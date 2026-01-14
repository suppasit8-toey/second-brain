'use server'

import { createClient } from '@/utils/supabase/server'
import { Hero } from '@/utils/types'

export interface HeroPoolStat {
    hero: Hero;
    picks: number;
    wins: number;
    winRate: number;
    roles: string[];
}

export interface TeamPoolData {
    teamId: string;
    teamName: string;
    teamLogo: string | null;
    totalGames: number;
    totalWins: number;
    pool: Record<string, HeroPoolStat>; // key is heroId
}

export async function getTournamentTeamPools(tournamentId: string) {
    const supabase = await createClient()

    // 1. Fetch Tournament Context (Teams)
    // We only care about teams IN this tournament
    const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .eq('tournament_id', tournamentId)

    if (teamError || !teams) return { error: 'Failed to fetch teams' }

    // 2. Fetch Matches for this Tournament
    const { data: matches, error: matchError } = await supabase
        .from('draft_matches')
        .select(`
            id,
            team_a_name, team_b_name,
            games:draft_games(
                id,
                winner,
                blue_team_name,
                red_team_name,
                picks:draft_picks(
                    hero_id,
                    side,
                    type,
                    assigned_role,
                    hero:heroes(id, name, icon_url, main_position)
                )
            )
        `)
        .eq('tournament_id', tournamentId)
        .eq('status', 'finished')

    if (matchError) return { error: 'Failed to fetch matches' }

    // 3. Aggregate Data
    // We need to map team Names to Team IDs because matches store Names (string) 
    // but we want to confirm they belong to our structured Teams list.
    const teamMap = new Map<string, string>() // Name -> ID
    const resultMap = new Map<string, TeamPoolData>() // ID -> Data

    // Initialize Result Map
    teams.forEach(t => {
        teamMap.set(t.name, t.id)
        resultMap.set(t.id, {
            teamId: t.id,
            teamName: t.name,
            teamLogo: t.logo_url,
            totalGames: 0,
            totalWins: 0,
            pool: {}
        })
    })

    // Process Games
    matches?.forEach(m => {
        m.games?.forEach((g: any) => {
            if (!g.picks) return

            // Identify Teams (Matches use names, we map to IDs)
            const blueTeamId = teamMap.get(g.blue_team_name)
            const redTeamId = teamMap.get(g.red_team_name)

            // Only process if the team is part of this tournament's registered teams
            if (blueTeamId) processGameSide(blueTeamId, 'Blue', g)
            if (redTeamId) processGameSide(redTeamId, 'Red', g)
        })
    })

    function processGameSide(teamId: string, side: 'Blue' | 'Red', game: any) {
        const data = resultMap.get(teamId)!
        const isWin = game.winner === side

        data.totalGames++
        if (isWin) data.totalWins++

        const myPicks = game.picks.filter((p: any) => p.side === side.toUpperCase() && p.type === 'PICK')

        myPicks.forEach((p: any) => {
            if (!p.hero) return

            if (!data.pool[p.hero.id]) {
                data.pool[p.hero.id] = {
                    hero: p.hero,
                    picks: 0,
                    wins: 0,
                    winRate: 0,
                    roles: []
                }
            }

            const stat = data.pool[p.hero.id]
            stat.picks++
            if (isWin) stat.wins++

            // Track Role
            // Prefer assigned_role from history, fallback to first main_position
            const role = p.assigned_role || p.hero.main_position?.[0] || 'Unknown'
            if (!stat.roles.includes(role)) {
                stat.roles.push(role)
            }
        })
    }

    // Final Calculations (Win Rates)
    const results = Array.from(resultMap.values()).map(t => {
        Object.values(t.pool).forEach(stat => {
            stat.winRate = (stat.wins / stat.picks) * 100
        })
        return t
    })

    return { data: results }
}
