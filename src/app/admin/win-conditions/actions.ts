'use server'

import { createClient } from '@/utils/supabase/server'

interface ConditionItem {
    id: string;
    heroId: string;
    role: string;
}

interface AnalysisFilters {
    version: string; // This is likely the version ID or Name. Using Name for now as per form, but ID is better.
    patch: string;   // Keeping for UI, but might just be same as version in current schema.
    tournamentId?: string;
    allyConditions: ConditionItem[];
    enemyConditions: ConditionItem[];
}

export async function analyzeWinCondition(filters: AnalysisFilters) {
    const supabase = await createClient()

    // 2. Fetch all finished games with their picks AND match info
    let query = supabase
        .from('draft_games')
        .select(`
            id,
            winner,
            status,
            blue_team_name,
            red_team_name,
            draft_matches!inner (
                id,
                tournament_id,
                match_date,
                slug,
                match_type
            ),
            draft_picks (
                hero_id,
                side,
                assigned_role
            )
        `)
        .eq('status', 'finished')

    // Filter by Tournament if specified
    if (filters.tournamentId) {
        query = query.eq('draft_matches.tournament_id', filters.tournamentId)
    }

    const { data: games, error } = await query

    if (error) {
        return { success: false, message: error.message }
    }

    if (!games) return { success: true, winRate: 0, totalMatches: 0, winCount: 0, lossCount: 0, teamStats: [], matches: [] }

    const detailedMatches: any[] = []
    const teamStatsMap = new Map<string, { wins: number, matches: number }>()

    const matchingGames: any[] = []

    for (const game of games) {
        const bluePicks = game.draft_picks.filter((p: any) => p.side === 'BLUE')
        const redPicks = game.draft_picks.filter((p: any) => p.side === 'RED')

        // Helper to check conditions
        const teamMatches = (teamPicks: any[], conditions: ConditionItem[], mustHave: boolean) => {
            if (conditions.length === 0) return true;

            if (mustHave) {
                // Must have ALL
                return conditions.every(cond => {
                    return teamPicks.some((pick: any) => {
                        const heroMatch = !cond.heroId || pick.hero_id === cond.heroId
                        const roleMatch = cond.role === 'ANY' || (pick.assigned_role && pick.assigned_role.toLowerCase() === cond.role.toLowerCase())
                        return heroMatch && roleMatch
                    })
                })
            } else {
                // Must NOT have ANY
                return !conditions.some(cond => {
                    return teamPicks.some((pick: any) => {
                        const heroMatch = !cond.heroId || pick.hero_id === cond.heroId
                        const roleMatch = cond.role === 'ANY' || (pick.assigned_role && pick.assigned_role.toLowerCase() === cond.role.toLowerCase())
                        return heroMatch && roleMatch
                    })
                })
            }
        }

        // Check Perspective: Blue is "Us"
        const blueIsAlly = teamMatches(bluePicks, filters.allyConditions, true) && teamMatches(redPicks, filters.enemyConditions, false)

        // Check Perspective: Red is "Us"
        const redIsAlly = teamMatches(redPicks, filters.allyConditions, true) && teamMatches(bluePicks, filters.enemyConditions, false)

        let matchedPerspective = null
        if (blueIsAlly) matchedPerspective = 'BLUE'
        else if (redIsAlly) matchedPerspective = 'RED'

        if (matchedPerspective) {
            const isWin = (matchedPerspective === 'BLUE' && game.winner === 'Blue') || (matchedPerspective === 'RED' && game.winner === 'Red')
            const teamName = matchedPerspective === 'BLUE' ? game.blue_team_name : game.red_team_name
            const enemyName = matchedPerspective === 'BLUE' ? game.red_team_name : game.blue_team_name

            // Record Detail
            detailedMatches.push({
                gameId: game.id,
                matchId: (game.draft_matches as any)?.id,
                matchSlug: (game.draft_matches as any)?.slug,
                matchType: (game.draft_matches as any)?.match_type,
                date: (game.draft_matches as any)?.match_date,
                team: teamName,
                enemy: enemyName,
                result: isWin ? 'WIN' : 'LOSS',
                side: matchedPerspective
            })

            // Aggregate Team Stats
            if (teamName) {
                const current = teamStatsMap.get(teamName) || { wins: 0, matches: 0 }
                teamStatsMap.set(teamName, {
                    wins: current.wins + (isWin ? 1 : 0),
                    matches: current.matches + 1
                })
            }

            // Store for overall calculation
            (game as any)._result = isWin ? 'WIN' : 'LOSS'
            matchingGames.push(game)
        }
    }

    // Calculate Overall Stats
    let wins = 0
    let total = matchingGames.length

    matchingGames.forEach((game: any) => {
        if (game._result === 'WIN') wins++
    })

    const winRate = total > 0 ? (wins / total) * 100 : 0

    // Format Team Stats array
    const teamStats = Array.from(teamStatsMap.entries()).map(([name, stats]) => ({
        name,
        matches: stats.matches,
        wins: stats.wins,
        winRate: (stats.wins / stats.matches) * 100
    })).sort((a, b) => b.matches - a.matches) // Sort by most played

    return {
        success: true,
        totalMatches: total,
        winCount: wins,
        lossCount: total - wins,
        winRate: parseFloat(winRate.toFixed(2)),
        teamStats,
        matches: detailedMatches
    }
}

