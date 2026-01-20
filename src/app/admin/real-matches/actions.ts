'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { DraftMode } from '@/utils/types'

export async function createRealMatch(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const team_a_name = formData.get('team_a_name') as string || 'Team A'
    const team_b_name = formData.get('team_b_name') as string || 'Team B'
    const mode = formData.get('mode') as DraftMode
    const version_id = formData.get('version_id') as string
    const tournament_id = formData.get('tournament_id') as string || null

    // AI settings are optional/irrelevant for Real Match recording usually, but we keep the structure
    // const ai_mode = formData.get('ai_mode') as string || 'PVP' 
    // const ai_settings_json = formData.get('ai_settings') as string || '{}'

    if (!team_a_name || !team_b_name || !mode || !version_id) {
        return { message: 'Missing required fields', success: false }
    }

    // Generate REAL Slugs? Or reuse current logic but maybe prefix 'REAL'?
    // Let's stick to DRAFT/REAL prefix if we want separation, or just share ID space.
    // Ideally we use a different slug prefix to easily identify them.
    const { data: latestMatch } = await supabase
        .from('draft_matches')
        .select('slug')
        .like('slug', 'REAL%')
        .order('slug', { ascending: false })
        .limit(1)
        .single()

    let nextNum = 1
    if (latestMatch && latestMatch.slug) {
        const match = latestMatch.slug.match(/REAL(\d+)/)
        if (match) {
            nextNum = parseInt(match[1]) + 1
        }
    }
    const slug = `REAL${nextNum.toString().padStart(6, '0')}`

    const { data, error } = await supabase
        .from('draft_matches')
        .insert([{
            team_a_name,
            team_b_name,
            mode,
            version_id: parseInt(version_id),
            tournament_id,
            status: 'ongoing',
            match_type: 'real_match', // Explicitly marking as real_match
            slug,
            ai_metadata: { mode: 'MANUAL', settings: {} } // Real matches are manual recording
        }])
        .select()
        .single()

    if (error) {
        console.error('Error creating real match (Supabase):', JSON.stringify(error, null, 2))
        return { message: 'Error creating match: ' + (error.message || JSON.stringify(error)), success: false }
    }

    revalidatePath('/admin/real-matches')
    return { message: 'Real Match created successfully!', success: true, matchId: data.slug || data.id }
}

export async function getRealMatches() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(id, name),
            games:draft_games(id, created_at, game_number)
        `)
        .eq('match_type', 'real_match') // Strict filtering
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching real matches:', error)
        return []
    }
    return data
}
