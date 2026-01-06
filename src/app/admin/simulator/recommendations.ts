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

    return {
        analyst: analystRecs,
        history: historyRecs,
        hybrid: hybridRecs
    }
}
