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
    bannedHeroIds: string[]
) {
    const supabase = await createClient()

    // 1. Fetch all Heroes for this version (base pool)
    const { data: heroes } = await supabase
        .from('heroes')
        .select(`
            *,
            hero_stats!inner(tier, win_rate, power_spike)
        `)
        .eq('hero_stats.version_id', versionId)

    if (!heroes) return { data: [], history: [], hybrid: [] }

    const availableHeroes = heroes.filter(h =>
        !allyHeroIds.includes(h.id) &&
        !enemyHeroIds.includes(h.id) &&
        !bannedHeroIds.includes(h.id)
    )

    // --- ANALYST TAB (Synergy/Counters) ---
    // Fetch Combos for Allies
    const { data: combos } = await supabase
        .from('hero_combos')
        .select('*')
        .eq('version_id', versionId)
        .in('hero_a_id', allyHeroIds)

    // Fetch Matchups against Enemies
    const { data: matchups } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .in('opponent_id', enemyHeroIds) // Heroes who are opponents to current enemies
        .gt('win_rate', 50)

    const analystScores: Record<string, { score: number, reasons: string[] }> = {}

    // Score based on Synergy
    combos?.forEach(c => {
        if (!analystScores[c.hero_b_id]) analystScores[c.hero_b_id] = { score: 0, reasons: [] }
        analystScores[c.hero_b_id].score += (c.synergy_score / 10)
        analystScores[c.hero_b_id].reasons.push(`Synergy with teammate (Score: ${c.synergy_score})`)
    })

    // Score based on Counters
    matchups?.forEach(m => {
        if (!analystScores[m.hero_id]) analystScores[m.hero_id] = { score: 0, reasons: [] }
        analystScores[m.hero_id].score += ((m.win_rate - 50) / 2) // Bonus for winrate > 50
        analystScores[m.hero_id].reasons.push(`Counters enemy`)
    })

    const analystRecs: Recommendation[] = availableHeroes
        .map(h => ({
            hero: h,
            score: analystScores[h.id]?.score || 0,
            reason: analystScores[h.id]?.reasons.join(', ') || 'General pool',
            type: 'synergy' as const
        }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)


    // --- HISTORY TAB (Trends) ---
    // In a real app we'd aggregate `draft_picks`, for now we use `hero_stats` winrate/tier
    const historyRecs: Recommendation[] = availableHeroes
        .map(h => {
            const stats = h.hero_stats[0]
            let score = stats.win_rate
            if (stats.tier === 'S') score += 10
            if (stats.tier === 'A') score += 5
            return {
                hero: h,
                score: score,
                reason: `${stats.tier} Tier, ${stats.win_rate}% WR`,
                type: 'history' as const
            }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    // --- HYBRID TAB ---
    // Simple mock weighting
    const hybridRecs: Recommendation[] = availableHeroes
        .map(h => {
            const anaScore = analystScores[h.id]?.score || 0
            const stats = h.hero_stats[0]
            const histScore = stats.win_rate / 10 // Normalize roughly

            return {
                hero: h,
                score: anaScore + histScore,
                reason: 'Combined Analysis',
                type: 'hybrid' as const
            }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    // --- SMART BAN TAB ---
    // Identify threats to our team or general OP heroes
    const smartBanRecs: Recommendation[] = [];
    const banScores: Record<string, { score: number, reasons: string[] }> = {};

    // 1. Ban counters to our picks (Protect)
    if (allyHeroIds.length > 0) {
        // Find enemies that are good against our team
        const { data: threats } = await supabase
            .from('matchups')
            .select('*')
            .eq('version_id', versionId)
            .in('opponent_id', allyHeroIds) // Heroes that are opponents to ALLIES (i.e. enemies)
            .gt('win_rate', 52) // Threats with >52% win rate against us

        threats?.forEach(t => {
            if (!banScores[t.hero_id]) banScores[t.hero_id] = { score: 0, reasons: [] }
            const impact = (t.win_rate - 50) * 5
            banScores[t.hero_id].score += impact
            banScores[t.hero_id].reasons.push(`Counters your team`)
        })
    }

    // 2. Ban General OP Heroes (Deny)
    availableHeroes.forEach(h => {
        const stats = h.hero_stats[0]
        if (stats.tier === 'S' || stats.win_rate > 54) {
            if (!banScores[h.id]) banScores[h.id] = { score: 0, reasons: [] }
            banScores[h.id].score += 50 // Flat bonus for S-tier/OP
            banScores[h.id].reasons.push(`Meta Threat (${stats.win_rate}%)`)
        }
    })

    // Convert to array
    Object.entries(banScores).forEach(([heroId, data]) => {
        const hero = availableHeroes.find(h => h.id === heroId)
        if (hero) {
            smartBanRecs.push({
                hero,
                score: data.score,
                reason: data.reasons[0] || 'Strategic Ban',
                type: 'ban' as const // Explicitly 'ban' type
            })
        }
    })

    const finalSmartBans = smartBanRecs
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    return {
        analyst: analystRecs,
        history: historyRecs,
        hybrid: hybridRecs,
        smartBan: finalSmartBans
    }
}
