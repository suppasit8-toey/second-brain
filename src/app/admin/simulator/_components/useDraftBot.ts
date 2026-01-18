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

export function useDraftBot({ game, match, draftState, onLockIn, isPaused, initialHeroes, analysisConfig, blueSuggestions, redSuggestions }: UseDraftBotProps & { blueSuggestions?: any[], redSuggestions?: any[] }) {
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

                // Get all currently picked hero IDs to prevent duplicates
                const allPickedIds = [
                    ...Object.values(draftState.bluePicks || {}),
                    ...Object.values(draftState.redPicks || {})
                ].filter(Boolean) as string[]

                // --- STRATEGY: Use Advisor Suggestions First ---
                if (suggestions && suggestions.length > 0) {
                    if (currentPhase === 'BAN') {
                        // For BAN, just pick the highest score ban suggestion
                        // Filter out unavailable just in case
                        const availableBans = suggestions.filter((s: any) =>
                            !draftState.blueBans.includes(s.hero.id) &&
                            !draftState.redBans.includes(s.hero.id) &&
                            !allPickedIds.includes(s.hero.id) // Ensure not banning a picked hero (though UI prevents this usually)
                        )
                        if (availableBans.length > 0) {
                            console.log(`🤖 Bot following Advisor BAN: ${availableBans[0].hero.name}`)
                            bestHeroId = availableBans[0].hero.id
                        }
                    } else {
                        // For PICK, be smarter about roles
                        const allyPicks = draftState.currentStep.side === 'BLUE' ? Object.values(draftState.bluePicks) : Object.values(draftState.redPicks)

                        // Filter suggestions to exclude ALREADY PICKED heroes by ANYONE
                        const availableSuggestions = suggestions.filter((s: any) => !allPickedIds.includes(s.hero.id))

                        // 1. Identify Needed Roles
                        const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']
                        const allyHeroes = initialHeroes.filter(h => allyPicks.includes(h.id))

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
                /* 
                   Also use allPickedIds to filter fallback
                */
                if (!bestHeroId) {
                    console.log("🤖 Bot fallback to internal analysis (Advisor empty)")
                    const bannedIds = [...draftState.blueBans, ...draftState.redBans]

                    const excludeIds = [...bannedIds, ...allPickedIds]
                    const available = initialHeroes.filter(h => !excludeIds.includes(h.id))
                        .sort((a, b) => (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0))

                    if (available.length > 0) bestHeroId = available[0].id
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
        redSuggestions
    ])
}
