'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function saveMatchups(
    versionId: number,
    heroId: string, // UUID
    myPosition: string,
    matchupData: { enemyId: string, enemyPosition: string, winRate: number }[]
) {
    const supabase = await createClient()

    if (!versionId || !heroId || !myPosition || matchupData.length === 0) {
        return { success: false, message: 'Missing required data' }
    }

    // 1. Prepare data array (Bidirectional)
    const recordsToUpsert: any[] = []

    for (const m of matchupData) {
        // A. Forward Record (Me vs Enemy)
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: heroId,
            position: myPosition,
            enemy_hero_id: m.enemyId,
            enemy_position: m.enemyPosition,
            win_rate: m.winRate
        })

        // B. Reverse Record (Enemy vs Me)
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: m.enemyId,         // Swapped
            position: m.enemyPosition,  // Swapped
            enemy_hero_id: heroId,      // Swapped
            enemy_position: myPosition, // Swapped
            win_rate: 100 - m.winRate   // Inverted Win Rate
        })
    }

    // 2. Bulk Upsert
    const { error } = await supabase
        .from('matchups')
        .upsert(recordsToUpsert, {
            onConflict: 'version_id, hero_id, position, enemy_hero_id, enemy_position',
            ignoreDuplicates: false
        })

    if (error) {
        console.error('Error saving matchups:', error)
        return { success: false, message: error.message }
    }

    revalidatePath('/admin/matchups')
    return { success: true, message: 'Matchups saved successfully (Bidirectional Sync)' }
}

export async function getMatchups(versionId: number, heroId: string, position: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('matchups')
        .select(`
            *,
            opponent:heroes!matchups_enemy_hero_id_fkey (
                id,
                name,
                icon_url
            )
        `)
        .eq('version_id', versionId)
        .eq('hero_id', heroId)
        .eq('position', position)

    if (error) {
        console.error('Error fetching matchups:', error)
        return []
    }

    return data
}

export async function createNewMatchup(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const heroId = (formData.get('hero_id') || formData.get('heroId')) as string
    const opponentId = (formData.get('opponent_id') || formData.get('opponentId')) as string

    const position = (formData.get('lane') || 'Mid') as string
    const winRate = parseInt((formData.get('win_rate') || '50') as string)

    if (!heroId || !opponentId) {
        return { message: 'Hero and Opponent are required', success: false }
    }

    try {
        const { data: activeVersion } = await supabase.from('versions').select('id').eq('is_active', true).single()
        if (!activeVersion) throw new Error("No active version found")
        const versionId = activeVersion.id

        const enemyPosition = position

        const { error } = await supabase
            .from('matchups')
            .insert({
                version_id: versionId,
                hero_id: heroId,
                position: position,
                enemy_hero_id: opponentId,
                enemy_position: enemyPosition,
                win_rate: winRate,
            })

        if (error) throw error

        revalidatePath('/admin/matchups')
    } catch (error: any) {
        return { message: 'Failed to add matchup: ' + error.message, success: false }
    }

    redirect('/admin/matchups')
}

// ALIAS TO FIX IMPORT ERRORS
export const addMatchup = createNewMatchup;

