'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { DraftMode } from '@/utils/types'

export async function createMatch(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const team_a_name = formData.get('team_a_name') as string
    const team_b_name = formData.get('team_b_name') as string
    const mode = formData.get('mode') as DraftMode
    const version_id = formData.get('version_id') as string

    if (!team_a_name || !team_b_name || !mode || !version_id) {
        return { message: 'Missing required fields', success: false }
    }

    const { data, error } = await supabase
        .from('draft_matches')
        .insert([{
            team_a_name,
            team_b_name,
            mode,
            version_id: parseInt(version_id),
            status: 'ongoing'
        }])
        .select()
        .single()

    if (error) {
        console.error('Error creating match:', error)
        return { message: 'Error creating match: ' + error.message, success: false }
    }

    revalidatePath('/admin/simulator')
    return { message: 'Match created successfully!', success: true, matchId: data.id }
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

    const { data, error } = await supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(*),
            games:draft_games(*)
        `)
        .eq('id', matchId)
        .single()

    if (error) {
        console.error('Error fetching match:', error)
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

    revalidatePath(`/admin/simulator/${matchId}`)
    return { success: true, message: 'Game created', gameId: data.id }
}

export async function getGame(gameId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('draft_games')
        .select('*')
        .eq('id', gameId)
        .single()

    if (error) {
        console.error('Error fetching game:', error)
        return null
    }

    return data
}
