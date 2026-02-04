'use client'

import { useState, useEffect } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { useDraftEngine } from './useDraftEngine'
import { getRecommendations } from '../../simulator/recommendations' // Switched to Simulator engine for full features
import { deleteGame } from '../actions'
import { getHeroesByVersion } from '../../heroes/actions'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Pause, Play, Check, Brain, ChevronUp, ChevronDown, ChevronLeft, LogOut } from 'lucide-react'
import Image from 'next/image'
import PostDraftResult from '@/components/draft/PostDraftResult' // Updated import

interface DraftInterfaceProps {
    match: DraftMatch;
    game: DraftGame;
    initialHeroes: Hero[];
}

export default function DraftInterface({ match, game, initialHeroes }: DraftInterfaceProps) {
    const { state, currentStep, lockIn, togglePause } = useDraftEngine({ initialPicks: game.picks })
    const [selectedHero, setSelectedHero] = useState<Hero | null>(null)
    const [recommendations, setRecommendations] = useState<any>({ analyst: [], history: [], hybrid: [], smartBan: [] })
    const [isAiOpen, setIsAiOpen] = useState(true)

    // Navigate to next game logic
    const games = match.games || []
    const sortedGames = [...games].sort((a: any, b: any) => a.game_number - b.game_number)
    const currentIndex = sortedGames.findIndex(g => g.id === game.id)
    const nextGame = sortedGames[currentIndex + 1]

    // Derived Lists for filtering
    const bannedIds = [...state.blueBans, ...state.redBans]
    const pickedIds = [...Object.values(state.bluePicks), ...Object.values(state.redPicks)]
    const unavailableIds = [...bannedIds, ...pickedIds]

    // Fetch Recommendations when step changes
    useEffect(() => {
        if (!currentStep || state.isFinished) return;

        const allyPicks = currentStep.side === 'BLUE' ? Object.values(state.bluePicks) : Object.values(state.redPicks)
        const enemyPicks = currentStep.side === 'BLUE' ? Object.values(state.redPicks) : Object.values(state.bluePicks)

        const currentPhase = (currentStep?.type === 'BAN' ? 'BAN' : 'PICK') as 'BAN' | 'PICK'

        // Determine teams based on side
        const isBlue = currentStep?.side === 'BLUE'
        const targetTeamName = isBlue ? match.team_a_name : match.team_b_name
        const enemyTeamName = isBlue ? match.team_b_name : match.team_a_name

        const context = {
            matchId: match.id,
            phase: currentPhase,
            side: currentStep?.side,
            targetTeamName,
            enemyTeamName,
            pickOrder: state.stepIndex + 1 // Add pick order for slot analysis
        }

        getRecommendations(match.version_id, allyPicks, enemyPicks, bannedIds, [], context)
            .then(setRecommendations)

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

    // --- ACTIONS ---
    const handleReset = async () => {
        if (!confirm('Are you sure you want to reset this game? This will return to the Setup screen.')) return

        await deleteGame(game.id, match.id)
        window.location.reload()
    }

    // Render POST-DRAFT Screen if finished
    if (state.isFinished) {
        return (
            <PostDraftResult
                gameId={game.id}
                blueTeamName={match.team_a_name}
                redTeamName={match.team_b_name}
                bluePicks={state.bluePicks}
                redPicks={state.redPicks}
                blueBans={state.blueBans}
                redBans={state.redBans}
                heroes={initialHeroes}
                nextGameId={nextGame?.id}
                matchId={match.slug || match.id}
                initialData={{
                    winner: game.winner || null,
                    blueKeyPlayer: game.blue_key_player_id,
                    redKeyPlayer: game.red_key_player_id,
                    winPrediction: game.analysis_data?.winPrediction?.blue || 50,
                    notes: game.analysis_data?.notes
                }}
                seriesScore={{ blue: 0, red: 0 }} // TODO: Calculate actual score
                matchMode={match.mode}
                gameNumber={game.game_number}
            />
        )
    }

    return (
        <div className="flex flex-col lg:flex-row h-full gap-2 lg:gap-4 p-2 lg:p-4 text-white overflow-y-auto lg:overflow-hidden">
            {/* LEFT: BLUE TEAM */}
            <div className="w-full lg:w-1/4 flex flex-row lg:flex-col gap-2 items-center lg:items-stretch overflow-x-auto lg:overflow-visible order-2 lg:order-1 no-scrollbar shrink-0">
                <div className="hidden lg:block p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
                    <h3 className="text-xl font-bold text-blue-400">{match.team_a_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-1 lg:gap-2 justify-center shrink-0">
                    {[0, 2, 11, 13].map((stepIdx, i) => (
                        <div key={i} className="w-8 h-8 lg:w-10 lg:h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.blueBans[i] ? (
                                <Image src={getHero(state.blueBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-[10px] lg:text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex flex-row lg:flex-col gap-1 lg:space-y-2 flex-1 lg:flex-none justify-end lg:justify-start">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.bluePicks[i]
                        const hero = getHero(heroId || '')
                        return (
                            <div key={i} className="h-10 w-10 lg:h-20 lg:w-full border border-blue-500/20 bg-blue-900/10 rounded lg:rounded-lg flex items-center justify-center lg:justify-start lg:px-4 relative overflow-hidden shrink-0">
                                {hero ? (
                                    <>
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20 hidden lg:block" />
                                        <div className="relative z-10 flex items-center gap-4">
                                            <Image src={hero.icon_url} alt={hero.name} width={48} height={48} className="w-full h-full lg:w-12 lg:h-12 object-cover lg:rounded-full lg:border-2 border-blue-400" />
                                            <span className="font-bold text-lg hidden lg:block">{hero.name}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-[10px] lg:text-base text-slate-600 lg:hidden">P{i + 1}</span>
                                )}
                                <span className="hidden lg:inline text-slate-600">{!hero && `Pick ${i + 1}`}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* CENTER: BOARD & CONTROLS */}
            <div className="flex-1 flex flex-col gap-2 lg:gap-4 order-1 lg:order-2 min-h-0">
                {/* Header / Timer */}
                <div className="h-16 lg:h-24 bg-slate-900 border border-slate-700 rounded-lg lg:rounded-xl flex items-center justify-between px-4 lg:px-8 relative overflow-hidden shrink-0">
                    <div className="z-10 flex flex-col items-center w-full">
                        {state.isFinished ? (
                            <h2 className="text-xl lg:text-3xl font-black text-green-400">COMPLETE</h2>
                        ) : (
                            <>
                                <span className={`text-[10px] lg:text-sm font-bold tracking-wider ${currentStep?.side === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                                    {currentStep?.side} {currentStep?.type}
                                </span>
                                <div className="text-3xl lg:text-5xl font-mono font-bold mt-0 lg:mt-1">{state.timer}</div>
                            </>
                        )}
                    </div>
                    <div className="absolute right-2 top-2 lg:right-4 lg:top-4 flex gap-1 lg:gap-2 z-20">
                        <Button size="icon" variant="ghost" className="text-slate-400 hover:text-white h-8 w-8 lg:h-10 lg:w-10" onClick={handleReset}>
                            <LogOut className="w-3 h-3 lg:w-4 lg:h-4" />
                        </Button>
                        <div className="w-px h-6 lg:h-8 bg-slate-800 my-auto mx-0 lg:mx-1" />
                        <Button size="icon" variant="ghost" className="h-8 w-8 lg:h-10 lg:w-10" onClick={togglePause}>
                            {state.isPaused ? <Play className="w-3 h-3 lg:w-4 lg:h-4" /> : <Pause className="w-3 h-3 lg:w-4 lg:h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Hero Selector Grid */}
                <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg lg:rounded-xl p-2 lg:p-4 flex flex-col min-h-0">
                    <ScrollArea className="flex-1 h-[400px] lg:h-auto">
                        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1 lg:gap-2">
                            {initialHeroes.map(hero => {
                                const isUnavailable = unavailableIds.includes(hero.id)
                                const isSelected = selectedHero?.id === hero.id
                                return (
                                    <button
                                        key={hero.id}
                                        disabled={isUnavailable}
                                        onClick={() => handleHeroClick(hero)}
                                        className={`
                                            relative aspect-square rounded lg:rounded-lg overflow-hidden border transition-all
                                            ${isUnavailable ? 'grayscale opacity-30 border-slate-800' : 'hover:scale-105 border-transparent'}
                                            ${isSelected ? 'border-yellow-400 ring-1 lg:ring-2 ring-yellow-400/50 scale-105 z-10' : ''}
                                        `}
                                    >
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-0.5 lg:p-1 text-[8px] lg:text-[10px] text-center truncate">
                                            {hero.name}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </ScrollArea>

                    {/* Action Bar */}
                    <div className="mt-2 lg:mt-4 pt-2 lg:pt-4 border-t border-slate-800 flex justify-center">
                        <Button
                            size="lg"
                            className={`w-full lg:w-64 font-bold text-sm lg:text-lg h-10 lg:h-12 ${state.isPaused || !selectedHero ? 'opacity-50' : 'animate-pulse'}`}
                            disabled={state.isPaused || !selectedHero}
                            onClick={handleLockIn}
                        >
                            {state.isPaused ? 'Draft Paused' : selectedHero ? `LOCK ${selectedHero.name.toUpperCase()}` : 'SELECT HERO'}
                        </Button>
                    </div>
                </div>

                {/* Recommendation Panel: Cerebro AI */}
                <div className={`bg-slate-900 border border-slate-800 rounded-lg lg:rounded-xl overflow-hidden flex flex-col transition-all duration-300 shrink-0 ${isAiOpen ? 'h-48 lg:h-64' : 'h-10 lg:h-12'}`}>
                    <div
                        className="bg-slate-950 px-3 py-2 lg:px-4 lg:py-3 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors"
                        onClick={() => setIsAiOpen(!isAiOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <Brain className={`w-4 h-4 lg:w-5 lg:h-5 text-indigo-400 ${isAiOpen ? 'animate-pulse' : ''}`} />
                            <h3 className="font-bold text-sm lg:text-base text-indigo-100 tracking-wider">CEREBRO AI</h3>
                            <span className="text-[10px] lg:text-xs text-slate-500 ml-1 lg:ml-2 font-mono hidden sm:inline">{currentStep?.type === 'BAN' ? 'STRATEGIC BANS' : 'STRATEGIC PICKS'}</span>
                        </div>
                        <div className="flex items-center gap-2 lg:gap-3">
                            <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-400 text-[10px] lg:text-xs px-1 lg:px-2 h-5 lg:h-6">
                                {isAiOpen ? (currentStep?.type === 'BAN' ? '🛡️ Strategic Ban' : '⚡ Strategic Pick') : 'Min'}
                            </Badge>
                            {isAiOpen ? <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4 text-slate-500" /> : <ChevronUp className="w-3 h-3 lg:w-4 lg:h-4 text-slate-500" />}
                        </div>
                    </div>

                    <div className="flex-1 p-2 lg:p-4 bg-slate-900/50 overflow-y-auto">
                        {(() => {
                            let activeRecs = recommendations.hybrid;
                            if (currentStep?.type === 'BAN') {
                                // Phase 1 Bans (Indices 0-3) vs Phase 2 Bans (Indices 10+)
                                if (state.stepIndex < 10) {
                                    activeRecs = recommendations.smartBanPhase1 && recommendations.smartBanPhase1.length > 0
                                        ? recommendations.smartBanPhase1
                                        : recommendations.smartBan;
                                } else {
                                    activeRecs = recommendations.smartBanPhase2 && recommendations.smartBanPhase2.length > 0
                                        ? recommendations.smartBanPhase2
                                        : recommendations.smartBan;
                                }
                            }

                            if (!activeRecs || activeRecs.length === 0) {
                                return (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                        <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-indigo-500/30"></div>
                                        <span className="text-[10px] lg:text-xs">Analyzing...</span>
                                    </div>
                                )
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-4">
                                    {activeRecs.slice(0, 6).map((rec: any) => (
                                        <div key={rec.hero.id}
                                            onClick={() => handleHeroClick(rec.hero)}
                                            className="bg-slate-800 p-2 lg:p-3 rounded lg:rounded-lg flex items-center gap-2 lg:gap-3 hover:bg-slate-700 cursor-pointer transition-colors border border-slate-700 hover:border-indigo-500/50 group"
                                        >
                                            <div className="relative w-8 h-8 lg:w-10 lg:h-10 rounded overflow-hidden border border-slate-600 group-hover:border-indigo-400 transition-colors">
                                                <Image src={rec.hero.icon_url} alt={rec.hero.name} fill className="object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-xs lg:text-sm truncate text-slate-200 group-hover:text-white">{rec.hero.name}</span>
                                                    <Badge variant="secondary" className={`text-[10px] h-3 lg:h-4 px-1 ${rec.score > 30 ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                                                        {rec.score.toFixed(0)}
                                                    </Badge>
                                                </div>
                                                <p className="text-[10px] lg:text-xs text-slate-400 truncate group-hover:text-indigo-300 transition-colors">
                                                    {rec.reason}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* RIGHT: RED TEAM */}
            <div className="w-full lg:w-1/4 flex flex-row lg:flex-col gap-2 items-center lg:items-stretch overflow-x-auto lg:overflow-visible order-3 no-scrollbar shrink-0">
                <div className="hidden lg:block p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
                    <h3 className="text-xl font-bold text-red-400">{match.team_b_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-1 lg:gap-2 justify-center shrink-0">
                    {[1, 3, 10, 12].map((stepIdx, i) => (
                        <div key={i} className="w-8 h-8 lg:w-10 lg:h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.redBans[i] ? (
                                <Image src={getHero(state.redBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-[10px] lg:text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex flex-row lg:flex-col gap-1 lg:space-y-2 flex-1 lg:flex-none justify-start lg:justify-start">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.redPicks[i]
                        const hero = getHero(heroId || '')
                        return (
                            <div key={i} className="h-10 w-10 lg:h-20 lg:w-full border border-red-500/20 bg-red-900/10 rounded lg:rounded-lg flex items-center justify-center lg:justify-end lg:px-4 relative overflow-hidden lg:flex-row-reverse text-right shrink-0">
                                {hero ? (
                                    <>
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20 hidden lg:block" />
                                        <div className="relative z-10 flex items-center gap-4 lg:flex-row-reverse">
                                            <Image src={hero.icon_url} alt={hero.name} width={48} height={48} className="w-full h-full lg:w-12 lg:h-12 object-cover lg:rounded-full lg:border-2 border-red-400" />
                                            <span className="font-bold text-lg hidden lg:block">{hero.name}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-[10px] lg:text-base text-slate-600 lg:hidden">P{i + 1}</span>
                                )}
                                <span className="hidden lg:inline text-slate-600">{!hero && `Pick ${i + 1}`}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
