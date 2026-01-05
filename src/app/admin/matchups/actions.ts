'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function saveMatchups(
    versionId: number,
    heroId: string, // UUID
    myPosition: string,
    matchupData: { enemyId: string, enemyPosition: string, winRate: number }[]
) {
    const supabase = await createClient()

    if (!versionId || !heroId || !myPosition || matchupData.length === 0) {
        return { success: false, message: 'Missing required data' }
    }

    // 1. Prepare data array (Bidirectional)
    const recordsToUpsert: any[] = []

    for (const m of matchupData) {
        // A. Forward Record (Me vs Enemy)
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: heroId,
            position: myPosition,
            enemy_hero_id: m.enemyId,
            enemy_position: m.enemyPosition,
            win_rate: m.winRate
        })

        // B. Reverse Record (Enemy vs Me)
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: m.enemyId,         // Swapped
            position: m.enemyPosition,  // Swapped
            enemy_hero_id: heroId,      // Swapped
            enemy_position: myPosition, // Swapped
            win_rate: 100 - m.winRate   // Inverted Win Rate
        })
    }

    // 2. Bulk Upsert
    const { error } = await supabase
        .from('matchups')
        .upsert(recordsToUpsert, {
            onConflict: 'version_id, hero_id, position, enemy_hero_id, enemy_position',
            ignoreDuplicates: false
        })

    if (error) {
        console.error('Error saving matchups:', error)
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/matchups')
    return { success: true, message: 'Matchups saved successfully (Bidirectional Sync)' }
}

export async function getMatchups(versionId: number, heroId: string, position: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('matchups')
        .select(`
            *,
            opponent:heroes!matchups_enemy_hero_id_fkey (
                id,
                name,
                icon_url
            )
        `)
        .eq('version_id', versionId)
        .eq('hero_id', heroId)
        .eq('position', position)

    if (error) {
        console.error('Error fetching matchups:', error)
        return []
    }

    return data
}

export async function createNewMatchup(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const heroId = (formData.get('hero_id') || formData.get('heroId')) as string
    const opponentId = (formData.get('opponent_id') || formData.get('opponentId')) as string

    const position = (formData.get('lane') || 'Mid') as string
    const winRate = parseInt((formData.get('win_rate') || '50') as string)

    if (!heroId || !opponentId) {
        return { message: 'Hero and Opponent are required', success: false }
    }

    try {
        const { data: activeVersion } = await supabase.from('versions').select('id').eq('is_active', true).single()
        if (!activeVersion) throw new Error("No active version found")
        const versionId = activeVersion.id

        const enemyPosition = position

        const { error } = await supabase
            .from('matchups')
            .insert({
                version_id: versionId,
                hero_id: heroId,
                position: position,
                enemy_hero_id: opponentId,
                enemy_position: enemyPosition,
                win_rate: winRate,
            })

        if (error) throw error

        revalidatePath('/admin/matchups')
    } catch (error: any) {
        return { message: 'Failed to add matchup: ' + error.message, success: false }
    }

    redirect('/admin/matchups')
}

// ALIAS TO FIX IMPORT ERRORS
export const addMatchup = createNewMatchup;
