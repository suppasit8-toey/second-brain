'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getLatestScrimId() {
    const supabase = await createClient()
    const { data: matches } = await supabase
        .from('draft_matches')
        .select('slug')
        .ilike('slug', 'SCRIM%')
        .order('slug', { ascending: false })
        .limit(50)

    let maxNum = 0
    if (matches && matches.length > 0) {
        matches.forEach((m: { slug: string }) => {
            const numPart = m.slug.replace('SCRIM', '')
            const parsed = parseInt(numPart)
            if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed
            }
        })
    }

    const nextNum = maxNum + 1
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

    let attempts = 0
    let savedMatch = null
    let errorMsg = ''

    while (attempts < 3 && !savedMatch) {
        // 1. Generate Slug using Robust Scan
        const { data: matches } = await supabase
            .from('draft_matches')
            .select('slug')
            .ilike('slug', 'SCRIM%')
            .order('slug', { ascending: false })
            .limit(50)

        let maxNum = 0
        if (matches && matches.length > 0) {
            matches.forEach((m: { slug: string }) => {
                const numPart = m.slug.replace('SCRIM', '')
                const parsed = parseInt(numPart)
                if (!isNaN(parsed) && parsed > maxNum) {
                    maxNum = parsed
                }
            })
        }

        const nextNum = maxNum + 1
        const newSlug = `SCRIM${nextNum.toString().padStart(6, '0')}`
        const matchType = mode === 'FULL' ? 'scrim_simulator' : 'scrim_summary'

        // 2. Try Create Match
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
            if (error.code === '23505') { // Unique constraint violation (duplicate slug)
                console.warn(`Slug collision for ${newSlug}, retrying...`)
                attempts++
                errorMsg = 'Failed to generate unique Match ID. Please try again.'
            } else {
                return { error: error.message }
            }
        } else {
            savedMatch = match
        }
    }

    if (!savedMatch) {
        return { error: errorMsg || 'Failed to create match after multiple attempts.' }
    }

    const match = savedMatch

    // 3. Handle Mode Redirect
    if (mode === 'FULL') {
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
    //    tournamentName?: string,
    //    patchName?: string,
    //    games: [ ... ]
    // }

    const { games, tournamentName, patchName } = payload

    // 0. Lookup / Updates for Match Metadata (Tournament/Patch)
    const matchUpdatePayload: any = {
        status: 'finished'
    }

    if (tournamentName) {
        const { data: tour } = await supabase.from('tournaments')
            .select('id')
            .ilike('name', tournamentName)
            .single()

        if (tour) matchUpdatePayload.tournament_id = tour.id
    }

    if (patchName) {
        const { data: ver } = await supabase.from('versions')
            .select('id')
            .ilike('name', patchName)
            .single()

        if (ver) matchUpdatePayload.version_id = ver.id
    }

    // 1. Process Games
    for (const gData of games) {
        // Upsert Game
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
            winner: gData.winner === 'blue' ? 'Blue' : 'Red',
            blue_key_player_id: gData.blueKeyPlayer || null,
            red_key_player_id: gData.redKeyPlayer || null
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

    // 3. Mark Match Finished and Update Metadata
    await supabase.from('draft_matches').update(matchUpdatePayload).eq('id', matchId)

    revalidatePath('/admin/scrims')
    return { success: true }
}

export async function getTeamHeroPoolStats(teamName: string) {
    const supabase = await createClient()

    // Fetch all games where this team played
    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
            id,
            blue_team_name,
            red_team_name,
            draft_picks (
                hero_id,
                side,
                assigned_role
            )
        `)
        .or(`blue_team_name.eq.${teamName},red_team_name.eq.${teamName}`)

    if (error) {
        console.error('Error fetching team stats:', error)
        return []
    }

    // Process stats
    const heroStats = new Map<string, { count: number, roles: Map<string, number> }>()

    games?.forEach((game: any) => {
        const isBlue = game.blue_team_name === teamName
        const targetSide = isBlue ? 'BLUE' : 'RED'

        game.draft_picks?.forEach((pick: any) => {
            if (pick.side === targetSide) {
                const existing = heroStats.get(pick.hero_id) || { count: 0, roles: new Map() }
                existing.count++

                const role = pick.assigned_role || 'FLEX'
                existing.roles.set(role, (existing.roles.get(role) || 0) + 1)

                heroStats.set(pick.hero_id, existing)
            }
        })
    })

    // Convert to array
    return Array.from(heroStats.entries()).map(([heroId, stats]) => ({
        heroId,
        totalPlayed: stats.count,
        roles: Array.from(stats.roles.entries()).map(([role, count]) => ({ role, count }))
    })).sort((a, b) => b.totalPlayed - a.totalPlayed)
}

export async function getEnemyFirstPickStats(teamName: string) {
    const supabase = await createClient()

    // 1. Fetch games where the enemy team was BLUE side
    // We select draft_matches(match_type) to filter in memory/Typescript
    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
            id,
            blue_team_name,
            draft_matches (
                match_type
            ),
            draft_picks (
                hero_id,
                side,
                position_index,
                type
            )
        `)
        .eq('blue_team_name', teamName)

    if (error) {
        console.error('Error fetching enemy first picks:', error)
        return { totalGames: 0, picks: [] }
    }

    const fpStats = new Map<string, number>()
    let totalGames = 0

    games?.forEach((game: any) => {
        // FILTER: Only allow 'scrim_simulator' OR NULL (Legacy)
        // Exclude 'scrim_summary'
        const mType = game.draft_matches?.match_type;
        if (mType === 'scrim_summary') return;

        // Find Blue Pick 1 (First Pick)
        // Simulator uses global index 5 for Blue Pick 1 (1-4 bans).
        // Summary uses relative index 1.
        const firstPick = game.draft_picks?.find((p: any) =>
            p.side === 'BLUE' &&
            p.type === 'PICK' &&
            (p.position_index === 1 || p.position_index === 5)
        )

        if (firstPick && firstPick.hero_id) {
            fpStats.set(firstPick.hero_id, (fpStats.get(firstPick.hero_id) || 0) + 1)
            totalGames++
        }
    })

    return {
        totalGames,
        picks: Array.from(fpStats.entries()).map(([heroId, count]) => ({
            heroId,
            count,
            percentage: totalGames > 0 ? Math.round((count / totalGames) * 100) : 0
        })).sort((a, b) => b.count - a.count)
    }
}

