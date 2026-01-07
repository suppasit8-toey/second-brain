'use client'

import { useState, useEffect } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { useDraftEngine } from './useDraftEngine'
import { getRecommendations } from '../recommendations'
import { getHeroesByVersion } from '../../heroes/actions'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Pause, Play, Check } from 'lucide-react'
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
    const [recommendations, setRecommendations] = useState<any>({ analyst: [], history: [], hybrid: [] })
    const [activeTab, setActiveTab] = useState('analyst')

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

        getRecommendations(match.version_id, allyPicks, enemyPicks, bannedIds)
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
            />
        )
    }

    return (
        <div className="flex h-full gap-4 p-4 text-white">
            {/* LEFT: BLUE TEAM */}
            <div className="w-1/4 flex flex-col gap-2">
                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
                    <h3 className="text-xl font-bold text-blue-400">{match.team_a_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-2 justify-center">
                    {[0, 2, 11, 13].map((stepIdx, i) => ( // Mapping ban steps relevant to blue if needed, simpler to just list state.blueBans
                        <div key={i} className="w-10 h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.blueBans[i] ? (
                                <Image src={getHero(state.blueBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex-1 space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.bluePicks[i]
                        const hero = getHero(heroId || '')
                        return (
                            <div key={i} className="h-20 border border-blue-500/20 bg-blue-900/10 rounded-lg flex items-center px-4 relative overflow-hidden">
                                {hero ? (
                                    <>
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20" />
                                        <div className="relative z-10 flex items-center gap-4">
                                            <Image src={hero.icon_url} alt={hero.name} width={48} height={48} className="rounded-full border-2 border-blue-400" />
                                            <span className="font-bold text-lg">{hero.name}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-slate-600">Pick {i + 1}</span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* CENTER: BOARD & CONTROLS */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Header / Timer */}
                <div className="h-24 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between px-8 relative overflow-hidden">
                    {/* Progress Bar background could go here */}
                    <div className="z-10 flex flex-col items-center w-full">
                        {state.isFinished ? (
                            <h2 className="text-3xl font-black text-green-400">DRAFT COMPLETE</h2>
                        ) : (
                            <>
                                <span className={`text-sm font-bold tracking-wider ${currentStep?.side === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                                    {currentStep?.side} SIDE {currentStep?.type}
                                </span>
                                <div className="text-5xl font-mono font-bold mt-1">{state.timer}</div>
                            </>
                        )}
                    </div>
                    <div className="absolute right-4 top-4 flex gap-2 z-20">
                        <Button size="icon" variant="ghost" onClick={togglePause}>
                            {state.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Hero Selector Grid */}
                <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col">
                    <ScrollArea className="flex-1 h-[400px]">
                        <div className="grid grid-cols-6 gap-2">
                            {initialHeroes.map(hero => {
                                const isUnavailable = unavailableIds.includes(hero.id)
                                const isSelected = selectedHero?.id === hero.id
                                return (
                                    <button
                                        key={hero.id}
                                        disabled={isUnavailable}
                                        onClick={() => handleHeroClick(hero)}
                                        className={`
                                            relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                                            ${isUnavailable ? 'grayscale opacity-30 border-slate-800' : 'hover:scale-105'}
                                            ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/50 scale-105 z-10' : 'border-transparent'}
                                        `}
                                    >
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-center truncate">
                                            {hero.name}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </ScrollArea>

                    {/* Action Bar */}
                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center">
                        <Button
                            size="lg"
                            className={`w-64 font-bold text-lg ${state.isPaused || !selectedHero ? 'opacity-50' : 'animate-pulse'}`}
                            disabled={state.isPaused || !selectedHero}
                            onClick={handleLockIn}
                        >
                            {state.isPaused ? 'Draft Paused' : selectedHero ? 'LOCK IN' : 'Select Hero'}
                        </Button>
                    </div>
                </div>

                {/* Recommendation Panel */}
                <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800">
                            <TabsList className="bg-transparent h-auto p-0 gap-4">
                                <TabsTrigger value="analyst" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 border-indigo-400 rounded-none pb-2">
                                    Analyst (Data)
                                </TabsTrigger>
                                <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 border-indigo-400 rounded-none pb-2">
                                    History (Trends)
                                </TabsTrigger>
                                <TabsTrigger value="hybrid" className="data-[state=active]:bg-transparent data-[state=active]:text-purple-400 data-[state=active]:border-b-2 border-purple-400 rounded-none pb-2">
                                    AI Hybrid
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 p-4 bg-slate-900/50">
                            {['analyst', 'history', 'hybrid'].map(tab => (
                                <TabsContent key={tab} value={tab} className="mt-0 h-full">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {recommendations[tab]?.length > 0 ? recommendations[tab].slice(0, 3).map((rec: any) => (
                                            <div key={rec.hero.id}
                                                onClick={() => handleHeroClick(rec.hero)}
                                                className="bg-slate-800 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-700 cursor-pointer transition-colors border border-slate-700 hover:border-indigo-500/50"
                                            >
                                                <Image src={rec.hero.icon_url} alt={rec.hero.name} width={40} height={40} className="rounded" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-sm truncate">{rec.hero.name}</span>
                                                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{rec.score.toFixed(1)}</Badge>
                                                    </div>
                                                    <p className="text-xs text-slate-400 truncate">{rec.reason}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="col-span-3 text-center text-slate-500 py-8">
                                                Waiting for draft to progress for recommendations...
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            ))}
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* RIGHT: RED TEAM */}
            <div className="w-1/4 flex flex-col gap-2">
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
                    <h3 className="text-xl font-bold text-red-400">{match.team_b_name}</h3>
                </div>

                {/* Bans */}
                <div className="flex gap-2 justify-center">
                    {[1, 3, 10, 12].map((stepIdx, i) => ( // Mapping ban steps relevant to red
                        <div key={i} className="w-10 h-10 border border-slate-700 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                            {state.redBans[i] ? (
                                <Image src={getHero(state.redBans[i])?.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : <span className="text-xs text-slate-600">Ban</span>}
                        </div>
                    ))}
                </div>

                {/* Picks */}
                <div className="flex-1 space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const heroId = state.redPicks[i]
                        const hero = getHero(heroId || '')
                        return (
                            <div key={i} className="h-20 border border-red-500/20 bg-red-900/10 rounded-lg flex items-center px-4 relative overflow-hidden flex-row-reverse text-right">
                                {hero ? (
                                    <>
                                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover opacity-20" />
                                        <div className="relative z-10 flex items-center gap-4 flex-row-reverse">
                                            <Image src={hero.icon_url} alt={hero.name} width={48} height={48} className="rounded-full border-2 border-red-400" />
                                            <span className="font-bold text-lg">{hero.name}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-slate-600">Pick {i + 1}</span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