export async function getSuggestedMatchups(versionId: number) {
    const supabase = await createClient()

    // 1. Fetch Existing Matchups for THIS version
    // We want a Set of keys to quickly check existence: `${heroId}|${position}|${enemyId}|${enemyPosition}`
    // NOTE: Default limit is 1000. Use pagination to ensure we get ALL records.
    let existing: any[] = []
    let page = 0
    const pageSize = 1000
    while (true) {
        const { data, error } = await supabase
            .from('matchups')
            .select('hero_id, position, enemy_hero_id, enemy_position')
            .eq('version_id', versionId)
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
            console.error('Error fetching existing matchups:', error)
            break
        }
        if (data && data.length > 0) {
            existing = existing.concat(data)
            if (data.length < pageSize) break // Reached end
            page++
        } else {
            break
        }
    }

    const existingSet = new Set<string>()
    // STRICT DUPLICATE CHECK: Track pairs to filter out ANY existing matchup between two heroes
    const existingPairs = new Set<string>()

    existing?.forEach((m: any) => {
        existingSet.add(`${m.hero_id}|${m.position}|${m.enemy_hero_id}|${m.enemy_position}`)
        existingPairs.add(`${m.hero_id}|${m.enemy_hero_id}`)
        existingPairs.add(`${m.enemy_hero_id}|${m.hero_id}`)
    })

    // 2. Fetch Scrim Data (Draft Picks) for THIS version
    // We need game_id, hero_id, position, side, win/loss
    // We need games to know the winner
    const { data: matches } = await supabase
        .from('draft_matches')
        .select(`
            games:draft_games(
                id,
                winner,
                blue_key_player_id,
                red_key_player_id,
                picks:draft_picks(
                    hero_id,
                    side,
                    assigned_role,
                    type
                )
            )
        `)
        .eq('version_id', versionId)
        .eq('status', 'finished')

    // 3. Aggregate Stats for Unrecorded Matchups
    // Map Key: `${idMin}|${role}|${idMax}|${role}` -> { heroId, enemyId, ... }
    const suggestions = new Map<string, {
        heroId: string,
        role: string,
        enemyId: string,
        enemyRole: string,
        wins: number,
        games: number
    }>()

    matches?.forEach(match => {
        match.games.forEach((game: any) => {
            const bluePicks: Record<string, string> = {} // Role -> HeroID
            const redPicks: Record<string, string> = {}
            const blueTeamIds: { id: string, role: string }[] = []
            const redTeamIds: { id: string, role: string }[] = []

            game.picks?.forEach((p: any) => {
                if (p.type === 'PICK' && p.assigned_role) {
                    if (p.side === 'BLUE') {
                        bluePicks[p.assigned_role] = p.hero_id
                        blueTeamIds.push({ id: p.hero_id, role: p.assigned_role })
                    } else {
                        redPicks[p.assigned_role] = p.hero_id
                        redTeamIds.push({ id: p.hero_id, role: p.assigned_role })
                    }
                }
            })

            // Compare Roles
            const processPair = (hA: string, rA: string, hB: string, rB: string, winnerSide: 'Blue' | 'Red' | null, hASide: 'Blue' | 'Red') => {
                // Check Existing Pair (User Requested Strict Filter)
                if (existingPairs.has(`${hA}|${hB}`)) return;

                // Determine Canonical Order (A vs B)
                let h1 = hA, r1 = rA
                let h2 = hB, r2 = rB
                let h1Won = (winnerSide === hASide)

                if (hA > hB) {
                    h1 = hB; r1 = rB;
                    h2 = hA; r2 = rA;
                    h1Won = (winnerSide !== hASide)
                }

                const canonicalKey = `${h1}|${r1}|${h2}|${r2}`

                if (!suggestions.has(canonicalKey)) {
                    suggestions.set(canonicalKey, {
                        heroId: h1, role: r1,
                        enemyId: h2, enemyRole: r2,
                        wins: 0, games: 0
                    })
                }

                const s = suggestions.get(canonicalKey)!
                s.games++
                if (h1Won) s.wins++
            }

            const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
            roles.forEach(role => {
                const blueHero = bluePicks[role]
                const redHero = redPicks[role]

                if (blueHero && redHero && blueHero !== redHero) {
                    // Check if Filtered (Already Exists)
                    // We check both directions. If EITHER exists, we assume we have data (since we save bidirectional)
                    const keyBlue = `${blueHero}|${role}|${redHero}|${role}`
                    const keyRed = `${redHero}|${role}|${blueHero}|${role}`

                    // Filter if this specific matchup exists OR if the pair exists in any capacity
                    if (existingSet.has(keyBlue) || existingSet.has(keyRed) || existingPairs.has(`${blueHero}|${redHero}`)) return;

                    // Canonical Key for Suggestion Deduplication
                    // We want only ONE entry per pair (e.g. A vs B). 
                    // Let's decide based on string comparison of IDs
                    let h1 = blueHero, h2 = redHero
                    let h1Won = (game.winner === 'Blue')

                    if (blueHero > redHero) {
                        h1 = redHero
                        h2 = blueHero
                        h1Won = (game.winner === 'Red')
                    }

                    const canonicalKey = `${h1}|${role}|${h2}|${role}`

                    if (!suggestions.has(canonicalKey)) {
                        suggestions.set(canonicalKey, {
                            heroId: h1,
                            role,
                            enemyId: h2,
                            enemyRole: role,
                            wins: 0,
                            games: 0
                        })
                    }

                    const s = suggestions.get(canonicalKey)!
                    s.games++
                    if (h1Won) s.wins++
                }
            })

            // B. MVP vs All Opponents (User Request)
            // Blue Key Player vs All Red
            if (game.blue_key_player_id) {
                const mvpData = blueTeamIds.find(m => m.id === game.blue_key_player_id)
                if (mvpData) {
                    redTeamIds.forEach(enemy => {
                        // Skip if same role (already handled in A usually, or handled by strict pair check)
                        if (mvpData.role === enemy.role) return;
                        processPair(mvpData.id, mvpData.role, enemy.id, enemy.role, game.winner, 'Blue')
                    })
                }
            }
            // Red Key Player vs All Blue
            if (game.red_key_player_id) {
                const mvpData = redTeamIds.find(m => m.id === game.red_key_player_id)
                if (mvpData) {
                    blueTeamIds.forEach(enemy => {
                        if (mvpData.role === enemy.role) return;
                        processPair(mvpData.id, mvpData.role, enemy.id, enemy.role, game.winner, 'Red')
                    })
                }
            }
        })
    })

    // 4. Fetch Hero Details for suggestions
    const { data: heroes } = await supabase.from('heroes').select('id, name, icon_url')
    const heroMap = new Map<string, any>()
    heroes?.forEach((h: any) => heroMap.set(h.id, h))

    // 5. Convert to Array and Return
    return Array.from(suggestions.values()).map(s => ({
        ...s,
        hero: heroMap.get(s.heroId),
        enemy: heroMap.get(s.enemyId),
        winRate: (s.wins / s.games) * 100
    })).sort((a, b) => b.games - a.games) // Prioritize most frequent matchups
}

