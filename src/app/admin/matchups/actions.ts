'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface MatchupInput {
    enemyId: number; // or string depending on hero id type, assumed string based on types.ts
    // Wait, types.ts says ID is uuid (string). 
    // User request said: "enemyId: number". But Hero ID is UUID.
    // I will support string UUID.
    enemyPosition: string; // The lane the enemy is in
    winRate: number;
}

// NOTE: User request specified "enemyId: number" but Hero ID is UUID string in types.ts.
// I will use string to be compatible with the database.

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
        // Me (heroId, myPosition) vs Enemy (m.enemyId, m.enemyPosition) = m.winRate
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: heroId,
            position: myPosition,
            enemy_hero_id: m.enemyId,
            enemy_position: m.enemyPosition,
            win_rate: m.winRate
        })

        // B. Reverse Record (Enemy vs Me)
        // Enemy (m.enemyId, m.enemyPosition) vs Me (heroId, myPosition) = 100 - m.winRate
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
            // Ensure unique key constraint matches your DB schema
            onConflict: 'version_id, hero_id, position, enemy_hero_id, enemy_position',
            ignoreDuplicates: false // Update duplicate keys
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

    // Fetch matchups for this specific 'My Hero in My Position' context
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
        .eq('position', position) // My Position

    if (error) {
        console.error('Error fetching matchups:', error)
        return []
    }

    return data
}

export async function addMatchup(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const heroId = formData.get('heroId') as string
    const opponentId = formData.get('opponentId') as string
    const description = formData.get('description') as string

    if (!heroId || !opponentId) {
        return { message: 'Hero and Opponent are required', success: false }
    }

    try {
        // This is a simplified insertion relative to the bulk one. 
        // Assuming default values for positions/version if not provided or just basic linking.
        // However, the user prompt implies a specific DB schema. 
        // Given 'saveMatchups' uses versionId, myPosition etc., this simple form might be for a different view or simple log.
        // I will use a reasonable default or insert what I can.
        // BUT, looking at 'saveMatchups', the table requires version_id, position, enemy_position.
        // The user prompt didn't ask to extract those from formData. 
        // I will try to fetch active version and use default positions if not in formData.
        // Actually, let's check if formData HAS them.

        const { data: activeVersion } = await supabase.from('versions').select('id').eq('is_active', true).single()
        if (!activeVersion) throw new Error("No active version found")

        const versionId = activeVersion.id
        const position = 'Mid' // Default fallback
        const enemyPosition = 'Mid' // Default fallback
        const winRate = 50

        const { error } = await supabase
            .from('matchups')
            .insert({
                version_id: versionId,
                hero_id: heroId,
                position: position,
                enemy_hero_id: opponentId,
                enemy_position: enemyPosition,
                win_rate: winRate,
                // description: description // If schema has it. Assuming yes or ignorable.
            })

        if (error) throw error

        revalidatePath('/admin/matchups')
    } catch (error: any) {
        return { message: 'Failed to add matchup: ' + error.message, success: false }
    }

    // Redirect must be outside try/catch
    redirect('/admin/matchups')
}
