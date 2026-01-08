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

    // Auto-fix missing slugs
    const tournaments = data as Tournament[]
    const updates = []

    for (const t of tournaments) {
        if (!t.slug && t.name) {
            const newSlug = slugify(t.name)
            // Update in DB (fire and forget mostly, or await)
            updates.push(
                supabase.from('tournaments').update({ slug: newSlug }).eq('id', t.id)
            )
            // Update local object for UI
            t.slug = newSlug
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates)
    }

    return tournaments
}

export async function getTournament(idOrSlug: string) {
    const supabase = await createClient()

    // UUID regex pattern
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

    let query = supabase.from('tournaments').select('*')

    if (isUuid) {
        query = query.eq('id', idOrSlug)
    } else {
        query = query.eq('slug', idOrSlug)
    }

    const { data, error } = await query.single()

    if (error) {
        console.error('Error fetching tournament:', error)
        return null
    }
    return data as Tournament
}

// Helper to slugify text
function slugify(text: string) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '_')           // Replace spaces with _
        .replace(/[^\w-]+/g, '')        // Remove all non-word chars
        .replace(/__+/g, '_')           // Replace multiple _ with single _
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

export async function createTournament(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    let slug = formData.get('slug') as string
    const startDate = formData.get('start_date') as string
    const endDate = formData.get('end_date') as string
    const status = formData.get('status') as string || 'upcoming'

    if (!name) return { error: 'Name is required' }

    // Auto-generate slug if not provided
    if (!slug) {
        slug = slugify(name)
    }

    const { data, error } = await supabase
        .from('tournaments')
        .insert({
            name,
            slug: slug || undefined,
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

    // Auto-fix missing slugs for Teams
    const teams = data as Team[]
    const updates = []

    for (const t of teams) {
        if (!t.slug && t.name) {
            const newSlug = slugify(t.name)
            updates.push(
                supabase.from('teams').update({ slug: newSlug }).eq('id', t.id)
            )
            t.slug = newSlug
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates)
    }

    return teams
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
            slug: slugify(name),
            short_name: shortName || null,
            logo_url: logoUrl || null
        })
        .select()
        .single()

    const path = formData.get('path') as string

    if (error) return { error: error.message }

    if (path) {
        revalidatePath(path)
    } else {
        revalidatePath(`/admin/tournaments/${tournamentId}`)
    }

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

    // Check availability
    const { data: existing } = await supabase
        .from('players')
        .select('id')
        .ilike('name', name)
        .single()

    if (existing) {
        return { error: 'Player name already exists!' }
    }

    const { data, error } = await supabase
        .from('players')
        .insert({
            team_id: teamId || null,
            name,
            slug: slugify(name),
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

export async function updatePlayer(formData: FormData) {
    const supabase = await createClient()
    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const teamId = formData.get('team_id') as string
    const positions = JSON.parse(formData.get('positions') as string || '[]')

    if (!id || !name) return { error: 'ID and Name are required' }

    // Regenerate slug if name changes (or just always ensure it matches)
    const slug = slugify(name)

    const { error } = await supabase
        .from('players')
        .update({
            name,
            slug,
            team_id: teamId || null,
            positions
        })
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/players')
    revalidatePath(`/admin/players/${id}`)
    revalidatePath(`/admin/players/${slug}`)

    return { success: true, newSlug: slug }
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

    // Auto-fix missing slugs
    const players = data as any[] // using any to avoid strict type issues during transition
    const updates = []

    for (const p of players) {
        if (!p.slug && p.name) {
            const newSlug = slugify(p.name)
            updates.push(
                supabase.from('players').update({ slug: newSlug }).eq('id', p.id)
            )
            p.slug = newSlug
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates)
    }

    return data
}

export async function getPlayer(idOrSlug: string) {
    const supabase = await createClient()

    // UUID regex pattern
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

    let query = supabase.from('players').select(`
        *,
        team:teams(*)
    `)

    if (isUuid) {
        query = query.eq('id', idOrSlug)
    } else {
        query = query.eq('slug', idOrSlug)
    }

    const { data, error } = await query.single()

    if (error) {
        console.error('Error fetching player:', error)
        return null
    }
    return data
}

export async function assignPlayerToRoster(playerId: string, teamIdOrSlug: string, role: string, tournamentId: string) {
    const supabase = await createClient()

    // Resolve slug to ID if needed
    let teamId = teamIdOrSlug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamIdOrSlug)

    if (!isUuid) {
        const { data: team } = await supabase.from('teams').select('id').eq('slug', teamIdOrSlug).single()
        if (!team) return { error: 'Team not found' }
        teamId = team.id
    }

    const { error } = await supabase
        .from('players')
        .update({
            team_id: teamId,
            roster_role: role
        })
        .eq('id', playerId)

    if (error) return { error: error.message }

    revalidatePath(`/admin/tournaments/${tournamentId}/teams/${teamIdOrSlug}`)
    revalidatePath('/admin/players')
    return { success: true }
}

export async function removePlayerFromRoster(playerId: string, tournamentId: string, teamIdOrSlug: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('players')
        // Removing from Roster also removes from Team as per user request (Team implies Roster)
        .update({
            roster_role: null,
            team_id: null
        })
        .eq('id', playerId)

    if (error) return { error: error.message }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams/${teamIdOrSlug}`)
    revalidatePath('/admin/players')
    return { success: true }
}