// === NEW: Check and Fix Matchup Data Consistency ===

export async function checkMatchupConsistency(versionId: number) {
    const supabase = await createClient()

    // Fetch all matchups for this version
    let allMatchups: any[] = []
    let page = 0
    const pageSize = 1000
    while (true) {
        const { data, error } = await supabase
            .from('matchups')
            .select('id, hero_id, position, enemy_hero_id, enemy_position, win_rate')
            .eq('version_id', versionId)
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
            console.error('Error fetching matchups:', error)
            break
        }
        if (data && data.length > 0) {
            allMatchups = allMatchups.concat(data)
            if (data.length < pageSize) break
            page++
        } else {
            break
        }
    }

    // Create lookup map: key = "heroId|position|enemyId|enemyPosition" -> win_rate
    const matchupMap = new Map<string, { id: string, win_rate: number }>()
    allMatchups.forEach(m => {
        const key = `${m.hero_id}|${m.position}|${m.enemy_hero_id}|${m.enemy_position}`
        matchupMap.set(key, { id: m.id, win_rate: m.win_rate })
    })

    // Find inconsistencies
    const inconsistencies: {
        heroId: string,
        position: string,
        enemyId: string,
        enemyPosition: string,
        currentWinRate: number,
        reverseWinRate: number | null,
        expectedReverseWinRate: number,
        issue: 'missing_reverse' | 'wrong_reverse'
    }[] = []

    const checkedPairs = new Set<string>()

    allMatchups.forEach(m => {
        // Create canonical key to avoid double-checking
        const pairKey = [m.hero_id, m.enemy_hero_id].sort().join('|')
        if (checkedPairs.has(pairKey)) return
        checkedPairs.add(pairKey)

        const forwardKey = `${m.hero_id}|${m.position}|${m.enemy_hero_id}|${m.enemy_position}`
        const reverseKey = `${m.enemy_hero_id}|${m.enemy_position}|${m.hero_id}|${m.position}`

        const forward = matchupMap.get(forwardKey)
        const reverse = matchupMap.get(reverseKey)

        if (!forward) return

        const expectedReverseWinRate = 100 - forward.win_rate

        if (!reverse) {
            // Missing reverse record
            inconsistencies.push({
                heroId: m.hero_id,
                position: m.position,
                enemyId: m.enemy_hero_id,
                enemyPosition: m.enemy_position,
                currentWinRate: forward.win_rate,
                reverseWinRate: null,
                expectedReverseWinRate,
                issue: 'missing_reverse'
            })
        } else if (Math.abs(reverse.win_rate - expectedReverseWinRate) > 0.5) {
            // Wrong reverse value (allowing 0.5% tolerance for rounding)
            inconsistencies.push({
                heroId: m.hero_id,
                position: m.position,
                enemyId: m.enemy_hero_id,
                enemyPosition: m.enemy_position,
                currentWinRate: forward.win_rate,
                reverseWinRate: reverse.win_rate,
                expectedReverseWinRate,
                issue: 'wrong_reverse'
            })
        }
    })

    // Fetch hero names for display
    const heroIds = new Set<string>()
    inconsistencies.forEach(i => {
        heroIds.add(i.heroId)
        heroIds.add(i.enemyId)
    })

    const { data: heroes } = await supabase
        .from('heroes')
        .select('id, name')
        .in('id', Array.from(heroIds))

    const heroMap = new Map<string, string>()
    heroes?.forEach(h => heroMap.set(h.id, h.name))

    return {
        total: allMatchups.length,
        inconsistentCount: inconsistencies.length,
        inconsistencies: inconsistencies.map(i => ({
            ...i,
            heroName: heroMap.get(i.heroId) || 'Unknown',
            enemyName: heroMap.get(i.enemyId) || 'Unknown'
        }))
    }
}

export async function fixMatchupConsistency(versionId: number) {
    const supabase = await createClient()

    // Get inconsistencies
    const check = await checkMatchupConsistency(versionId)
    if (check.inconsistentCount === 0) {
        return { success: true, message: 'No inconsistencies found', fixed: 0 }
    }

    const recordsToUpsert: any[] = []

    check.inconsistencies.forEach(inc => {
        // Create/Update reverse record
        recordsToUpsert.push({
            version_id: versionId,
            hero_id: inc.enemyId,
            position: inc.enemyPosition,
            enemy_hero_id: inc.heroId,
            enemy_position: inc.position,
            win_rate: inc.expectedReverseWinRate
        })
    })

    const { error } = await supabase
        .from('matchups')
        .upsert(recordsToUpsert, {
            onConflict: 'version_id, hero_id, position, enemy_hero_id, enemy_position',
            ignoreDuplicates: false
        })

    if (error) {
        console.error('Error fixing matchups:', error)
        return { success: false, message: error.message, fixed: 0 }
    }

    revalidatePath('/admin/matchups')
    return {
        success: true,
        message: `Fixed ${recordsToUpsert.length} matchup records`,
        fixed: recordsToUpsert.length,
        details: check.inconsistencies.slice(0, 10) // Return first 10 for review
    }
}
