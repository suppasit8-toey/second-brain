'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Tournament, Team, Player } from '@/utils/types'

// --- TOURNAMENTS ---

export async function getTournaments() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching tournaments:', error)
        return []
    }
    return data as Tournament[]
}

export async function getTournament(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching tournament:', error)
        return null
    }
    return data as Tournament
}

export async function createTournament(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const startDate = formData.get('start_date') as string
    const endDate = formData.get('end_date') as string
    const status = formData.get('status') as string || 'upcoming'

    if (!name) return { error: 'Name is required' }

    const { data, error } = await supabase
        .from('tournaments')
        .insert({
            name,
            slug: slug || undefined, // Allow null if empty
            start_date: startDate ? new Date(startDate) : null,
            end_date: endDate ? new Date(endDate) : null,
            status
        })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath('/admin/tournaments')
    return { data }
}

export async function deleteTournament(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/tournaments')
    return { success: true }
}

// --- TEAMS ---

export async function getTeams(tournamentId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching teams:', error)
        return []
    }
    return data as Team[]
}

export async function createTeam(formData: FormData) {
    const supabase = await createClient()
    const tournamentId = formData.get('tournament_id') as string
    const name = formData.get('name') as string
    const shortName = formData.get('short_name') as string
    const logoUrl = formData.get('logo_url') as string

    if (!name || !tournamentId) return { error: 'Name and Tournament ID are required' }

    const { data, error } = await supabase
        .from('teams')
        .insert({
            tournament_id: tournamentId,
            name,
            short_name: shortName || null,
            logo_url: logoUrl || null
        })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { data }
}

export async function deleteTeam(id: string, tournamentId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { success: true }
}

// --- PLAYERS ---

export async function getPlayers(teamId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('id', { ascending: true }) // Or by name

    if (error) {
        console.error('Error fetching players:', error)
        return []
    }
    return data as Player[]
}

export async function getAllTeams() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('teams')
        .select('id, name, short_name')
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching all teams:', error)
        return []
    }
    return data as Partial<Team>[]
}

export async function createPlayer(formData: FormData) {
    const supabase = await createClient()
    const teamId = formData.get('team_id') as string
    const tournamentId = formData.get('tournament_id') as string // Needed for revalidation
    const name = formData.get('name') as string
    const positions = JSON.parse(formData.get('positions') as string || '[]')

    if (!name) return { error: 'Name is required' }

    const { data, error } = await supabase
        .from('players')
        .insert({
            team_id: teamId || null,
            name,
            positions
        })
        .select()
        .single()

    if (error) return { error: error.message }

    // Revalidate usage points
    if (tournamentId && tournamentId !== 'global') {
        revalidatePath(`/admin/tournaments/${tournamentId}`)
    }
    // Always revalidate the players list
    revalidatePath('/admin/players')

    return { data }
}

export async function deletePlayer(id: string, tournamentId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { success: true }
}


export async function getAllPlayers() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('players')
        .select(`
            *,
            team:teams(*)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching all players:', error)
        return []
    }
    return data
}

export async function assignPlayerToRoster(playerId: string, teamId: string, role: string, tournamentId: string) {
    const supabase = await createClient()

    // First, clear this role from any other player in this team to ensure uniqueness (optional but good for main roles)
    // Actually, for now let's just update the player.
    // If we want to enforce 1 player per role, we might need to swap or clear previous holder.
    // Let's keep it simple: just update this player.

    const { error } = await supabase
        .from('players')
        .update({
            team_id: teamId,
            roster_role: role
        })
        .eq('id', playerId)

    if (error) return { error: error.message }

    revalidatePath(`/admin/tournaments/${tournamentId}/teams/${teamId}`)
    return { success: true }
}

export async function removePlayerFromRoster(playerId: string, tournamentId: string, teamId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('players')
        .update({ roster_role: null }) // Keep them in team, just remove role? Or full remove?
        // User request: "Manage Players... select from Player system".
        // Likely we want to keep them in the team but maybe clear the role.
        // Let's just clear the role for now.
        .eq('id', playerId)

    if (error) return { error: error.message }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams/${teamId}`)
    return { success: true }
}

