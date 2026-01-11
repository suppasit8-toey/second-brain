'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { useDraftEngine } from './useDraftEngine'
import { getRecommendations } from '../recommendations'
import { getHeroesByVersion } from '../../heroes/actions'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Pause, Play, Check, ShieldBan, Brain, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import PostDraftResult from '@/components/draft/PostDraftResult'
import { Input } from '@/components/ui/input'

export interface DraftControls {
    togglePause: () => void;
    isPaused: boolean;
}

interface DraftInterfaceProps {
    match: DraftMatch;
    game: DraftGame;
    initialHeroes: Hero[];
    teamAGlobalBans?: string[];
    teamBGlobalBans?: string[];
    onReset?: () => void;
    onPausedChange?: (isPaused: boolean) => void;
}

const DraftInterface = forwardRef<DraftControls, DraftInterfaceProps>(({ match, game, initialHeroes, teamAGlobalBans = [], teamBGlobalBans = [], onReset, onPausedChange }, ref) => {
    const { state, currentStep, lockIn, togglePause } = useDraftEngine()

    useImperativeHandle(ref, () => ({
        togglePause,
        isPaused: state.isPaused
    }), [togglePause, state.isPaused])

    useEffect(() => {
        if (onPausedChange) {
            onPausedChange(state.isPaused)
        }
    }, [state.isPaused, onPausedChange])

    const [selectedHero, setSelectedHero] = useState<Hero | null>(null)
    const [recommendations, setRecommendations] = useState<any>({ analyst: [], history: [], hybrid: [], smartBan: [] })
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
    const [showSummary, setShowSummary] = useState(false)
    const [manualLanes, setManualLanes] = useState<Record<string, string[]>>({})
    const [currentTab, setCurrentTab] = useState("hero")

    const handleLaneAssign = (heroId: string, lane: string) => {
        setManualLanes(prev => {
            const current = prev[heroId] || []
            if (current.includes(lane)) {
                return { ...prev, [heroId]: current.filter(l => l !== lane) }
            } else {
                return { ...prev, [heroId]: [...current, lane] }
            }
        })
    }

    // Auto-fill defaults from Roster (Multi-role support)
    useEffect(() => {
        const allPicks = [...Object.values(state.bluePicks), ...Object.values(state.redPicks)].filter(Boolean) as string[]

        setManualLanes(prev => {
            const next = { ...prev }
            let hasChanges = false

            allPicks.forEach(id => {
                if (!next[id]) {
                    const hero = getHero(id)
                    // If hero has main_position stats, use them. Otherwise default empty or 'Mid' etc.
                    // Assuming hero.main_position is string[] from DB/Types
                    if (hero && hero.main_position && hero.main_position.length > 0) {
                        next[id] = hero.main_position
                        hasChanges = true
                    }
                }
            })

            return hasChanges ? next : prev
        })
    }, [state.bluePicks, state.redPicks, initialHeroes])

    // UI Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRole, setSelectedRole] = useState('All')

    // 1. Calculate Played Heroes for each Team (Global Bans)
    // Find every hero picked by Team A and Team B in previous games of this match
    const previousGames = match.games?.filter(g => g.winner) || [] // Only count completed games

    const playedHeroesTeamA = new Set<string>()
    const playedHeroesTeamB = new Set<string>()

    previousGames.forEach(prevGame => {
        const pGame = match.games?.find(g => g.id === prevGame.id)
        if (!pGame?.picks) return

        // We need to know which side Team A was on in that specific game
        // In our current system, game.blue_team_name / red_team_name stores the names
        const sideOfA = pGame.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'

        pGame.picks.forEach(p => {
            if (p.type === 'PICK') {
                if (p.side === sideOfA) playedHeroesTeamA.add(p.hero_id)
                else playedHeroesTeamB.add(p.hero_id)
            }
        })
    })

    // 2. Map current side (BLUE/RED) to Team A/B
    const currentSide = currentStep?.side
    const blueTeamIsMatchA = game.blue_team_name === match.team_a_name

    // If it's BLUE's turn, who is BLUE?
    const teamOnCurrentSide = currentSide === 'BLUE'
        ? (blueTeamIsMatchA ? 'A' : 'B')
        : (blueTeamIsMatchA ? 'B' : 'A')

    const currentTeamPlayed = Array.from(teamOnCurrentSide === 'A' ? playedHeroesTeamA : playedHeroesTeamB)
    const opponentTeamPlayed = Array.from(teamOnCurrentSide === 'A' ? playedHeroesTeamB : playedHeroesTeamA)

    // SUGGESTED (Green) = My team's global bans (I can't pick them, enemy can, so I should ban them)
    // ENEMY USED (Unobtrusive) = Enemy's global bans (They can't pick them, so I don't need to ban them)
    // Actually the user said: "ตัวที่แนะนำให้แบนจะเป็นตัวที่ สีเเดงเล่นไปแล้ว และ ตัวที่Enemy USED จะเป็นตัวที่ฝั่ง Blue Side เล่นไปแล้ว" (Wait, translating...)
    // "When RED SIDE BAN, suggested bans are heroes RED played, and ENEMY USED are heroes BLUE played."
    // Yes, essentially: Suggested = Current Turn Side's Played Heroes. Opponent = Other Side's Played Heroes.

    const currentGlobalBans = currentTeamPlayed
    const opponentGlobalBans = opponentTeamPlayed

    // Derived Lists for filtering
    const bannedIds = [...state.blueBans, ...state.redBans]
    const pickedIds = [...Object.values(state.bluePicks), ...Object.values(state.redPicks)]

    const isBanPhase = currentStep?.type.includes('BAN')
    const unavailableIds = isBanPhase
        ? [...bannedIds, ...pickedIds, ...opponentGlobalBans] // Can ban global bans, but NOT opponent's global bans (waste)
        : [...bannedIds, ...pickedIds, ...currentGlobalBans] // Cannot pick global bans

    // Fetch Recommendations when step changes
    useEffect(() => {
        if (!currentStep || state.isFinished) return;

        const allyPicks = currentStep.side === 'BLUE' ? Object.values(state.bluePicks) : Object.values(state.redPicks)
        const enemyPicks = currentStep.side === 'BLUE' ? Object.values(state.redPicks) : Object.values(state.bluePicks)

        const currentPhase = (currentStep?.type === 'BAN' ? 'BAN' : 'PICK') as 'BAN' | 'PICK'
        const context = {
            matchId: match.id,
            phase: currentPhase,
            side: currentStep?.side
        }

        setIsLoadingRecommendations(true)
        getRecommendations(match.version_id, allyPicks, enemyPicks, bannedIds, [], context)
            .then(data => {
                setRecommendations(data)
                setIsLoadingRecommendations(false)
            })
            .catch(err => {
                console.error("Cerebro failed:", err)
                setRecommendations({ analyst: [], history: [], hybrid: [], smartBan: [] })
                setIsLoadingRecommendations(false)
            })

    }, [state.stepIndex])

    const handleHeroClick = (hero: Hero) => {
        if (unavailableIds.includes(hero.id)) return
        setSelectedHero(hero)
    }

    const handleLockIn = () => {
        if (selectedHero) {
            lockIn(selectedHero.id)
            setSelectedHero(null)
        }
    }

    // Helper to get hero object
    const getHero = (id: string) => initialHeroes.find(h => h.id === id)

    // Filtering Logic
    const filteredHeroes = initialHeroes.filter(hero => {
        const matchesSearch = hero.name.toLowerCase().includes(searchQuery.toLowerCase())

        // Exact match for the new specific roles which match DB values
        // hero.main_position is string[]
        const matchesRole = selectedRole === 'All' || hero.main_position.includes(selectedRole)

        // Hide Picked Heroes entirely ("Cut out the ones opponent picked")
        // But keep Banned/Global Restricted visible (as disabled/grayscale)
        const isPicked = pickedIds.includes(hero.id)

        // Show everything during BAN phase (disabled/badged) so user sees context
        // During PICK phase, hide Picked heroes to clean up the list
        const isOpponentGlobalBan = opponentGlobalBans.includes(hero.id)
        const shouldHide = !isBanPhase && (isPicked || isOpponentGlobalBan)

        return matchesSearch && matchesRole && !shouldHide
    })

    // Helper: Predict Lanes
    const predictLanes = (picks: Record<number, string>) => {
        const pickValues = Object.values(picks)
        const heroes = pickValues.map(id => getHero(id)).filter(Boolean) as Hero[]

        const predicted: Record<string, string> = {}
        const lanes = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
        const availableHeroes = [...heroes]

        // Optimizations with main_position

        // Jungle
        const junglers = availableHeroes.filter(h => h.main_position.includes('Jungle') || h.main_position.includes('Assassin'))
        if (junglers.length > 0) {
            predicted['Jungle'] = junglers[0].id
            availableHeroes.splice(availableHeroes.indexOf(junglers[0]), 1)
        }

        // Abyssal
        const adcs = availableHeroes.filter(h => h.main_position.includes('Abyssal') || h.main_position.includes('Marksman'))
        if (adcs.length > 0) {
            predicted['Abyssal'] = adcs[0].id
            availableHeroes.splice(availableHeroes.indexOf(adcs[0]), 1)
        }

        // Mid
        const mages = availableHeroes.filter(h => h.main_position.includes('Mid') || h.main_position.includes('Mage'))
        if (mages.length > 0) {
            predicted['Mid'] = mages[0].id
            availableHeroes.splice(availableHeroes.indexOf(mages[0]), 1)
        }

        // Roam
        const supports = availableHeroes.filter(h => h.main_position.includes('Roam') || h.main_position.includes('Support') || h.main_position.includes('Tank'))
        if (supports.length > 0) {
            predicted['Roam'] = supports[0].id
            availableHeroes.splice(availableHeroes.indexOf(supports[0]), 1)
        }

        // Dark Slayer (Warrior/Tank)
        const ds = availableHeroes.filter(h => h.main_position.includes('Dark Slayer') || h.main_position.includes('Warrior') || h.main_position.includes('Tank'))
        if (ds.length > 0) {
            predicted['Dark Slayer'] = ds[0].id
            availableHeroes.splice(availableHeroes.indexOf(ds[0]), 1)
        }

        // Fill remaining
        lanes.forEach(lane => {
            if (!predicted[lane] && availableHeroes.length > 0) {
                predicted[lane] = availableHeroes[0].id
                availableHeroes.shift()
            }
        })

        return predicted
    }

    // Check if game is already finished (from DB)
    const isGameFinished = !!game.winner

    if (isGameFinished && game.picks) {
        const manualLanes: Record<string, string> = {}
        const bluePicks: Record<number, string> = {}
        const redPicks: Record<number, string> = {}
        const blueBans: string[] = []
        const redBans: string[] = []

        game.picks.forEach(p => {
            if (p.type === 'PICK') {
                const idx = p.position_index - 1
                if (p.side === 'BLUE') bluePicks[idx] = p.hero_id
                else redPicks[idx] = p.hero_id

                if (p.assigned_role) {
                    manualLanes[p.hero_id] = p.assigned_role
                }
            } else {
                if (p.side === 'BLUE') blueBans.push(p.hero_id)
                else redBans.push(p.hero_id)
            }
        })

        const initialData = {
            winner: game.winner,
            blueKeyPlayer: game.blue_key_player_id,
            redKeyPlayer: game.red_key_player_id,
            winPrediction: game.analysis_data?.winPrediction?.blue,
            notes: game.analysis_data?.notes
        }

        const nextGameNum = game.game_number + 1
        const nextExistingGame = match.games?.find(g => g.game_number === nextGameNum)
        const nextGameTab = nextExistingGame ? nextExistingGame.id : `new-${nextGameNum}`

        const currentBlueWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_a_name) || (g.winner === 'Red' && g.red_team_name === match.team_a_name)).length || 0
        const currentRedWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_b_name) || (g.winner === 'Red' && g.red_team_name === match.team_b_name)).length || 0

        // IMPORTANT: The above counts Team A vs Team B wins, but PostDraftResult needs "Blue" vs "Red" context relative to the SERIES? 
        // No, PostDraftResult seriesScore should probably be Team A vs Team B.
        // Or better: Let's pass the raw numbers.
        // Wait, the logic in PostDraftResult assumes seriesScore.blue and seriesScore.red. 
        // But "Blue" in PostDraftResult refers to `blueTeamName`. 
        // If `blueTeamName` is Team A, we should pass Team A's score as blue. 
        // If `blueTeamName` is Team B, we should pass Team B's score as blue.

        const isBlueTeamA = game.blue_team_name === match.team_a_name
        const blueScore = isBlueTeamA ? currentBlueWins : currentRedWins
        const redScore = isBlueTeamA ? currentRedWins : currentBlueWins

        return (
            <PostDraftResult
                gameId={game.id}
                blueTeamName={game.blue_team_name}
                redTeamName={game.red_team_name}
                bluePicks={bluePicks}
                redPicks={redPicks}
                blueBans={blueBans}
                redBans={redBans}
                heroes={initialHeroes}
                matchId={match.id}
                manualLanes={manualLanes}
                initialData={initialData}
                nextGameId={nextGameTab}
                matchMode={match.mode || 'BO1'}
                seriesScore={{ blue: blueScore, red: redScore }}
            />
        )
    }

    // Render POST-DRAFT Screen if finished AND user clicked the button
    if (state.isFinished && showSummary) {
        const nextGameNum = game.game_number + 1
        const nextExistingGame = match.games?.find(g => g.game_number === nextGameNum)
        const nextGameTab = nextExistingGame ? nextExistingGame.id : `new-${nextGameNum}`

        const currentBlueWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_a_name) || (g.winner === 'Red' && g.red_team_name === match.team_a_name)).length || 0
        const currentRedWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_b_name) || (g.winner === 'Red' && g.red_team_name === match.team_b_name)).length || 0

        const isBlueTeamA = game.blue_team_name === match.team_a_name
        const blueScore = isBlueTeamA ? currentBlueWins : currentRedWins
        const redScore = isBlueTeamA ? currentRedWins : currentBlueWins

        // Convert multi-lanes to single lane for PostDraftResult (Game Record uses 1 position)
        // Taking the first selected lane as primary
        const primaryLanes: Record<string, string> = {}
        Object.entries(manualLanes).forEach(([k, v]) => {
            if (v && v.length > 0) primaryLanes[k] = v[0]
        })

        return (
            <PostDraftResult
                gameId={game.id}
                blueTeamName={game.blue_team_name}
                redTeamName={game.red_team_name}
                bluePicks={state.bluePicks}
                redPicks={state.redPicks}
                blueBans={state.blueBans}
                redBans={state.redBans}
                heroes={initialHeroes}
                matchId={match.id}
                manualLanes={primaryLanes}
                nextGameId={nextGameTab}
                seriesScore={{ blue: blueScore, red: redScore }}
                matchMode={match.mode || 'BO1'}
            />
        )
    }

    return (
        <div className="flex flex-col lg:flex-row h-full gap-2 p-2 text-white overflow-y-auto custom-scrollbar">
            {/* LEFT: BLUE TEAM (Mobile: Order 2) */}
            <div className="w-full lg:w-[22%] flex flex-col gap-1 order-2 lg:order-none">
                <div className="p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
                    <h3 className="text-lg font-bold text-blue-400 truncate">{game.blue_team_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-2 justify-center">
                    {[0, 2, 11, 13].map((stepIdx, i) => (
                        <div key={i} className="w-10 h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.blueBans[i] ? (
                                <Image src={getHero(state.blueBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex-1 space-y-2 min-h-[300px] lg:min-h-0">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.bluePicks[i]
                        const hero = getHero(heroId || '')

                        // Lanes
                        const lanes = [
                            { id: 'Dark Slayer', label: 'DS' },
                            { id: 'Jungle', label: 'JG' },
                            { id: 'Mid', label: 'MID' },
                            { id: 'Abyssal', label: 'AB' },
                            { id: 'Roam', label: 'SP' },
                        ]

                        return (
                            <div key={i} className="relative flex flex-col bg-blue-900/10 border border-blue-500/20 rounded-lg overflow-hidden shrink-0">
                                {/* Hero Row */}
                                <div className="h-12 lg:h-14 flex items-center px-3 relative overflow-hidden shrink-0">
                                    {hero ? (
                                        <>
                                            <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20" />
                                            <div className="relative z-10 flex items-center gap-3">
                                                <Image src={hero.icon_url} alt={hero.name} width={40} height={40} className="rounded-full border-2 border-blue-400" />
                                                <span className="font-bold text-base">{hero.name}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-slate-600 relative z-10 text-sm">Pick {i + 1}</span>
                                    )}
                                </div>

                                {/* Manual Lane Selector (Only if hero picked) */}
                                {/* Manual Lane Selector (Always rendered for height consistency) */}
                                <div className={`flex bg-slate-900/50 border-t divide-x divide-slate-800 transition-opacity ${hero ? 'opacity-100 border-blue-500/20' : 'opacity-0 border-transparent pointer-events-none'}`}>
                                    {lanes.map(lane => {
                                        const isSelected = hero ? manualLanes[hero.id]?.includes(lane.id) : false
                                        return (
                                            <button
                                                key={lane.id}
                                                onClick={() => hero && handleLaneAssign(hero.id, lane.id)}
                                                className={`flex-1 h-6 text-[10px] font-bold uppercase transition-colors hover:bg-blue-500/20 ${isSelected ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                                            >
                                                {lane.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>


            </div>

            {/* CENTER: BOARD & CONTROLS (Mobile: Order 1 - Top) */}
            <div className="w-full lg:flex-1 flex flex-col gap-2 order-1 lg:order-none">
                {/* Header / Timer */}
                <div className="h-14 lg:h-16 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between px-4 lg:px-6 relative overflow-hidden shrink-0">
                    <div className="z-10 flex flex-col items-center w-full">
                        {state.isFinished ? (
                            <h2 className="text-2xl lg:text-3xl font-black text-green-400">DRAFT COMPLETE</h2>
                        ) : (
                            <>
                                <span className={`text-[10px] lg:text-xs font-bold tracking-wider ${currentStep?.side === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                                    {currentStep?.side} SIDE {currentStep?.type}
                                </span>
                                <div className="text-3xl lg:text-4xl font-mono font-bold mt-0.5">{state.timer}</div>

                            </>
                        )}
                    </div>
                    {currentGlobalBans.length > 0 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex">
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 flex items-center gap-1 bg-slate-950/80">
                                <ShieldBan className="w-3 h-3" />
                                Global Bans Active: {currentGlobalBans.length}
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Tabs for Hero Selection / Global Bans / Cerebro AI */}
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-900 h-10 p-1 mb-2">
                        <TabsTrigger value="hero" className="text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            HEROES
                        </TabsTrigger>
                        <TabsTrigger value="global-bans" className="text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white flex items-center gap-1">
                            <ShieldBan className="w-3 h-3" />
                            GLOBAL BANS
                        </TabsTrigger>
                        <TabsTrigger value="cerebro-ai" className="text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white flex items-center gap-1">
                            <Brain className="w-3 h-3 text-indigo-400" />
                            CEREBRO AI
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: HERO SELECTOR */}
                    <TabsContent value="hero" className="flex-1 flex flex-col min-h-0 gap-2 data-[state=active]:flex m-0">
                        {/* Filters */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2 flex flex-col gap-1 flex-1 overflow-hidden min-h-0">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        placeholder="Search heroes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-slate-950 border-slate-800 text-white h-8 text-sm"
                                    />
                                </div>
                                <div className="flex gap-1 flex-wrap justify-center">
                                    {['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(role => (
                                        <Button
                                            key={role}
                                            size="sm"
                                            variant={selectedRole === role ? 'default' : 'outline'}
                                            onClick={() => setSelectedRole(role)}
                                            className={`h-8 px-2 text-[10px] lg:text-xs ${selectedRole === role ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-transparent border-slate-700 hover:bg-slate-800 text-slate-400'}`}
                                        >
                                            {role}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <ScrollArea className="flex-1 bg-slate-950/30 rounded-lg p-2">
                                {filteredHeroes.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        No heroes found.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                                        {filteredHeroes.map(hero => {
                                            const isUnavailable = unavailableIds.includes(hero.id)
                                            const isSelected = selectedHero?.id === hero.id

                                            // Determine status for label
                                            let statusLabel = ''
                                            let statusColor = 'bg-red-600/80' // default

                                            if (pickedIds.includes(hero.id)) statusLabel = 'PICKED'
                                            else if (bannedIds.includes(hero.id)) statusLabel = 'BANNED'
                                            else if (currentGlobalBans.includes(hero.id) && !isBanPhase) statusLabel = 'GLOBAL'
                                            else if (opponentGlobalBans.includes(hero.id) && isBanPhase) {
                                                statusLabel = 'ENEMY USED'
                                                statusColor = 'bg-slate-600/90'
                                            }
                                            else if (currentGlobalBans.includes(hero.id) && isBanPhase) {
                                                // "Denial" suggestion - No Text Label, just Green Border
                                                statusLabel = ''
                                                statusColor = 'bg-green-600/90'
                                            }

                                            // Selection Logic with priority for Suggestions
                                            let borderColorClass = 'border-transparent'
                                            let ringClass = ''
                                            let scaleClass = ''
                                            let contentZ = 'z-0 hover:z-10'

                                            const isSuggested = currentGlobalBans.includes(hero.id) && isBanPhase

                                            if (isSelected) {
                                                scaleClass = 'scale-110'
                                                contentZ = 'z-20'
                                                if (isSuggested) {
                                                    borderColorClass = 'border-green-500'
                                                    ringClass = 'ring-4 ring-green-500/50'
                                                } else {
                                                    borderColorClass = 'border-yellow-400'
                                                    ringClass = 'ring-1 ring-yellow-400/50'
                                                }
                                            } else if (isSuggested && !isUnavailable) {
                                                // Suggested but not selected
                                                borderColorClass = 'border-green-500'
                                                ringClass = 'ring-2 ring-green-500/50'
                                                contentZ = 'z-10'
                                                scaleClass = 'scale-105'
                                            }

                                            const isEnemyUsed = statusLabel === 'ENEMY USED'

                                            return (
                                                <button
                                                    key={hero.id}
                                                    disabled={isUnavailable}
                                                    onClick={() => handleHeroClick(hero)}
                                                    className={`
                                                relative aspect-square rounded overflow-hidden border transition-all group
                                                ${isUnavailable
                                                            ? (isEnemyUsed ? 'opacity-90 cursor-not-allowed border-slate-700' : 'grayscale opacity-50 border-slate-800 cursor-not-allowed')
                                                            : `hover:scale-110 cursor-pointer ${contentZ}`
                                                        }
                                                ${borderColorClass} ${ringClass} ${scaleClass}
                                            `}
                                                >
                                                    <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" sizes="5vw" />
                                                    {statusLabel && (
                                                        <div className={`absolute inset-0 flex items-center justify-center z-10 ${isEnemyUsed ? '' : 'bg-black/60'}`}>
                                                            <span className={`
                                                        font-black text-white uppercase tracking-tighter 
                                                        ${isEnemyUsed
                                                                    ? 'text-[8px] bg-slate-800/90 py-0.5 w-full text-center bottom-0 absolute tracking-normal'
                                                                    : `text-[8px] sm:text-[10px] -rotate-12 border-2 border-white/50 px-1 rounded transform ${statusColor}`
                                                                }
                                                    `}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </ScrollArea>


                        </div>
                    </TabsContent>

                    {/* Tab 2: GLOBAL BANS */}
                    <TabsContent value="global-bans" className="flex-1 flex flex-col min-h-0 bg-slate-900/50 border border-slate-800 rounded-xl p-4 data-[state=active]:flex m-0 overflow-y-auto">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center mb-4">Historical Bans (Previous Games)</h4>

                        <div className="space-y-3">
                            {/* Header */}
                            <div className="flex justify-between px-4 py-2 bg-slate-950/50 rounded-lg text-xs font-bold uppercase border border-slate-800">
                                <span className="text-blue-400 w-1/2 text-center border-r border-slate-800">{match.team_a_name}</span>
                                <span className="text-red-400 w-1/2 text-center">{match.team_b_name}</span>
                            </div>

                            {/* Game Rows */}
                            {match.games?.filter(g => g.game_number < game.game_number).map((g) => {
                                // Extract picks for this specific game
                                const picks = g.picks || []
                                const bluePicks = picks.filter(p => p.side === 'BLUE' && p.type === 'PICK').map(p => p.hero_id)
                                const redPicks = picks.filter(p => p.side === 'RED' && p.type === 'PICK').map(p => p.hero_id)

                                // Determine which picks belong to Team A (Left Column) and Team B (Right Column)
                                const teamAIsBlue = g.blue_team_name === match.team_a_name
                                const teamAPicks = teamAIsBlue ? bluePicks : redPicks
                                const teamBPicks = teamAIsBlue ? redPicks : bluePicks

                                return (
                                    <div key={g.id} className="flex flex-col gap-1 bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-mono text-slate-500">GAME {g.game_number}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 ${teamAIsBlue ? 'text-blue-400' : 'text-red-400'}`}>
                                                {teamAIsBlue ? 'BLUE SIDE' : 'RED SIDE'} (A)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Left Column: Team A Picks */}
                                            <div className="flex flex-wrap gap-2 justify-center content-start">
                                                {teamAPicks.map(id => {
                                                    const h = getHero(id)
                                                    return h ? (
                                                        <div key={id} className="relative group">
                                                            <Image src={h.icon_url} alt={h.name} width={32} height={32} className="rounded border border-slate-700 grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all" title={h.name} />
                                                        </div>
                                                    ) : null
                                                })}
                                                {teamAPicks.length === 0 && <span className="text-xs text-slate-600">-</span>}
                                            </div>
                                            {/* Right Column: Team B Picks */}
                                            <div className="flex flex-wrap gap-2 justify-center content-start">
                                                {teamBPicks.map(id => {
                                                    const h = getHero(id)
                                                    return h ? (
                                                        <div key={id} className="relative group">
                                                            <Image src={h.icon_url} alt={h.name} width={32} height={32} className="rounded border border-slate-700 grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all" title={h.name} />
                                                        </div>
                                                    ) : null
                                                })}
                                                {teamBPicks.length === 0 && <span className="text-xs text-slate-600">-</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {(match.games?.filter(g => g.game_number < game.game_number).length === 0) && (
                                <div className="text-center text-slate-500 py-8 italic flex flex-col items-center gap-2">
                                    <ShieldBan className="w-8 h-8 opacity-20" />
                                    <span>No global bans active (First Game)</span>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab 3: CEREBRO AI */}
                    <TabsContent value="cerebro-ai" className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-4 data-[state=active]:flex m-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <h3 className="font-bold text-indigo-400 flex items-center gap-2">
                                    <Brain className="w-5 h-5" />
                                    CEREBRO AI ANALYSIS
                                </h3>
                                <div className="text-xs text-slate-500 font-mono mt-1">
                                    CONTEXT: {isBanPhase ? 'RECOMMENDED BANS' : 'RECOMMENDED PICKS'}
                                </div>
                            </div>

                            {/* Warning Badge */}
                            {recommendations.warning && (
                                <div className="bg-yellow-900/20 border border-yellow-900/30 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <span className="text-[10px] text-yellow-500 font-bold tracking-tight uppercase">Strategy Alert</span>
                                </div>
                            )}
                        </div>

                        {recommendations.warning && (
                            <div className="mb-4 p-3 bg-yellow-950/30 border border-yellow-900/20 rounded text-xs text-yellow-200/80 leading-relaxed shrink-0">
                                {recommendations.warning}
                            </div>
                        )}

                        <ScrollArea className="flex-1 -mr-2 pr-2">
                            {(() => {
                                const activeRecs = isBanPhase
                                    ? recommendations.smartBan
                                    : recommendations.hybrid;

                                if (isLoadingRecommendations) {
                                    return (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3 opacity-60">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                            <span className="text-xs font-mono">Processing Matchup Data...</span>
                                        </div>
                                    )
                                }

                                if (!activeRecs || activeRecs.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3 opacity-60">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                                <Brain className="w-6 h-6 text-slate-600" />
                                            </div>
                                            <span className="text-xs">No strategic recommendations found for this context.</span>
                                        </div>
                                    )
                                }

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeRecs.map((rec: any, idx: number) => (
                                            <div key={rec.hero.id}
                                                onClick={() => handleHeroClick(rec.hero)}
                                                className="bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-all group flex items-start gap-3"
                                            >
                                                {/* Rank Badge */}
                                                <div className="text-xs font-black text-slate-600 group-hover:text-indigo-500/50 font-mono mt-1">
                                                    #{idx + 1}
                                                </div>

                                                <div className="relative w-10 h-10 rounded overflow-hidden border border-slate-600 group-hover:border-indigo-400 transition-colors shrink-0">
                                                    <Image src={rec.hero.icon_url} alt={rec.hero.name} fill className="object-cover" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-sm text-slate-200 group-hover:text-white truncate">{rec.hero.name}</span>
                                                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${rec.score > 30 ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                                                            {rec.score.toFixed(0)} PTS
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 group-hover:text-indigo-300 leading-tight">
                                                        {rec.reason}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                {/* Lock In Button (Always Visible) */}
                <div className="mt-1 pt-2 border-t border-slate-800 flex justify-center shrink-0 bg-slate-900/80 rounded-b-xl pb-1">
                    <Button
                        size="sm"
                        className={`w-full lg:w-48 font-bold ${state.isFinished
                            ? 'bg-green-600 hover:bg-green-700 animate-pulse text-white'
                            : (state.isPaused || !selectedHero ? 'opacity-50' : 'animate-pulse')
                            }`}
                        disabled={!state.isFinished && (state.isPaused || !selectedHero)}
                        onClick={state.isFinished ? () => setShowSummary(true) : handleLockIn}
                    >
                        {state.isFinished
                            ? 'GO TO SUMMARY'
                            : (state.isPaused ? 'Draft Paused' : selectedHero ? 'LOCK IN' : 'Select Hero')
                        }
                    </Button>
                </div>
            </div>

            {/* RIGHT: RED TEAM (Mobile: Order 3) */}
            <div className="w-full lg:w-[22%] flex flex-col gap-1 order-3 lg:order-none">
                <div className="p-2 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
                    <h3 className="text-lg font-bold text-red-400 truncate">{game.red_team_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-2 justify-center">
                    {[1, 3, 10, 12].map((stepIdx, i) => (
                        <div key={i} className="w-10 h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.redBans[i] ? (
                                <Image src={getHero(state.redBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex-1 space-y-2 min-h-[300px] lg:min-h-0">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.redPicks[i]
                        const hero = getHero(heroId || '')

                        // Lanes
                        const lanes = [
                            { id: 'Dark Slayer', label: 'DS' },
                            { id: 'Jungle', label: 'JG' },
                            { id: 'Mid', label: 'MID' },
                            { id: 'Abyssal', label: 'AB' },
                            { id: 'Roam', label: 'SP' },
                        ]

                        return (
                            <div key={i} className="relative flex flex-col bg-red-900/10 border border-red-500/20 rounded-lg overflow-hidden shrink-0">
                                <div className="h-12 lg:h-14 flex items-center px-3 relative overflow-hidden flex-row-reverse text-right shrink-0">
                                    {hero ? (
                                        <>
                                            <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20" />
                                            <div className="relative z-10 flex items-center gap-3 flex-row-reverse">
                                                <Image src={hero.icon_url} alt={hero.name} width={40} height={40} className="rounded-full border-2 border-red-400" />
                                                <span className="font-bold text-base">{hero.name}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-slate-600 relative z-10 text-sm">Pick {i + 1}</span>
                                    )}
                                </div>

                                {/* Manual Lane Selector (Only if hero picked) */}
                                {/* Manual Lane Selector (Always rendered for height consistency) */}
                                <div className={`flex bg-slate-900/50 border-t divide-x divide-slate-800 transition-opacity ${hero ? 'opacity-100 border-red-500/20' : 'opacity-0 border-transparent pointer-events-none'}`}>
                                    {lanes.map(lane => {
                                        const isSelected = hero ? manualLanes[hero.id]?.includes(lane.id) : false
                                        return (
                                            <button
                                                key={lane.id}
                                                onClick={() => hero && handleLaneAssign(hero.id, lane.id)}
                                                className={`flex-1 h-6 text-[10px] font-bold uppercase transition-colors hover:bg-red-500/20 ${isSelected ? 'bg-red-600 text-white' : 'text-slate-500'}`}
                                            >
                                                {lane.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>


            </div>

        </div >
    )
})

export default DraftInterface