export async function getEnemyCounterPickStats(teamName: string) {
    if (!teamName) return []

    const supabase = await createClient()

    // Fetch games where the team participated (either Blue or Red)
    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
            id,
            blue_team_name,
            red_team_name,
            winner,
            draft_matches!inner (
                match_type
            ),
            draft_picks (
                hero_id,
                side,
                position_index,
                type,
                assigned_role
            )
        `)
        .or(`blue_team_name.eq.${teamName},red_team_name.eq.${teamName}`)

    if (error || !games) {
        console.error('Error fetching counter stats:', error)
        return []
    }

    // Structure: OpponentHeroID -> { role, total: number, responses: Map<MyHeroID, { count, wins }> }
    const analysis = new Map<string, { role: string, total: number, responses: Map<string, { count: number, wins: number }> }>()

    games.forEach((game: any) => {
        // Filter: Only allow 'scrim_simulator' OR NULL (Legacy) matches
        // Exclude 'scrim_summary'
        const mType = game.draft_matches?.match_type;
        if (mType === 'scrim_summary') return;

        const isBlue = game.blue_team_name === teamName
        const won = (isBlue && game.winner === 'BLUE') || (!isBlue && game.winner === 'RED')

        // Create a map of position -> pick for easy lookup
        const picksByPos = new Map<number, any>()
        game.draft_picks?.forEach((p: any) => {
            if (p.type === 'PICK') {
                picksByPos.set(p.position_index, p)
            }
        })

        // Define Counter Sequences (Opponent Pos -> My Potential Response Pos)
        // Global Indices for Simulator
        const sequences = []
        if (!isBlue) {
            // Enemy is RED
            // Blue P1(5) -> Red P2(6),P3(7)
            sequences.push({ opp: [5], my: [6, 7] })
            // Blue P4(8),P5(9) -> Red P6(10)
            sequences.push({ opp: [8, 9], my: [10] })
            // Blue P8(16),P9(17) -> Red P10(18)
            sequences.push({ opp: [16, 17], my: [18] })
        } else {
            // Enemy is BLUE
            // Red P2(6),P3(7) -> Blue P4(8),P5(9)
            sequences.push({ opp: [6, 7], my: [8, 9] })
            // Red P7(15) -> Blue P8(16),P9(17)
            sequences.push({ opp: [15], my: [16, 17] })
        }

        sequences.forEach(seq => {
            const oppPicks = seq.opp.map(pos => picksByPos.get(pos)).filter(Boolean)
            const myPicks = seq.my.map(pos => picksByPos.get(pos)).filter(Boolean)

            oppPicks.forEach(oppPick => {
                myPicks.forEach(myPick => {
                    // Check for Role Match (Counter Logic)
                    if (oppPick.assigned_role && myPick.assigned_role && oppPick.assigned_role === myPick.assigned_role) {

                        if (!analysis.has(oppPick.hero_id)) {
                            analysis.set(oppPick.hero_id, {
                                role: oppPick.assigned_role,
                                total: 0,
                                responses: new Map()
                            })
                        }

                        const entry = analysis.get(oppPick.hero_id)!
                        entry.total++

                        if (!entry.responses.has(myPick.hero_id)) {
                            entry.responses.set(myPick.hero_id, { count: 0, wins: 0 })
                        }

                        const resp = entry.responses.get(myPick.hero_id)!
                        resp.count++
                        if (won) resp.wins++
                    }
                })
            })
        })
    })

    // Convert map to array
    const result = Array.from(analysis.entries()).map(([oppHeroId, data]) => {
        return {
            opponentHeroId: oppHeroId,
            role: data.role,
            totalEncounters: data.total,
            responses: Array.from(data.responses.entries()).map(([myHeroId, stats]) => ({
                heroId: myHeroId,
                count: stats.count,
                winRate: Math.round((stats.wins / stats.count) * 100)
            })).sort((a, b) => {
                // Sort by Win Rate DESC first, then Count DESC
                if (b.winRate !== a.winRate) return b.winRate - a.winRate
                return b.count - a.count
            })
        }
    }).sort((a, b) => b.totalEncounters - a.totalEncounters)

    return result
}
