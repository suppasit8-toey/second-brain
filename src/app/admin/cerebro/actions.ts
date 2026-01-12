'use server'

import { createClient } from '@/utils/supabase/server'
import { Hero } from '@/utils/types'

export type CerebroMode = 'ALL' | 'SCRIM_SUMMARY' | 'FULL_SIMULATOR'

export async function getCerebroStats(versionId: number, mode: CerebroMode = 'ALL', tournamentId?: string, teamName?: string) {
    const supabase = await createClient()

    // 1. Fetch Matches filtered by Version and Mode
    let matchQuery = supabase
        .from('draft_matches')
        .select(`
            id,
            mode,
            match_type,
            tournament_id,
            games:draft_games(
                id,
                winner,
                blue_team_name,
                red_team_name,
                picks:draft_picks(
                    hero_id,
                    type,
                    side,
                    position_index,
                    assigned_role
                )
            )
        `)
        .eq('version_id', versionId)
        .eq('status', 'finished')

    // Filter by Mode
    if (mode === 'SCRIM_SUMMARY') {
        matchQuery = matchQuery.eq('match_type', 'scrim_summary')
    } else if (mode === 'FULL_SIMULATOR') {
        matchQuery = matchQuery.or('match_type.eq.scrim_simulator,match_type.eq.simulation')
    }

    // Filter by Tournament
    if (tournamentId && tournamentId !== 'ALL') {
        matchQuery = matchQuery.eq('tournament_id', tournamentId)
    }

    // Filter by Team (handled in memory or query? query is harder because it's in games or team_a/b names)
    // Team names are stored in draft_matches as team_a_name / team_b_name
    if (teamName) {
        // Simple OR filter on match level team names. Quote the string for safety.
        matchQuery = matchQuery.or(`team_a_name.eq."${teamName}",team_b_name.eq."${teamName}"`)
    }

    const { data: matches, error } = await matchQuery

    if (error) {
        console.error('Error fetching cerebro stats:', error)
        return null
    }

    // 2. Fetch All Heroes for lookup
    const { data: heroes } = await supabase.from('heroes').select('*')
    const heroMap = new Map<string, Hero>()
    heroes?.forEach((h: Hero) => heroMap.set(h.id, h))

    // 3. Aggregate Data
    const stats = {
        totalMatches: matches.length,
        totalGames: 0,
        blueWins: 0,
        redWins: 0,
        heroStats: {} as Record<string, {
            id: string,
            name: string,
            icon: string,
            picks: number,
            bans: number,
            wins: number,
            roleStats: Record<string, number>
        }>,
        teamStats: {} as Record<string, {
            name: string,
            games: number,
            wins: number
        }>,
        combos: {} as Record<string, { count: number, wins: number, heroes: [string, string] }>,
        firstPickWinRate: { wins: 0, total: 0 },
        pickOrderStats: {} as Record<number, Record<string, number>>, // Slot (1-5) -> Role -> Count
        banOrderStats: {} as Record<number, Record<string, number>>   // Slot (1-4) -> HeroId -> Count
    }

    // Initialize Pick Order Stats
    for (let i = 1; i <= 5; i++) stats.pickOrderStats[i] = {}
    // Initialize Ban Order Stats
    for (let i = 1; i <= 4; i++) stats.banOrderStats[i] = {}

    matches.forEach(match => {
        match.games.forEach((game: any) => {
            stats.totalGames++

            // Win/Loss
            if (game.winner === 'Blue') stats.blueWins++
            if (game.winner === 'Red') stats.redWins++

            // Team Stats
            const updateTeamParams = (name: string, isWin: boolean) => {
                const cleanName = name.trim()
                if (!stats.teamStats[cleanName]) {
                    stats.teamStats[cleanName] = { name: cleanName, games: 0, wins: 0 }
                }
                stats.teamStats[cleanName].games++
                if (isWin) stats.teamStats[cleanName].wins++
            }
            if (game.blue_team_name) updateTeamParams(game.blue_team_name, game.winner === 'Blue')
            if (game.red_team_name) updateTeamParams(game.red_team_name, game.winner === 'Red')

            // First Pick Win Rate (Blue is usually First Pick in standard draft, but depends on mode. Assuming Blue = FP)
            if (game.winner) stats.firstPickWinRate.total++
            if (game.winner === 'Blue') stats.firstPickWinRate.wins++

            // Process Picks & Bans
            const blueHeroIds: string[] = []
            const redHeroIds: string[] = []

            game.picks?.forEach((p: any) => {
                const heroId = p.hero_id
                const hero = heroMap.get(heroId)
                if (!hero) return

                if (!stats.heroStats[heroId]) {
                    stats.heroStats[heroId] = {
                        id: heroId,
                        name: hero.name,
                        icon: hero.icon_url,
                        picks: 0,
                        bans: 0,
                        wins: 0,
                        roleStats: {}
                    }
                }

                if (p.type === 'BAN') {
                    stats.heroStats[heroId].bans++

                    // Track Ban Order
                    if (match.match_type !== 'scrim_summary' && p.position_index && p.position_index >= 1 && p.position_index <= 4) {
                        const slot = p.position_index
                        stats.banOrderStats[slot][heroId] = (stats.banOrderStats[slot][heroId] || 0) + 1
                    }

                } else if (p.type === 'PICK') {
                    stats.heroStats[heroId].picks++

                    // Track Wins
                    const isBlueWin = game.winner === 'Blue'
                    const isRedWin = game.winner === 'Red'
                    if ((p.side === 'BLUE' && isBlueWin) || (p.side === 'RED' && isRedWin)) {
                        stats.heroStats[heroId].wins++
                    }

                    // Track Role
                    if (p.assigned_role) {
                        const r = p.assigned_role
                        stats.heroStats[heroId].roleStats[r] = (stats.heroStats[heroId].roleStats[r] || 0) + 1

                        // Track Pick Order (Role Priority) - Exclude Quick Results as they don't capture sequential pick order reliably
                        if (match.match_type !== 'scrim_summary' && p.position_index && p.position_index >= 1 && p.position_index <= 5) {
                            stats.pickOrderStats[p.position_index][r] = (stats.pickOrderStats[p.position_index][r] || 0) + 1
                        }
                    }

                    // Collect for combos
                    if (p.side === 'BLUE') blueHeroIds.push(heroId)
                    else redHeroIds.push(heroId)
                }
            })

            // Generate Combos (Pairwise for each team)
            const processCombos = (teamIds: string[], isWin: boolean) => {
                // sort to ensure unique key for pair A-B vs B-A
                teamIds.sort()
                for (let i = 0; i < teamIds.length; i++) {
                    for (let j = i + 1; j < teamIds.length; j++) {
                        const key = `${teamIds[i]}|${teamIds[j]}`
                        if (!stats.combos[key]) {
                            stats.combos[key] = { count: 0, wins: 0, heroes: [teamIds[i], teamIds[j]] }
                        }
                        stats.combos[key].count++
                        if (isWin) stats.combos[key].wins++
                    }
                }
            }

            if (game.winner === 'Blue') {
                processCombos(blueHeroIds, true)
                processCombos(redHeroIds, false)
            } else if (game.winner === 'Red') {
                processCombos(blueHeroIds, false)
                processCombos(redHeroIds, true)
            } else {
                processCombos(blueHeroIds, false)
                processCombos(redHeroIds, false)
            }
        })
    })

    return stats
}

