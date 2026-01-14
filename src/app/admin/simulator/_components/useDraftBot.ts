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
}

export function useDraftBot({ game, match, draftState, onLockIn, isPaused, initialHeroes }: UseDraftBotProps) {
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

                const recs = await getRecommendations(
                    match.version_id,
                    allyPicks as string[],
                    enemyPicks as string[],
                    [...bannedIds, ...pickedIds], // Must exclude all unavailable
                    [], // global bans (not implemented for bot yet)
                    {
                        matchId: match.id,
                        phase: currentPhase,
                        side: draftState.currentStep.side,
                        tournamentId: match.ai_metadata?.settings?.tournamentId,
                        targetTeamName: match.team_b_name // The Bot simulates Team B
                    }
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
                    if (recs.hybrid && recs.hybrid.length > 0) {
                        bestHeroId = recs.hybrid[0].hero.id
                    } else if (recs.history && recs.history.length > 0) {
                        bestHeroId = recs.history[0].hero.id
                    }
                }

                // Fallback: Random High Win Rate if API fails or no recs
                if (!bestHeroId) {
                    console.log("🤖 Bot fallback to random high WR")
                    const available = initialHeroes.filter(h =>
                        !bannedIds.includes(h.id) &&
                        !pickedIds.includes(h.id)
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
