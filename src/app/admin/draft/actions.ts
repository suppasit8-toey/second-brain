'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DraftMode } from '@/utils/types'

export async function createMatch(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const team_a_name = formData.get('team_a_name') as string || 'Team A'
    const team_b_name = formData.get('team_b_name') as string || 'Team B'
    const mode = formData.get('mode') as DraftMode
    const version_id = formData.get('version_id') as string

    if (!team_a_name || !team_b_name || !mode || !version_id) {
        return { message: 'Missing required fields', success: false }
    }

    // Generate Slug: YYYYMMDD-XX
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD

    // Count matches for today to determine suffix
    // Note: This is prone to race conditions in high traffic but okay for admin tool
    // Better way is to query latest slug for today
    const { data: latestMatch } = await supabase
        .from('draft_matches')
        .select('slug')
        .ilike('slug', `${dateStr}-%`)
        .order('slug', { ascending: false })
        .limit(1)
        .single()

    let sequence = 1
    if (latestMatch && latestMatch.slug) {
        const parts = latestMatch.slug.split('-')
        if (parts.length === 2) {
            sequence = parseInt(parts[1]) + 1
        }
    }

    const slug = `${dateStr}-${sequence.toString().padStart(2, '0')}`

    const { data, error } = await supabase
        .from('draft_matches')
        .insert([{
            team_a_name,
            team_b_name,
            mode,
            version_id: parseInt(version_id),
            status: 'ongoing',
            slug,
            match_type: 'scrim_simulator'
        }])
        .select()
        .single()

    if (error) {
        console.error('Error creating match:', error)
        return { message: 'Error creating match: ' + error.message, success: false }
    }

    // Games are now created manually one by one via NewGameButton to allow side selection
    // const games = []
    // const gameCount = mode === 'BO1' ? 1 : mode === 'BO2' ? 2 : mode === 'BO3' ? 3 : mode === 'BO4' ? 4 : mode === 'BO5' ? 5 : mode === 'BO7' ? 7 : 1

    // for (let i = 1; i <= gameCount; i++) {
    //     games.push({
    //         match_id: data.id,
    //         game_number: i,
    //         blue_team_name: i % 2 !== 0 ? team_a_name : team_b_name,
    //         red_team_name: i % 2 !== 0 ? team_b_name : team_a_name,
    //     })
    // }

    // const { error: gamesError } = await supabase
    //     .from('draft_games')
    //     .insert(games)

    // if (gamesError) {
    //     console.error('Error creating games:', gamesError)
    // }

    revalidatePath('/admin/draft')
    revalidatePath('/admin/draft')
    return { message: 'Match created successfully!', success: true, matchId: data.slug || data.id }
}

export async function getMatches() {
    const supabase = await createClient()

    // Fetch matches with version info
    const { data, error } = await supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(id, name)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching matches:', error)
        return []
    }
    return data
}

export async function getMatch(matchId: string) {
    const supabase = await createClient()

    // Build query
    let query = supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(*),
            tournament:tournaments(*),
            games:draft_games(
                *,
                picks:draft_picks(*)
            )
        `)

    // Check if matchId looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)

    if (isUUID) {
        query = query.eq('id', matchId)
    } else {
        query = query.eq('slug', matchId)
    }

    const { data, error } = await query
        .single()

    if (error) {
        console.error(`Error fetching match with ID ${matchId}:`, JSON.stringify(error, null, 2))
        return null
    }

    // Sort games by game_number
    if (data.games) {
        data.games.sort((a: any, b: any) => a.game_number - b.game_number)
    }

    return data
}

export async function createGame(matchId: string, gameNumber: number, blueTeam: string, redTeam: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('draft_games')
        .insert([{
            match_id: matchId,
            game_number: gameNumber,
            blue_team_name: blueTeam,
            red_team_name: redTeam
        }])
        .select()
        .single()

    if (error) {
        console.error('Error creating game:', error)
        return { success: false, message: error.message }
    }

    revalidatePath(`/admin/draft/${matchId}`)
    return { success: true, message: 'Game created', gameId: data.id }
}

export async function deleteMatch(matchId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('draft_matches')
        .delete()
        .eq('id', matchId)

    if (error) {
        console.error('Error deleting match:', error)
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/draft')
    revalidatePath('/admin/scrims')
    return { success: true, message: 'Match deleted' }
}
