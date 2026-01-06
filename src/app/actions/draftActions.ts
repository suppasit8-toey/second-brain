'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface FinishGameData {
    gameId: string;
    winner: 'Blue' | 'Red';
    mvpHeroId?: string;
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
    const { error: gameError } = await supabase
        .from('draft_games')
        .update({
            winner: data.winner,
            mvp_hero_id: data.mvpHeroId,
            notes: data.notes,
            status: 'finished'
        })
        .eq('id', data.gameId)

    if (gameError) {
        return { success: false, message: 'From Game Update: ' + gameError.message }
    }

    // 2. Insert Draft Picks (Bans & Picks)
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
