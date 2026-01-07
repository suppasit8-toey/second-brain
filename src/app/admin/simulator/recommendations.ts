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
    }
) {
    const supabase = await createClient()

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


    // --- AI ANALYST (PICK) LOGIC ---
    const analystScores: Record<string, { score: number, reasons: string[] }> = {}

    // Bulk Fetch Matchups & Combos
    const { data: matchups } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .or(`opponent_id.in.(${enemyHeroIds.join(',')}),hero_id.in.(${enemyHeroIds.join(',')})`)
    // We want: 
    // 1. Hero VS Enemy (Us countering them) -> hero_id=Candidate, opponent_id=Enemy
    // 2. Enemy VS Hero (Them countering us) -> hero_id=Enemy, opponent_id=Candidate (to avoid self-countering?) - No, usually we look for winning matchups.

    // Filter for "Good for Ally" (Candidate winrate > 50 vs Enemy)
    const goodMatchups = matchups?.filter(m => enemyHeroIds.includes(m.enemy_hero_id) && m.win_rate > 50) || []

    const { data: combos } = await supabase
        .from('hero_combos')
        .select('*')
        .eq('version_id', versionId)
        .in('hero_a_id', allyHeroIds)

    availableHeroes.forEach(h => {
        let score = h.hero_stats[0].win_rate
        const reasons: string[] = []

        // 1. Key Player Analysis (Phase 1)
        if (enemyKeyPlayerIds.has(h.id)) {
            // If this hero IS an enemy key player, and we can pick it -> Deny pick!
            score += 25
            reasons.push('Deny Enemy Key Player')
        }

        // 2. Counter Logic (Draft to win vs Enemy)
        const myMatchups = goodMatchups.filter(m => m.hero_id === h.id)
        myMatchups.forEach(m => {
            const winDiff = m.win_rate - 50
            score += winDiff
            reasons.push(`Counters ${heroes.find(eh => eh.id === m.enemy_hero_id)?.name}`)
        })

        // 3. Synergy Logic
        const myCombos = combos?.filter(c => c.hero_b_id === h.id)
        myCombos?.forEach(c => {
            score += (c.synergy_score / 5)
            reasons.push(`Synergy with ${heroes.find(ah => ah.id === c.hero_a_id)?.name}`)
        })

        // 4. Position Logic (Simple check if role needed)
        const allyHeroes = heroes.filter(ah => allyHeroIds.includes(ah.id))
        const allyRoles = new Set<string>()
        allyHeroes.forEach(ah => ah.main_position.forEach((p: string) => allyRoles.add(p)))
        // If this hero fills a missing role, boost slightly
        // (This is complex because flex picks exist, simplified here)

        analystScores[h.id] = { score, reasons }
    })


    // --- COMPILE RESULTS ---

    let smartBanRecs = availableHeroes
        .map(h => ({
            hero: h,
            score: smartBanScores[h.id]?.score || 0,
            reason: smartBanScores[h.id]?.reasons.join(', ') || 'Meta Ban',
            type: 'counter' as const
        }))
        .filter(r => r.score > 20 || r.reason.includes('Meta') || r.reason.includes('Deny')) // Relaxed threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)

    // Fallback: If no specific smart bans, just suggest high tier/winrate
    if (smartBanRecs.length === 0) {
        smartBanRecs = availableHeroes
            .sort((a, b) => b.hero_stats[0].win_rate - a.hero_stats[0].win_rate)
            .slice(0, 5)
            .map(h => ({
                hero: h,
                score: h.hero_stats[0].win_rate,
                reason: `High Win Rate (${h.hero_stats[0].win_rate}%)`,
                type: 'counter'
            }))
    }

    const analystRecs = availableHeroes
        .map(h => ({
            hero: h,
            score: analystScores[h.id]?.score || 0,
            reason: analystScores[h.id]?.reasons.join(', ') || 'Solid Pick',
            type: 'hybrid' as const
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)

    // History (Trends) - Keep simple
    const historyRecs = availableHeroes
        .map(h => ({
            hero: h,
            score: h.hero_stats[0].win_rate,
            reason: `${h.hero_stats[0].win_rate}% WR`,
            type: 'history' as const
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)

    return {
        analyst: analystRecs,
        history: historyRecs,
        smartBan: smartBanRecs,
        hybrid: analystRecs,
        warning: warningMessage
    }
}
