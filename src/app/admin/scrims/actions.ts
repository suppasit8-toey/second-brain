'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getLatestScrimId() {
    const supabase = await createClient()
    const { data: latestMatch } = await supabase
        .from('draft_matches')
        .select('slug')
        .ilike('slug', 'SCRIM%')
        .order('slug', { ascending: false })
        .limit(1)
        .single()

    let nextNum = 1
    if (latestMatch && latestMatch.slug) {
        const numPart = latestMatch.slug.replace('SCRIM', '')
        const parsed = parseInt(numPart)
        if (!isNaN(parsed)) {
            nextNum = parsed + 1
        }
    }

    return `SCRIM${nextNum.toString().padStart(6, '0')}`
}

export async function createScrim(formData: FormData) {
    const supabase = await createClient()

    const matchDate = formData.get('match_date') as string
    const versionId = formData.get('version_id') as string // ID
    const tournamentId = formData.get('tournament_id') as string // UUID
    const mode = formData.get('mode') as string // 'FULL' | 'SUMMARY'
    const teamA = formData.get('team_a_name') as string || 'Team A'
    const teamB = formData.get('team_b_name') as string || 'Team B'
    const bestOf = formData.get('best_of') as string || 'BO1'

    if (!matchDate || !versionId || !tournamentId) {
        return { error: 'Missing required fields' }
    }

    // 1. Generate Slug: SCRIMxxxxxx
    // Query for the latest slug starting with 'SCRIM'
    const { data: latestMatch } = await supabase
        .from('draft_matches')
        .select('slug')
        .ilike('slug', 'SCRIM%')
        .order('slug', { ascending: false })
        .limit(1)
        .single()

    let nextNum = 1
    if (latestMatch && latestMatch.slug) {
        // Expected format: SCRIM000001
        const numPart = latestMatch.slug.replace('SCRIM', '')
        const parsed = parseInt(numPart)
        if (!isNaN(parsed)) {
            nextNum = parsed + 1
        }
    }

    const newSlug = `SCRIM${nextNum.toString().padStart(6, '0')}`

    const matchType = mode === 'FULL' ? 'scrim_simulator' : 'scrim_summary'

    // 2. Create Match
    const { data: match, error } = await supabase
        .from('draft_matches')
        .insert({
            version_id: parseInt(versionId),
            tournament_id: tournamentId,
            team_a_name: teamA,
            team_b_name: teamB,
            mode: bestOf,
            status: 'ongoing',
            match_date: matchDate,
            slug: newSlug,
            match_type: matchType
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    // 3. Handle Mode Redirect
    if (mode === 'FULL') {
        // Create first game? Or let Simulator handle it?
        // Simulator expects a game to exist OR creates one.
        // We now want to let the Simulator (NewGameButton) handle the creation of Game 1 so the user can choosing Sides.

        /* 
        const { error: gameError } = await supabase
            .from('draft_games')
            .insert({
                match_id: match.id,
                game_number: 1,
                blue_team_name: teamA,
                red_team_name: teamB
            })

        if (gameError) return { error: `Match created but game failed: ${gameError.message}` }
        */

        redirect(`/admin/simulator/${match.slug}`)
    } else {
        // Mode 2: Summary -> Redirect to Summary Entry Page
        redirect(`/admin/scrims/${match.slug}`)
    }
}

export async function saveScrimSummary(formData: FormData) {
    const supabase = await createClient()
    const matchId = formData.get('match_id') as string
    const matchSlug = formData.get('match_slug') as string // Not used but good to have
    const gameNumber = parseInt(formData.get('game_number') as string || '1')
    const totalGames = parseInt(formData.get('total_games') as string || '1')

    // Explicit Team Names for THIS game (handling side swaps)
    const blueTeamName = formData.get('blue_team_name') as string
    const redTeamName = formData.get('red_team_name') as string

    // Winner of THIS game ('blue' or 'red')
    const gameWinnerSide = formData.get('winner') as 'blue' | 'red'

    // 1. Create/Update GAME Record
    // Check if game exists
    let { data: game } = await supabase.from('draft_games')
        .select('id')
        .eq('match_id', matchId)
        .eq('game_number', gameNumber)
        .single()

    if (!game) {
        const { data: newGame, error } = await supabase.from('draft_games').insert({
            match_id: matchId,
            game_number: gameNumber,
            blue_team_name: blueTeamName,
            red_team_name: redTeamName,
            winner: gameWinnerSide === 'blue' ? 'Blue' : 'Red'
        }).select().single()

        if (error) return { error: error.message }
        game = newGame
    } else {
        // Update existing game
        await supabase.from('draft_games').update({
            blue_team_name: blueTeamName,
            red_team_name: redTeamName,
            winner: gameWinnerSide === 'blue' ? 'Blue' : 'Red'
        }).eq('id', game.id)
    }

    if (!game) return { error: 'Game record failed' }

    // 2. SAVE PICKS
    const picks = []

    // Blue Picks
    for (let i = 0; i < 5; i++) {
        const heroId = formData.get(`blue_pick_${i}`) as string
        const role = formData.get(`blue_role_${i}`) as string
        if (heroId) {
            picks.push({
                game_id: game.id,
                hero_id: heroId,
                type: 'PICK',
                side: 'BLUE',
                position_index: i + 1,
                assigned_role: role
            })
        }
    }

    // Red Picks
    for (let i = 0; i < 5; i++) {
        const heroId = formData.get(`red_pick_${i}`) as string
        const role = formData.get(`red_role_${i}`) as string
        if (heroId) {
            picks.push({
                game_id: game.id,
                hero_id: heroId,
                type: 'PICK',
                side: 'RED',
                position_index: i + 1,
                assigned_role: role
            })
        }
    }

    // Clean up old picks for this game
    await supabase.from('draft_picks').delete().eq('game_id', game.id)

    if (picks.length > 0) {
        const { error: pickError } = await supabase.from('draft_picks').insert(picks)
        if (pickError) return { error: pickError.message }
    }

    // 3. CHECK PROGRESS
    if (gameNumber >= totalGames) {
        // FINISHED MATCH
        // Determine series winner based on games
        const { data: games } = await supabase.from('draft_games').select('*').eq('match_id', matchId)

        // Count wins (logic could be improved but simple for now)
        // We just mark it finished. 'winner' column in draft_matches might be redundant if we have games, 
        // but let's try to set it. We need to know which Team matches Blue/Red.
        // For simplicity, we just mark status 'finished'.

        await supabase.from('draft_matches').update({
            status: 'finished'
        }).eq('id', matchId)

        revalidatePath('/admin/scrims')
        redirect('/admin/scrims')
    } else {
        // NEXT GAME
        revalidatePath(`/admin/scrims/${matchId}`)
        redirect(`/admin/scrims/${matchId}`)
    }
}
// ... (previous imports)

export async function saveBatchScrimSummary(matchId: string, payload: any) {
    const supabase = await createClient()

    // Payload structure expected:
    // {
    //    totalGames: number,
    //    games: [
    //       {
    //          gameNumber: 1,
    //          blueTeamName: string,
    //          redTeamName: string,
    //          winner: 'blue' | 'red',
    //          bluePicks: [{ heroId, role, index }],
    //          redPicks: [{ heroId, role, index }]
    //       }, 
    //       ...
    //    ]
    // }

    const { games } = payload

    for (const gData of games) {
        // 1. Upsert Game
        let { data: game } = await supabase.from('draft_games')
            .select('id')
            .eq('match_id', matchId)
            .eq('game_number', gData.gameNumber)
            .single()

        let gameId = game?.id

        const gameData = {
            match_id: matchId,
            game_number: gData.gameNumber,
            blue_team_name: gData.blueTeamName,
            red_team_name: gData.redTeamName,
            winner: gData.winner === 'blue' ? 'Blue' : 'Red'
        }

        if (!gameId) {
            const { data: newGame, error } = await supabase.from('draft_games').insert(gameData).select().single()
            if (error) return { error: `Game ${gData.gameNumber} creation failed: ${error.message}` }
            gameId = newGame.id
        } else {
            await supabase.from('draft_games').update(gameData).eq('id', gameId)
        }

        // 2. Picks
        // Clear old picks
        await supabase.from('draft_picks').delete().eq('game_id', gameId)

        const picksToInsert = []
        // Blue
        for (const p of gData.bluePicks) {
            if (p.heroId) {
                picksToInsert.push({
                    game_id: gameId,
                    hero_id: p.heroId,
                    type: 'PICK',
                    side: 'BLUE',
                    position_index: p.index,
                    assigned_role: p.role
                })
            }
        }
        // Red
        for (const p of gData.redPicks) {
            if (p.heroId) {
                picksToInsert.push({
                    game_id: gameId,
                    hero_id: p.heroId,
                    type: 'PICK',
                    side: 'RED',
                    position_index: p.index,
                    assigned_role: p.role
                })
            }
        }

        if (picksToInsert.length > 0) {
            const { error: pickError } = await supabase.from('draft_picks').insert(picksToInsert)
            if (pickError) return { error: `Picks for Game ${gData.gameNumber} failed: ${pickError.message}` }
        }
    }

    // 3. Mark Match Finished
    await supabase.from('draft_matches').update({
        status: 'finished'
    }).eq('id', matchId)

    revalidatePath('/admin/scrims')
    return { success: true }
}
