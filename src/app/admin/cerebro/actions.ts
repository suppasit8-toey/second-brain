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
            team_a_name,
            team_b_name,
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

    // Filter by Team
    if (teamName) {
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
        gamesOnBlue: 0,
        gamesOnRed: 0,
        winsOnBlue: 0, // NEW: Wins when playing on Blue
        winsOnRed: 0,  // NEW: Wins when playing on Red
        simulatorGames: 0,          // NEW: Only Full Simulator games
        simulatorGamesOnBlue: 0,    // NEW: Full Simulator on Blue
        simulatorGamesOnRed: 0,     // NEW: Full Simulator on Red
        heroStats: {} as Record<string, {
            id: string,
            name: string,
            icon: string,
            picks: number,
            bans: number,
            bansPhase1: number,
            bansPhase2: number,
            wins: number,
            roleStats: Record<string, { picks: number, wins: number }>
        }>,
        teamStats: {} as Record<string, {
            name: string,
            games: number,
            wins: number
        }>,
        combos: {} as Record<string, { count: number, wins: number, heroes: [string, string] }>,
        firstPickWinRate: { wins: 0, total: 0 },
        // Global Stats (Legacy/Total)
        pickOrderStats: {} as Record<number, Record<string, number>>,
        banOrderStats: {} as Record<number, Record<string, number>>,
        roster: {} as Record<string, string>,

        // NEW: Side-Specific Draft Stats
        sideStats: {
            BLUE: {
                pickOrderStats: {} as Record<number, Record<string, number>>,
                banOrderStats: {} as Record<number, Record<string, number>>,
                heroBans: {} as Record<string, number>
            },
            RED: {
                pickOrderStats: {} as Record<number, Record<string, number>>,
                banOrderStats: {} as Record<number, Record<string, number>>,
                heroBans: {} as Record<string, number>
            }
        }
    }

    // Initialize Order Stats Helpers
    const initOrderStats = (target: Record<number, any>, max: number) => {
        for (let i = 1; i <= max; i++) target[i] = {}
    }

    // Initialize Global
    initOrderStats(stats.pickOrderStats, 20)
    initOrderStats(stats.banOrderStats, 20)

    // Initialize Sides
    initOrderStats(stats.sideStats.BLUE.pickOrderStats, 20)
    initOrderStats(stats.sideStats.BLUE.banOrderStats, 20)
    initOrderStats(stats.sideStats.RED.pickOrderStats, 20)
    initOrderStats(stats.sideStats.RED.banOrderStats, 20)

    // NEW: If analyzing specific team, fetch roster code names
    if (teamName) {
        const { data: teamData } = await supabase
            .from('teams')
            .select(`
                players (
                    name, 
                    positions,
                    roster_role
                )
            `)
            .ilike('name', teamName)
            .single()

        if (teamData?.players) {
            teamData.players.forEach((p: any) => {
                const role = p.roster_role || (p.positions && p.positions[0])
                if (role) {
                    let cleanRole = role
                    if (role === 'Dark Slayer' || role === 'DSL') cleanRole = 'Dark Slayer'
                    if (role === 'Abyssal Dragon' || role === 'Abyssal' || role === 'ADL') cleanRole = 'Abyssal'
                    if (role === 'Roam' || role === 'Support' || role === 'SUP') cleanRole = 'Roam'
                    if (role === 'Mid' || role === 'Middle' || role === 'MID') cleanRole = 'Mid'
                    if (role === 'Jungle' || role === 'JUG') cleanRole = 'Jungle'

                    stats.roster[cleanRole] = p.name
                }
            })
        }
    }

    matches.forEach(match => {
        match.games.forEach((game: any) => {
            stats.totalGames++

            // Win/Loss
            if (game.winner === 'Blue') stats.blueWins++
            if (game.winner === 'Red') stats.redWins++

            const isSimulator = match.match_type === 'scrim_simulator' || match.match_type === 'simulation';
            if (isSimulator) stats.simulatorGames++;

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

            // First Pick Win Rate
            if (game.winner) stats.firstPickWinRate.total++
            if (game.winner === 'Blue') stats.firstPickWinRate.wins++

            // Determine Target Side if filtering by Team & Track Side Counts
            let targetSide: 'BLUE' | 'RED' | null = null;
            if (teamName) {
                // Determine which side the target team is on for this game
                const blueName = (game.blue_team_name || '').trim();
                const redName = (game.red_team_name || '').trim();

                // We use simple equality check. 
                // Note: teamName passed in is "Buriram United Esports". DB might have "Buriram United Esports " (trimmed generally ok).
                if (blueName === teamName || blueName.includes(teamName)) { // includes fallback
                    targetSide = 'BLUE';
                    stats.gamesOnBlue++;
                    if (game.winner === 'Blue') stats.winsOnBlue++;
                    if (isSimulator) stats.simulatorGamesOnBlue++;
                } else if (redName === teamName || redName.includes(teamName)) {
                    targetSide = 'RED';
                    stats.gamesOnRed++;
                    if (game.winner === 'Red') stats.winsOnRed++;
                    if (isSimulator) stats.simulatorGamesOnRed++;
                }
            }

            // Process Picks & Bans
            const blueHeroIds: string[] = []
            const redHeroIds: string[] = []

            game.picks?.forEach((p: any) => {
                let pSideRaw = p.side;
                // Normalize side
                let pSide = (pSideRaw || '').toUpperCase();
                // FIX: Handle verbose side names if present
                if (pSide === 'BLUE SIDE') pSide = 'BLUE';
                if (pSide === 'RED SIDE') pSide = 'RED';

                // FALLBACK: If BAN and Side is missing, infer from Position Index (AOV Standard)
                if (p.type === 'BAN' && !pSide && p.position_index) {
                    // Global Ban Pick (Tournament Mode)
                    // Phase 1: Blue(1) -> Red(2) -> Blue(3) -> Red(4)
                    // Phase 2: Red(5) -> Blue(6) -> Red(7) -> Blue(8)
                    if ([1, 3, 6, 8].includes(p.position_index)) pSide = 'BLUE';
                    else if ([2, 4, 5, 7].includes(p.position_index)) pSide = 'RED';
                }

                // FILTER: If analyzing a specific team, ONLY process picks/bans from that team's side
                if (teamName && targetSide && pSide !== targetSide) return;
                if (teamName && !targetSide) return;

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
                        bansPhase1: 0,
                        bansPhase2: 0,
                        wins: 0,
                        roleStats: {}
                    }
                }

                if (p.type === 'BAN') {
                    stats.heroStats[heroId].bans++

                    // Track Phases
                    if (p.position_index) {
                        if (p.position_index <= 4) stats.heroStats[heroId].bansPhase1++;
                        else if (p.position_index <= 8 || (p.position_index >= 11 && p.position_index <= 14)) stats.heroStats[heroId].bansPhase2++;
                    }

                    // Populate Side Stats - Bans
                    if (pSide === 'BLUE' || pSide === 'RED') {
                        const sideKey = pSide as 'BLUE' | 'RED';
                        if (stats.sideStats[sideKey]) {
                            stats.sideStats[sideKey].heroBans[heroId] = (stats.sideStats[sideKey].heroBans[heroId] || 0) + 1;
                        }
                    }

                    // Track Ban Order (Strictly for Simulator matches - Phase 1: 1-4, Phase 2: 11-14)
                    if (isSimulator && p.position_index && p.position_index >= 1 && p.position_index <= 14) {
                        const slot = p.position_index
                        stats.banOrderStats[slot][heroId] = (stats.banOrderStats[slot][heroId] || 0) + 1

                        // Side Specific Ban Order
                        if ((pSide === 'BLUE' || pSide === 'RED') && stats.sideStats[pSide as 'BLUE' | 'RED']) {
                            const sideKey = pSide as 'BLUE' | 'RED';
                            stats.sideStats[sideKey].banOrderStats[slot][heroId] = (stats.sideStats[sideKey].banOrderStats[slot][heroId] || 0) + 1;
                        }
                    }

                } else if (p.type === 'PICK') {
                    stats.heroStats[heroId].picks++

                    const isBlueWin = game.winner === 'Blue'
                    const isRedWin = game.winner === 'Red'
                    const isWin = (pSide === 'BLUE' && isBlueWin) || (pSide === 'RED' && isRedWin);

                    // Track Wins
                    if (isWin) {
                        stats.heroStats[heroId].wins++
                    }

                    // Track Role
                    if (p.assigned_role) {
                        const r = p.assigned_role
                        if (!stats.heroStats[heroId].roleStats[r]) {
                            stats.heroStats[heroId].roleStats[r] = { picks: 0, wins: 0 }
                        }
                        stats.heroStats[heroId].roleStats[r].picks++
                        if (isWin) {
                            stats.heroStats[heroId].roleStats[r].wins++
                        }

                        // Track Pick Order (Role Priority) (Strictly for Simulator matches)
                        if (isSimulator && p.position_index && p.position_index >= 1 && p.position_index <= 20) {
                            stats.pickOrderStats[p.position_index][r] = (stats.pickOrderStats[p.position_index][r] || 0) + 1

                            // Side Specific Pick Order
                            if ((pSide === 'BLUE' || pSide === 'RED') && stats.sideStats[pSide as 'BLUE' | 'RED']) {
                                const sideKey = pSide as 'BLUE' | 'RED';
                                stats.sideStats[sideKey].pickOrderStats[p.position_index][r] = (stats.sideStats[sideKey].pickOrderStats[p.position_index][r] || 0) + 1;
                            }
                        }
                    }

                    // Collect for combos
                    if (pSide === 'BLUE') blueHeroIds.push(heroId)
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

// ... getTeamDetailedStats remains unchanged ...
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
        .or(`name.ilike."${teamName.trim()}",short_name.ilike."${teamName.trim()}",slug.ilike."${teamName.trim()}"`)
        .limit(1)
        .maybeSingle()

    console.log(`[Cerebro] getTeamDetailedStats for ${teamName}:`, {
        found: !!teamData,
        id: teamData?.id,
        playerCount: teamData?.players?.length,
        players: teamData?.players
    })

    if (teamError) console.error('[Cerebro] Team Fetch Error:', teamError)

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
    const dbName = teamData ? teamData.name : teamName

    const matchQueryFilters = [
        `team_a_name.eq."${dbName}"`,
        `team_b_name.eq."${dbName}"`,
        `team_a_name.eq."${teamName}"`,
        `team_b_name.eq."${teamName}"`
    ].join(',')

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
        .or(matchQueryFilters)

    if (!matches) return null

    // 3. Fetch Heroes for names
    const { data: heroes } = await supabase.from('heroes').select('id, name, icon_url')
    const heroMap = new Map<string, any>()
    heroes?.forEach((h: any) => heroMap.set(h.id, h))

    // 4. Analytics Container
    const stats = {
        meta: {
            teamName: dbName,
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
            // Check against both DB Name and URL Name for robustness against dirty data
            const blue = game.blue_team_name
            const red = game.red_team_name

            if (blue === dbName || blue === teamName) mySide = 'BLUE'
            else if (red === dbName || red === teamName) mySide = 'RED'

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
                let pSideRaw = p.side;
                // Normalize side just in case (though DB should be strict)
                let pSide = (pSideRaw || '').toUpperCase();
                // FIX: Handle verbose side names if present
                if (pSide === 'BLUE SIDE') pSide = 'BLUE';
                if (pSide === 'RED SIDE') pSide = 'RED';

                // FALLBACK: If BAN and Side is missing, infer from Position Index (AOV Standard)
                if (p.type === 'BAN' && !pSide && p.position_index) {
                    // Global Ban Pick (Tournament Mode)
                    // Phase 1: Blue(1) -> Red(2) -> Blue(3) -> Red(4)
                    // Phase 2: Red(5) -> Blue(6) -> Red(7) -> Blue(8)
                    if ([1, 3, 6, 8].includes(p.position_index)) pSide = 'BLUE';
                    else if ([2, 4, 5, 7].includes(p.position_index)) pSide = 'RED';
                }

                if (p.type === 'PICK' && p.assigned_role) {
                    if (pSide === mySide) {
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
