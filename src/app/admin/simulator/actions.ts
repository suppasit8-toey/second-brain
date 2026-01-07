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
    const tournament_id = formData.get('tournament_id') as string || null

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
            tournament_id,
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

    // Build query
    let query = supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(*),
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

    revalidatePath('/admin/simulator')
    return { success: true, message: 'Match deleted successfully' }
}

// --- AI ANALYSIS ---

export async function getMatchAnalysis(matchId: string) {
    const supabase = await createClient()

    // 1. Get Match Data
    const { data: match, error: matchError } = await supabase
        .from('draft_matches')
        .select(`
            *,
            version:versions(*),
            games:draft_games(
                *,
                picks:draft_picks(*)
            )
        `)
        .eq(matchId.includes('-') && matchId.length > 20 ? 'id' : 'slug', matchId)
        .single()

    if (matchError || !match) {
        console.error('Error fetching match for analysis:', matchError)
        return null
    }

    const versionId = match.version_id
    const games = match.games || []

    // 2. Extract Hero IDs
    const heroIds = new Set<string>()
    games.forEach((g: any) => {
        g.picks?.forEach((p: any) => {
            if (p.hero_id) heroIds.add(p.hero_id)
        })
    })
    const uniqueHeroIds = Array.from(heroIds)

    if (uniqueHeroIds.length === 0) return { laneAnalysis: {}, comboAnalysis: {} }

    // 3. Fetch Matchups (Bulk)
    // We want records where BOTH heroes are in our list.
    const { data: matchupsData } = await supabase
        .from('matchups')
        .select('*')
        .eq('version_id', versionId)
        .in('hero_id', uniqueHeroIds)
        .in('enemy_hero_id', uniqueHeroIds)

    // 4. Fetch Combos (Bulk)
    // We want combos where BOTH heroes are in our list.
    const { data: combosData } = await supabase
        .from('hero_combos')
        .select(`
             *,
             hero_a:heroes!hero_combos_hero_a_id_fkey(name, icon_url),
             hero_b:heroes!hero_combos_hero_b_id_fkey(name, icon_url)
        `)
        .eq('version_id', versionId)
        .or(`hero_a_id.in.(${uniqueHeroIds.join(',')}),hero_b_id.in.(${uniqueHeroIds.join(',')})`)

    // 5. Compute Analysis per Game
    const laneAnalysis: Record<string, any[]> = {} // gameId -> list of lane analytics
    const comboAnalysis: Record<string, { blue: any[], red: any[] }> = {} // gameId -> { blue: [], red: [] }
    const keyPlayerAnalysis: Record<string, { blue: any[], red: any[] }> = {} // gameId -> { blue: [vs1, vs2...], red: [vs1, vs2...] }

    games.forEach((game: any) => {
        // --- A. Lane Analysis ---
        // Group picks by role depending on side.
        // Assuming Standard Lanes: DS, JG, MID, AD, SP
        const bluePicks = game.picks?.filter((p: any) => p.side === 'BLUE' && p.type === 'PICK') || []
        const redPicks = game.picks?.filter((p: any) => p.side === 'RED' && p.type === 'PICK') || []

        const gameLaneData: any[] = []

        // Find matching roles
        bluePicks.forEach((bp: any) => {
            if (!bp.assigned_role) return

            // Find Red counterpart
            const rp = redPicks.find((r: any) => r.assigned_role === bp.assigned_role)
            if (rp) {
                // Find stats in matchupsData
                // Looking for BlueHero vs RedHero at Role
                const stat = matchupsData?.find(m =>
                    m.hero_id === bp.hero_id &&
                    m.enemy_hero_id === rp.hero_id &&
                    m.position === bp.assigned_role
                )

                gameLaneData.push({
                    role: bp.assigned_role,
                    blueHeroId: bp.hero_id,
                    redHeroId: rp.hero_id,
                    winRate: stat ? stat.win_rate : 50, // Default to 50 if no data
                })
            }
        })
        laneAnalysis[game.id] = gameLaneData

        // --- B. Combo Analysis ---
        const getCombosForTeam = (picks: any[]) => {
            const teamCombos: any[] = []
            // Check every pair
            for (let i = 0; i < picks.length; i++) {
                for (let j = i + 1; j < picks.length; j++) {
                    const h1 = picks[i].hero_id
                    const h2 = picks[j].hero_id

                    // Check if this pair exists in combosData
                    // combosData might store A,B or B,A
                    const combo = combosData?.find(c =>
                        (c.hero_a_id === h1 && c.hero_b_id === h2) ||
                        (c.hero_a_id === h2 && c.hero_b_id === h1)
                    )

                    if (combo) {
                        teamCombos.push(combo)
                    }
                }
            }
            return teamCombos.sort((a, b) => b.synergy_score - a.synergy_score)
        }

        comboAnalysis[game.id] = {
            blue: getCombosForTeam(bluePicks),
            red: getCombosForTeam(redPicks)
        }

        // --- C. Key Player Analysis (NEW) ---
        const getKeyPlayerStats = (keyPlayerId: string | undefined, enemyPicks: any[]) => {
            if (!keyPlayerId) return []

            return enemyPicks.map((enemy: any) => {
                // Find stats: KeyPlayer vs EnemyHero (position generic or ignore? Usually simple H2H)
                // The matchups table records H2H with positions. 
                // We'll try to find any record matching these two heroes regardless of position, or prioritize main position.
                // Actually, the previous implementation used specific role matchup. 
                // For "Carry vs Team", we might just look for the record where KeyPlayer is playing their role, and Enemy is playing theirs.
                // But matchups are stored as (hero, position, enemy, enemy_pos).
                // Let's filter strictly by roles if available, or just find *any* matchup data between them.

                // Strict approach: KeyPlayer Role vs Enemy Role
                const kpDetails = [...bluePicks, ...redPicks].find(p => p.hero_id === keyPlayerId)
                if (!kpDetails || !enemy.assigned_role) return null

                const stat = matchupsData?.find(m =>
                    m.hero_id === keyPlayerId &&
                    m.enemy_hero_id === enemy.hero_id &&
                    m.position === kpDetails.assigned_role && // KeyPlayer Position
                    m.enemy_position === enemy.assigned_role  // Enemy Position
                )

                return {
                    enemyHeroId: enemy.hero_id,
                    enemyRole: enemy.assigned_role,
                    winRate: stat ? stat.win_rate : 50
                }
            }).filter(Boolean)
        }

        keyPlayerAnalysis[game.id] = {
            blue: getKeyPlayerStats(game.blue_key_player_id, redPicks),
            red: getKeyPlayerStats(game.red_key_player_id, bluePicks)
        }
    })

    return { laneAnalysis, comboAnalysis, keyPlayerAnalysis }
}

