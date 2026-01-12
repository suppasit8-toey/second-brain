'use server'

import { createClient } from '@/utils/supabase/server'
import { HeroCombo } from '@/utils/types'
import { revalidatePath } from 'next/cache'

export async function getCombos(versionId: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('hero_combos')
        .select(`
            *,
            hero_a:heroes!hero_combos_hero_a_id_fkey (id, name, icon_url),
            hero_b:heroes!hero_combos_hero_b_id_fkey (id, name, icon_url)
        `)
        .eq('version_id', versionId)
        .order('synergy_score', { ascending: false })

    if (error) {
        console.error('Error fetching combos:', error)
        return []
    }

    return data as HeroCombo[]
}

export async function saveCombo(combo: Omit<HeroCombo, 'id' | 'created_at' | 'hero_a' | 'hero_b' | 'version'>) {
    const supabase = await createClient()

    // Basic validation
    if (combo.hero_a_id === combo.hero_b_id) {
        return { success: false, message: "Cannot pair a hero with themselves." }
    }

    // Check if update or insert? 
    // For now we'll assume this function is mainly for "Create New" or doing an upsert if we passed an ID, 
    // but the type Omit<'id'> suggests creation. Let's strictly do Insert for now or allow ID if needed.
    // Actually, let's allow upsert if we check for existing pair logic outside or just insert new row.

    // Check if this pair already exists for this version (A-B or B-A)
    // We try to catch duplicates. 
    // Ideally the UI handles edit by passing an ID, so let's adjust the input type to allow optional ID if we were editing.
    // But for "Add Combo", we just insert.

    const { data, error } = await supabase
        .from('hero_combos')
        .insert(combo)
        .select()
        .single()

    if (error) {
        console.error('Error saving combo:', error)
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/combos')
    return { success: true, data }
}

export async function updateCombo(id: string, updates: {
    description?: string;
    hero_a_position?: string;
    hero_b_position?: string;
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('hero_combos')
        .update(updates)
        .eq('id', id)

    if (error) {
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/combos')
    return { success: true }
}


export async function deleteCombo(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('hero_combos')
        .delete()
        .eq('id', id)

    if (error) {
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/combos')
    return { success: true }
}

export async function getSuggestedCombos(versionId: number) {
    const supabase = await createClient()

    // 1. Fetch Existing Combos for THIS version to exclude them
    const { data: existing } = await supabase
        .from('hero_combos')
        .select('hero_a_id, hero_a_position, hero_b_id, hero_b_position')
        .eq('version_id', versionId)

    const existingSet = new Set<string>()
    existing?.forEach((c: any) => {
        // Store both directions to be safe
        existingSet.add(`${c.hero_a_id}|${c.hero_b_id}`)
        existingSet.add(`${c.hero_b_id}|${c.hero_a_id}`)
    })

    // 2. Fetch Scrim Data
    const { data: matches } = await supabase
        .from('draft_matches')
        .select(`
            games:draft_games(
                id,
                winner,
                picks:draft_picks(
                    hero_id,
                    side,
                    assigned_role,
                    type
                )
            )
        `)
        .eq('version_id', versionId)
        .eq('status', 'finished')

    // 3. Analyze Pairs
    // Key: `${ID_A}|${POS_A}|${ID_B}|${POS_B}` (ID_A < ID_B to handle uniqueness)
    const suggestions = new Map<string, {
        heroA: string, posA: string,
        heroB: string, posB: string,
        wins: number, games: number
    }>()

    matches?.forEach(match => {
        match.games.forEach((game: any) => {
            const blueTeam: { id: string, role: string }[] = []
            const redTeam: { id: string, role: string }[] = []

            game.picks?.forEach((p: any) => {
                if (p.type === 'PICK' && p.assigned_role) {
                    if (p.side === 'BLUE') blueTeam.push({ id: p.hero_id, role: p.assigned_role })
                    else redTeam.push({ id: p.hero_id, role: p.assigned_role })
                }
            })

            const processTeam = (team: { id: string, role: string }[], isWinner: boolean) => {
                // Generate all pairs
                for (let i = 0; i < team.length; i++) {
                    for (let j = i + 1; j < team.length; j++) {
                        const p1 = team[i]
                        const p2 = team[j]

                        // Sort to ensure consistency (Lexicographical ID sort)
                        // Actually, strict ID sort might mess up Position assignment if logic depends on order?
                        // No, just keep track of who is who.

                        let h1 = p1, h2 = p2
                        if (p1.id > p2.id) { h1 = p2; h2 = p1 } // Swap so h1.id < h2.id

                        // Check if exists in DB
                        // We only checked ID pairs in existingSet for loose collision detection, which is good enough
                        // But strictly we should check positions too if we want "Mid+Jungle" vs "Mid+Roam" distinct?
                        // Usually Synergy is Hero+Hero regardless of role, OR specific role. 
                        // Let's assume Hero+Hero key for exclusion to avoid spamming same hero pairs.
                        if (existingSet.has(`${h1.id}|${h2.id}`)) continue;

                        const key = `${h1.id}|${h1.role}|${h2.id}|${h2.role}`

                        if (!suggestions.has(key)) {
                            suggestions.set(key, {
                                heroA: h1.id, posA: h1.role,
                                heroB: h2.id, posB: h2.role,
                                wins: 0, games: 0
                            })
                        }

                        const s = suggestions.get(key)!
                        s.games++
                        if (isWinner) s.wins++
                    }
                }
            }

            processTeam(blueTeam, game.winner === 'Blue')
            processTeam(redTeam, game.winner === 'Red')
        })
    })

    // 4. Fetch Details & Format
    const { data: heroes } = await supabase.from('heroes').select('id, name, icon_url')
    const heroMap = new Map<string, any>()
    heroes?.forEach((h: any) => heroMap.set(h.id, h))

    const results = Array.from(suggestions.values())
        .filter(s => s.games >= 3) // Minimum threshold to reduce noise
        .map(s => ({
            ...s,
            heroAData: heroMap.get(s.heroA),
            heroBData: heroMap.get(s.heroB),
            winRate: Math.round((s.wins / s.games) * 100 / 5) * 5 // Round to nearest 5 as requested
        }))
        .sort((a, b) => b.games - a.games) // Most frequent first

    return results
}
