import { useState, useEffect, useCallback } from 'react'
import { DRAFT_SEQUENCE, PHASE_TIMERS, DraftStep } from '../constants'
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

export function useDraftEngine() {
    const [state, setState] = useState<DraftState>({
        stepIndex: 0,
        bluePicks: {},
        redPicks: {},
        blueBans: [],
        redBans: [],
        timer: PHASE_TIMERS.BAN,
        isPaused: true, // Start paused
        isFinished: false,
        history: []
    })

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
