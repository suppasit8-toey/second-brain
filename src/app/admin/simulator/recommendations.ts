'use server'

import { createClient } from '@/utils/supabase/server'
import { Hero } from '@/utils/types'
import { calculateComposition, normalizeRole, resolveTeamRoles, STANDARD_ROLES } from './recommendation-utils'

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
        pickOrder?: number; // Team pick order (1-5)
        draftSlot?: number; // NEW: Actual draft sequence position (5, 8, 9, 16, 17 for Blue picks)
        tournamentId?: string; // New: Filter data by tournament
        targetTeamName?: string; // New: Specific team to emulate
        enemyTeamName?: string; // New: Enemy team for context
    },
    analysisConfig?: { layers: { id: string, weight: number, isActive: boolean }[] }, // Mode Configuration
    draftStrategyStats?: {
        pickOrderStats?: Record<number, Record<string, number>>;
        sideStats?: {
            BLUE?: { pickOrderStats?: Record<number, Record<string, number>> };
            RED?: { pickOrderStats?: Record<number, Record<string, number>> };
        };
    }, // Draft Strategy Analysis data from CEREBRO
    mode: 'team' | 'global' = 'team' // NEW: Toggle between Team Specific and Global Meta data
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
        !bannedHeroIds.includes(h.id) &&
        !allyGlobalBans.includes(h.id)
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
    // Fetch relevant matchups (Advantage vs Enemy - we counter them)
    const { data: relativeMatchups } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .in('enemy_hero_id', enemyHeroIds) // We usually look for "Us vs Them" where Them is Enemy
        .gt('win_rate', 50) // Only good matchups (we counter them)

    // Fetch matchups where enemy counters us (we lose to them)
    const { data: counteredByMatchups } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .in('enemy_hero_id', enemyHeroIds) // Looking for matchups vs enemy heroes
        .lt('win_rate', 50) // Bad matchups (enemy counters us)

    // Fetch relevant combos (Synergy with Ally)
    const { data: relativeCombos } = await supabase
        .from('hero_combos')
        .select('*')
        .eq('version_id', versionId)
        .in('hero_a_id', allyHeroIds) // Synergy with existing allies

    // NEW: Fetch threats to OUR Team (Candidate Ban counters Our Pick)
    let threatMatchups: any[] = []
    if (allyHeroIds.length > 0) {
        const { data } = await supabase
            .from('matchups')
            .select('*')
            .eq('version_id', versionId)
            .in('enemy_hero_id', allyHeroIds) // Look for matchups against OUR picks
            .gt('win_rate', 51) // Candidate Ban wins against Our Pick (>51% - Lowered threshold)
        threatMatchups = data || []
        console.log(`[DEBUG] Found ${threatMatchups.length} threat matchups for allies:`, allyHeroIds)
    }

    // [NEW] Fetch "Risk Matchups" (Hard Counters)
    // Matchups where we (hero_id) have < 35% WR against enemy (enemy_hero_id)
    const { data: riskMatchups } = await supabase
        .from('matchups')
        .select('hero_id, enemy_hero_id, win_rate')
        .eq('version_id', versionId)
        .lt('win_rate', 35)

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

    // --- 1.1 Scrim Simulator Specific Stats (For Ban Strategy) ---
    // Enhanced: Phase-specific ban tracking
    const scrimBanStats: Record<string, number> = {} // HeroID -> Ban Count (legacy, all phases combined)
    const scrimPhase1Bans: Record<string, { count: number, slots: number[] }> = {} // BAN slots 1-4
    const scrimPhase2Bans: Record<string, { count: number, slots: number[] }> = {} // BAN slots 11-14
    const enemyMVPHeroes: Record<string, { mvpCount: number, wins: number, games: number }> = {} // Enemy's Key Players (MVP heroes)

    // NEW: Track opponent hero pool and winning game patterns
    const opponentHeroPool: Record<string, { picks: number, wins: number }> = {} // Heroes opponent plays
    const winningGameBans: Record<string, number> = {} // Bans in games we won
    const firstPickStats: Record<string, { picks: number, wins: number, roles: Set<string> }> = {} // First pick hero stats

    if (context?.targetTeamName && context.targetTeamName !== 'Cerebro AI') {
        const searchName = context.targetTeamName.replace(/\(Bot\)/i, '').trim()
        console.log("[DEBUG] Fetching Scrim Bans for:", searchName)
        const { data: scrimGames } = await supabase.from('draft_games')
            .select(`winner, blue_team_name, red_team_name, blue_key_player_id, red_key_player_id, picks:draft_picks(hero_id, side, type, pick_order:position_index), match:draft_matches!inner(status, match_type, team_a_name, team_b_name)`)
            .or(`blue_team_name.ilike.%${searchName}%,red_team_name.ilike.%${searchName}%`)
            .eq('match.match_type', 'scrim_simulator') // STRICTLY Full Draft Simulator
            .neq('match.status', 'ongoing')
            .order('created_at', { ascending: false })
            .limit(50) // Analyze last 50 scrims

        if (scrimGames) {
            console.log("[DEBUG] Found Scrim Games:", scrimGames.length)
            scrimGames.forEach((g: any) => {
                const targetName = searchName?.toLowerCase()
                let isBlue = g.blue_team_name?.toLowerCase()?.includes(targetName)
                let isRed = g.red_team_name?.toLowerCase()?.includes(targetName)
                if (!isBlue && !isRed && g.match) {
                    if (g.match.team_a_name?.toLowerCase()?.includes(targetName)) isBlue = true
                    else if (g.match.team_b_name?.toLowerCase()?.includes(targetName)) isRed = true
                }
                if (!isBlue && !isRed) return
                const mySide = isBlue ? 'BLUE' : 'RED'
                const enemySide = isBlue ? 'RED' : 'BLUE'
                const myWon = (g.winner === 'Blue' && isBlue) || (g.winner === 'Red' && isRed)

                // Track our bans by phase
                g.picks?.forEach((p: any) => {
                    if (p.side === mySide && p.type === 'BAN') {
                        scrimBanStats[p.hero_id] = (scrimBanStats[p.hero_id] || 0) + 1

                        // Phase-specific tracking based on slot
                        const slot = p.pick_order || 0
                        if (slot >= 1 && slot <= 4) {
                            // Phase 1 bans
                            if (!scrimPhase1Bans[p.hero_id]) scrimPhase1Bans[p.hero_id] = { count: 0, slots: [] }
                            scrimPhase1Bans[p.hero_id].count++
                            if (!scrimPhase1Bans[p.hero_id].slots.includes(slot)) {
                                scrimPhase1Bans[p.hero_id].slots.push(slot)
                            }
                        } else if (slot >= 11 && slot <= 14) {
                            // Phase 2 bans
                            if (!scrimPhase2Bans[p.hero_id]) scrimPhase2Bans[p.hero_id] = { count: 0, slots: [] }
                            scrimPhase2Bans[p.hero_id].count++
                            if (!scrimPhase2Bans[p.hero_id].slots.includes(slot)) {
                                scrimPhase2Bans[p.hero_id].slots.push(slot)
                            }
                        }
                    }
                })

                // Track enemy MVP heroes (Key Players)
                const enemyMVPId = isBlue ? g.red_key_player_id : g.blue_key_player_id
                if (enemyMVPId) {
                    if (!enemyMVPHeroes[enemyMVPId]) {
                        enemyMVPHeroes[enemyMVPId] = { mvpCount: 0, wins: 0, games: 0 }
                    }
                    enemyMVPHeroes[enemyMVPId].mvpCount++
                    enemyMVPHeroes[enemyMVPId].games++
                    if (!myWon) enemyMVPHeroes[enemyMVPId].wins++ // Enemy won with this MVP
                }

                // NEW: Track opponent hero pool (heroes they play)
                g.picks?.forEach((p: any) => {
                    if (p.side === enemySide && p.type === 'PICK') {
                        if (!opponentHeroPool[p.hero_id]) opponentHeroPool[p.hero_id] = { picks: 0, wins: 0 }
                        opponentHeroPool[p.hero_id].picks++
                        if (!myWon) opponentHeroPool[p.hero_id].wins++ // Opponent won with this hero
                    }
                })

                // NEW: Track bans in games we WON (good ban pattern)
                if (myWon) {
                    g.picks?.forEach((p: any) => {
                        if (p.side === mySide && p.type === 'BAN') {
                            winningGameBans[p.hero_id] = (winningGameBans[p.hero_id] || 0) + 1
                        }
                    })
                }

                // NEW: Track first pick stats (slot 5 or 6)
                g.picks?.forEach((p: any) => {
                    if (p.side === mySide && p.type === 'PICK' && (p.pick_order === 5 || p.pick_order === 6)) {
                        const heroId = p.hero_id
                        if (!firstPickStats[heroId]) firstPickStats[heroId] = { picks: 0, wins: 0, roles: new Set() }
                        firstPickStats[heroId].picks++
                        if (myWon) firstPickStats[heroId].wins++

                        // Track role
                        const hero = heroes.find(h => h.id === heroId)
                        if (hero?.main_position?.[0]) {
                            firstPickStats[heroId].roles.add(hero.main_position[0])
                        }
                    }
                })
            })
            console.log("[DEBUG] Scrim Phase1 Bans:", Object.keys(scrimPhase1Bans).length)
            console.log("[DEBUG] Scrim Phase2 Bans:", Object.keys(scrimPhase2Bans).length)
            console.log("[DEBUG] Enemy MVP Heroes:", Object.keys(enemyMVPHeroes).length)
            console.log("[DEBUG] Opponent Hero Pool:", Object.keys(opponentHeroPool).length)
            console.log("[DEBUG] First Pick Stats:", Object.keys(firstPickStats).length)
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

        // --- SCENARIO: Recording Mode Full Draft Simulator Analysis ---
        // Priority 1: Historical Phase-Specific Bans from Scrim Logs
        if (isPhase1 && scrimPhase1Bans[h.id]) {
            const phaseData = scrimPhase1Bans[h.id]
            if (phaseData.count > 0) {
                const scrimBonus = Math.min(phaseData.count * 25, 75) // High weight for phase-specific data
                score += scrimBonus
                const slotInfo = phaseData.slots.length > 0 ? ` (Slots ${phaseData.slots.join(',')})` : ''
                reasons.push(`🎯 Scrim P1 Ban (${phaseData.count}x)${slotInfo}`)
            }
        } else if (isPhase1 && scrimBanStats[h.id]) {
            // Fallback to general scrim ban stats if no phase-specific data
            const count = scrimBanStats[h.id]
            if (count > 0) {
                const scrimBonus = Math.min(count * 15, 45)
                score += scrimBonus
                reasons.push(`📊 Scrim Ban Pattern (${count}x)`)
            }
        }

        // --- PHASE 1: Enemy MVP Heroes - Priority Ban Target ---
        if (isPhase1 && enemyMVPHeroes[h.id]) {
            const mvpData = enemyMVPHeroes[h.id]
            if (mvpData.mvpCount >= 1) {
                const mvpWinRate = mvpData.games > 0 ? (mvpData.wins / mvpData.games) * 100 : 0
                const mvpBonus = Math.min(mvpData.mvpCount * 30, 90) + (mvpWinRate > 60 ? 20 : 0)
                score += mvpBonus
                reasons.push(`⭐ Enemy MVP (${mvpData.mvpCount}x, ${mvpWinRate.toFixed(0)}% WR)`)
            }
        }

        // --- PHASE 1: Use Ban Statistics + Enemy Team's Preferred Heroes ---
        if (isPhase1) {
            // Check if hero is in enemy team's hero pool (they pick it often)
            const enemyHeroStat = enemyTeamStats?.heroStats?.[h.id]
            if (enemyHeroStat && enemyHeroStat.picks >= 2) {
                const enemyPoolBonus = Math.min(enemyHeroStat.picks * 8, 30)
                score += enemyPoolBonus
                reasons.push(`Enemy Pool (${enemyHeroStat.picks} games)`)
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
                        reasons.push(`Team Pattern (Slot ${context.pickOrder})`)
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
                        reasons.push(`Freq. Opening Ban (${phase1BanCount})`)
                    }
                }
            }

            // S/A Tier Meta picks are priority bans in Phase 1
            if (h.hero_stats?.[0]?.tier === 'S') {
                score += 15
                reasons.push('S Tier Meta')
            } else if (h.hero_stats?.[0]?.tier === 'A') {
                score += 8
                reasons.push('A Tier Meta')
            }
        }

        // --- PHASE 2: High-Impact Denial (Counter & Protect) ---
        if (isPhase2) {
            const totalPicks = allyHeroIds.length + enemyHeroIds.length

            // 2.0 Historical Phase 2 Bans from Scrim
            if (scrimPhase2Bans[h.id]) {
                const phaseData = scrimPhase2Bans[h.id]
                if (phaseData.count > 0) {
                    const scrimBonus = Math.min(phaseData.count * 30, 90)
                    score += scrimBonus
                    const slotInfo = phaseData.slots.length > 0 ? ` (Slots ${phaseData.slots.join(',')})` : ''
                    reasons.push(`🎯 Scrim P2 Ban (${phaseData.count}x)${slotInfo}`)
                }
            }

            // 2.0b Enemy MVP Heroes - Also Priority in Phase 2
            if (enemyMVPHeroes[h.id]) {
                const mvpData = enemyMVPHeroes[h.id]
                if (mvpData.mvpCount >= 1) {
                    const mvpWinRate = mvpData.games > 0 ? (mvpData.wins / mvpData.games) * 100 : 0
                    const mvpBonus = Math.min(mvpData.mvpCount * 25, 75) + (mvpWinRate > 60 ? 15 : 0)
                    score += mvpBonus
                    reasons.push(`⭐ Enemy MVP (${mvpData.mvpCount}x)`)
                }
            }

            // 2.1 Protect Our Picks (Ban Enemy Counters to Pick 1-3)
            // Look for heroes that win against OUR already picked heroes
            const allyHeroes = heroes.filter(ah => allyHeroIds.includes(ah.id))
            let protectScore = 0
            const counteredAllies: string[] = []

            // [NEW] Calculate Enemy Missing Roles to ensure we only ban counters for lanes they haven't picked yet
            const enemyHeroes = heroes.filter(eh => enemyHeroIds.includes(eh.id))
            const enemyRolesFilled = new Set<string>()
            const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']

            enemyHeroes.forEach(eh => {
                // Try to infer role based on main_position
                // (In a real draft, assigned_role is better, but here we infer)
                // Use a greedy match or predefined map if available. 
                // Simple inference:
                if (eh.main_position) {
                    eh.main_position.forEach((p: string) => {
                        const norm = p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)
                        if (STANDARD_ROLES.includes(norm)) enemyRolesFilled.add(norm)
                    })
                }
            })

            // If strict role tracking isn't perfect, we can be lenient. 
            // But the User request is specific: "Analyze from the position opponent hasn't picked yet"
            // So we must try to be strict.
            const enemyMissingRoles = STANDARD_ROLES.filter(r => !enemyRolesFilled.has(r))

            // Iterate our team - picks 1-3 are most important to protect
            for (let i = 0; i < allyHeroes.length; i++) {
                const ally = allyHeroes[i]

                // Find enemies that counter 'ally'
                const vsAlly = relativeMatchups?.find(m => m.hero_id === h.id && m.enemy_hero_id === ally.id)

                // LOGIC: High Threat Counter AND Enemy Needs Role
                if (vsAlly && vsAlly.win_rate > 52) {
                    // Check if 'h' (The Counter Hero) fills a generic role the enemy is missing
                    const hRoles = h.main_position?.map((p: string) => p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)) || []
                    const isLaneThreat = hRoles.some((r: string) => enemyMissingRoles.includes(r))

                    if (isLaneThreat) {
                        // Higher multiplier because it's a VALID Lane Counter
                        const threat = (vsAlly.win_rate - 50) * 5
                        protectScore += threat
                        // Format: "Beat Zata 60%"
                        counteredAllies.push(`Beat ${ally.name} ${vsAlly.win_rate.toFixed(0)}%`)
                    }
                }
            }

            if (protectScore > 0) {
                score += protectScore
                reasons.push(`${counteredAllies.slice(0, 2).join(', ')}`)
            }

            // 2.2 Deny Enemy Win Conditions (Comfort Picks)
            // If Enemy plays this hero often and wins often -> Ban it
            const enemyHeroStat = enemyTeamStats?.heroStats?.[h.id]
            if (enemyHeroStat && enemyHeroStat.picks >= 1) {
                // [NEW] Role Check: Does enemy need this role?
                const hRoles = h.main_position?.map((p: string) => p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)) || []
                const enemyNeedsRole = hRoles.some((r: string) => enemyMissingRoles.includes(r))

                if (enemyNeedsRole) {
                    const enemyWR = (enemyHeroStat.wins / enemyHeroStat.picks) * 100
                    if (enemyWR >= 60 || enemyHeroStat.picks >= 3) {
                        const comfortBonus = 30 + (enemyHeroStat.picks * 5)
                        score += comfortBonus
                        reasons.push(`Enemy Comfort (${enemyHeroStat.picks}g, ${enemyWR.toFixed(0)}% WR)`)
                    }
                }
            }

            // 2.3 Predict Missing Roles (Standard Logic preserved)
            if (totalPicks >= 6) {
                // We already calculated enemyMissingRoles above
                if (h.main_position?.some((p: string) => {
                    const norm = p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)
                    return enemyMissingRoles.includes(norm)
                })) {
                    score += 15
                    reasons.push(`Deny Role: ${h.main_position[0]}`)
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

    console.log('[DEBUG] SmartBan Scores count:', Object.keys(smartBanScores).length)

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

    // [NEW] 3.0 Pre-calculate Missing Roles for PICK Phase
    const missingRoles: string[] = []
    if (context?.phase === 'PICK') {
        const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
        const allyHeroes = heroes.filter(h => allyHeroIds.includes(h.id))

        // Simple Greedy Role Assignment (Prioritize specialists)
        const tempRoles = new Set<string>()
        const sortedAllies = [...allyHeroes].sort((a, b) => (a.main_position?.length || 0) - (b.main_position?.length || 0))

        sortedAllies.forEach(h => {
            const role = h.main_position?.find((r: string) => {
                const normalized = r === 'Abyssal' ? 'Abyssal Dragon' : (r === 'Support' ? 'Roam' : r)
                return STANDARD_ROLES.includes(normalized) && !tempRoles.has(normalized)
            })
            if (role) {
                const normalized = role === 'Abyssal' ? 'Abyssal Dragon' : (role === 'Support' ? 'Roam' : role)
                tempRoles.add(normalized)
            }
        })

        STANDARD_ROLES.forEach(r => {
            if (!tempRoles.has(r)) missingRoles.push(r)
        })
        // console.log(`[DEBUG] Missing Roles: ${missingRoles.join(', ')}`)
    }

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

        const reasons: string[] = []

        // BASE SCORE (Meta/Global)
        // If meta weight is 0, we shouldn't rely on global winrate? 
        // Let's assume Base is 50.
        let base = h.hero_stats?.[0]?.win_rate || 50
        if (wMeta > 0) {
            score += base
            reasons.push(`Base Score (${Math.round(base)}% Win Rate) +${Math.round(base)}`)
        }

        // --- [NEW] ROLE PENALTY ---
        if (context?.phase === 'PICK' && missingRoles.length > 0) {
            // Check if hero can fill ANY of the missing roles
            const canFillMissing = h.main_position?.some((pos: string) => {
                const normalized = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                return missingRoles.includes(normalized)
            })

            if (!canFillMissing) {
                const penalty = 150
                score -= penalty
                reasons.push(`Role Filled (Need ${missingRoles.join('/')}) -${penalty}`)
            }
        }

        // --- [NEW] RISKPENALTY: Check if choosing this hero exposes us to a Hard Counter ---
        // Requirement: Enemy must have a "Missing Role" that the Counter fits into.
        // We need to know what roles the ENEMY is missing.
        let enemyMissingRoles: string[] = []
        if (context?.phase === 'PICK') {
            const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
            const enemyHeroes = heroes.filter(eh => enemyHeroIds.includes(eh.id))
            const enemyRoles = new Set<string>()

            // Greedy assignment for enemy to see what's filled
            const sortedEnemies = [...enemyHeroes].sort((a, b) => (a.main_position?.length || 0) - (b.main_position?.length || 0))
            sortedEnemies.forEach(eh => {
                const role = eh.main_position?.find((r: string) => {
                    const norm = r === 'Abyssal' ? 'Abyssal Dragon' : (r === 'Support' ? 'Roam' : r)
                    return STANDARD_ROLES.includes(norm) && !enemyRoles.has(norm)
                })
                if (role) {
                    const norm = role === 'Abyssal' ? 'Abyssal Dragon' : (role === 'Support' ? 'Roam' : role)
                    enemyRoles.add(norm)
                }
            })
            enemyMissingRoles = STANDARD_ROLES.filter(r => !enemyRoles.has(r))
        }

        if (context?.phase === 'PICK' && enemyMissingRoles.length > 0) {
            const potentialCounters = riskMatchups?.filter(m =>
                m.hero_id === h.id &&
                !allyHeroIds.includes(m.enemy_hero_id) &&
                !enemyHeroIds.includes(m.enemy_hero_id) &&
                !bannedHeroIds.includes(m.enemy_hero_id) &&
                !allyGlobalBans.includes(m.enemy_hero_id) // Exclude globally banned heroes (picked in previous games)
            ) || []

            const validCounters = potentialCounters.filter(m => {
                const counterHero = heroes.find(ch => ch.id === m.enemy_hero_id)
                if (!counterHero) return false

                // Check if ANY of the counter's roles fits an EMPTY enemy slot
                return counterHero.main_position?.some((pos: string) => {
                    const normalized = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                    return enemyMissingRoles.includes(normalized)
                })
            })

            if (validCounters.length > 0) {
                // Sort by severity (lowest win rate for us = highest threat)
                const worstThreat = validCounters.sort((a, b) => a.win_rate - b.win_rate)[0]
                const counterHeroName = heroes.find(x => x.id === worstThreat.enemy_hero_id)?.name

                // Calculate penalty: Starts at 50, increases as WR drops below 35%
                // Example: WR 30% -> Penalty 50 + (35-30)*4 = 70
                // Example: WR 20% -> Penalty 50 + (35-20)*4 = 110
                const penalty = 50 + Math.max(0, (35 - worstThreat.win_rate) * 4)

                score -= penalty
                reasons.push(`⚠️ Risk: Exposed to ${counterHeroName} (${worstThreat.win_rate.toFixed(0)}% WR) -${Math.round(penalty)}`)
            }
        }

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

        // 3.3 [Draft Logic] Comparison with Enemy - Calculate against ALL enemy heroes
        if (wCounter > 0) {
            // For PICK phase: Counter enemy picks | For BAN phase: Find threats to OUR picks
            if (context?.phase === 'BAN') {
                // BAN Phase: Find heroes that threaten OUR picks
                const threatMatches = relativeMatchups?.filter(m => m.hero_id === h.id && allyHeroIds.includes(m.enemy_hero_id)) || []
                if (threatMatches.length > 0) {
                    let totalThreatBonus = 0
                    const threatDetails: string[] = []
                    threatMatches.forEach(tm => {
                        const allyName = queryHeroName(tm.enemy_hero_id, heroes)
                        const bonus = Math.max((tm.win_rate - 50) * 4, 5)
                        totalThreatBonus += bonus
                        threatDetails.push(allyName)
                    })
                    const weightedBonus = totalThreatBonus * wCounter
                    score += weightedBonus
                    const uniqueNames = Array.from(new Set(threatDetails))
                    reasons.push(`Threatens ${uniqueNames.join(', ')} +${Math.round(weightedBonus)}`)
                }
            } else {
                // PICK Phase: Counter enemy picks (original logic)
                const counterMatches = relativeMatchups?.filter(m => m.hero_id === h.id) || []

                if (counterMatches.length > 0) {
                    let totalCounterBonus = 0
                    const counterDetails: string[] = []

                    counterMatches.forEach(counterMatch => {
                        const enemyName = queryHeroName(counterMatch.enemy_hero_id, heroes)
                        const winAdvantage = counterMatch.win_rate - 50
                        const bonus = Math.max(winAdvantage * 3, 5)
                        totalCounterBonus += bonus
                        counterDetails.push(`${enemyName}`)
                    })

                    const weightedBonus = totalCounterBonus * wCounter
                    score += weightedBonus

                    // Show all countered enemies in reason (Unique names only)
                    const uniqueCounterNames = Array.from(new Set(counterDetails))
                    if (uniqueCounterNames.length === 1) {
                        reasons.push(`Hard Counter to ${uniqueCounterNames[0]} +${Math.round(weightedBonus)}`)
                    } else {
                        reasons.push(`Counters ${uniqueCounterNames.join(', ')} +${Math.round(weightedBonus)}`)
                    }
                }
            } // Close else block (PICK phase)

            // 3.3b [Draft Logic] Penalty for being countered by enemy
            const counteredMatches = counteredByMatchups?.filter(m => m.hero_id === h.id) || []

            if (counteredMatches.length > 0) {
                let totalPenalty = 0
                const counteredByDetails: string[] = []

                counteredMatches.forEach(match => {
                    const enemyName = queryHeroName(match.enemy_hero_id, heroes)
                    const winDisadvantage = 50 - match.win_rate // How much below 50%
                    const penalty = Math.max(winDisadvantage * 2, 5) // Smaller multiplier than counter bonus
                    totalPenalty += penalty
                    counteredByDetails.push(`${enemyName}`)
                })

                const weightedPenalty = totalPenalty * wCounter
                score -= weightedPenalty

                // Show all enemies that counter us (Unique names only)
                const uniqueCounteredByNames = Array.from(new Set(counteredByDetails))
                if (uniqueCounteredByNames.length === 1) {
                    reasons.push(`Countered by ${uniqueCounteredByNames[0]} -${Math.round(weightedPenalty)}`)
                } else {
                    reasons.push(`Weak vs ${uniqueCounteredByNames.join(', ')} -${Math.round(weightedPenalty)}`)
                }
            }
        }

        // 3.4 [Draft Logic] Synergy
        if (wSynergy > 0) {
            const synergyCombo = relativeCombos?.find(c => c.hero_b_id === h.id)
            if (synergyCombo) {
                const partnerName = queryHeroName(synergyCombo.hero_a_id, heroes)
                // const synergyBonus = (synergyCombo.synergy_score / 4) * wSynergy // OLD

                // NEW: Fixed +100 as requested
                const synergyBonus = 100 * wSynergy

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

            // Find which needed role this hero fits
            const fittingRole = h.main_position?.find((p: string) => neededRoles.includes(p))
            const fitsRole = !!fittingRole

            if (fitsRole) {
                // Give bonus for filling a needed role
                const roleBonus = 30 * wRoster // Bonus for fitting needed role
                score += roleBonus
                reasons.push(`Fills ${fittingRole} +${Math.round(roleBonus)}`)
                const rosterPlayer = teamRoster.find((p: any) => h.main_position?.some((pos: string) => p.roster_role === pos || (p.positions && p.positions.includes(pos))))

                if (rosterPlayer) {
                    let signatureBonus = 15 * wRoster
                    let bonusReason = `${rosterPlayer.name} Main`

                    // Check player's hero performance (wins/picks from teamStats.heroStats)
                    const heroStats = teamStats.heroStats[h.id]

                    if (heroStats && heroStats.picks >= 1) {
                        // [NEW] 1. Experience Bonus (Pure Game Count)
                        const xpBonus = heroStats.picks
                        signatureBonus += xpBonus
                        bonusReason += ` (+${xpBonus} XP)`

                        // [NEW] 2. Role Specific Comfort (Played in THIS Role)
                        if (fittingRole) {
                            // Normalize role to look up in roleStats
                            const normRole = fittingRole === 'Abyssal Dragon' ? 'Abyssal' : (fittingRole === 'Roam' ? 'Roam' : fittingRole)
                            // Map 'Abyssal' back to what might be in roleStats if needed, but teamStats uses normalized keys?
                            // teamStats roleStats keys are normalized in lines 264.
                            // Let's check teamStats normalization logic: 
                            // Line 201: 'Abyssal' -> 'Abyssal'
                            // My fittingRole might be 'Abyssal' or 'Abyssal Dragon'.
                            // Safe normalization:
                            let lookupRole = fittingRole
                            if (fittingRole === 'Abyssal Dragon') lookupRole = 'Abyssal'
                            if (fittingRole === 'Support') lookupRole = 'Roam'

                            const roleSpecificParams = heroStats.roleStats?.[lookupRole]
                            if (roleSpecificParams && roleSpecificParams.picks >= 1) {
                                // High bonus for verifying they play it in this position
                                const roleComfortBonus = 20 * wRoster
                                signatureBonus += roleComfortBonus
                                const roleWR = Math.round((roleSpecificParams.wins / roleSpecificParams.picks) * 100)
                                bonusReason += ` • ${lookupRole} Main (${roleSpecificParams.picks}g ${roleWR}%)`
                            }
                        }

                        const winRate = heroStats.wins / heroStats.picks
                        // const winPct = Math.round(winRate * 100) // Unused?

                        // Add game count to display
                        // bonusReason += ` (${heroStats.wins}W/${heroStats.picks - heroStats.wins}L)` // Already covered by XP/Role text

                        if (heroStats.picks >= 2) {
                            if (winRate >= 0.7) {
                                // 70%+ win rate - high bonus
                                const winBonus = 15 * wRoster
                                signatureBonus += winBonus
                            } else if (winRate >= 0.5) {
                                // 50-69% win rate - moderate bonus
                                const winBonus = 8 * wRoster
                                signatureBonus += winBonus
                            } else if (winRate < 0.4 && heroStats.picks >= 3) {
                                // Below 40% with 3+ games - penalty
                                const penalty = 10 * wRoster
                                signatureBonus -= penalty
                            }
                        }
                    }

                    score += signatureBonus
                    reasons.push(`${bonusReason} +${Math.round(signatureBonus)}`)
                } else {
                    const roleBonus = 10
                    score += roleBonus
                    reasons.push(`Basic Role Fit +${roleBonus}`)
                    // Base role fit isn't multiplied by roster weight?? Maybe it should.
                    // Actually, Role Fit is fundamental logic, not just "Roster Dominance". 
                    // But if we are in "Free Style" mode (Roster=0), maybe we don't care about roles? No, Role Fit is constraints.
                    // Keep Role Fit unweighted or weighted by Meta? Let's leave Role Fit as Base Logic (unweighted or weight 1).
                    // BUT penalize missing role heavily.
                }
            } else {
                // Hero doesn't fit any needed role - apply heavy penalty
                // Penalty increases as team gets more complete
                if (allyHeroIds.length >= 2) {
                    // Scale penalty: more picks = heavier penalty
                    // 2 picks = -100, 3 picks = -150, 4 picks = -200
                    const basePenalty = 100
                    const scaleFactor = allyHeroIds.length - 1 // 1x at 2 picks, 2x at 3, 3x at 4
                    const penalty = basePenalty * scaleFactor
                    score -= penalty
                    reasons.push(`Role Filled (${h.main_position?.[0] || 'Unknown'}) -${penalty}`)
                }
            }
        }

        // 3.6 [Ban Priority]
        // 3.6 [Ban Priority]
        // 3.6 [Ban Priority]
        // 3.6 [Ban Priority]
        if (context?.phase === 'BAN' || h.is_ban_suggestion) { // Explicitly check if we are in Ban Suggestion Mode

            // [NEW] Calc Enemy Missing Roles for usage here if context.phase is BAN
            let banEnemyMissingRoles: string[] = []
            if (context?.phase === 'BAN') {
                const enemyHeroes = heroes.filter(eh => enemyHeroIds.includes(eh.id))
                const enemyRolesFilled = new Set<string>()
                const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
                enemyHeroes.forEach(eh => {
                    if (eh.main_position) {
                        eh.main_position.forEach((p: string) => {
                            const norm = p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)
                            if (STANDARD_ROLES.includes(norm)) enemyRolesFilled.add(norm)
                        })
                    }
                })
                banEnemyMissingRoles = STANDARD_ROLES.filter(r => !enemyRolesFilled.has(r))
            }

            // 3.6a Deny Enemy Main (Original)
            if (wBan > 0 && enemyKeyPlayerIds.has(h.id)) {
                // [NEW] Role Check
                const hRoles = h.main_position?.map((p: string) => p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)) || []
                const enemyNeedsRole = hRoles.some((r: string) => banEnemyMissingRoles.includes(r))

                if (enemyNeedsRole) {
                    const banBonus = 20 * wBan
                    score += banBonus
                    reasons.push(`Deny Enemy Main +${Math.round(banBonus)}`)
                }
            }

            // 3.6b [NEW] Protect Comp: Ban heroes that counter US
            const threats = threatMatchups?.filter(m => m.hero_id === h.id) || []
            if (threats.length > 0) {
                // [NEW] Role Check
                const hRoles = h.main_position?.map((p: string) => p === 'Abyssal' ? 'Abyssal Dragon' : (p === 'Support' ? 'Roam' : p)) || []
                const enemyNeedsRole = hRoles.some((r: string) => banEnemyMissingRoles.includes(r))

                if (enemyNeedsRole) {
                    let totalThreatBonus = 0
                    const threatNames: string[] = []

                    threats.forEach(threat => {
                        const myHeroName = queryHeroName(threat.enemy_hero_id, heroes)
                        const winAdvantage = threat.win_rate - 50 // How much Candidate Ban wins against Us
                        const bonus = Math.max(winAdvantage * 4, 10) // High multiplier for protection
                        totalThreatBonus += bonus
                        threatNames.push(myHeroName)
                    })

                    const weightedThreat = totalThreatBonus * wBan
                    score += weightedThreat

                    const uniqueThreatNames = Array.from(new Set(threatNames))
                    if (uniqueThreatNames.length === 1) {
                        reasons.push(`Protect ${uniqueThreatNames[0]} (High Threat) +${Math.round(weightedThreat)}`)
                    } else {
                        reasons.push(`Protect Team (Threatens ${uniqueThreatNames.join(', ')}) +${Math.round(weightedThreat)}`)
                    }
                }
            }
        }

        // 3.7 [Draft Strategy] Role Priority per Slot
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

        // 3.7b [CEREBRO AI] Draft Strategy Analysis - Role Priority per Slot
        // Use draftSlot (actual draft sequence position like 5, 8, 9, 16, 17) not pickOrder (1-5)
        if (context?.draftSlot && context?.phase === 'PICK' && draftStrategyStats) {
            // Get side-specific stats or fall back to general
            let targetPickOrderStats = draftStrategyStats.pickOrderStats
            if (context.side === 'BLUE' && draftStrategyStats.sideStats?.BLUE?.pickOrderStats) {
                targetPickOrderStats = draftStrategyStats.sideStats.BLUE.pickOrderStats
            } else if (context.side === 'RED' && draftStrategyStats.sideStats?.RED?.pickOrderStats) {
                targetPickOrderStats = draftStrategyStats.sideStats.RED.pickOrderStats
            }

            if (targetPickOrderStats && targetPickOrderStats[context.draftSlot]) {
                const slotRoleStats = targetPickOrderStats[context.draftSlot]
                const totalPicks = Object.values(slotRoleStats).reduce((a, b) => a + b, 0)

                if (totalPicks > 0 && h.main_position && h.main_position.length > 0) {
                    // Get sorted roles for this slot
                    const sortedRoles = Object.entries(slotRoleStats)
                        .map(([role, count]) => ({ role, count: count as number, pct: ((count as number) / totalPicks) * 100 }))
                        .sort((a, b) => b.count - a.count)

                    // Check if hero matches any of the top roles
                    let matchesTopRole = false
                    for (let roleIdx = 0; roleIdx < sortedRoles.length && roleIdx < 2; roleIdx++) {
                        const roleData = sortedRoles[roleIdx]
                        const heroMatchesRole = h.main_position.some((pos: string) =>
                            pos.toLowerCase().includes(roleData.role.toLowerCase()) ||
                            roleData.role.toLowerCase().includes(pos.toLowerCase())
                        )

                        if (heroMatchesRole && roleData.pct >= 20) { // Only count if role appears >= 20% of the time
                            // Scale bonus by percentage and rank
                            const baseBonus = roleIdx === 0 ? 40 : 20 // Top role = 40, Second = 20
                            const scaledBonus = Math.round(baseBonus * (roleData.pct / 100))
                            const finalBonus = Math.max(scaledBonus, roleIdx === 0 ? 15 : 8) // Minimum bonus

                            score += finalBonus
                            reasons.push(`Draft Order (Slot #${context.draftSlot}: ${roleData.role} ${Math.round(roleData.pct)}%) +${finalBonus}`)
                            matchesTopRole = true
                            break // Only apply highest matching bonus
                        }
                    }

                    // 3.7c [Draft Order] Penalty for Wrong Role (if Team strongly prioritizes a role)
                    // If the top role for this slot is very dominant (>50%) and this hero DOES NOT belong to it, apply penalty
                    if (!matchesTopRole && sortedRoles.length > 0) {
                        const topRole = sortedRoles[0]
                        if (topRole.pct > 50) {
                            // Check if hero is completely outside the top role
                            const isSameRole = h.main_position.some((pos: string) =>
                                pos.toLowerCase().includes(topRole.role.toLowerCase()) ||
                                topRole.role.toLowerCase().includes(pos.toLowerCase())
                            )

                            if (!isSameRole) {
                                // Penalty scale: -20 (at 50%) to -40 (at 100%)
                                const penaltyBase = 20 + ((topRole.pct - 50) * 0.4)
                                const penalty = Math.round(penaltyBase) * -1
                                score += penalty
                                reasons.push(`Draft Order (Needs ${topRole.role}) ${penalty}`)
                            }
                        }
                    }
                }
            }
        }

        // 3.8. [First Pick Specific Logic] (NEW)
        if (context?.pickOrder === 1 && !firstPickStats[h.id]) { // Only if we don't already have specific first pick stats (handled below)
            // Generic First Pick Logic if no historical data
        }

        // 3.8a [First Pick] Historical First Pick Pattern
        if (context?.pickOrder && (context.pickOrder === 1 || context.pickOrder === 2)) { // Slot 1 or 2 (First Pick Phase)
            if (firstPickStats[h.id]) {
                const fps = firstPickStats[h.id]
                const pickRate = fps.picks / teamStats.games
                const winRate = fps.wins / fps.picks

                const bonus = (pickRate * 20) + (winRate * 30)
                score += bonus
                reasons.push(`Team First Pick Preference (${Math.round(winRate * 100)}% WR) +${Math.round(bonus)}`)
            }
        }

        // 3.8b [First Pick] Deny Opponent Best Heroes
        if (context?.pickOrder === 1) {
            const oppStats = opponentHeroPool[h.id]
            if (oppStats && oppStats.picks >= 2) {
                const oppWinRate = oppStats.wins / oppStats.picks
                if (oppWinRate > 0.6) {
                    const denyBonus = 40 // High priority to deny
                    score += denyBonus
                    reasons.push(`Deny Opponent Main (${Math.round(oppWinRate * 100)}% WR) +${denyBonus}`)
                }
            }
        }

        // 3.8c [First Pick] Counter Opponent Pool (General)
        // Check if this hero counters many of opponent's frequently played heroes
        if (context?.pickOrder === 1) {
            let poolCounterBonus = 0
            let counteredCount = 0

            Object.entries(opponentHeroPool).forEach(([oppHeroId, stats]) => {
                if (stats.picks >= 2) { // Only consider heroes they actually play
                    // Check if h counters oppHeroId
                    const match = relativeMatchups?.find(m => m.hero_id === h.id && m.enemy_hero_id === oppHeroId)
                    if (match && match.win_rate > 53) {
                        poolCounterBonus += 15
                        counteredCount++
                    }
                }
            })

            if (counteredCount > 0) {
                const finalBonus = Math.min(poolCounterBonus, 60) // Cap at 60
                score += finalBonus
                reasons.push(`Counters Opponent Pool (${counteredCount} heroes) +${finalBonus}`)
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
            reason: analystScores[h.id]?.reasons.join(' • ') || 'Solid Pick',
            type: 'hybrid' as const
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)



    let smartBanRecs = Object.entries(smartBanScores)
        .map(([id, s]) => {
            const h = heroes?.find(x => x.id === id)
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

    // --- NEW: Phase-specific ban recommendations ---
    // Filter bans that are specifically strong for Phase 1 (based on scrim P1 data and MVP)
    let smartBanPhase1 = Object.entries(smartBanScores)
        .map(([id, s]) => {
            const h = heroes?.find(x => x.id === id)
            if (!h) return null
            // Boost score for Phase 1 specific indicators
            let phase1Score = s.score
            if (scrimPhase1Bans[id]) phase1Score += 20
            if (enemyMVPHeroes[id]) phase1Score += 30
            return {
                hero: h,
                score: phase1Score,
                reason: s.reasons.join(' • ') || 'Strategic Ban',
                type: 'ban' as const,
                phase: 'PHASE_1' as const
            }
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, 20) as any[]

    // Filter bans that are specifically strong for Phase 2 (based on counter analysis and P2 scrim data)
    let smartBanPhase2 = Object.entries(smartBanScores)
        .map(([id, s]) => {
            const h = heroes?.find(x => x.id === id)
            if (!h) return null
            // Boost score for Phase 2 specific indicators
            let phase2Score = s.score
            if (scrimPhase2Bans[id]) phase2Score += 30
            if (s.reasons.some(r => r.includes('Counter'))) phase2Score += 25
            return {
                hero: h,
                score: phase2Score,
                reason: s.reasons.join(' • ') || 'Strategic Ban',
                type: 'ban' as const,
                phase: 'PHASE_2' as const
            }
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, 20) as any[]

    // --- NEW: Enemy Key Heroes (MVP Heroes remaining) ---
    const enemyKeyHeroesFormatted = Object.entries(enemyMVPHeroes)
        .map(([id, data]) => {
            const h = heroes?.find(x => x.id === id)
            if (!h) return null
            const isBanned = bannedHeroIds.includes(id)
            const isPicked = enemyHeroIds.includes(id)
            return {
                hero: h,
                mvpCount: data.mvpCount,
                wins: data.wins,
                games: data.games,
                winRate: data.games > 0 ? (data.wins / data.games) * 100 : 0,
                status: isBanned ? 'BANNED' : isPicked ? 'PICKED' : 'AVAILABLE'
            }
        })
        .filter(Boolean)
        .sort((a, b) => b!.mvpCount - a!.mvpCount || b!.winRate - a!.winRate)
        .slice(0, 6) as any[]

    // FALLBACK: If smartBan is empty (no stats), use Top Picks (Meta) as Ban Suggestions
    if (smartBanRecs.length === 0) {
        console.log("Avoid empty Ban list: Fallback to Meta Picks")
        smartBanRecs = sortedRecs.map(r => ({
            ...r,
            type: 'ban' as const,
            reason: 'High Priority Meta Pick (Fallback)'
        }))
    }

    // Ensure Phase 1 and Phase 2 also have fallback if empty
    if (smartBanPhase1.length === 0) {
        smartBanPhase1 = smartBanRecs.map(r => ({ ...r, phase: 'PHASE_1' as const }))
    }
    if (smartBanPhase2.length === 0) {
        smartBanPhase2 = smartBanRecs.map(r => ({ ...r, phase: 'PHASE_2' as const }))
    }

    console.log('[DEBUG] Return Phase1:', smartBanPhase1.length, 'Phase2:', smartBanPhase2.length, 'SmartBan:', smartBanRecs.length)

    // --- Prepare Data for History Analysis ---
    // Use passed draftStrategyStats (CEREBRO) if available, otherwise rely on local scrim stats
    const strategyPhase1Bans: Record<string, any> = {}
    const strategyPhase2Bans: Record<string, any> = {}

    // Determine which stats to use (Side specific if context provided, otherwise general)
    // Determine which stats to use (Side specific if context provided, otherwise general)
    const statsAny = draftStrategyStats as any
    let banSource = statsAny?.banOrderStats || {}
    if (context?.side && statsAny?.sideStats?.[context.side]?.banOrderStats) {
        banSource = statsAny.sideStats[context.side].banOrderStats
    }

    [1, 2, 3, 4].forEach((slot: number) => {
        const slotData = banSource[slot] || {}
        Object.entries(slotData).forEach(([hid, count]) => {
            if (!strategyPhase1Bans[hid]) strategyPhase1Bans[hid] = { count: 0 }
            strategyPhase1Bans[hid].count += (count as number)
        })
    });

    [11, 12, 13, 14].forEach((slot: number) => {
        const slotData = banSource[slot] || {}
        Object.entries(slotData).forEach(([hid, count]) => {
            if (!strategyPhase2Bans[hid]) strategyPhase2Bans[hid] = { count: 0 }
            strategyPhase2Bans[hid].count += (count as number)
        })
    })

    // Use Strategy Bans if available, else fallback to Scrim Bans
    const effectivePhase1Bans = Object.keys(strategyPhase1Bans).length > 0 ? strategyPhase1Bans : scrimPhase1Bans
    const effectivePhase2Bans = Object.keys(strategyPhase2Bans).length > 0 ? strategyPhase2Bans : scrimPhase2Bans

    return {
        analyst: sortedRecs,
        history: sortedRecs,
        hybrid: sortedRecs,
        smartBan: smartBanRecs,
        // NEW: Phase-specific recommendations
        smartBanPhase1,
        smartBanPhase2,
        enemyKeyHeroes: enemyKeyHeroesFormatted,
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
        composition: calculateComposition(allyHeroIds, heroes),
        historyAnalysis: getHistoryRecommendations(mode, context, availableHeroes, teamStats, enemyTeamStats, relativeMatchups || [], relativeCombos || [], effectivePhase1Bans, effectivePhase2Bans, allyHeroIds, enemyHeroIds, heroes)
    }
}



// --- NEW: History Analysis Logic ---
function getHistoryRecommendations(
    mode: 'team' | 'global',
    context: any,
    availableHeroes: Hero[],
    teamStats: any,
    enemyTeamStats: any,
    matchups: any[],
    combos: any[],
    phase1Bans: Record<string, any>,
    phase2Bans: Record<string, any>,
    allyHeroIds: string[],
    enemyHeroIds: string[],
    allHeroes: Hero[]
) {
    const recs: Recommendation[] = []
    const isTeamMode = mode === 'team'
    const isBanPhase = context?.phase === 'BAN'
    const isPickPhase = context?.phase === 'PICK'

    // Determine specific sub-phase
    const currentSlot = (context?.bannedHeroIds?.length || 0) + (context?.pickOrder || 0) // Approximation

    // Ban Phase 2 Check
    // Phase 1 Bans happen BEFORE any picks. 
    // If there are ANY picks (ally or enemy), or if bans >= 4, we are in Phase 2 or later.
    const hasPicks = allyHeroIds.length > 0 || enemyHeroIds.length > 0
    const isBanPhase2 = isBanPhase && (hasPicks || (context?.bannedHeroIds?.length || 0) >= 4)

    // --- Identify Missing Roles (Role-Based Filtering) ---
    // Uses shared exported functions

    const filledRoles = resolveTeamRoles(allyHeroIds, allHeroes)
    const missingRoles = STANDARD_ROLES.filter(r => !filledRoles.has(r))
    const isFullTeam = allyHeroIds.length >= 5

    // [NEW] Resolve Enemy Roles for Smart Ban
    const enemyFilledRoles = resolveTeamRoles(enemyHeroIds, allHeroes)
    const enemyMissingRoles = STANDARD_ROLES.filter(r => !enemyFilledRoles.has(r))

    availableHeroes.forEach(h => {
        let score = 0
        const reasons: string[] = []

        // --- BAN PHASE 1 LOGIC ---
        // Only run if NOT Phase 2
        if (isBanPhase && !isBanPhase2) {
            // 1. Problematic Enemies (They beat us)
            if (isTeamMode) {
                // Check if this hero has high win rate against US (Team Specific)
                if (teamStats.heroStats[h.id]) {
                    // logic placeholder
                }
            }

            // Simple: Frequent Bans (Comfort Bans)
            // Use effective bans source passed in
            if (isTeamMode && phase1Bans[h.id]) {
                const count = phase1Bans[h.id].count
                score += count * 20
                reasons.push(`Frequent Team Ban (${count}x)`)
            } else if (isTeamMode && teamStats.banOrderStats) {
                // Fallback to general ban stats if phase1Bans is empty in context but exists in full stats
                let totalBans = 0
                Object.values(teamStats.banOrderStats as Record<string, Record<string, number>>).forEach(slotData => {
                    if (slotData[h.id]) totalBans += slotData[h.id]
                })
                if (totalBans > 0) {
                    score += totalBans * 15
                    reasons.push(`Frequent Team Ban (${totalBans}x)`)
                }
            }

            // Global: Meta Bans
            if (!isTeamMode) {
                const banRate = h.hero_stats?.[0]?.ban_rate || 0
                if (banRate > 15) {
                    score += banRate
                    reasons.push(`Global Ban Rate (${banRate}%)`)
                }
            }
        }

        // --- BAN PHASE 2 LOGIC (Smart Target Bans) ---
        // Trigger if Ban Phase AND NOT Phase 1 (so > 4 bans)
        // Or if we specifically detect Ban Phase 2 context
        if (isBanPhase && isBanPhase2) {
            // 1. Role Check: Only recommend banning heroes for EMPTY enemy roles
            // Assume strict role filtering for bans too
            const heroRoles = h.main_position || []
            const relevantForEnemy = heroRoles.some(r => enemyMissingRoles.includes(normalizeRole(r)))

            if (!relevantForEnemy) {
                // Severe Penalty if enemy already has this role filled (e.g. banning Jungle when they have Zill)
                score -= 1000
            } else {
                // 2. High Value Bans for Missing Roles
                // Check if this hero is a "High Win Rate" or "Meta" hero 
                const banRate = h.hero_stats?.[0]?.ban_rate || 0
                if (banRate > 10) {
                    score += banRate
                    reasons.push(`Block Meta Role (${banRate}%)`)
                }

                // Check Scrim Data (Phase 2 Specific)
                if (isTeamMode && phase2Bans[h.id]) {
                    const count = phase2Bans[h.id].count
                    score += count * 25
                    reasons.push(`Frequent Phase 2 Ban`)
                }
            }
        }

        // --- PICK PHASE LOGIC ---
        if (isPickPhase) {
            // 0. Role Filling Priority (CRITICAL)
            // If team is full, ignore roles. If not, prioritize needed roles.
            if (!isFullTeam) {
                const heroRoles = h.main_position || []

                const fillsMissing = heroRoles.some(r => {
                    const norm = normalizeRole(r)
                    return missingRoles.includes(norm)
                })

                if (fillsMissing) {
                    score += 50 // Huge bonus for needed role
                    const needed = heroRoles.find(r => missingRoles.includes(normalizeRole(r)))
                    reasons.push(`Fills ${needed}`)
                } else if (filledRoles.size > 0 && heroRoles.length > 0) {
                    // Hero only provides roles we ALREADY have
                    // Strict penalty to hide them
                    score -= 1000
                    reasons.push('Role Overlap')
                }
            }

            // 1. Synergy (Combo)
            const synergy = combos.find(c => c.hero_b_id === h.id)
            if (synergy) {
                // Mode separation? Synergy data usually global unless we have team-specific synergy table.
                // Assuming global data for now, maybe filtered by team games later.
                score += 50
                reasons.push('Combo Synergy')
            }

            // 2. Counter Pick (Lane)
            // If picking AFTER enemy in same lane
            // ... (Simple placeholder logic for now as detailed counter logic is complex)
            const counter = matchups.find(m => m.hero_id === h.id && m.win_rate > 55)
            if (counter) {
                score += (counter.win_rate - 50) * 5
                reasons.push(`Counters Enemy`)
            }

            // 3. Role History (Team Preference)
            if (isTeamMode) {
                const picks = teamStats.heroStats[h.id]?.picks || 0
                if (picks > 0) {
                    score += picks * 10
                    reasons.push(`Team Comfort (${picks} games)`)
                }
            }
        }

        if (score > 0) {
            recs.push({
                hero: h,
                score,
                reason: reasons.join(', '),
                type: 'history'
            })
        }
    })

    // [FALLBACK] If Global Mode and no recommendations, show Top Meta
    if (!isTeamMode && recs.length < 5) {
        const keyStat = isBanPhase ? 'ban_rate' : 'win_rate' // Use win_rate for picks as it's a better quality signal

        // Sort all available heroes by the key stat
        const topMeta = availableHeroes
            .filter(h => {
                // Filter out already recommended heroes
                return !recs.find(r => r.hero.id === h.id)
            })
            .sort((a, b) => {
                const statA = a.hero_stats?.[0]?.[keyStat] || 0
                const statB = b.hero_stats?.[0]?.[keyStat] || 0
                return statB - statA
            })
            .slice(0, 5)

        topMeta.forEach(h => {
            const statVal = h.hero_stats?.[0]?.[keyStat] || 0
            // Only add if it has SOME stats
            if (statVal > 0) {
                recs.push({
                    hero: h,
                    score: statVal, // Use the raw stat as score (e.g. 50% winrate = 50 pts)
                    reason: `Global Meta (${keyStat === 'ban_rate' ? 'Ban' : 'Win'} Rate ${statVal}%)`,
                    type: 'history'
                })
            }
        })
    }

    // --- CONVERT SMART BAN SCORES ---
    return recs.sort((a, b) => b.score - a.score).slice(0, 20)
}



