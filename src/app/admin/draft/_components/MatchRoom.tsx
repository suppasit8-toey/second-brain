'use client'

import { useState, useEffect } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DraftInterface from './DraftInterface'
import NewGameButton from './NewGameButton'
import { Badge } from '@/components/ui/badge'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

interface MatchRoomProps {
    match: DraftMatch;
    heroes: Hero[];
}

export default function MatchRoom({ match, heroes }: MatchRoomProps) {
    const games = match.games || []
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // 1. Determine Max Games based on Mode
    const getMaxGames = (mode: string) => {
        switch (mode) {
            case 'BO1': return 1;
            case 'BO2': return 2;
            case 'BO3': return 3;
            case 'BO5': return 5;
            case 'BO7': return 7;
            default: return 1;
        }
    }
    const maxGames = getMaxGames(match.mode)
    const seriesArray = Array.from({ length: maxGames }, (_, i) => i + 1)

    // 2. Score Calculation
    const teamAScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_a_name || g.winner === 'Red' && g.red_team_name === match.team_a_name).length
    const teamBScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_b_name || g.winner === 'Red' && g.red_team_name === match.team_b_name).length

    // 3. Tab Logic
    const gameIdParam = searchParams.get('game')

    // Default Tab: Latest Created Game or 'game-1' if none
    const latestGameId = games.length > 0 ? games[games.length - 1].id : 'new-1'

    // Resolve initial active tab
    // If param exists and is valid (either a game ID or a placeholder 'new-X') -> use it
    // Else -> use latestGameId
    const resolveInitialTab = () => {
        if (gameIdParam) {
            // Check if it's an ID
            if (games.some(g => g.id === gameIdParam)) return gameIdParam
            // Check if it's a valid placeholder like "new-2"
            if (gameIdParam.startsWith('new-')) return gameIdParam
        }
        return latestGameId
    }

    const [activeTab, setActiveTab] = useState<string>(resolveInitialTab())

    const onTabChange = (val: string) => {
        setActiveTab(val)
        const params = new URLSearchParams(searchParams)
        params.set('game', val)
        router.replace(`${pathname}?${params.toString()}`)
    }

    // Effect: If a new game is created (games length increases), switch to it automatically?
    // Handled by NewGameButton refresh usually, but let's keep state in sync if props update
    useEffect(() => {
        // Optional: Auto-select latest game if not viewing history?
        // sticking to URL param priority
    }, [games.length])

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Match Header */}
            <div className="shrink-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="text-right w-48">
                        <h2 className="text-2xl font-black text-white truncate">{match.team_a_name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Team A</p>
                    </div>

                    <div className="px-8 py-3 bg-slate-800 rounded-xl border border-slate-700 flex flex-col items-center min-w-[120px]">
                        <span className="text-xs text-slate-500 font-mono mb-1">{match.mode} Series</span>
                        <div className="text-4xl font-bold font-mono leading-none tracking-widest text-white">
                            <span className={teamAScore > teamBScore ? 'text-blue-400' : ''}>{teamAScore}</span>
                            <span className="text-slate-600 mx-2">-</span>
                            <span className={teamBScore > teamAScore ? 'text-red-400' : ''}>{teamBScore}</span>
                        </div>
                    </div>

                    <div className="text-left w-48">
                        <h2 className="text-2xl font-black text-white truncate">{match.team_b_name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Team B</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-8 px-3 border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                        Patch {match.version?.name}
                    </Badge>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
                    <div className="shrink-0 px-6 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2 overflow-x-auto">
                        <TabsList className="bg-slate-800 text-slate-400 h-10 p-1">
                            {seriesArray.map((num) => {
                                const game = games.find(g => g.game_number === num)
                                const isCreated = !!game
                                // Previous game must be finished to unlock this (if not created)
                                const prevGame = games.find(g => g.game_number === num - 1)
                                const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner)) // Simple check: winner field implies finished? Or check status? 
                                // Actually, draft_games table doesn't have 'status', but has 'winner' or 'picks'.
                                // PostDraftResult saves winner. So if winner is set, game is done.

                                const value = isCreated ? game.id : `new-${num}`

                                return (
                                    <TabsTrigger
                                        key={num}
                                        value={value}
                                        disabled={isLocked}
                                        className="data-[state=active]:bg-slate-700 data-[state=active]:text-white px-4"
                                    >
                                        {isLocked ? <Lock className="w-3 h-3 mr-2 opacity-50" /> : null}
                                        Game {num}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </div>

                    <div className="flex-1 relative bg-slate-950">
                        {seriesArray.map((num) => {
                            const game = games.find(g => g.game_number === num)
                            const isCreated = !!game
                            const value = isCreated ? game.id : `new-${num}`

                            // Check lock status for content rendering too (security)
                            const prevGame = games.find(g => g.game_number === num - 1)
                            const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))

                            return (
                                <TabsContent key={num} value={value} className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0">
                                    {isCreated ? (
                                        <DraftInterface match={match} game={game} initialHeroes={heroes} />
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center p-12">
                                            {isLocked ? (
                                                <div className="text-center space-y-4 opacity-50">
                                                    <Lock className="w-16 h-16 mx-auto text-slate-600" />
                                                    <h3 className="text-xl font-bold text-slate-500">Game {num} Locked</h3>
                                                    <p className="text-slate-600">Complete Game {num - 1} to unlock this round.</p>
                                                </div>
                                            ) : (
                                                <div className="w-full max-w-md">
                                                    <NewGameButton match={match} gameNumber={num} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>
                            )
                        })}
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
