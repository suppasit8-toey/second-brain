import { useEffect, useRef, useState, useMemo } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { normalizeRole, resolveTeamRoles, STANDARD_ROLES } from '../recommendation-utils'
import {
    DraftPlan,
    HeroPoolAnalysis,
    BackupTrigger,
    TeamStats,
    MatchupData,
    createDraftPlan,
    analyzeHeroPools,
    checkBackupTrigger,
    adaptPlan,
    findBestCounter,
    getPlannedAction,
    isActionValid,
    findDenialPick
} from './botStrategies'

interface UseDraftBotProps {
    game: DraftGame;
    match: DraftMatch;
    draftState: any; // Type from useDraftEngine
    onLockIn: (heroId: string) => void;
    isPaused: boolean;
    initialHeroes: Hero[];
    analysisConfig?: { layers: { id: string, weight: number, isActive: boolean, order: number }[] };
    // NEW: Strategic Planning Props
    teamStats?: TeamStats | null;
    enemyTeamStats?: TeamStats | null;
    matchups?: MatchupData[];
}

export function useDraftBot({ game, match, draftState, onLockIn, isPaused, initialHeroes, analysisConfig, blueSuggestions, redSuggestions, opponentGlobalBans = [], suggestionLoading = false, teamStats = null, enemyTeamStats = null, matchups = [] }: UseDraftBotProps & { blueSuggestions?: any[], redSuggestions?: any[], opponentGlobalBans?: string[], suggestionLoading?: boolean }) {
    const isBotTurn = (
        match.ai_metadata?.mode === 'PVE' &&
        draftState.currentStep &&
        (
            (draftState.currentStep.side === 'BLUE' && game.blue_team_name === match.team_b_name) ||
            (draftState.currentStep.side === 'RED' && game.red_team_name === match.team_b_name)
        )
    )

    // Determine which side the bot is playing
    const botSide: 'BLUE' | 'RED' = game.blue_team_name === match.team_b_name ? 'BLUE' : 'RED'

    const processingRef = useRef(false)
    const onLockInRef = useRef(onLockIn)

    // === NEW: Draft Planning State ===
    const [draftPlan, setDraftPlan] = useState<DraftPlan | null>(null)
    const planCreatedRef = useRef(false)

    // Create Draft Plan once at the start of the game
    useEffect(() => {
        if (!planCreatedRef.current && match.ai_metadata?.mode === 'PVE' && initialHeroes.length > 0) {
            console.log("🤖 [STRATEGY] Initializing Draft Plan...")
            const plan = createDraftPlan(
                botSide,
                teamStats,
                enemyTeamStats,
                matchups,
                initialHeroes
            )
            setDraftPlan(plan)
            planCreatedRef.current = true
            console.log(`🤖 [STRATEGY] Draft Plan Created: Target Comp = ${plan.primaryPlan.targetComposition}, Key Pick = ${plan.primaryPlan.keyPickIndex}`)
        }
    }, [botSide, teamStats, enemyTeamStats, matchups, initialHeroes, match.ai_metadata?.mode])

    // Calculate Hero Pool Analysis per turn
    const heroPoolAnalysis = useMemo<HeroPoolAnalysis | null>(() => {
        if (!initialHeroes.length) return null

        const ourPicks = Object.values(botSide === 'BLUE' ? draftState.bluePicks : draftState.redPicks).filter(Boolean).map(String)
        const enemyPicks = Object.values(botSide === 'BLUE' ? draftState.redPicks : draftState.bluePicks).filter(Boolean).map(String)
        const allBans = [...draftState.blueBans, ...draftState.redBans].map(String)

        return analyzeHeroPools(
            initialHeroes,
            ourPicks,
            enemyPicks,
            allBans,
            teamStats,
            enemyTeamStats
        )
    }, [draftState.bluePicks, draftState.redPicks, draftState.blueBans, draftState.redBans, initialHeroes, botSide, teamStats, enemyTeamStats])

    // Check for Backup Triggers and adapt plan
    useEffect(() => {
        if (!draftPlan || !heroPoolAnalysis) return

        const ourPicks = Object.values(botSide === 'BLUE' ? draftState.bluePicks : draftState.redPicks).filter(Boolean).map(String)
        const enemyPicks = Object.values(botSide === 'BLUE' ? draftState.redPicks : draftState.bluePicks).filter(Boolean).map(String)
        const allBans = [...draftState.blueBans, ...draftState.redBans].map(String)

        const trigger = checkBackupTrigger(draftPlan, allBans, enemyPicks, ourPicks)
        if (trigger) {
            console.log(`🤖 [STRATEGY] Backup Trigger Detected: ${trigger}`)
            const adaptedPlan = adaptPlan(trigger, draftPlan, heroPoolAnalysis)
            setDraftPlan(adaptedPlan)
        }
    }, [draftState.stepIndex])

    // Keep ref updated
    useEffect(() => {
        onLockInRef.current = onLockIn
    }, [onLockIn])

    useEffect(() => {
        if (!isBotTurn || isPaused || draftState.isFinished || processingRef.current) return

        // 1. Wait for suggestions to load
        if (suggestionLoading) {
            console.log("🤖 Bot waiting for suggestions to load...")
            return
        }

        // 2. Validate Step Index (prevent using stale suggestions from previous turn)
        const suggestions = draftState.currentStep.side === 'BLUE' ? blueSuggestions : redSuggestions
        if (suggestions && suggestions.length > 0) {
            const currentStepIndex = draftState.stepIndex
            // Check if the first suggestion has a stepIndex and if it matches current
            // If suggestions don't have stepIndex (legacy/fallback), we might skip this check, 
            // but for safety in our new implementation, we want to enforce it if possible.
            // Let's assume if it exists, it must match.
            if (suggestions[0].stepIndex !== undefined && suggestions[0].stepIndex !== currentStepIndex) {
                console.log(`🤖 Bot waiting for FREH suggestions (Current: ${currentStepIndex}, Stale: ${suggestions[0].stepIndex})`)
                return
            }
        }

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

                // === STRATEGIC DECISION LOGIC ===
                // Count how many picks/bans the bot has made
                const myPicks = Object.values(botSide === 'BLUE' ? draftState.bluePicks : draftState.redPicks).filter(Boolean)
                const myBans = botSide === 'BLUE' ? draftState.blueBans.filter(Boolean) : draftState.redBans.filter(Boolean)
                const myPickCount = myPicks.length
                const myBanCount = myBans.length

                // Detect Counter-Pick Timing
                // RED: Pick 3 is the counter-pick slot (their 3rd pick)
                // BLUE: Pick 4 is the counter-pick slot (their 4th pick)
                const isCounterPickTiming = (
                    currentPhase === 'PICK' && (
                        (botSide === 'RED' && myPickCount === 2) ||  // About to make Pick 3
                        (botSide === 'BLUE' && myPickCount === 3)   // About to make Pick 4
                    )
                )

                // Detect Protection Ban Timing (Ban 3 or Ban 4 in Phase 2)
                const isProtectionBanTiming = (
                    currentPhase === 'BAN' && (myBanCount === 2 || myBanCount === 3) // Ban 3 or 4
                )

                // 😈 STRATEGY 0: Denial Pick (Steal enemy's best hero) - Phase 1 Priority
                if (!bestHeroId && currentPhase === 'PICK' && myPickCount <= 2 && enemyTeamStats && heroPoolAnalysis) {
                    const denialPick = findDenialPick(enemyTeamStats, teamStats, heroPoolAnalysis.available)
                    if (denialPick) {
                        console.log(`🤖 [STRATEGY] Denial Pick: Capturing ${denialPick.name}`)
                        bestHeroId = denialPick.id
                    }
                }

                // 🌟 STRATEGY 0.2: Follow ADVISOR Recommendations (High Priority - "Think like the button")
                // If Advisor has suggestions, use them! (Specifically Hybrid for Pick, SmartBan for Ban)
                if (!bestHeroId && suggestions && suggestions.length > 0) {
                    // Check if 'suggestions' is the new object format { hybrid: [], smartBan: [] } or old array
                    // Based on DraftInterface, 'blueSuggestions' seems to be passed as the WHOLE object from getRecommendations?
                    // Wait, useDraftBot receives `blueSuggestions`. in DraftInterface: `<DraftSuggestionPanel ... suggestions={recommendations} />`
                    // BUT useDraftBot usage in DraftInterface is NOT VISIBLE in the previous `view_file`.
                    // Let's assume `blueSuggestions` is the ARRAY of recommendations (e.g. hybrid) OR the full object.
                    // Actually, looking at `useDraftBot` signature: `blueSuggestions?: any[]`. It expects an array.
                    // The previous logic `suggestions[0].stepIndex` suggests it might be a different structure?
                    // Let's stick to the existing logic which treats `suggestions` as an ARRAY of recommendation objects.
                    // If so, we just need to move this block UP.

                    // NOTE: We trust that the parent component passes the CORRECT list (e.g. Hybrid list) to `blueSuggestions`.

                    if (currentPhase === 'BAN') {
                        const enemyPicks = draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.redPicks).filter(Boolean).map(id => String(id))
                            : Object.values(draftState.bluePicks).filter(Boolean).map(id => String(id))

                        const availableBans = suggestions.filter((s: any) =>
                            !draftState.blueBans.map(String).includes(String(s.hero.id)) &&
                            !draftState.redBans.map(String).includes(String(s.hero.id)) &&
                            !allPickedIds.includes(String(s.hero.id)) &&
                            !enemyPicks.includes(String(s.hero.id)) &&
                            !opponentGlobalBans.map(String).includes(String(s.hero.id))
                        )
                        if (availableBans.length > 0) {
                            console.log(`🤖 [STRATEGY] Advisor BAN: ${availableBans[0].hero.name}`)
                            bestHeroId = availableBans[0].hero.id
                        }
                    } else {
                        // PICK Phase - Use Advisor but respect roles
                        const allyPicks = (draftState.currentStep.side === 'BLUE'
                            ? Object.values(draftState.bluePicks)
                            : Object.values(draftState.redPicks)
                        ).filter(Boolean).map(id => String(id))

                        const bannedIds = [...draftState.blueBans, ...draftState.redBans].map(String)
                        const availableSuggestions = suggestions.filter((s: any) => {
                            const heroIdStr = String(s.hero.id)
                            return !allPickedIds.includes(heroIdStr) && !bannedIds.includes(heroIdStr)
                        })

                        const filledRoles = resolveTeamRoles(allyPicks, initialHeroes)
                        const missingRoles = STANDARD_ROLES.filter(r => !filledRoles.has(r))

                        if (missingRoles.length > 0) {
                            const roleFillSuggestion = availableSuggestions.find((s: any) =>
                                s.hero.main_position?.some((pos: string) => {
                                    const norm = normalizeRole(pos)
                                    return missingRoles.includes(norm)
                                })
                            )
                            if (roleFillSuggestion) {
                                console.log(`🤖 [STRATEGY] Advisor PICK (Role Fill): ${roleFillSuggestion.hero.name}`)
                                bestHeroId = roleFillSuggestion.hero.id
                            }
                        }

                        if (!bestHeroId && availableSuggestions.length > 0) {
                            console.log(`🤖 [STRATEGY] Advisor PICK (Top Rated): ${availableSuggestions[0].hero.name}`)
                            bestHeroId = availableSuggestions[0].hero.id
                        }
                    }
                }

                // 💪 STRATEGY 0.5: Flex Pick (Hide strategy) - Early Picks
                if (!bestHeroId && currentPhase === 'PICK' && myPickCount <= 1 && draftPlan?.flexPicks && draftPlan.flexPicks.length > 0 && heroPoolAnalysis) {
                    const flexPickId = draftPlan.flexPicks.find(id => heroPoolAnalysis.available.some(h => h.id === id))
                    if (flexPickId) {
                        // Get hero name for logging
                        const flexHero = heroPoolAnalysis.available.find(h => h.id === flexPickId)
                        console.log(`🤖 [STRATEGY] Flex Pick: Securing versatile hero ${flexHero?.name || flexPickId}`)
                        bestHeroId = flexPickId
                    }
                }

                // 🎯 STRATEGY 1: Counter-Pick at Key Timing
                if (isCounterPickTiming && heroPoolAnalysis && matchups.length > 0) {
                    console.log(`🤖 [STRATEGY] Counter-Pick Timing Detected! (${botSide} Pick ${myPickCount + 1})`)

                    const enemyPickIds = Object.values(botSide === 'BLUE' ? draftState.redPicks : draftState.bluePicks).filter(Boolean).map(String)
                    const bestCounter = findBestCounter(enemyPickIds, matchups, heroPoolAnalysis.available)

                    if (bestCounter) {
                        console.log(`🤖 [STRATEGY] Counter-Pick Selected: ${bestCounter.name}`)
                        bestHeroId = bestCounter.id
                    }
                }

                // 🛡️ STRATEGY 2: Protection Ban at Phase 2
                if (!bestHeroId && isProtectionBanTiming && draftPlan && heroPoolAnalysis) {
                    console.log(`🤖 [STRATEGY] Protection Ban Timing Detected! (Ban ${myBanCount + 1})`)

                    // Get our key pick hero (most recent pick or planned key pick)
                    const keyPickIndex = draftPlan.primaryPlan.keyPickIndex
                    const ourPickHeroes = myPicks.map(id => initialHeroes.find(h => h.id === String(id))).filter(Boolean)

                    if (ourPickHeroes.length > 0) {
                        // Find counters to our last/key pick and ban them
                        const keyHeroId = ourPickHeroes[ourPickHeroes.length - 1]?.id
                        if (keyHeroId) {
                            const countersToUs = matchups
                                .filter(m => m.enemyId === keyHeroId && m.winRate > 55 && m.games >= 2)
                                .filter(m => !heroPoolAnalysis.bannedIds.includes(m.heroId) && !heroPoolAnalysis.pickedIds.includes(m.heroId))
                                .sort((a, b) => b.winRate - a.winRate)

                            if (countersToUs.length > 0) {
                                console.log(`🤖 [STRATEGY] Protection Ban: Banning ${countersToUs[0].heroId} (counters our ${keyHeroId})`)
                                bestHeroId = countersToUs[0].heroId
                            }
                        }
                    }
                }

                // 📋 STRATEGY 3: Follow Draft Plan if available
                if (!bestHeroId && draftPlan && heroPoolAnalysis) {
                    const plannedHeroes = getPlannedAction(draftPlan, draftState.stepIndex, currentPhase, myPickCount, myBanCount)
                    const validHero = isActionValid(plannedHeroes, heroPoolAnalysis)

                    if (validHero) {
                        console.log(`🤖 [STRATEGY] Following Plan: ${validHero}`)
                        bestHeroId = validHero
                    }
                }

                // --- FALLBACK: Use Advisor Suggestions (Legacy block removed, moved up) ---
                // (This block is intentionally left empty as logic was moved up)

                // --- FALLBACK: If Advisor has no data, use internal logic ---
                // ... (Existing fallback logic remains same)
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

                        // CRITICAL: Re-calculate picked IDs from FRESH state to prevent duplicates
                        const bluePickIds = Object.values(draftState.bluePicks || {}).filter(Boolean).map(String)
                        const redPickIds = Object.values(draftState.redPicks || {}).filter(Boolean).map(String)
                        const allCurrentPickedIds = [...bluePickIds, ...redPickIds]
                        const allCurrentBannedIds = [...(draftState.blueBans || []), ...(draftState.redBans || [])].map(String)
                        const freshExcludeIds = [...allCurrentPickedIds, ...allCurrentBannedIds]

                        console.log(`🤖 [FALLBACK] Excluding IDs: ${freshExcludeIds.join(', ')}`)

                        const allyPicks = draftState.currentStep.side === 'BLUE' ? bluePickIds : redPickIds
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
                        console.log(`🤖 [FALLBACK] Missing roles: ${missingRoles.join(', ')}`)

                        // Get available heroes (STRICTLY exclude all picked and banned)
                        const available = initialHeroes.filter(h => !freshExcludeIds.includes(String(h.id)))
                        console.log(`🤖 [FALLBACK] Available heroes count: ${available.length}`)

                        // First, try to find a hero that fills a missing role (SORTED BY WIN RATE, not alphabetical!)
                        if (missingRoles.length > 0) {
                            const roleFillers = available
                                .filter(h =>
                                    h.main_position?.some(pos => {
                                        const norm = pos === 'Abyssal' ? 'Abyssal Dragon' : (pos === 'Support' ? 'Roam' : pos)
                                        return missingRoles.includes(norm)
                                    })
                                )
                                .sort((a, b) =>
                                    (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0)
                                )

                            if (roleFillers.length > 0) {
                                console.log(`🤖 [FALLBACK] Role filler selected: ${roleFillers[0].name} (WR: ${roleFillers[0].hero_stats?.[0]?.win_rate || 'N/A'}%)`)
                                bestHeroId = roleFillers[0].id
                            }
                        }

                        // If no role filler, pick highest win rate
                        if (!bestHeroId && available.length > 0) {
                            const sorted = [...available].sort((a, b) =>
                                (b.hero_stats?.[0]?.win_rate || 0) - (a.hero_stats?.[0]?.win_rate || 0)
                            )
                            console.log(`🤖 [FALLBACK] Top win rate hero selected: ${sorted[0].name} (WR: ${sorted[0].hero_stats?.[0]?.win_rate || 'N/A'}%)`)
                            bestHeroId = sorted[0].id
                        }
                    }
                }

                if (bestHeroId) {
                    if (allPickedIds.includes(String(bestHeroId))) {
                        console.error(`🤖 [CRITICAL ERROR] Bot attempted to pick duplicate hero: ${bestHeroId}. Aborting action.`)
                        // Optional: Retry or fallback? for now just abort to prevent game corruption
                        return
                    }
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
        blueSuggestions,
        redSuggestions,
        opponentGlobalBans,
        suggestionLoading // Add to DEPS to re-trigger when loading changes (though mainly we just want to block if loading is true)
    ])
}
