'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface FinishGameData {
    gameId: string;
    winner: 'Blue' | 'Red';
    mvpHeroId?: string; // Optional (legacy) or mapped to winner
    blueKeyPlayer?: string;
    redKeyPlayer?: string;
    winPrediction?: { blue: number; red: number };
    notes?: string;
    picks: {
        hero_id: string;
        type: 'BAN' | 'PICK';
        side: 'BLUE' | 'RED';
        position_index: number;
        assigned_role?: string;
    }[];
}

export async function finishGame(data: FinishGameData) {
    const supabase = await createClient()

    // 1. Update Game Result
    const updatePayload: any = {
        winner: data.winner,
        notes: data.notes,
        status: 'finished',
        // Map new fields if columns exist, or put in analysis_data
        blue_key_player_id: data.blueKeyPlayer,
        red_key_player_id: data.redKeyPlayer,
        analysis_data: data.winPrediction
    }

    // Set MVP based on winner for backward compatibility if needed, or simple logic
    if (data.winner === 'Blue') updatePayload.mvp_hero_id = data.blueKeyPlayer
    else updatePayload.mvp_hero_id = data.redKeyPlayer

    const { error: gameError } = await supabase
        .from('draft_games')
        .update(updatePayload)
        .eq('id', data.gameId)

    if (gameError) {
        return { success: false, message: 'Game Update Error: ' + gameError.message }
    }

    // 2. Delete Existing Picks (Clean state for this game)
    const { error: deleteError } = await supabase
        .from('draft_picks')
        .delete()
        .eq('game_id', data.gameId)

    if (deleteError) {
        return { success: false, message: 'From Picks Cleanup: ' + deleteError.message }
    }

    // 3. Insert Draft Picks (Bans & Picks)
    // We map them to the DB structure
    const picksToInsert = data.picks.map(p => ({
        game_id: data.gameId,
        hero_id: p.hero_id,
        type: p.type,
        side: p.side,
        position_index: p.position_index,
        assigned_role: p.assigned_role
    }))

    const { error: picksError } = await supabase
        .from('draft_picks')
        .insert(picksToInsert)

    if (picksError) {
        return { success: false, message: 'From Picks Insert: ' + picksError.message }
    }

    revalidatePath(`/admin/simulator`)

    return { success: true }
}
