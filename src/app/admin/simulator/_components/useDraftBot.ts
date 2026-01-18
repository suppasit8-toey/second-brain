import { useEffect, useRef } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { getRecommendations } from '../recommendations'

interface UseDraftBotProps {
    game: DraftGame;
    match: DraftMatch;
    draftState: any; // Type from useDraftEngine
    onLockIn: (heroId: string) => void;
    isPaused: boolean;
    initialHeroes: Hero[];
    analysisConfig?: { layers: { id: string, weight: number, isActive: boolean, order: number }[] }; // Correct type from AnalysisMode
}

export function useDraftBot({ game, match, draftState, onLockIn, isPaused, initialHeroes, analysisConfig }: UseDraftBotProps) {
    const isBotTurn = (
        match.ai_metadata?.mode === 'PVE' &&
        draftState.currentStep &&
        // If Bot is Team B (Red usually, but could be Blue if side swapped)
        // Wait, "Team B" is Bot. 
        // We need to know if current side (BLUE/RED) matches Team B's side.
        // In MatchRoom, we know:
        // const blueTeamName = game.blue_team_name
        // match.team_b_name === 'Cerebro AI'
        // So if (currentStep.side === 'BLUE' && game.blue_team_name === match.team_b_name) OR
        //    (currentStep.side === 'RED' && game.red_team_name === match.team_b_name)
        (
            (draftState.currentStep.side === 'BLUE' && game.blue_team_name === match.team_b_name) ||
            (draftState.currentStep.side === 'RED' && game.red_team_name === match.team_b_name)
        )
    )

    const processingRef = useRef(false)
    const onLockInRef = useRef(onLockIn)

    // Keep ref updated
    useEffect(() => {
        onLockInRef.current = onLockIn
    }, [onLockIn])

    useEffect(() => {
        if (!isBotTurn || isPaused || draftState.isFinished || processingRef.current) return

        const currentPhase = draftState.currentStep?.type === 'BAN' ? 'BAN' : 'PICK'

        // Execute Bot Move
        const executeBotMove = async () => {
            console.log("🤖 Bot is thinking...")
            processingRef.current = true

            // Simulate "Thinking" time (2-5 seconds)
            const delay = Math.floor(Math.random() * 3000) + 2000
            await new Promise(r => setTimeout(r, delay))

            // Check if still bot turn after delay (pause/reset might happen)
            // Note: We check current state via refs or we assume if effect logic hasn't been cancelled/unmounted?
            // If component re-rendered in between, this closure is stale regarding 'isBotTurn' etc.
            // But we only care if we should still proceed.
            if (!processingRef.current) return

            try {
                // Prepare Context
                const allyPicks = draftState.currentStep.side === 'BLUE' ? Object.values(draftState.bluePicks) : Object.values(draftState.redPicks)
                const enemyPicks = draftState.currentStep.side === 'BLUE' ? Object.values(draftState.redPicks) : Object.values(draftState.bluePicks)
                const bannedIds = [...draftState.blueBans, ...draftState.redBans]
                const pickedIds = [...Object.values(draftState.bluePicks), ...Object.values(draftState.redPicks)]

                // Calculate global bans (heroes played in previous games)
                // Bot is Team B, so opponent is Team A
                const previousGames = match.games?.filter((g: any) => g.winner) || []
                const opponentGlobalBans: string[] = []
                const allyGlobalBans: string[] = []

                previousGames.forEach((prevGame: any) => {
                    const pGame = match.games?.find((g: any) => g.id === prevGame.id)
                    if (!pGame?.picks) return

                    const sideOfA = pGame.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'

                    pGame.picks.forEach((p: any) => {
                        if (p.type === 'PICK') {
                            if (p.side === sideOfA) opponentGlobalBans.push(p.hero_id)
                            else allyGlobalBans.push(p.hero_id)
                        }
                    })
                })

                // For ban phase, ALSO exclude opponent's global bans (banning them is useless)
                const excludeFromBans = currentPhase === 'BAN' ? [...bannedIds, ...pickedIds, ...opponentGlobalBans] : [...bannedIds, ...pickedIds]

                const recs = await getRecommendations(
                    match.version_id,
                    allyPicks as string[],
                    enemyPicks as string[],
                    excludeFromBans, // Must exclude all unavailable + opponent's global bans
                    allyGlobalBans, // Our own global bans (can't pick these)
                    {
                        matchId: match.id,
                        phase: currentPhase,
                        side: draftState.currentStep.side,
                        tournamentId: match.ai_metadata?.settings?.tournamentId,
                        targetTeamName: match.team_b_name // The Bot simulates Team B
                    },
                    analysisConfig // Pass the config
                )

                // Pick Strategy:
                // 1. If BAN phase: Pick top 'smartBan' or 'counter'
                // 2. If PICK phase: Pick top 'hybrid' or 'analyst'

                let bestHeroId = ''

                if (currentPhase === 'BAN') {
                    // Try smart bans first
                    if (recs.smartBan && recs.smartBan.length > 0) {
                        bestHeroId = recs.smartBan[0].hero.id
                    } else if (recs.analyst && recs.analyst.length > 0) {
                        // Ban high score pick
                        bestHeroId = recs.analyst[0].hero.id
                    }
                } else {
                    // For PICK phase, filter out heroes we've already picked in previous games
                    // AND prioritize filling missing roles

                    // 1. Identify Needed Roles
                    const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']

                    // Simple Greedy Assignment to find what we have
                    const filledRoles = new Set<string>()
                    const allyHeroes = initialHeroes.filter(h => allyPicks.includes(h.id))

                    // Sort allies by flexibility (ascending) to assign stiff heroes first
                    const sortedAllies = [...allyHeroes].sort((a, b) => (a.main_position?.length || 0) - (b.main_position?.length || 0))

                    const tempRoles = new Set<string>()
                    sortedAllies.forEach(h => {
                        // Find first available role this hero can play
                        const role = h.main_position?.find(r => {
                            const normalized = r === 'Abyssal' ? 'Abyssal Dragon' : (r === 'Support' ? 'Roam' : r)
                            return STANDARD_ROLES.includes(normalized) && !tempRoles.has(normalized)
                        })
                        if (role) {
                            const normalized = role === 'Abyssal' ? 'Abyssal Dragon' : (role === 'Support' ? 'Roam' : role)
                            tempRoles.add(normalized)
                        }
                    })

                    const missingRoles = STANDARD_ROLES.filter(r => !tempRoles.has(r))
                    console.log("[Bot] Missing Roles:", missingRoles)

                    const baseRecs = recs.hybrid || []
                    const validRecs = baseRecs.filter(rec => !allyGlobalBans.includes(rec.hero.id))

                    // 2. Filter for Missing Roles
                    let bestRec = null

                    // Attempt to find top rec that fills a missing role
                    if (missingRoles.length > 0) {
                        const neededRecs = validRecs.filter(r => {
                            return r.hero.main_position?.some((pos: string) => {
                                const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                return missingRoles.includes(norm)
                            })
                        })

                        if (neededRecs.length > 0) {
                            console.log("[Bot] Found recommendation for missing role:", neededRecs[0].hero.name)
                            bestRec = neededRecs[0]
                        } else {
                            // No recommendation found for missing role? 
                            // Fallback: Search in history or initialHeroes for ANY high WR hero in that role
                            console.log("[Bot] No recommendation for missing role, checking history...")
                            const historyRecs = recs.history?.filter(rec => !allyGlobalBans.includes(rec.hero.id)) || []
                            const neededHistory = historyRecs.filter(r => {
                                return r.hero.main_position?.some((pos: string) => {
                                    const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                    return missingRoles.includes(norm)
                                })
                            })
                            if (neededHistory.length > 0) {
                                bestRec = neededHistory[0]
                            } else {
                                // Ultimate Fallback: Just pick best available hero that fits role from raw list
                                console.log("[Bot] Deep search for missing role...")
                                // check initialHeroes excluding unavailable
                                const excludeIds = [...bannedIds, ...pickedIds, ...allyGlobalBans]
                                const availableForRole = initialHeroes.filter(h =>
                                    !excludeIds.includes(h.id) &&
                                    h.main_position?.some((pos: string) => {
                                        const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                        return missingRoles.includes(norm)
                                    })
                                ).sort((a, b) => (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0))

                                if (availableForRole.length > 0) {
                                    bestHeroId = availableForRole[0].id // Direct assignment
                                }
                            }
                        }
                    }

                    if (!bestHeroId) {
                        if (bestRec) {
                            bestHeroId = bestRec.hero.id
                        } else if (validRecs.length > 0) {
                            bestHeroId = validRecs[0].hero.id
                        }
                    }
                }

                // Fallback: Random High Win Rate if API fails or no recs
                if (!bestHeroId) {
                    console.log("🤖 Bot fallback to random high WR")
                    const excludeIds = currentPhase === 'BAN'
                        ? [...bannedIds, ...pickedIds, ...opponentGlobalBans]
                        : [...bannedIds, ...pickedIds, ...allyGlobalBans]
                    const available = initialHeroes.filter(h =>
                        !excludeIds.includes(h.id)
                    ).sort((a, b) => (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0))

                    if (available.length > 0) bestHeroId = available[0].id
                }

                if (bestHeroId) {
                    console.log(`🤖 Bot selected: ${bestHeroId}`)
                    // Use REF to call latest lockIn (avoids stale closure issue)
                    onLockInRef.current(bestHeroId)
                }

            } catch (err) {
                console.error("Bot Error:", err)
            } finally {
                processingRef.current = false
            }
        }

        executeBotMove()

        return () => {
            processingRef.current = false // Cancel on unmount/change
        }

    }, [
        isBotTurn,
        draftState.stepIndex,
        isPaused,
        // Remove game props from dependency to avoid unnecessary resets if they referentially change (though usually stable)
        // Kept logic dependencies
    ])
}
