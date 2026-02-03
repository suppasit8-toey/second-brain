'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Hero } from '@/utils/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
    Play, Pause, RotateCcw, Brain, ChevronUp, ChevronDown,
    Bot, Zap, Download, Clock, User, Shield, Swords
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRecommendations } from '../recommendations'
import { DRAFT_SEQUENCE, PHASE_TIMERS, DraftStep } from './constants'

interface DraftPracticeProps {
    heroes: Hero[]
    heroMap: Map<string, Hero>
    myTeamName: string
    enemyTeamName: string
    myTeamStats?: any[]
    blueTeamName: string
    redTeamName: string
    globalBanIds?: Set<string>
    combos?: any[]
    matchups?: any[]
    versionId?: number
    onExportStrategy?: (picks: DraftPick[], side: 'BLUE' | 'RED') => void
}

interface DraftPick {
    step: number
    side: 'BLUE' | 'RED'
    type: 'BAN' | 'PICK'
    heroId: string
}

interface DraftState {
    stepIndex: number
    bluePicks: Record<number, string>
    redPicks: Record<number, string>
    blueBans: string[]
    redBans: string[]
    timer: number
    isPaused: boolean
    isFinished: boolean
}

export default function DraftPractice({
    heroes,
    heroMap,
    myTeamName,
    enemyTeamName,
    myTeamStats = [],
    blueTeamName,
    redTeamName,
    globalBanIds = new Set(),
    combos = [],
    matchups = [],
    versionId,
    onExportStrategy
}: DraftPracticeProps) {
    // State
    const [state, setState] = useState<DraftState>({
        stepIndex: 0,
        bluePicks: {},
        redPicks: {},
        blueBans: [],
        redBans: [],
        timer: PHASE_TIMERS.BAN,
        isPaused: true,
        isFinished: false
    })

    const [selectedHero, setSelectedHero] = useState<Hero | null>(null)
    const [mySide, setMySide] = useState<'BLUE' | 'RED'>('BLUE')
    const [aiAutoPlay, setAiAutoPlay] = useState(true)
    const [recommendations, setRecommendations] = useState<any>({ smartBan: [], hybrid: [] })
    const [isAiOpen, setIsAiOpen] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRole, setSelectedRole] = useState<string | null>(null)

    const currentStep = DRAFT_SEQUENCE[state.stepIndex] as DraftStep | undefined
    const isMyTurn = currentStep?.side === mySide
    const enemySide = mySide === 'BLUE' ? 'RED' : 'BLUE'

    // Derived data
    const bannedIds = useMemo(() => [...state.blueBans, ...state.redBans], [state.blueBans, state.redBans])
    const pickedIds = useMemo(() => [...Object.values(state.bluePicks), ...Object.values(state.redPicks)], [state.bluePicks, state.redPicks])
    const unavailableIds = useMemo(() => [...bannedIds, ...pickedIds, ...Array.from(globalBanIds)], [bannedIds, pickedIds, globalBanIds])

    // Roles for filtering
    const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

    // Filtered heroes
    const filteredHeroes = useMemo(() => {
        return heroes.filter(hero => {
            if (searchQuery && !hero.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
            if (selectedRole && !hero.main_position?.includes(selectedRole)) return false
            return true
        })
    }, [heroes, searchQuery, selectedRole])

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (!state.isPaused && !state.isFinished && currentStep) {
            interval = setInterval(() => {
                setState(prev => {
                    if (prev.timer <= 0) return prev
                    return { ...prev, timer: prev.timer - 1 }
                })
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [state.isPaused, state.isFinished, currentStep])

    // Fetch recommendations
    useEffect(() => {
        if (!currentStep || state.isFinished || !versionId) return

        const allyPicks = mySide === 'BLUE' ? Object.values(state.bluePicks) : Object.values(state.redPicks)
        const enemyPicks = mySide === 'BLUE' ? Object.values(state.redPicks) : Object.values(state.bluePicks)

        getRecommendations(versionId, allyPicks, enemyPicks, bannedIds)
            .then(setRecommendations)
    }, [state.stepIndex, mySide, versionId])

    // AI Auto-play for enemy side
    useEffect(() => {
        if (!aiAutoPlay || state.isPaused || state.isFinished) return
        if (isMyTurn) return // My turn, don't auto-play

        const timeout = setTimeout(() => {
            autoPlayEnemy()
        }, 1500) // Delay for realistic feel

        return () => clearTimeout(timeout)
    }, [state.stepIndex, aiAutoPlay, state.isPaused, isMyTurn])

    const autoPlayEnemy = useCallback(() => {
        if (!currentStep || isMyTurn) return

        // Get available heroes (not banned/picked)
        const available = heroes.filter(h => !unavailableIds.includes(h.id))
        if (available.length === 0) return

        // Pick based on recommendations for enemy side (simulate reasonable picks)
        // For simplicity, pick from top recommended or random
        const randomIndex = Math.floor(Math.random() * Math.min(5, available.length))
        const selectedId = available[randomIndex].id

        lockIn(selectedId)
    }, [currentStep, isMyTurn, heroes, unavailableIds])

    const lockIn = useCallback((heroId: string) => {
        if (!currentStep || state.isFinished) return

        setState(prev => {
            const newState = { ...prev }

            if (currentStep.type === 'BAN') {
                if (currentStep.side === 'BLUE') {
                    newState.blueBans = [...prev.blueBans, heroId]
                } else {
                    newState.redBans = [...prev.redBans, heroId]
                }
            } else {
                const currentSidePicks = currentStep.side === 'BLUE' ? prev.bluePicks : prev.redPicks
                const nextSlot = Object.keys(currentSidePicks).length

                if (currentStep.side === 'BLUE') {
                    newState.bluePicks = { ...prev.bluePicks, [nextSlot]: heroId }
                } else {
                    newState.redPicks = { ...prev.redPicks, [nextSlot]: heroId }
                }
            }

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

        setSelectedHero(null)
    }, [currentStep, state.isFinished])

    const handleHeroClick = (hero: Hero) => {
        if (unavailableIds.includes(hero.id)) return
        if (!isMyTurn && !state.isPaused) return // Can't select on enemy turn if running
        setSelectedHero(hero)
    }

    const handleLockIn = () => {
        if (!selectedHero || !isMyTurn) return
        lockIn(selectedHero.id)
    }

    const togglePause = () => {
        setState(prev => ({ ...prev, isPaused: !prev.isPaused }))
    }

    const resetDraft = () => {
        setState({
            stepIndex: 0,
            bluePicks: {},
            redPicks: {},
            blueBans: [],
            redBans: [],
            timer: PHASE_TIMERS.BAN,
            isPaused: true,
            isFinished: false
        })
        setSelectedHero(null)
    }

    const handleExport = () => {
        if (!onExportStrategy) return

        const picks: DraftPick[] = []
        state.blueBans.forEach((heroId, i) => picks.push({ step: i, side: 'BLUE', type: 'BAN', heroId }))
        state.redBans.forEach((heroId, i) => picks.push({ step: i, side: 'RED', type: 'BAN', heroId }))
        Object.entries(state.bluePicks).forEach(([slot, heroId]) =>
            picks.push({ step: parseInt(slot, 10), side: 'BLUE', type: 'PICK', heroId })
        )
        Object.entries(state.redPicks).forEach(([slot, heroId]) =>
            picks.push({ step: parseInt(slot, 10), side: 'RED', type: 'PICK', heroId })
        )

        onExportStrategy(picks, mySide)
    }

    const getHero = (id: string) => heroMap.get(id) || heroes.find(h => h.id === id)

    // Format timer
    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Controls Header */}
            <div className="flex items-center justify-between bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center gap-4">
                    {/* Side Selector */}
                    <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <button
                            onClick={() => setMySide('BLUE')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                mySide === 'BLUE'
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <Shield className="w-3 h-3 inline mr-1" />
                            Blue Side
                        </button>
                        <button
                            onClick={() => setMySide('RED')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                mySide === 'RED'
                                    ? "bg-rose-600 text-white"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <Swords className="w-3 h-3 inline mr-1" />
                            Red Side
                        </button>
                    </div>

                    {/* AI Auto-play Toggle */}
                    <div className="flex items-center gap-2">
                        <Switch
                            id="ai-auto"
                            checked={aiAutoPlay}
                            onChange={(e) => setAiAutoPlay(e.target.checked)}
                        />
                        <Label htmlFor="ai-auto" className="text-xs text-slate-400 flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5" />
                            AI Auto-draft Enemy
                        </Label>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={togglePause}
                        className={cn(
                            "text-xs",
                            state.isPaused ? "text-green-400 hover:text-green-300" : "text-yellow-400 hover:text-yellow-300"
                        )}
                    >
                        {state.isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                        {state.isPaused ? 'Start' : 'Pause'}
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetDraft}
                        className="text-xs text-slate-400 hover:text-red-400"
                    >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                    </Button>

                    {state.isFinished && onExportStrategy && (
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleExport}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500"
                        >
                            <Download className="w-4 h-4 mr-1" />
                            Export Strategy
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Draft Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Left: Blue Team */}
                <div className="w-48 flex flex-col gap-2 shrink-0">
                    <div className={cn(
                        "p-3 rounded-lg text-center border",
                        mySide === 'BLUE' ? "bg-blue-900/30 border-blue-500/50" : "bg-blue-900/10 border-blue-500/20"
                    )}>
                        <h3 className="text-sm font-bold text-blue-400 flex items-center justify-center gap-1">
                            {mySide === 'BLUE' && <User className="w-3.5 h-3.5" />}
                            {blueTeamName}
                        </h3>
                    </div>

                    {/* Blue Bans */}
                    <div className="flex gap-1 justify-center">
                        {[0, 1, 2, 3].map(i => {
                            const heroId = state.blueBans[i]
                            const hero = heroId ? getHero(heroId) : null
                            return (
                                <div key={i} className="w-8 h-8 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                                    {hero ? (
                                        <img src={hero.icon_url} alt="" className="w-full h-full object-cover grayscale opacity-60" />
                                    ) : (
                                        <span className="text-[8px] text-slate-600">B{i + 1}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Blue Picks */}
                    <div className="flex-1 space-y-1">
                        {[0, 1, 2, 3, 4].map(i => {
                            const heroId = state.bluePicks[i]
                            const hero = heroId ? getHero(heroId) : null
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-12 border rounded-lg flex items-center px-2 relative overflow-hidden",
                                        hero ? "border-blue-500/30 bg-blue-900/20" : "border-slate-700 bg-slate-800/50"
                                    )}
                                >
                                    {hero ? (
                                        <>
                                            <img src={hero.icon_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                                            <div className="relative z-10 flex items-center gap-2">
                                                <img src={hero.icon_url} alt="" className="w-8 h-8 rounded border border-blue-400" />
                                                <span className="text-xs font-bold truncate">{hero.name}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-slate-600">Pick {i + 1}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Center: Board */}
                <div className="flex-1 flex flex-col min-w-0 gap-2">
                    {/* Phase Indicator & Timer */}
                    <div className={cn(
                        "h-16 rounded-xl flex items-center justify-center gap-6 border relative overflow-hidden",
                        currentStep?.side === 'BLUE' ? "bg-blue-900/20 border-blue-500/30" : "bg-rose-900/20 border-rose-500/30"
                    )}>
                        {state.isFinished ? (
                            <h2 className="text-xl font-black text-green-400">DRAFT COMPLETE</h2>
                        ) : (
                            <>
                                <div className="flex flex-col items-center">
                                    <span className={cn(
                                        "text-xs font-bold tracking-wider uppercase",
                                        currentStep?.side === 'BLUE' ? "text-blue-400" : "text-rose-400"
                                    )}>
                                        {currentStep?.label}
                                    </span>
                                    <Badge variant="outline" className={cn(
                                        "text-[10px] mt-1",
                                        isMyTurn ? "border-green-500 text-green-400" : "border-slate-600 text-slate-400"
                                    )}>
                                        {isMyTurn ? 'YOUR TURN' : 'ENEMY TURN'}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    <span className="text-2xl font-mono font-bold">{formatTimer(state.timer)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedRole(null)}
                            className={cn(
                                "px-2 py-1 rounded text-xs font-bold transition-all border",
                                !selectedRole ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-indigo-500"
                            )}
                        >
                            ALL
                        </button>
                        {roles.map(role => (
                            <button
                                key={role}
                                onClick={() => setSelectedRole(role === selectedRole ? null : role)}
                                className={cn(
                                    "px-2 py-1 rounded text-xs font-bold transition-all border",
                                    selectedRole === role ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-indigo-500"
                                )}
                            >
                                {role}
                            </button>
                        ))}
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="ml-auto px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 w-32 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    {/* Hero Grid */}
                    <ScrollArea className="flex-1 border border-slate-800 rounded-xl bg-slate-900/30 p-2">
                        <div className="grid grid-cols-8 gap-1.5">
                            {filteredHeroes.map(hero => {
                                const isUnavailable = unavailableIds.includes(hero.id)
                                const isSelected = selectedHero?.id === hero.id

                                return (
                                    <button
                                        key={hero.id}
                                        disabled={isUnavailable}
                                        onClick={() => handleHeroClick(hero)}
                                        className={cn(
                                            "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                            isUnavailable ? "grayscale opacity-30 border-slate-800 cursor-not-allowed" : "hover:scale-105 cursor-pointer",
                                            isSelected ? "border-yellow-400 ring-2 ring-yellow-400/50 scale-105 z-10" : "border-transparent"
                                        )}
                                    >
                                        <img src={hero.icon_url} alt={hero.name} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/70 p-0.5 text-[8px] text-center truncate">
                                            {hero.name}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </ScrollArea>

                    {/* Action Bar */}
                    <div className="flex justify-center">
                        <Button
                            size="lg"
                            disabled={!isMyTurn || state.isPaused || !selectedHero}
                            onClick={handleLockIn}
                            className={cn(
                                "w-48 font-bold",
                                isMyTurn && !state.isPaused && selectedHero ? "animate-pulse bg-indigo-600 hover:bg-indigo-500" : "opacity-50"
                            )}
                        >
                            {!isMyTurn ? 'Wait for Enemy' : state.isPaused ? 'Draft Paused' : selectedHero ? 'LOCK IN' : 'Select Hero'}
                        </Button>
                    </div>
                </div>

                {/* Right: Red Team */}
                <div className="w-48 flex flex-col gap-2 shrink-0">
                    <div className={cn(
                        "p-3 rounded-lg text-center border",
                        mySide === 'RED' ? "bg-rose-900/30 border-rose-500/50" : "bg-rose-900/10 border-rose-500/20"
                    )}>
                        <h3 className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1">
                            {mySide === 'RED' && <User className="w-3.5 h-3.5" />}
                            {redTeamName}
                        </h3>
                    </div>

                    {/* Red Bans */}
                    <div className="flex gap-1 justify-center">
                        {[0, 1, 2, 3].map(i => {
                            const heroId = state.redBans[i]
                            const hero = heroId ? getHero(heroId) : null
                            return (
                                <div key={i} className="w-8 h-8 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                                    {hero ? (
                                        <img src={hero.icon_url} alt="" className="w-full h-full object-cover grayscale opacity-60" />
                                    ) : (
                                        <span className="text-[8px] text-slate-600">B{i + 1}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Red Picks */}
                    <div className="flex-1 space-y-1">
                        {[0, 1, 2, 3, 4].map(i => {
                            const heroId = state.redPicks[i]
                            const hero = heroId ? getHero(heroId) : null
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-12 border rounded-lg flex items-center justify-end px-2 relative overflow-hidden text-right",
                                        hero ? "border-rose-500/30 bg-rose-900/20" : "border-slate-700 bg-slate-800/50"
                                    )}
                                >
                                    {hero ? (
                                        <>
                                            <img src={hero.icon_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                                            <div className="relative z-10 flex items-center gap-2 flex-row-reverse">
                                                <img src={hero.icon_url} alt="" className="w-8 h-8 rounded border border-rose-400" />
                                                <span className="text-xs font-bold truncate">{hero.name}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-slate-600">Pick {i + 1}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* AI Advisor Panel */}
            <div className={cn(
                "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col transition-all duration-300",
                isAiOpen ? "h-40" : "h-10"
            )}>
                <div
                    className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/80"
                    onClick={() => setIsAiOpen(!isAiOpen)}
                >
                    <div className="flex items-center gap-2">
                        <Brain className={cn("w-4 h-4 text-indigo-400", isAiOpen && "animate-pulse")} />
                        <span className="text-xs font-bold text-indigo-100">CEREBRO AI</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-slate-900 border-slate-700">
                            {currentStep?.type === 'BAN' ? 'BAN MODE' : 'PICK MODE'}
                        </Badge>
                    </div>
                    {isAiOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                </div>

                <div className="flex-1 p-2 overflow-y-auto">
                    {(() => {
                        const activeRecs = currentStep?.type === 'BAN' ? recommendations.smartBan : recommendations.hybrid

                        if (!activeRecs || activeRecs.length === 0) {
                            return (
                                <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500/30" />
                                    <span className="text-xs">Analyzing...</span>
                                </div>
                            )
                        }

                        return (
                            <div className="grid grid-cols-4 gap-2">
                                {activeRecs.slice(0, 8).map((rec: any) => (
                                    <div
                                        key={rec.hero.id}
                                        onClick={() => handleHeroClick(rec.hero)}
                                        className="bg-slate-800 p-2 rounded-lg flex items-center gap-2 hover:bg-slate-700 cursor-pointer transition-colors border border-slate-700 hover:border-indigo-500/50"
                                    >
                                        <img src={rec.hero.icon_url} alt="" className="w-8 h-8 rounded border border-slate-600" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold truncate">{rec.hero.name}</span>
                                                <Badge variant="secondary" className={cn(
                                                    "text-[8px] h-3.5 px-1",
                                                    rec.score > 30 ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-300"
                                                )}>
                                                    {rec.score.toFixed(0)}
                                                </Badge>
                                            </div>
                                            <p className="text-[8px] text-slate-400 truncate">{rec.reason}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    })()}
                </div>
            </div>
        </div>
    )
}