export async function getWinConditions() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('win_conditions')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching win conditions:', JSON.stringify(error, null, 2))
        return []
    }

    // Process in parallel
    const conditions = await Promise.all(data.map(async (item: any) => {
        const allyConditions = typeof item.ally_conditions === 'string' ? JSON.parse(item.ally_conditions) : item.ally_conditions
        const enemyConditions = typeof item.enemy_conditions === 'string' ? JSON.parse(item.enemy_conditions) : item.enemy_conditions

        // Re-run analysis to get fresh stats (including teamStats)
        const result = await analyzeWinCondition({
            allyConditions,
            enemyConditions,
            tournamentId: item.tournament_id,
            version: item.version,
            patch: ''
        })

        return {
            id: item.id,
            name: item.name,
            version: item.version,
            tournamentId: item.tournament_id,
            allyConditions,
            enemyConditions,
            createdAt: new Date(item.created_at).getTime(),
            result: result // Use fresh result instead of stale item.last_result
        }
    }))

    return conditions
}

export async function createWinCondition(data: any) {
    const supabase = await createClient()

    // 1. Insert
    const { data: newCondition, error } = await supabase
        .from('win_conditions')
        .insert({
            name: data.name,
            version: data.version,
            tournament_id: data.tournamentId,
            ally_conditions: data.allyConditions, // Supabase handles JSON array automatically usually
            enemy_conditions: data.enemyConditions,
            last_result: data.result
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating win condition:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: newCondition }
}

export async function updateWinCondition(id: string, data: any) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('win_conditions')
        .update({
            name: data.name,
            version: data.version,
            tournament_id: data.tournamentId,
            ally_conditions: data.allyConditions,
            enemy_conditions: data.enemyConditions,
            // Note: We might want to clear 'last_result' here if the definition changes, 
            // but 'analyzeWinCondition' will likely be called immediately after anyway.
            last_result: null
        })
        .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function deleteWinCondition(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('win_conditions')
        .delete()
        .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function updateWinConditionResult(id: string, result: any) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('win_conditions')
        .update({ last_result: result })
        .eq('id', id)

    if (error) console.error("Failed to update cache", error)
}

export async function getWinCondition(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('win_conditions')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching win condition:', error)
        return null
    }

    return {
        id: data.id,
        name: data.name,
        version: data.version,
        tournamentId: data.tournament_id,
        allyConditions: typeof data.ally_conditions === 'string' ? JSON.parse(data.ally_conditions) : data.ally_conditions,
        enemyConditions: typeof data.enemy_conditions === 'string' ? JSON.parse(data.enemy_conditions) : data.enemy_conditions,
        createdAt: new Date(data.created_at).getTime(),
        result: data.last_result
    }
}

