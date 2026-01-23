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
                match_date
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
        // Fallback or re-throw?
        // return []
        // Let's return empty for now but log loudly
        return []
    }

    // Map DB shape to UI shape
    return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        tournamentId: item.tournament_id,
        allyConditions: typeof item.ally_conditions === 'string' ? JSON.parse(item.ally_conditions) : item.ally_conditions,
        enemyConditions: typeof item.enemy_conditions === 'string' ? JSON.parse(item.enemy_conditions) : item.enemy_conditions,
        createdAt: new Date(item.created_at).getTime(),
        result: item.last_result
    }))
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