export async function getVersions() {
    const supabase = await createClient()
    const { data } = await supabase.from('versions').select('*').order('start_date', { ascending: false })
    return data || []
}

export async function getTeamDetailedStats(teamName: string, versionId: number) {
    const supabase = await createClient()

    // 1. Get Team and Players
    // We need to match teamName to the team table. filtering by slug or name? 
    // The previous code used team_a_name string from matches. 
    // Let's try to find the team in 'teams' table first for roster.
    const { data: teamData, error: teamError } = await supabase
        .from('teams') // Check if table is 'teams' or 'tournaments'->'teams' joins? usually 'teams'
        .select(`
            id, 
            name, 
            players (
                id, 
                name, 
                positions,
                roster_role
            )
        `)
        .ilike('name', teamName) // Case insensitive match
        .single()

    // If no registered team found, we can still show stats but without player names
    const rosterMap: Record<string, string> = {}
    if (teamData?.players) {
        teamData.players.forEach((p: any) => {
            // Map Role to Player Name
            // If roster_role is set (e.g. 'Jungle'), use that.
            // Else try positions[0]
            const role = p.roster_role || (p.positions && p.positions[0])
            if (role) {
                // Normalize role string
                let cleanRole = role
                if (role === 'Dark Slayer' || role === 'DSL') cleanRole = 'Dark Slayer'
                if (role === 'Abyssal Dragon' || role === 'Abyssal' || role === 'ADL') cleanRole = 'Abyssal'
                if (role === 'Roam' || role === 'Support' || role === 'SUP') cleanRole = 'Roam'
                if (role === 'Mid' || role === 'Middle' || role === 'MID') cleanRole = 'Mid'
                if (role === 'Jungle' || role === 'JUG') cleanRole = 'Jungle'

                rosterMap[cleanRole] = p.name
            }
        })
    }

    // 2. Fetch Matches
    // Use the canonical name from DB if found, otherwise use the provided name
    const searchName = teamData ? teamData.name : teamName

    const { data: matches } = await supabase
        .from('draft_matches')
        .select(`
            id,
            match_type,
            games:draft_games(
                id,
                winner,
                blue_team_name,
                red_team_name,
                picks:draft_picks(
                    hero_id,
                    type,
                    side,
                    position_index,
                    assigned_role
                )
            )
        `)
        .eq('version_id', versionId)
        .eq('status', 'finished')
        .or(`team_a_name.eq."${searchName}",team_b_name.eq."${searchName}"`)

    if (!matches) return null

    // 3. Fetch Heroes for names
    const { data: heroes } = await supabase.from('heroes').select('id, name, icon_url')
    const heroMap = new Map<string, any>()
    heroes?.forEach((h: any) => heroMap.set(h.id, h))

    // 4. Analytics Container
    const stats = {
        meta: {
            teamName: searchName,
            totalGames: 0,
            wins: 0
        },
        roles: {
            'Dark Slayer': { player: rosterMap['Dark Slayer'] || 'DSL', heroes: {}, matchups: {} },
            'Jungle': { player: rosterMap['Jungle'] || 'Jungle', heroes: {}, matchups: {} },
            'Mid': { player: rosterMap['Mid'] || 'Mid', heroes: {}, matchups: {} },
            'Abyssal': { player: rosterMap['Abyssal'] || 'Carry', heroes: {}, matchups: {} },
            'Roam': { player: rosterMap['Roam'] || 'Support', heroes: {}, matchups: {} },
        } as Record<string, {
            player: string,
            heroes: Record<string, { picks: number, wins: number, bansAgainst: number }>,
            matchups: Record<string, { games: number, wins: number }> // EnemyHeroId -> Stats
        }>
    }

    matches.forEach(match => {
        match.games.forEach((game: any) => {
            // Identify Side
            let mySide: 'BLUE' | 'RED' | null = null
            if (game.blue_team_name === searchName) mySide = 'BLUE'
            else if (game.red_team_name === searchName) mySide = 'RED'

            if (!mySide) return // Should not happen given query

            const isWin = (game.winner === 'Blue' && mySide === 'BLUE') || (game.winner === 'Red' && mySide === 'RED')

            stats.meta.totalGames++
            if (isWin) stats.meta.wins++

            // Process Picks
            // We need to pair My Role vs Enemy Role
            // First, map roles for this game
            const myPicks: Record<string, string> = {} // Role -> HeroID
            const enemyPicks: Record<string, string> = {} // Role -> HeroID

            game.picks?.forEach((p: any) => {
                if (p.type === 'PICK' && p.assigned_role) {
                    if (p.side === mySide) {
                        myPicks[p.assigned_role] = p.hero_id
                    } else {
                        enemyPicks[p.assigned_role] = p.hero_id
                    }
                }
            })

            // Update Stats per Role
            Object.keys(stats.roles).forEach(role => {
                const myHeroId = myPicks[role]
                const enemyHeroId = enemyPicks[role]

                if (myHeroId) {
                    const roleStats = stats.roles[role]

                    // Update Hero Stats
                    if (!roleStats.heroes[myHeroId]) {
                        roleStats.heroes[myHeroId] = { picks: 0, wins: 0, bansAgainst: 0 }
                    }
                    roleStats.heroes[myHeroId].picks++
                    if (isWin) roleStats.heroes[myHeroId].wins++

                    // Update Matchup Stats (if enemy exists)
                    if (enemyHeroId) {
                        if (!roleStats.matchups[enemyHeroId]) {
                            roleStats.matchups[enemyHeroId] = { games: 0, wins: 0 }
                        }
                        roleStats.matchups[enemyHeroId].games++
                        if (isWin) roleStats.matchups[enemyHeroId].wins++
                    }
                }
            })
        })
    })

    return { stats, heroMap: Object.fromEntries(heroMap) }
}
