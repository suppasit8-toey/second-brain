'use server'

import { createClient } from '@/utils/supabase/server'
import { Hero } from '@/utils/types'

export interface Recommendation {
    hero: Hero;
    score: number;
    reason: string;
    type: 'synergy' | 'counter' | 'history' | 'hybrid';
}

export async function getRecommendations(
    versionId: number,
    allyHeroIds: string[],
    enemyHeroIds: string[],
    bannedHeroIds: string[],
    allyGlobalBans: string[] = [],
    context?: {
        matchId?: string;
        side?: 'BLUE' | 'RED';
        phase?: 'BAN' | 'PICK'; // 'BAN_1' (1-2), 'BAN_2' (3-4), 'PICK_1', 'PICK_2' could be inferred
        pickOrder?: number; // 0-19?
        tournamentId?: string; // New: Filter data by tournament
        targetTeamName?: string; // New: Specific team to emulate
        enemyTeamName?: string; // New: Enemy team for context
    }
) {
    const supabase = await createClient()

    // ... (rest of function)


    console.log("--- GET RECOMMENDATIONS CALL ---")
    console.log("Version ID:", versionId)
    console.log("Context:", context)

    // 1. Fetch all Heroes for this version (base pool)
    let { data: heroes, error } = await supabase
        .from('heroes')
        .select(`
            *,
            hero_stats!inner(tier, win_rate, pick_rate, ban_rate, power_spike)
        `)
        .eq('hero_stats.version_id', versionId)

    let warningMessage = null

    // FALLBACK: If no heroes found for this version, try the latest version with stats
    if (!heroes || heroes.length === 0) {
        console.warn(`No stats found for version ${versionId}. Attempting fallback...`)

        // Find latest patch with stats (simplified: just get latest hero_stats version)
        const { data: latestStats } = await supabase
            .from('hero_stats')
            .select('version_id')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (latestStats) {
            const { data: fallbackHeroes } = await supabase
                .from('heroes')
                .select(`
                    *,
                    hero_stats!inner(tier, win_rate, pick_rate, ban_rate, power_spike)
                `)
                .eq('hero_stats.version_id', latestStats.version_id)

            if (fallbackHeroes && fallbackHeroes.length > 0) {
                heroes = fallbackHeroes
                warningMessage = `Data from previous patch used (Version ID: ${latestStats.version_id})`
            }
        }
    }

    if (error) console.error("Supabase Error:", error)
    console.log("Heroes found:", heroes?.length)

    if (!heroes || heroes.length === 0) return { analyst: [], history: [], hybrid: [], smartBan: [], warning: "No data available in any patch." }

    const availableHeroes = heroes.filter(h =>
        !allyHeroIds.includes(h.id) &&
        !enemyHeroIds.includes(h.id) &&
        !bannedHeroIds.includes(h.id)
    )
    console.log("Available Heroes:", availableHeroes.length)

    // --- CONTEXT PREP ---
    // Fetch Key Players from previous games if matchId exists
    const enemyKeyPlayerIds = new Set<string>()
    const allyKeyPlayerIds = new Set<string>()
    let previousGames = []

    if (context?.matchId) {
        const { data: matchData } = await supabase
            .from('draft_matches')
            .select(`
                games:draft_games(
                   blue_team_name, red_team_name,
                   blue_key_player_id, red_key_player_id,
                   winner
                )
            `)
            .eq(context.matchId.includes('-') && context.matchId.length > 20 ? 'id' : 'slug', context.matchId)
            .single()

        if (matchData?.games) {
            previousGames = matchData.games
            // Determine which team we are (Ally)
            // Ideally we need to know if 'side' (BLUE/RED) corresponds to Team A or Team B.
            // But usually DraftInterface knows. Assuming context.side is 'BLUE' or 'RED' for the current game.
            // Wait, Key Players are tied to Team Name, not Side.
            // We need to know if we are Team A or Team B to track OUR key players.
            // Since we don't have team names passed in context easily, let's just collect ALL key players for now as "Meta Threats"
            // Or better: pass team names. For now, simplifiction:
            // "Enemy Key Players" -> Logic: Whoever was Key Player on the opposing team in previous games.
            // We'll trust the caller or just filter generally.

            // Simpler approach: Collect ALL frequent MVPs as "Threats"
            matchData.games.forEach((g: any) => {
                if (g.blue_key_player_id) enemyKeyPlayerIds.add(g.blue_key_player_id) // Add both for now as potential targets
                if (g.red_key_player_id) enemyKeyPlayerIds.add(g.red_key_player_id)
            })
        }
    }

    // --- SMART BAN LOGIC ---
    // 1. Global Data (Ban Rate)
    // 2. Counter First Pick (if we are 2nd pick, ban what counters us? No, if we are 1st pick, ban counters to us. If we are 2nd pick, ban OP heroes)
    // 3. Phase 2: Predict Missing Roles

    const smartBanScores: Record<string, { score: number, reasons: string[] }> = {}

    // Calculate Global Ban Score
    availableHeroes.forEach(h => {
        let score = h.hero_stats[0].ban_rate || 0
        const reasons: string[] = []

        // Base: Ban Rate
        if (score > 30) {
            score += 10
            reasons.push(`High Ban Rate (${h.hero_stats[0].ban_rate}%)`)
        }

        // Logic 3: Phase 2 (If many heroes already banned/picked)
        const totalPicks = allyHeroIds.length + enemyHeroIds.length
        if (totalPicks >= 6) { // Phase 2
            // 3.1 Predict Enemy Missing Roles
            const enemyHeroes = heroes.filter(eh => enemyHeroIds.includes(eh.id))
            const enemyRolesFilled = new Set<string>()
            enemyHeroes.forEach(eh => eh.main_position.forEach((p: string) => enemyRolesFilled.add(p)))

            const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
            const missingRoles = roles.filter(r => !enemyRolesFilled.has(r))

            if (h.main_position.some((p: string) => missingRoles.includes(p))) {
                score += 20
                reasons.push(`Deny ${h.main_position[0]} (Enemy needs role)`)
            }
        }

        // Logic 1: No Data -> Ban Frequent
        if (totalPicks === 0 && h.hero_stats[0].tier === 'S') {
            score += 15
            reasons.push('S Tier (Meta Ban)')
        }

        smartBanScores[h.id] = { score, reasons }
    })

    // Logic 2: Counter First Pick / Counter Us
    if (context?.phase === 'BAN') {
        // Fetch counters to OUR likely picks or our Key Players
        // Since we don't know our picks yet in Ban Phase 1, we protect our Key Players
        if (allyGlobalBans.length > 0) { // If we have global bans/favs
            // ...
        }
    }

    // --- 1. PREPARE ROSTER & TEAM DATA ---
    let teamRoster: any[] = []
    const teamStats = {
        wins: 0,
        games: 0,
        heroStats: {} as Record<string, { picks: number, wins: number, roles: Set<string> }>
    }

    if (context?.targetTeamName && context.targetTeamName !== 'Cerebro AI') {
        console.log("Deep Analysis for Team:", context.targetTeamName)

        // A. Get Team ID & Roster
        const { data: teamData } = await supabase
            .from('teams')
            .select('id, players(*)')
            .eq('name', context.targetTeamName)
            .single()

        if (teamData) {
            teamRoster = teamData.players || []
        }

        // B. Get Team History (Hero Pool & Win Rates)
        const { data: teamMatches } = await supabase
            .from('draft_matches')
            .select(`
                team_a_name, team_b_name,
                games:draft_games(
                    winner, blue_team_name, red_team_name,
                    picks:draft_picks(hero_id, side, type, assigned_role)
                )
            `)
            .or(`team_a_name.eq.${context.targetTeamName},team_b_name.eq.${context.targetTeamName}`)
            .eq('status', 'finished')
            .order('created_at', { ascending: false })
            .limit(50)

        if (teamMatches) {
            teamMatches.forEach((m: any) => {
                m.games?.forEach((g: any) => {
                    const isBlue = g.blue_team_name === context.targetTeamName
                    const isRed = g.red_team_name === context.targetTeamName
                    if (!isBlue && !isRed) return

                    const mySide = isBlue ? 'BLUE' : 'RED'
                    const won = (g.winner === 'Blue' && isBlue) || (g.winner === 'Red' && isRed)

                    if (won) teamStats.wins++
                    teamStats.games++

                    g.picks?.forEach((p: any) => {
                        if (p.side === mySide && p.type === 'PICK') {
                            if (!teamStats.heroStats[p.hero_id]) {
                                teamStats.heroStats[p.hero_id] = { picks: 0, wins: 0, roles: new Set() }
                            }
                            const hs = teamStats.heroStats[p.hero_id]
                            hs.picks++
                            if (won) hs.wins++
                            if (p.assigned_role) hs.roles.add(p.assigned_role)
                        }
                    })
                })
            })
        }
    }

    // --- 2. MATCHUPS & COMBOS (Global & Contextual) ---
    // Fetch relevant matchups (Advantage vs Enemy)
    const { data: relativeMatchups } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .in('enemy_hero_id', enemyHeroIds) // We usually look for "Us vs Them" where Them is Enemy
        .gt('win_rate', 50) // Only good matchups

    // Fetch relevant combos (Synergy with Ally)
    const { data: relativeCombos } = await supabase
        .from('hero_combos')
        .select('*')
        .eq('version_id', versionId)
        .in('hero_a_id', allyHeroIds) // Synergy with existing allies

    // --- 3. SCORING LOOP ---
    const analystScores: Record<string, { score: number, reasons: string[] }> = {}

    availableHeroes.forEach(h => {
        let score = h.hero_stats[0].win_rate // Base: Global Win Rate
        const reasons: string[] = []

        // 3.1 [Hero Pool] Team Comfort & Win Rate
        const teamHeroStat = teamStats.heroStats[h.id]
        if (teamHeroStat) {
            const teamWR = (teamHeroStat.wins / teamHeroStat.picks) * 100
            const volumeBonus = Math.min(teamHeroStat.picks * 5, 25) // Up to +25 for volume
            const wrBonus = teamWR > 60 ? 15 : (teamWR > 50 ? 5 : 0)

            score += volumeBonus + wrBonus
            reasons.push(`Team Pool (${teamHeroStat.picks} games, ${Math.round(teamWR)}% WR)`)
        }

        // 3.2 [Meta Analysis] Tournament Presence
        // We can reuse the `tournamentId` fetching logic if needed, or rely on global stats. 
        // For brevity, using global `hero_stats.pick_rate` as Meta proxy if Tournament ID not set.
        if (h.hero_stats[0].pick_rate > 30) {
            score += 5
            reasons.push('Meta Pick')
        }

        // 3.3 [Draft Logic] Comparison with Enemy
        // Counter Logic
        const counterMatch = relativeMatchups?.find(m => m.hero_id === h.id)
        if (counterMatch) {
            // Find which enemy
            const enemyName = queryHeroName(counterMatch.enemy_hero_id, heroes)
            score += (counterMatch.win_rate - 50) // e.g. 55% -> +5
            reasons.push(`Counters ${enemyName} (${counterMatch.win_rate}% Win)`)
        }

        // 3.4 [Draft Logic] Synergy
        const synergyCombo = relativeCombos?.find(c => c.hero_b_id === h.id)
        if (synergyCombo) {
            const partnerName = queryHeroName(synergyCombo.hero_a_id, heroes)
            score += (synergyCombo.synergy_score / 5)
            reasons.push(`Synergy with ${partnerName}`)
        }

        // 3.5 [Roster Dominance] Player Proficiency (Role Based)
        // If we are in PICK phase and need a role
        if (context?.phase === 'PICK') {
            // Determine needed roles
            const allyRolesFilled = new Set<string>()
            // Basic heuristic for filled roles based on picks
            // Ideally we pass manual assignments, but defaulting to main_position of picks
            allyHeroIds.forEach(id => {
                const ah = heroes.find(x => x.id === id)
                if (ah && ah.main_position) allyRolesFilled.add(ah.main_position[0])
            })
            const allRoles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
            const neededRoles = allRoles.filter(r => !allyRolesFilled.has(r))

            // Check if Hero fits a needed role
            const fitsRole = h.main_position.some((p: string) => neededRoles.includes(p))

            if (fitsRole) {
                // Find the PLAYER for this role
                // We assume roles are filled in order or we just find the player assigned to this role in roster
                // For simplified "Next Best Role", we look if the TEAM accesses this hero in this role.
                const rosterPlayer = teamRoster.find((p: any) => h.main_position.some((pos: string) => p.roster_role === pos || (p.positions && p.positions.includes(pos))))

                if (rosterPlayer) {
                    score += 10
                    reasons.push(`${rosterPlayer.name}'s Pool`)
                }

                score += 10
                // reasons.push('Needed Role') // Too generic, skip text
            } else if (allyHeroIds.length >= 3) {
                // Late draft penalty for role clash
                score -= 50
            }
        }

        // 3.6 [Ban Priority] (Handled in SmartBan section usually, but if pick, maybe "Deny")
        if (enemyKeyPlayerIds.has(h.id)) {
            score += 20
            reasons.push('Deny Enemy Main')
        }

        analystScores[h.id] = { score, reasons }
    })

    // Helper
    function queryHeroName(id: string, list: any[]) {
        return list.find(x => x.id === id)?.name || 'Hero'
    }

    // --- 4. FORMAT OUTPUT & EXTRACT COMPONENT DATA ---

    // NEW: Fetch Enemy Pool if context provided
    let enemyTeamStats = { wins: 0, games: 0, heroStats: {} as Record<string, { picks: number, wins: number }> }
    if (context?.enemyTeamName && context.enemyTeamName !== 'Cerebro AI') {
        const { data: teamMatches } = await supabase
            .from('draft_matches')
            .select(`
                team_a_name, team_b_name,
                games:draft_games(
                    winner, blue_team_name, red_team_name,
                    picks:draft_picks(hero_id, side, type)
                )
            `)
            .or(`team_a_name.eq.${context.enemyTeamName},team_b_name.eq.${context.enemyTeamName}`)
            .eq('status', 'finished')
            .order('created_at', { ascending: false })
            .limit(50)

        if (teamMatches) {
            teamMatches.forEach((m: any) => {
                m.games?.forEach((g: any) => {
                    const isBlue = g.blue_team_name === context.enemyTeamName
                    const isRed = g.red_team_name === context.enemyTeamName
                    if (!isBlue && !isRed) return
                    const mySide = isBlue ? 'BLUE' : 'RED'
                    const won = (g.winner === 'Blue' && isBlue) || (g.winner === 'Red' && isRed)
                    if (won) enemyTeamStats.wins++
                    enemyTeamStats.games++
                    g.picks?.forEach((p: any) => {
                        if (p.side === mySide && p.type === 'PICK') {
                            if (!enemyTeamStats.heroStats[p.hero_id]) enemyTeamStats.heroStats[p.hero_id] = { picks: 0, wins: 0 }
                            enemyTeamStats.heroStats[p.hero_id].picks++
                            if (won) enemyTeamStats.heroStats[p.hero_id].wins++
                        }
                    })
                })
            })
        }
    }

    // A. Meta Analysis (Global Top Picks)
    const metaStats = heroes
        ?.filter(h => h.hero_stats[0].pick_rate > 15 || h.hero_stats[0].win_rate > 52)
        .sort((a, b) => (b.hero_stats[0].win_rate * 0.7 + b.hero_stats[0].pick_rate * 0.3) - (a.hero_stats[0].win_rate * 0.7 + a.hero_stats[0].pick_rate * 0.3))
        .slice(0, 10)
        .map(h => ({
            hero: h,
            stats: { winRate: h.hero_stats[0].win_rate, pickRate: h.hero_stats[0].pick_rate }
        }))

    // B. Counter Matchups
    // Good for Ally (Counters Enemy)
    const counters = relativeMatchups
        ?.sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 10)
        .map(m => ({
            hero: heroes?.find(h => h.id === m.hero_id), // The hero WE should pick
            target: heroes?.find(h => h.id === m.enemy_hero_id), // The enemy it counters
            winRate: m.win_rate
        }))
        .filter(x => x.hero && x.target)

    // C. Synergies
    const synergies = relativeCombos
        ?.sort((a, b) => b.synergy_score - a.synergy_score)
        .slice(0, 10)
        .map(c => ({
            hero: heroes?.find(h => h.id === c.hero_b_id), // The hero WE should pick
            partner: heroes?.find(h => h.id === c.hero_a_id), // The ally it combos with
            score: c.synergy_score
        }))
        .filter(x => x.hero && x.partner)

    // D. Roster Dominance (Matches for Current Team)
    // Identify signature picks for the team
    const rosterDominance = teamRoster
        .flatMap((p: any) => {
            // Find signature heroes for this player (either via explicit 'positions' or from history)
            // For now, using teamStats to imply "Team Signature"
            // But if we have player data, use it.
            // Mocking "Signature" as high winrate (>60%) with >3 picks by this team
            return Object.entries(teamStats.heroStats as Record<string, { picks: number, wins: number, roles: Set<string> }>)
                .filter(([id, s]) => s.picks >= 5 && (s.wins / s.picks) >= 0.6)
                .map(([id, s]) => {
                    const hero = heroes?.find(h => h.id === id)
                    if (!hero) return null
                    return {
                        hero,
                        player: p.name, // Just associating with team generally if specific player mapping is weak
                        picks: s.picks,
                        winRate: (s.wins / s.picks) * 100
                    }
                })
        })
        .filter(Boolean)
        // Dedupe by hero ID, taking max picks
        .reduce((acc: any[], curr: any) => {
            if (!acc.find(x => x.hero.id === curr.hero.id)) acc.push(curr)
            return acc
        }, [])
        .slice(0, 10)


    // Format Hero Pools for UI (Helper)
    const formatPool = (stats: any) => {
        return Object.entries(stats.heroStats as Record<string, { picks: number, wins: number }>)
            .map(([id, s]) => {
                const hero = heroes?.find(h => h.id === id)
                if (!hero) return null
                return {
                    hero,
                    picks: s.picks,
                    winRate: s.picks > 0 ? (s.wins / s.picks) * 100 : 0
                }
            })
            .filter(Boolean)
            .sort((a, b) => b!.picks - a!.picks)
            .slice(0, 10) // Top 10
    }

    const sortedRecs = availableHeroes
        .map(h => ({
            hero: h,
            score: analystScores[h.id]?.score || 0,
            reason: analystScores[h.id]?.reasons.slice(0, 3).join(' • ') || 'Solid Pick',
            type: 'hybrid' as const
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)

    return {
        analyst: sortedRecs,
        history: sortedRecs,
        hybrid: sortedRecs,
        smartBan: [] as Recommendation[],
        warning: warningMessage,
        heroPools: {
            ally: formatPool(teamStats),
            enemy: formatPool(enemyTeamStats)
        },
        // NEW ANALYSIS MODULES
        meta: metaStats,
        counters,
        synergies,
        roster: rosterDominance
    }
}
