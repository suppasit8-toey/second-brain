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
