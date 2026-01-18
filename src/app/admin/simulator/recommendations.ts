'use server'

import { createClient } from '@/utils/supabase/server'
import { Hero } from '@/utils/types'

export interface Recommendation {
    hero: Hero;
    score: number;
    reason: string;
    type: 'synergy' | 'counter' | 'history' | 'hybrid' | 'ban';
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
    },
    analysisConfig?: { layers: { id: string, weight: number, isActive: boolean }[] } // NEW: Mode Configuration
) {
    const supabase = await createClient()

    // ... (rest of function)


    console.log("--- GET RECOMMENDATIONS CALL ---")
    console.log("Version ID:", versionId)
    console.log("Context:", context)

    // REVISED STRATEGY: Fetch ALL heroes, and LEFT JOIN stats for this version.
    let { data: heroes, error } = await supabase
        .from('heroes')
        .select(`
            *,
            hero_stats(tier, win_rate, pick_rate, ban_rate, power_spike)
        `)
        .eq('hero_stats.version_id', versionId)

    let warningMessage = null

    // If no heroes found (which shouldn't happen if heroes are global), OR if we want to fallback because stats are missing for EVERYONE.
    // Check if stats are empty.
    const hasStats = heroes?.some(h => h.hero_stats && h.hero_stats.length > 0)

    if (!heroes || heroes.length === 0 || !hasStats) {
        console.warn(`No stats found for version ${versionId}. Attempting fallback...`)

        // Find latest patch with stats
        const { data: latestStats } = await supabase
            .from('hero_stats')
            .select('version_id')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (latestStats && latestStats.version_id !== versionId) {
            const { data: fallbackHeroes } = await supabase
                .from('heroes')
                .select(`
                    *,
                    hero_stats!inner(tier, win_rate, pick_rate, ban_rate, power_spike)
                `)
                .eq('hero_stats.version_id', latestStats.version_id)

            if (fallbackHeroes && fallbackHeroes.length > 0) {
                heroes = fallbackHeroes
                warningMessage = `Using stats from previous patch (Version ${latestStats.version_id})`
            }
        }
    }

    // If STILL no heroes (empty DB), return. 
    // If heroes exist but no stats (and no fallback found), we continue but warn.
    if (!heroes || heroes.length === 0) {
        // Try fetching just heroes without stats as last resort
        const { data: baseHeroes } = await supabase.from('heroes').select('*')
        if (baseHeroes && baseHeroes.length > 0) {
            heroes = baseHeroes.map(h => ({ ...h, hero_stats: [] }))
            warningMessage = "No stats available. Showing raw hero data."
        } else {
            return { analyst: [], history: [], hybrid: [], smartBan: [], warning: "No data available in any patch." }
        }
    }

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

    // --- 1. PREPARE ROSTER & TEAM DATA (Enhanced) ---
    let teamRoster: any[] = []

    // Normalize Role Helper
    const normalizeRole = (r: string) => {
        if (['Dark Slayer', 'DSL', 'Slayer', 'Top'].includes(r)) return 'Dark Slayer'
        if (['Jungle', 'JUG', 'Jungler'].includes(r)) return 'Jungle'
        if (['Mid', 'Middle', 'MID', 'Mage'].includes(r)) return 'Mid'
        if (['Abyssal', 'Abyssal Dragon', 'ADL', 'Dragon', 'Carry', 'ADC'].includes(r)) return 'Abyssal'
        if (['Roam', 'Support', 'SUP'].includes(r)) return 'Roam'
        return r
    }

    const teamStats = {
        wins: 0,
        games: 0,
        pickOrderStats: {} as Record<number, Record<string, number>>,
        banOrderStats: {} as Record<number, Record<string, number>>, // NEW: Track Bans by Slot
        heroStats: {} as Record<string, {
            picks: number,
            wins: number,
            roles: Set<string>,
            roleStats: Record<string, { picks: number, wins: number }>
        }>
    }

    if (context?.targetTeamName && context.targetTeamName !== 'Cerebro AI') {
        // Sanitize team name: Remove '(Bot)' to match historical data for the actual team
        const searchName = context.targetTeamName.replace(/\(Bot\)/i, '').trim()

        const { data: teamData } = await supabase.from('teams').select('id, players(*)').ilike('name', `%${searchName}%`).limit(1).single()
        if (teamData) teamRoster = teamData.players || []

        let teamGamesQuery = supabase.from('draft_games')
            .select(`winner, blue_team_name, red_team_name, picks:draft_picks(hero_id, side, type, assigned_role, pick_order:position_index), match:draft_matches!inner(status, tournament_id, match_type, team_a_name, team_b_name)`)
            .or(`blue_team_name.ilike.%${searchName}%,red_team_name.ilike.%${searchName}%`)
            .neq('match.status', 'ongoing')
            .in('match.match_type', ['scrim', 'scrim_summary', 'scrim_simulator', 'simulation', null])

        if (context.tournamentId) teamGamesQuery = teamGamesQuery.eq('match.tournament_id', context.tournamentId)

        const { data: teamGames } = await teamGamesQuery.order('created_at', { ascending: false })
        if (teamGames) {
            teamGames.forEach((g: any) => {
                // Use searchName (sanitized) for comparison to handle (Bot) suffix mismatches
                const targetName = searchName?.toLowerCase()
                let isBlue = g.blue_team_name?.toLowerCase()?.includes(targetName)
                let isRed = g.red_team_name?.toLowerCase()?.includes(targetName)

                // Fallback to match table team names if direct names don't match
                if (!isBlue && !isRed && g.match) {
                    if (g.match.team_a_name?.toLowerCase()?.includes(targetName)) isBlue = true
                    else if (g.match.team_b_name?.toLowerCase()?.includes(targetName)) isRed = true
                }
                if (!isBlue && !isRed) return
                const mySide = isBlue ? 'BLUE' : 'RED'
                const won = (g.winner === 'Blue' && isBlue) || (g.winner === 'Red' && isRed)
                if (won) teamStats.wins++
                teamStats.games++
                g.picks?.forEach((p: any) => {
                    if (p.side === mySide) {
                        if (p.type === 'PICK') {
                            if (!teamStats.heroStats[p.hero_id]) teamStats.heroStats[p.hero_id] = { picks: 0, wins: 0, roles: new Set(), roleStats: {} }
                            const hs = teamStats.heroStats[p.hero_id]
                            hs.picks++
                            if (won) hs.wins++
                            if (p.assigned_role) {
                                hs.roles.add(p.assigned_role)
                                let r = normalizeRole(p.assigned_role)
                                if (!hs.roleStats[r]) hs.roleStats[r] = { picks: 0, wins: 0 }
                                hs.roleStats[r].picks++
                                if (won) hs.roleStats[r].wins++
                            }
                            if (p.pick_order) {
                                if (!teamStats.pickOrderStats[p.pick_order]) teamStats.pickOrderStats[p.pick_order] = {}
                                const rNorm = p.assigned_role ? normalizeRole(p.assigned_role) : 'Flex'
                                if (!teamStats.pickOrderStats[p.pick_order][rNorm]) teamStats.pickOrderStats[p.pick_order][rNorm] = 0
                                teamStats.pickOrderStats[p.pick_order][rNorm]++
                            }
                        } else if (p.type === 'BAN' && p.pick_order) {
                            // Track Bans by Slot - STRICT: Only if side matches context side (Blue vs Red strategy)
                            if (context.side && mySide === context.side) {
                                if (!teamStats.banOrderStats[p.pick_order]) teamStats.banOrderStats[p.pick_order] = {}
                                if (!teamStats.banOrderStats[p.pick_order][p.hero_id]) teamStats.banOrderStats[p.pick_order][p.hero_id] = 0
                                teamStats.banOrderStats[p.pick_order][p.hero_id]++
                            }
                        }
                    }
                })
            })
        }
    }

    // Capture Enemy Stats
    const enemyTeamStats = { wins: 0, games: 0, heroStats: {} as Record<string, { picks: number, wins: number }> }
    if (context?.enemyTeamName && context.enemyTeamName !== 'Cerebro AI') {
        let enemyGamesQuery = supabase.from('draft_games')
            .select(`winner, blue_team_name, red_team_name, picks:draft_picks(hero_id, side, type), match:draft_matches!inner(status, match_type)`)
            .or(`blue_team_name.ilike.%${context.enemyTeamName}%,red_team_name.ilike.%${context.enemyTeamName}%`)
            .neq('match.status', 'ongoing')
            .in('match.match_type', ['scrim', 'scrim_summary', 'scrim_simulator', 'simulation', null])

        if (context.tournamentId) enemyGamesQuery = enemyGamesQuery.eq('match.tournament_id', context.tournamentId)

        const { data: enemyGames } = await enemyGamesQuery.order('created_at', { ascending: false })

        if (enemyGames) {
            enemyGames.forEach((g: any) => {
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
        }
    }

    // --- SMART BAN LOGIC ---
    // 1. Global Data (Ban Rate)
    // 2. Counter First Pick (if we are 2nd pick, ban what counters us? No, if we are 1st pick, ban counters to us. If we are 2nd pick, ban OP heroes)
    // 3. Phase 2: Predict Missing Roles

    const smartBanScores: Record<string, { score: number, reasons: string[] }> = {}

    // Calculate Global Ban Score
    availableHeroes.forEach(h => {
        // Init score with Ban Rate + Fraction of Pick Rate (to ensure non-zero for Meta heroes)
        let score = (h.hero_stats?.[0]?.ban_rate || 0) + ((h.hero_stats?.[0]?.pick_rate || 0) * 0.1)
        const reasons: string[] = []

        // Base: Ban Rate
        if (score > 30) {
            score += 10
            reasons.push(`High Ban Rate (${h.hero_stats?.[0]?.ban_rate}%)`)
        }

        // === ENHANCED BAN STRATEGY ANALYSIS ===
        const currentBanSlot = bannedHeroIds.length + 1  // Which ban slot we're on (1-6)
        const isPhase1 = currentBanSlot <= 4  // First 4 bans = Phase 1
        const isPhase2 = currentBanSlot > 4   // Last 2 bans = Phase 2

        // --- PHASE 1: Use Ban Statistics + Enemy Team's Preferred Heroes ---
        if (isPhase1) {
            // Check if hero is in enemy team's hero pool (they pick it often)
            const enemyHeroStat = enemyTeamStats?.heroStats?.[h.id]
            if (enemyHeroStat && enemyHeroStat.picks >= 2) {
                const enemyPoolBonus = Math.min(enemyHeroStat.picks * 8, 30)
                score += enemyPoolBonus
                reasons.push(`Enemy Pool (${enemyHeroStat.picks} games) +${enemyPoolBonus}`)
            }

            // [Strategy] Team Ban Pattern (Historical Bans for this Slot & Phase)
            if (context?.phase === 'BAN' && teamStats.banOrderStats) {
                // 1. Specific Slot Bonus (Strongest Signal)
                if (context.pickOrder) {
                    const slotBans = teamStats.banOrderStats[context.pickOrder]
                    if (slotBans && slotBans[h.id]) {
                        const banCount = slotBans[h.id]
                        const frequencyBonus = Math.min(banCount * 15, 45) // Boosted
                        score += frequencyBonus
                        reasons.push(`Team Pattern (Slot ${context.pickOrder}) - ${banCount} Bans`)
                    }
                }

                // 2. Phase 1 General Bonus (Broader Signal)
                // Aggregates bans from slots 1, 2, 3, 4 to find general "Opening Bans"
                let phase1BanCount = 0
                for (let i = 1; i <= 4; i++) {
                    const bans = teamStats.banOrderStats[i]
                    if (bans && bans[h.id]) phase1BanCount += bans[h.id]
                }

                // Only apply if significant and distinct from slot bonus (to avoid double counting too much, or stack it?)
                // Strategy: Stack it but with diminishing return.
                if (phase1BanCount >= 2) {
                    const generalBonus = Math.min(phase1BanCount * 5, 25)
                    score += generalBonus
                    // e.g. "Create a solid baseline for frequent bans"
                    if (!reasons.some(r => r.includes('Team Pattern'))) {
                        reasons.push(`Freq. Opening Ban (${phase1BanCount}) +${generalBonus}`)
                    } else {
                        // If slot match already exists, this reinforces it slightly silently or we can show it
                        // Let's just add to score silently to make it "Very Recommended"
                    }
                }
            }

            // S/A Tier Meta picks are priority bans in Phase 1
            if (h.hero_stats?.[0]?.tier === 'S') {
                score += 15
                reasons.push('S Tier Meta Target')
            } else if (h.hero_stats?.[0]?.tier === 'A') {
                score += 8
                reasons.push('A Tier Meta')
            }
        }

        // --- PHASE 2: High-Impact Denial - Target heroes that counter our comp ---
        if (isPhase2) {
            const totalPicks = allyHeroIds.length + enemyHeroIds.length

            // 2.1 Predict Enemy Missing Roles and ban what they likely need
            if (totalPicks >= 6) {
                const enemyHeroes = heroes.filter(eh => enemyHeroIds.includes(eh.id))
                const enemyRolesFilled = new Set<string>()
                enemyHeroes.forEach(eh => eh.main_position?.forEach((p: string) => enemyRolesFilled.add(p)))

                const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
                const missingRoles = roles.filter(r => !enemyRolesFilled.has(r))

                if (h.main_position?.some((p: string) => missingRoles.includes(p))) {
                    score += 25
                    reasons.push(`Deny ${h.main_position[0]} (Enemy needs role)`)
                }
            }

            // 2.2 Calculate Impact Score: Heroes that counter our picked heroes
            // High priority: ban heroes that have good matchups against our team
            const allyHeroes = heroes.filter(ah => allyHeroIds.includes(ah.id))
            let impactScore = 0
            for (const ally of allyHeroes) {
                // Check if 'h' counters any of our allies (via matchup data if available)
                const matchup = relativeMatchups?.find(m => m.hero_id === h.id && m.enemy_hero_id === ally.id)
                if (matchup && matchup.win_rate > 55) {
                    impactScore += (matchup.win_rate - 50) * 2
                }
            }
            if (impactScore > 0) {
                score += impactScore
                reasons.push(`Counters Our Comp +${Math.round(impactScore)}`)
            }

            // 2.3 Enemy team's best heroes with high win rates
            const enemyHeroStat = enemyTeamStats?.heroStats?.[h.id]
            if (enemyHeroStat && enemyHeroStat.picks >= 2) {
                const enemyWR = (enemyHeroStat.wins / enemyHeroStat.picks) * 100
                if (enemyWR >= 60) {
                    score += 20
                    reasons.push(`Enemy WR ${enemyWR.toFixed(0)}% (Danger)`)
                }
            }
        }

        // Logic 1: No Data -> Ban Frequent (S Tier)
        // Logic 1: No Data or just Phase 1 -> Ban Frequent (S Tier / High Ban Rate)
        // Ensure we always have recommendations for Phase 1
        if (isPhase1 && h.hero_stats?.[0]?.tier === 'S' && score < 15) {
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





    // --- 3. SCORING LOOP ---
    const analystScores: Record<string, { score: number, reasons: string[] }> = {}

    // Helper to get weight
    const getWeight = (layerId: string) => {
        if (!analysisConfig) return 1.0
        const layer = analysisConfig.layers.find(l => l.id === layerId)
        return layer && layer.isActive ? layer.weight : 0 // If not active, weight 0
    }

    // Cache weights
    const wMeta = getWeight('meta')
    const wCounter = getWeight('counter')
    const wSynergy = getWeight('synergy')
    const wComfort = getWeight('comfort') // Team Hero Pool
    const wRoster = getWeight('roster') // Roster Dominance
    const wBan = getWeight('ban')

    console.log("Analysis Weights:", { wMeta, wCounter, wSynergy, wComfort, wRoster, wBan })

    availableHeroes.forEach(h => {
        let score = 0 // Start from 0 to be pure weighted sum? Or keep base winrate?
        // Proposal: Base score is WinRate * wMeta (as it's global strength)
        // Or keep Base = 50, then add weighted bonuses.
        // Let's stick to additive model but weighted.

        // BASE SCORE (Meta/Global)
        // If meta weight is 0, we shouldn't rely on global winrate? 
        // Let's assume Base is 50.
        let base = h.hero_stats?.[0]?.win_rate || 50
        if (wMeta > 0) {
            score += base
        }

        const reasons: string[] = []

        // 3.1 [Hero Pool] Team Comfort & Win Rate
        if (wComfort > 0) {
            const teamHeroStat = teamStats.heroStats[h.id]
            if (teamHeroStat) {
                const teamWR = (teamHeroStat.wins / teamHeroStat.picks) * 100
                const volumeBonus = Math.min(teamHeroStat.picks * 5, 25)
                const wrBonus = teamWR > 60 ? 15 : (teamWR > 50 ? 5 : 0)
                const totalComfort = (volumeBonus + wrBonus) * wComfort
                score += totalComfort
                reasons.push(`Team Pool (${teamHeroStat.picks} games) +${Math.round(totalComfort)}`)
            }
        }

        // 3.2 [Meta Analysis] Tournament Presence
        if (wMeta > 0 && h.hero_stats?.[0]?.pick_rate > 30) {
            const metaBonus = 5 * wMeta
            score += metaBonus
            reasons.push(`Meta Pick +${Math.round(metaBonus)}`)
        }

        // 3.3 [Draft Logic] Comparison with Enemy (High Priority)
        if (wCounter > 0) {
            const counterMatch = relativeMatchups?.find(m => m.hero_id === h.id)
            if (counterMatch) {
                const enemyName = queryHeroName(counterMatch.enemy_hero_id, heroes)
                const winAdvantage = counterMatch.win_rate - 50
                const bonus = Math.max(winAdvantage * 3, 5)
                const weightedBonus = bonus * wCounter
                score += weightedBonus
                reasons.push(`Hard Counter to ${enemyName} +${Math.round(weightedBonus)}`)
            }
        }

        // 3.4 [Draft Logic] Synergy
        if (wSynergy > 0) {
            const synergyCombo = relativeCombos?.find(c => c.hero_b_id === h.id)
            if (synergyCombo) {
                const partnerName = queryHeroName(synergyCombo.hero_a_id, heroes)
                const synergyBonus = (synergyCombo.synergy_score / 4) * wSynergy
                score += synergyBonus
                reasons.push(`Synergy with ${partnerName} +${Math.round(synergyBonus)}`)
            }
        }

        // 3.5 [Roster Dominance] Player Proficiency (Role Based)
        if (wRoster > 0 && context?.phase === 'PICK') {
            const allyRolesFilled = new Set<string>()
            allyHeroIds.forEach(id => {
                const ah = heroes.find(x => x.id === id)
                if (ah && ah.main_position) allyRolesFilled.add(ah.main_position[0])
            })
            const allRoles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
            const neededRoles = allRoles.filter(r => !allyRolesFilled.has(r))

            const fitsRole = h.main_position?.some((p: string) => neededRoles.includes(p))

            if (fitsRole) {
                const rosterPlayer = teamRoster.find((p: any) => h.main_position?.some((pos: string) => p.roster_role === pos || (p.positions && p.positions.includes(pos))))

                if (rosterPlayer) {
                    const signatureBonus = 15 * wRoster
                    score += signatureBonus
                    reasons.push(`${rosterPlayer.name} Main +${Math.round(signatureBonus)}`)
                } else {
                    const roleBonus = 10
                    score += roleBonus // Base role fit isn't multiplied by roster weight?? Maybe it should.
                    // Actually, Role Fit is fundamental logic, not just "Roster Dominance". 
                    // But if we are in "Free Style" mode (Roster=0), maybe we don't care about roles? No, Role Fit is constraints.
                    // Keep Role Fit unweighted or weighted by Meta? Let's leave Role Fit as Base Logic (unweighted or weight 1).
                    // BUT penalize missing role heavily.
                }
            } else if (allyHeroIds.length >= 3) {
                score -= 50 // Penalty for bad role fit stays heavy
            }
        }

        // 3.6 [Ban Priority]
        if (wBan > 0 && enemyKeyPlayerIds.has(h.id)) {
            const banBonus = 20 * wBan
            score += banBonus
            reasons.push(`Deny Enemy Main +${Math.round(banBonus)}`)
        }

        // 3.7 [Draft Strategy] Role Priority per Slot
        if (context?.pickOrder && teamStats.pickOrderStats) {
            const slotStats = teamStats.pickOrderStats[context.pickOrder]
            if (slotStats && h.main_position && h.main_position.length > 0) {
                const mainRole = h.main_position[0]
                const count = slotStats[mainRole] || 0
                if (count >= 1) {
                    const bonus = Math.min(count * 10, 30)
                    score += bonus
                    reasons.push(`Team Pattern (Slot ${context.pickOrder}) +${bonus}`)
                }
            }
        }

        analystScores[h.id] = { score, reasons }
    })

    // Helper
    function queryHeroName(id: string, list: any[]) {
        return list.find(x => x.id === id)?.name || 'Hero'
    }

    // --- 4. FORMAT OUTPUT & EXTRACT COMPONENT DATA ---

    // --- 4. FORMAT OUTPUT & EXTRACT COMPONENT DATA ---


    // A. Meta Analysis (Global Top Picks)
    interface MetaStatItem {
        hero: Hero;
        stats: { winRate: number; pickRate: number; };
        rawPicks: number;
    }
    let metaStats: MetaStatItem[] = []

    // 1. Tournament-Specific Analysis
    if (context?.tournamentId) {
        // Fetch Matches for this Tournament
        const { data: tourneyMatches } = await supabase
            .from('draft_matches')
            .select(`
                games:draft_games(
                    winner,
                    picks:draft_picks(hero_id, type, side)
                )
            `)
            .eq('tournament_id', context.tournamentId)
            .eq('status', 'finished')

        if (tourneyMatches && tourneyMatches.length > 0) {
            const tStats: Record<string, { picks: number, wins: number }> = {}
            let tTotalGames = 0

            tourneyMatches.forEach(m => {
                // Manually assert type since partial selection doesn't match full DraftGame interface perfectly, or simpler: use existing types but be aware of missing fields
                // Using 'any' for the game object structure returned by query is sometimes safer if it's a join result structure.
                // However, let's try to type it partially.
                m.games?.forEach((g: any) => {
                    tTotalGames++
                    g.picks?.forEach((p: any) => {
                        if (p.type === 'PICK') {
                            if (!tStats[p.hero_id]) tStats[p.hero_id] = { picks: 0, wins: 0 }
                            tStats[p.hero_id].picks++

                            // Normalize side
                            let pSide = (p.side || '').toUpperCase()
                            if (pSide === 'BLUE SIDE') pSide = 'BLUE'
                            if (pSide === 'RED SIDE') pSide = 'RED'

                            const isBlueWin = g.winner === 'Blue'
                            const isRedWin = g.winner === 'Red'

                            if ((pSide === 'BLUE' && isBlueWin) || (pSide === 'RED' && isRedWin)) {
                                tStats[p.hero_id].wins++
                            }
                        }
                    })
                })
            })

            // Map to MetaStats format
            metaStats = heroes
                .map(h => {
                    const s = tStats[h.id]
                    if (!s) return null
                    return {
                        hero: h,
                        stats: {
                            pickRate: tTotalGames > 0 ? (s.picks / tTotalGames) * 100 : 0,
                            winRate: s.picks > 0 ? (s.wins / s.picks) * 100 : 0
                        },
                        rawPicks: s.picks
                    }
                })
                .filter((item): item is MetaStatItem => item !== null)
                .sort((a, b) => b.rawPicks - a.rawPicks) // Sort by popularity
        }
    }

    // 2. Global Fallback (if no tournament data or ID not provided)
    if (metaStats.length === 0) {
        metaStats = (heroes
            .filter(h => (h.hero_stats?.[0]?.pick_rate || 0) > 15 || (h.hero_stats?.[0]?.win_rate || 0) > 52)
            .sort((a, b) => {
                const aScore = (a.hero_stats?.[0]?.win_rate || 0) * 0.7 + (a.hero_stats?.[0]?.pick_rate || 0) * 0.3
                const bScore = (b.hero_stats?.[0]?.win_rate || 0) * 0.7 + (b.hero_stats?.[0]?.pick_rate || 0) * 0.3
                return bScore - aScore
            })
            .slice(0, 10)
            .map(h => ({
                hero: h,
                stats: { winRate: h.hero_stats?.[0]?.win_rate || 0, pickRate: h.hero_stats?.[0]?.pick_rate || 0 },
                rawPicks: 0
            })) || []) as MetaStatItem[]

        // 3. Ultimate Fallback: Just take top 10 regardless of thresholds if still empty
        if (metaStats.length === 0) {
            console.log("Using Ultimate Fallback for Meta Stats")
            metaStats = (heroes
                ?.sort((a, b) => {
                    // Sort by combined score or just pick rate
                    const aScore = (a.hero_stats?.[0]?.win_rate || 0) * 0.7 + (a.hero_stats?.[0]?.pick_rate || 0) * 0.3
                    const bScore = (b.hero_stats?.[0]?.win_rate || 0) * 0.7 + (b.hero_stats?.[0]?.pick_rate || 0) * 0.3
                    return bScore - aScore
                })
                .slice(0, 10)
                .map(h => ({
                    hero: h,
                    stats: { winRate: h.hero_stats?.[0]?.win_rate || 0, pickRate: h.hero_stats?.[0]?.pick_rate || 0 },
                    rawPicks: 0
                })) || []) as MetaStatItem[]
        }
    }

    // B. Counter Matchups
    // Good for Ally (Counters Enemy)
    const counters = relativeMatchups
        ?.sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 20)
        .map(m => ({
            hero: heroes?.find(h => h.id === m.hero_id), // The hero WE should pick
            target: heroes?.find(h => h.id === m.enemy_hero_id), // The enemy it counters
            winRate: m.win_rate,
            lane: m.lane || m.position || null // Include lane/position info
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
    // REVISED: Mimic RosterDominanceBoard Logic (Best Hero per Role)

    // 1. Try to find Specific Roster Player first
    let rosterDominance: any[] = []

    const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

    // Helper to find best hero for a role from teamStats
    const getBestHeroForRole = (role: string) => {
        let bestHeroId = ''
        let maxScore = -1
        let bestStats = { picks: 0, wins: 0 }

        Object.entries(teamStats.heroStats).forEach(([hId, stats]) => {
            const rStats = stats.roleStats?.[role]
            if (rStats && rStats.picks >= 1) {
                // Score = Picks * 100 + WinRate
                const wr = (rStats.wins / rStats.picks) * 100
                const score = (rStats.picks * 10) + wr

                if (score > maxScore) {
                    maxScore = score
                    bestHeroId = hId
                    bestStats = rStats
                }
            }
        })

        if (!bestHeroId) return null
        return { id: bestHeroId, ...bestStats }
    }

    // Generate List based on Roles
    roles.forEach(role => {
        const best = getBestHeroForRole(role)
        if (best) {
            const hero = heroes?.find(h => h.id === best.id)
            if (hero) {
                // Try to find player name
                let playerName = `${role} Specialist`
                const rosterPlayer = teamRoster.find((p: any) => p.roster_role === role || (p.positions && p.positions.includes(role)))
                if (rosterPlayer) playerName = rosterPlayer.name

                rosterDominance.push({
                    hero,
                    player: playerName,
                    picks: best.picks,
                    winRate: (best.wins / best.picks) * 100,
                    role // Metadata
                })
            }
        }
    })

    // Fallback: If still empty (no roles found), just show top picks globally
    if (rosterDominance.length === 0) {
        rosterDominance = Object.entries(teamStats.heroStats)
            .filter(([id, s]) => s.picks >= 1)
            .sort((a, b) => b[1].picks - a[1].picks)
            .slice(0, 5)
            .map(([id, s]) => {
                const hero = heroes?.find(h => h.id === id)
                if (!hero) return null
                return {
                    hero,
                    player: 'Flex Pick',
                    picks: s.picks,
                    winRate: (s.wins / s.picks) * 100
                }
            })
            .filter(Boolean)
    }


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
    }

    const sortedRecs = availableHeroes
        .map(h => ({
            hero: h,
            score: analystScores[h.id]?.score || 0,
            reason: analystScores[h.id]?.reasons.slice(0, 3).join(' • ') || 'Solid Pick',
            type: 'hybrid' as const
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)

    return {
        analyst: sortedRecs,
        history: sortedRecs,
        hybrid: sortedRecs,
        smartBan: [], // Placeholder, will fill below
    }

    let smartBanRecs = Object.entries(smartBanScores)
        .map(([id, s]) => {
            const h = heroes.find(x => x.id === id)
            if (!h) return null
            return {
                hero: h,
                score: s.score,
                reason: s.reasons.join(' • '),
                type: 'ban'
            }
        })
        .filter(Boolean)
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score) as Recommendation[]

    // FALLBACK: If smartBan is empty (no stats), use Top Picks (Meta) as Ban Suggestions
    if (smartBanRecs.length === 0) {
        console.log("Avoid empty Ban list: Fallback to Meta Picks")
        smartBanRecs = sortedRecs.map(r => ({
            ...r,
            type: 'ban' as const,
            reason: 'High Priority Meta Pick (Fallback)'
        }))
    }

    return {
        analyst: sortedRecs,
        history: sortedRecs,
        hybrid: sortedRecs,
        smartBan: smartBanRecs,
        warning: warningMessage,
        heroPools: {
            ally: formatPool(teamStats),
            enemy: formatPool(enemyTeamStats)
        },
        // NEW ANALYSIS MODULES
        meta: metaStats,
        counters,
        synergies,
        roster: rosterDominance,
        composition: calculateComposition(allyHeroIds, heroes)
    }
}

function calculateComposition(heroIds: string[], heroes: any[]) {
    const composition = {
        damage: { Physical: 0, Magic: 0, True: 0, Mixed: 0 },
        powerSpike: { Early: 0, Mid: 0, Late: 0, Balanced: 0 },
        attributes: {
            control: 0,
            durability: 0,
            mobility: 0,
            offense: 0
        },
        roles: [] as string[]
    }

    if (!heroIds || heroIds.length === 0) return composition

    const selectedHeroes = heroes.filter(h => heroIds.includes(h.id))

    selectedHeroes.forEach(h => {
        // Damage Type
        if (h.damage_type) composition.damage[h.damage_type as keyof typeof composition.damage]++

        // Power Spike (from Stats)
        const spike = h.hero_stats?.[0]?.power_spike || 'Balanced'
        composition.powerSpike[spike as keyof typeof composition.powerSpike]++

        // Attributes (Mocking simple attribute logic based on Role/Key Stats if available, or just generic)
        // Since we don't have explicit attribute stats in the type definition provided earlier, we will infer generic values or skip.
        // Let's infer from Role for now to populate the UI.
        const roles = h.main_position || []
        if (roles.includes('Tank') || roles.includes('Roam')) composition.attributes.durability += 2
        if (roles.includes('Warrior') || roles.includes('Dark Slayer')) { composition.attributes.durability += 1; composition.attributes.offense += 1 }
        if (roles.includes('Mage') || roles.includes('Mid')) { composition.attributes.offense += 2; composition.attributes.control += 1 }
        if (roles.includes('Marksman') || roles.includes('Abyssal')) { composition.attributes.offense += 3; }
        if (roles.includes('Assassin') || roles.includes('Jungle')) { composition.attributes.mobility += 3; composition.attributes.offense += 2 }

        // Count distinct roles
        composition.roles.push(...roles)
    })

    return composition
}
