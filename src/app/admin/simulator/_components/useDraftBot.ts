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

export function useDraftBot({ game, match, draftState, onLockIn, isPaused, initialHeroes, analysisConfig, blueSuggestions, redSuggestions, opponentGlobalBans = [] }: UseDraftBotProps & { blueSuggestions?: any[], redSuggestions?: any[], opponentGlobalBans?: string[] }) {
    const isBotTurn = (
        match.ai_metadata?.mode === 'PVE' &&
        draftState.currentStep &&
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

            if (!processingRef.current) return

            try {
                // Determine which suggestions to use
                const suggestions = draftState.currentStep.side === 'BLUE' ? blueSuggestions : redSuggestions
                let bestHeroId = ''

                // Get all currently picked hero IDs to prevent duplicates (convert to strings for consistent comparison)
                const allPickedIds = [
                    ...Object.values(draftState.bluePicks || {}),
                    ...Object.values(draftState.redPicks || {})
                ].filter(Boolean).map(id => String(id))

                console.log(`🤖 Bot checking - Already picked IDs: [${allPickedIds.join(', ')}]`)

                // --- STRATEGY: Use Advisor Suggestions First ---
                if (suggestions && suggestions.length > 0) {
                    if (currentPhase === 'BAN') {
                        // For BAN, pick the highest score ban suggestion
                        // Filter out: already banned, already picked, AND heroes opponent already used in previous games
                        const enemyPicks = draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.redPicks).filter(Boolean).map(id => String(id))
                            : Object.values(draftState.bluePicks).filter(Boolean).map(id => String(id))

                        const availableBans = suggestions.filter((s: any) =>
                            !draftState.blueBans.map(String).includes(String(s.hero.id)) &&
                            !draftState.redBans.map(String).includes(String(s.hero.id)) &&
                            !allPickedIds.includes(String(s.hero.id)) && // Ensure not banning a picked hero
                            !enemyPicks.includes(String(s.hero.id)) && // Don't ban heroes enemy already picked in this game
                            !opponentGlobalBans.map(String).includes(String(s.hero.id)) // Don't ban heroes opponent used in previous games
                        )
                        if (availableBans.length > 0) {
                            console.log(`🤖 Bot following Advisor BAN: ${availableBans[0].hero.name}`)
                            bestHeroId = availableBans[0].hero.id
                        } else {
                            console.log(`🤖 Bot BAN: All suggestions filtered out, skipping advisor`)
                        }
                    } else {
                        // For PICK, be smarter about roles
                        const allyPicks = (draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.bluePicks)
                            : Object.values(draftState.redPicks)
                        ).filter(Boolean).map(id => String(id))

                        // Filter suggestions to exclude ALREADY PICKED heroes by ANYONE
                        const availableSuggestions = suggestions.filter((s: any) => {
                            const heroIdStr = String(s.hero.id)
                            const isAlreadyPicked = allPickedIds.includes(heroIdStr)
                            if (isAlreadyPicked) {
                                console.log(`🤖 Filtering out ${s.hero.name} - already picked`)
                            }
                            return !isAlreadyPicked
                        })

                        // 1. Identify Needed Roles
                        const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
                        const allyHeroes = initialHeroes.filter(h => allyPicks.includes(String(h.id)))

                        // Simple Greedy Assignment
                        const tempRoles = new Set<string>()
                        const sortedAllies = [...allyHeroes].sort((a, b) => (a.main_position?.length || 0) - (b.main_position?.length || 0))

                        sortedAllies.forEach(h => {
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

                        // 2. Filter Suggestions for Missing Roles
                        if (missingRoles.length > 0) {
                            // Look for top suggestion that fills a missing role
                            const roleFillSuggestion = availableSuggestions.find((s: any) =>
                                s.hero.main_position?.some((pos: string) => {
                                    const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                    return missingRoles.includes(norm)
                                })
                            )

                            if (roleFillSuggestion) {
                                console.log(`🤖 Bot found role filler in Advisor: ${roleFillSuggestion.hero.name}`)
                                bestHeroId = roleFillSuggestion.hero.id
                            }
                        }

                        // 3. If no role filler found (or all roles filled), just pick Top 1 Suggestion
                        if (!bestHeroId && availableSuggestions.length > 0) {
                            console.log(`🤖 Bot picking Top Advisor suggestion: ${availableSuggestions[0].hero.name}`)
                            bestHeroId = availableSuggestions[0].hero.id
                        }
                    }
                }

                // --- FALLBACK: If Advisor has no data, use internal logic ---
                if (!bestHeroId) {
                    console.log("🤖 Bot fallback to internal analysis (Advisor empty)")
                    const bannedIds = [...draftState.blueBans, ...draftState.redBans].map(String)
                    const excludeIds = [...bannedIds, ...allPickedIds] // allPickedIds is already strings

                    if (currentPhase === 'BAN') {
                        // For BAN fallback: also exclude opponentGlobalBans (heroes opponent used in previous games)
                        const enemyPicks = draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.redPicks).filter(Boolean).map(id => String(id))
                            : Object.values(draftState.bluePicks).filter(Boolean).map(id => String(id))

                        const banExcludeIds = [...excludeIds, ...opponentGlobalBans.map(String), ...enemyPicks]
                        const available = initialHeroes.filter(h => !banExcludeIds.includes(String(h.id)))
                            .sort((a, b) => ((b.hero_stats as any)?.[0]?.ban_rate || (b.hero_stats as any)?.[0]?.win_rate || 0) - ((a.hero_stats as any)?.[0]?.ban_rate || (a.hero_stats as any)?.[0]?.win_rate || 0))

                        if (available.length > 0) bestHeroId = available[0].id
                    } else {
                        // For PICK fallback: prioritize heroes that fill missing roles
                        const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
                        const allyPicks = draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.bluePicks).filter(Boolean).map(id => String(id))
                            : Object.values(draftState.redPicks).filter(Boolean).map(id => String(id))
                        const allyHeroes = initialHeroes.filter(h => allyPicks.includes(String(h.id)))

                        // Calculate missing roles
                        const tempRoles = new Set<string>()
                        allyHeroes.forEach(h => {
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

                        const available = initialHeroes.filter(h => !excludeIds.includes(String(h.id)))

                        // First, try to find a hero that fills a missing role
                        if (missingRoles.length > 0) {
                            const roleFiller = available.find(h =>
                                h.main_position?.some(pos => {
                                    const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                    return missingRoles.includes(norm)
                                })
                            )
                            if (roleFiller) {
                                console.log(`🤖 Bot fallback found role filler: ${roleFiller.name}`)
                                bestHeroId = roleFiller.id
                            }
                        }

                        // If no role filler, pick highest win rate
                        if (!bestHeroId && available.length > 0) {
                            const sorted = available.sort((a, b) =>
                                (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0)
                            )
                            bestHeroId = sorted[0].id
                        }
                    }
                }

                if (bestHeroId) {
                    console.log(`🤖 Bot acting: ${bestHeroId}`)
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
            processingRef.current = false
        }

    }, [
        isBotTurn,
        draftState.stepIndex,
        isPaused,
        blueSuggestions, // Dependency added so bot reacts when suggestions load
        redSuggestions,
        opponentGlobalBans // Added so bot respects global bans from previous games
    ])
}