export async function getDynamicWinConditions(teamName?: string) {
    const supabase = await createClient()

    // 1. Get Active Version ID for Matchup Data
    const { data: activeVersion } = await supabase.from('versions').select('id').eq('is_active', true).single()
    const versionId = activeVersion?.id

    // 2. Fetch Matchup Data (known counters) if version exists
    let matchupMap = new Map<string, number>() // key: heroId|enemyId, value: winRate (My Win Rate)
    if (versionId) {
        // Fetch ALL matchups for this version to be safe, or we could filter by specific heroes later
        // For performance, let's fetch all (usually < 2000 rows) or optimize if needed.
        const { data: matchups } = await supabase
            .from('matchups')
            .select('hero_id, enemy_hero_id, win_rate')
            .eq('version_id', versionId)

        matchups?.forEach((m: any) => {
            // Store My Win Rate against Enemy
            matchupMap.set(`${m.hero_id}|${m.enemy_hero_id}`, m.win_rate)
        })
    }

    // 3. Fetch all finished games
    let query = supabase
        .from('draft_games')
        .select(`
            id,
            winner,
            blue_team_name,
            red_team_name,
            draft_picks ( hero_id, side, assigned_role, type )
        `)
        .eq('status', 'finished')

    // If teamName is provided, only look for games where this team played
    if (teamName) {
        query = query.or(`blue_team_name.eq.${teamName},red_team_name.eq.${teamName}`)
    }

    const { data: games, error } = await query

    if (error || !games) {
        console.error('Error fetching dynamic conditions:', error)
        return []
    }

    // Map: "HeroA_HeroB" -> { wins, total, heroes: [id, id], enemyStats: Map<heroId, { wins: number, losses: number }> }
    const duoStats = new Map<string, {
        wins: number,
        total: number,
        heroes: string[],
        roles: string[],
        enemyStats: Map<string, { wins: number, losses: number }>
    }>()

    games.forEach((game: any) => {
        const winner = game.winner?.trim().toUpperCase()
        const blueWin = winner === 'BLUE'
        const redWin = winner === 'RED'

        const processTeam = (side: string, isWin: boolean) => {
            const picks = game.draft_picks.filter((p: any) => p.side === side && p.type === 'PICK')
            const enemyPicks = game.draft_picks.filter((p: any) => p.side !== side && p.type === 'PICK') // Only consider picks

            // Sort picks by ID to ensure consistent key generation
            picks.sort((a: any, b: any) => parseInt(a.hero_id) - parseInt(b.hero_id))

            for (let i = 0; i < picks.length; i++) {
                for (let j = i + 1; j < picks.length; j++) {
                    const p1 = picks[i]
                    const p2 = picks[j]

                    const key = `${p1.hero_id}_${p2.hero_id}`

                    const entry = duoStats.get(key) || {
                        wins: 0,
                        total: 0,
                        heroes: [p1.hero_id, p2.hero_id],
                        roles: [p1.assigned_role || 'FLEX', p2.assigned_role || 'FLEX'],
                        enemyStats: new Map()
                    }

                    entry.total++
                    if (isWin) entry.wins++

                    // Track Enemy Heroes
                    enemyPicks.forEach((ep: any) => {
                        const eStat = entry.enemyStats.get(ep.hero_id) || { wins: 0, losses: 0 }
                        if (isWin) eStat.wins++
                        else eStat.losses++ // If we lost, this enemy contributed to loss
                        entry.enemyStats.set(ep.hero_id, eStat)
                    })

                    duoStats.set(key, entry)
                }
            }
        }

        processTeam('BLUE', blueWin)
        processTeam('RED', redWin)
    })

    // Convert to Array & Filter
    return Array.from(duoStats.entries())
        .map(([key, stats]) => {
            const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0

            // Find Top Threats (Enemies that cause losses OR are known counters)
            // Score = Losses + Bonus (from Matchup Data)
            const scoredThreats = Array.from(stats.enemyStats.entries())
                .map(([hId, s]) => {
                    let score = s.losses * 1.0 // Base score is raw losses

                    // Matchup Data Bonus
                    // Check if hId (Enemy) counters p1 or p2
                    const [myH1, myH2] = stats.heroes

                    // Check vs Hero 1
                    const wr1 = matchupMap.get(`${myH1}|${hId}`) // My WR vs Enemy
                    if (wr1 !== undefined) {
                        if (wr1 < 40) score += 3.0 // Hard Counter
                        else if (wr1 < 48) score += 1.5 // Soft Counter
                    }

                    // Check vs Hero 2
                    const wr2 = matchupMap.get(`${myH2}|${hId}`)
                    if (wr2 !== undefined) {
                        if (wr2 < 40) score += 3.0
                        else if (wr2 < 48) score += 1.5
                    }

                    return { heroId: hId, losses: s.losses, score, total: s.wins + s.losses }
                })
                .filter(t => t.score > 0) // Keep anything that has negative impact
                .sort((a, b) => b.score - a.score) // Sort by Impact Score
                .slice(0, 10) // Top 10 threats
                .map(t => t.heroId)

            return {
                id: `duo_${key}`,
                heroes: stats.heroes,
                roles: stats.roles,
                winRate: Math.round(winRate),
                total: stats.total,
                type: 'DUO',
                avoidHeroes: scoredThreats
            }
        })
        .filter(item => item.total >= 3 && item.winRate >= 60 && !item.roles.some(r => r.toUpperCase().includes('FLEX'))) // Threshold
        .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
        .slice(0, 8) // Top 8 Duos
}
