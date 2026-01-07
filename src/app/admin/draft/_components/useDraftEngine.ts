import { useState, useEffect, useCallback } from 'react'
import { DRAFT_SEQUENCE, PHASE_TIMERS, DraftStep } from './constants'
import { DraftSide } from '@/utils/types'

export interface DraftState {
    stepIndex: number;
    bluePicks: Record<number, string>; // slotIndex -> heroId
    redPicks: Record<number, string>;
    blueBans: string[];
    redBans: string[];
    timer: number;
    isPaused: boolean;
    isFinished: boolean;
    history: any[]; // Undo stack
}

interface UseDraftEngineProps {
    initialPicks?: any[]; // From DB
}

export function useDraftEngine({ initialPicks = [] }: UseDraftEngineProps = {}) {
    const initializeState = (): DraftState => {
        // Default State
        const defaults: DraftState = {
            stepIndex: 0,
            bluePicks: {},
            redPicks: {},
            blueBans: [],
            redBans: [],
            timer: PHASE_TIMERS.BAN,
            isPaused: true,
            isFinished: false,
            history: []
        }

        if (!initialPicks || initialPicks.length === 0) return defaults

        // Rehydrate State
        const newState = { ...defaults }

        initialPicks.forEach(p => {
            if (p.type === 'BAN') {
                if (p.side === 'BLUE') newState.blueBans.push(p.hero_id)
                else newState.redBans.push(p.hero_id)
            } else if (p.type === 'PICK') {
                // position_index is 1-based usually, but let's check how we stored it.
                // In generic logic, we used Object.keys length.
                // We should map strictly if possible, or just push.
                // Our generic engine uses 0-4 index.
                const idx = p.position_index - 1
                if (p.side === 'BLUE') newState.bluePicks[idx] = p.hero_id
                else newState.redPicks[idx] = p.hero_id
            }
        })

        // Determine step index based on fills
        // Simple way: count total actions
        const totalActions = initialPicks.length
        newState.stepIndex = totalActions

        // If all done (approx 18 steps usually), set finished
        if (totalActions >= DRAFT_SEQUENCE.length) {
            newState.isFinished = true
            newState.timer = 0
            newState.isPaused = true
        } else {
            // If mid-game rehydration (refresh), stay paused
            newState.isFinished = false
            newState.timer = DRAFT_SEQUENCE[totalActions]?.type === 'BAN' ? PHASE_TIMERS.BAN : PHASE_TIMERS.PICK
        }

        return newState
    }

    const [state, setState] = useState<DraftState>(initializeState)

    // ... rest of logic ...

    const currentStep: DraftStep | undefined = DRAFT_SEQUENCE[state.stepIndex]

    // Timer Tick
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!state.isPaused && !state.isFinished && currentStep) {
            interval = setInterval(() => {
                setState(prev => {
                    if (prev.timer <= 0) return prev; // Should auto-lock or something? For now just stop at 0
                    return { ...prev, timer: prev.timer - 1 }
                })
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [state.isPaused, state.isFinished, currentStep])

    const lockIn = (heroId: string) => {
        if (!currentStep || state.isFinished) return

        setState(prev => {
            const newState = { ...prev, history: [...prev.history, prev] }

            // Record Selection
            if (currentStep.type === 'BAN') {
                if (currentStep.side === 'BLUE') newState.blueBans = [...prev.blueBans, heroId]
                else newState.redBans = [...prev.redBans, heroId]
            } else {
                // Determine slot index for picks. 
                // We need to count how many picks this side has made so far to assign to next slot
                const currentSidePicks = currentStep.side === 'BLUE' ? prev.bluePicks : prev.redPicks
                const nextSlot = Object.keys(currentSidePicks).length

                if (currentStep.side === 'BLUE') newState.bluePicks = { ...prev.bluePicks, [nextSlot]: heroId }
                else newState.redPicks = { ...prev.redPicks, [nextSlot]: heroId }
            }

            // Advance Step
            const nextIndex = prev.stepIndex + 1
            if (nextIndex >= DRAFT_SEQUENCE.length) {
                newState.isFinished = true
                newState.timer = 0
            } else {
                newState.stepIndex = nextIndex
                const nextStep = DRAFT_SEQUENCE[nextIndex]
                newState.timer = nextStep.type === 'BAN' ? PHASE_TIMERS.BAN : PHASE_TIMERS.PICK
            }

            return newState
        })
    }

    const togglePause = () => setState(prev => ({ ...prev, isPaused: !prev.isPaused }))

    return {
        state,
        currentStep,
        lockIn,
        togglePause
    }
}
