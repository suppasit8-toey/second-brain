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

export interface MatchTeamPoolData {
    teamName: string;
    totalGames: number;
    totalWins: number;
    pool: HeroPoolStat[];
}

/**
 * Helper to clean team name - removes "(BOT)" suffix for proper DB matching
 */
const cleanTeamName = (name: string): string => {
    return name.replace(/\s*\(BOT\)\s*$/i, '').trim()
}

/**
 * Get hero pool stats for two specific teams from ALL their historical matches
 * This is used in the Draft Simulator's Team Hero Pool tab
 */
export async function getMatchTeamPools(teamAName: string, teamBName: string) {
    const supabase = await createClient()

    // Clean team names (remove "(BOT)" suffix for proper matching)
    const cleanedTeamA = cleanTeamName(teamAName)
    const cleanedTeamB = cleanTeamName(teamBName)

    // Fetch all finished games where either team played
    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
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
            ),
            match:draft_matches!inner(status, match_type, team_a_name, team_b_name)
        `)
        .or(`blue_team_name.ilike.%${cleanedTeamA}%,red_team_name.ilike.%${cleanedTeamA}%,blue_team_name.ilike.%${cleanedTeamB}%,red_team_name.ilike.%${cleanedTeamB}%`)
        .neq('match.status', 'ongoing')
        .in('match.match_type', ['scrim', 'scrim_summary', 'scrim_simulator', 'simulation', null])
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[getMatchTeamPools] Error:', error)
        return { error: 'Failed to fetch games' }
    }

    // Initialize team stats
    const teamAStats: Record<string, HeroPoolStat> = {}
    const teamBStats: Record<string, HeroPoolStat> = {}
    let teamAGames = 0, teamAWins = 0
    let teamBGames = 0, teamBWins = 0

    // Process each game
    games?.forEach((g: any) => {
        if (!g.picks) return

        const blueTeamLower = g.blue_team_name?.toLowerCase()?.trim()
        const redTeamLower = g.red_team_name?.toLowerCase()?.trim()
        const teamALower = cleanedTeamA.toLowerCase().trim()
        const teamBLower = cleanedTeamB.toLowerCase().trim()

        // Check if Team A is Blue or Red
        const teamAIsBlue = blueTeamLower?.includes(teamALower) || teamALower?.includes(blueTeamLower)
        const teamAIsRed = redTeamLower?.includes(teamALower) || teamALower?.includes(redTeamLower)
        const teamBIsBlue = blueTeamLower?.includes(teamBLower) || teamBLower?.includes(blueTeamLower)
        const teamBIsRed = redTeamLower?.includes(teamBLower) || teamBLower?.includes(redTeamLower)

        // Process Team A if they played this game
        if (teamAIsBlue || teamAIsRed) {
            const side = teamAIsBlue ? 'BLUE' : 'RED'
            const isWin = (g.winner === 'Blue' && teamAIsBlue) || (g.winner === 'Red' && teamAIsRed)

            teamAGames++
            if (isWin) teamAWins++

            g.picks.filter((p: any) => p.side === side && p.type === 'PICK').forEach((p: any) => {
                if (!p.hero) return

                if (!teamAStats[p.hero.id]) {
                    teamAStats[p.hero.id] = {
                        hero: p.hero,
                        picks: 0,
                        wins: 0,
                        winRate: 0,
                        roles: []
                    }
                }

                const stat = teamAStats[p.hero.id]
                stat.picks++
                if (isWin) stat.wins++

                const role = p.assigned_role || p.hero.main_position?.[0] || 'Unknown'
                if (!stat.roles.includes(role)) stat.roles.push(role)
            })
        }

        // Process Team B if they played this game
        if (teamBIsBlue || teamBIsRed) {
            const side = teamBIsBlue ? 'BLUE' : 'RED'
            const isWin = (g.winner === 'Blue' && teamBIsBlue) || (g.winner === 'Red' && teamBIsRed)

            teamBGames++
            if (isWin) teamBWins++

            g.picks.filter((p: any) => p.side === side && p.type === 'PICK').forEach((p: any) => {
                if (!p.hero) return

                if (!teamBStats[p.hero.id]) {
                    teamBStats[p.hero.id] = {
                        hero: p.hero,
                        picks: 0,
                        wins: 0,
                        winRate: 0,
                        roles: []
                    }
                }

                const stat = teamBStats[p.hero.id]
                stat.picks++
                if (isWin) stat.wins++

                const role = p.assigned_role || p.hero.main_position?.[0] || 'Unknown'
                if (!stat.roles.includes(role)) stat.roles.push(role)
            })
        }
    })

    // Calculate win rates and sort by picks
    const processPool = (stats: Record<string, HeroPoolStat>): HeroPoolStat[] => {
        return Object.values(stats)
            .map(stat => ({
                ...stat,
                winRate: stat.picks > 0 ? (stat.wins / stat.picks) * 100 : 0
            }))
            .sort((a, b) => b.picks - a.picks)
    }

    return {
        data: {
            teamA: {
                teamName: teamAName,
                totalGames: teamAGames,
                totalWins: teamAWins,
                pool: processPool(teamAStats)
            } as MatchTeamPoolData,
            teamB: {
                teamName: teamBName,
                totalGames: teamBGames,
                totalWins: teamBWins,
                pool: processPool(teamBStats)
            } as MatchTeamPoolData
        }
    }
}
