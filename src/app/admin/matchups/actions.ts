'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
