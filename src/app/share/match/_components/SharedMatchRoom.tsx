'use client'

import { useState, useEffect } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DraftInterface from '@/app/admin/simulator/_components/DraftInterface'
import MatchSummary from '@/app/admin/simulator/_components/MatchSummary'
import NewGameButton from '@/app/admin/draft/_components/NewGameButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Lock, Trophy, Maximize2, Minimize2 } from 'lucide-react'
import { useUI } from '@/context/UIContext'

interface SharedMatchRoomProps {
    match: DraftMatch;
    heroes: Hero[];
}

export default function SharedMatchRoom({ match, heroes }: SharedMatchRoomProps) {
    const games = match.games || []
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const { isFullscreen, toggleFullscreen } = useUI()

    // 1. Determine Max Games based on Mode
    const getMaxGames = (mode: string) => {
        switch (mode) {
            case 'BO1': return 1;
            case 'BO2': return 2;
            case 'BO3': return 3;
            case 'BO4': return 4;
            case 'BO5': return 5;
            case 'BO7': return 7;
            default: return 1;
        }
    }
    const maxGames = getMaxGames(match.mode || 'BO1')
    const seriesArray = Array.from({ length: maxGames }, (_, i) => i + 1)

    // 2. Score Calculation
    const teamAScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_a_name || g.winner === 'Red' && g.red_team_name === match.team_a_name).length
    const teamBScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_b_name || g.winner === 'Red' && g.red_team_name === match.team_b_name).length

    // 3. Tab Logic
    const gameIdParam = searchParams.get('game')

    let winningThreshold = 1
    let playAllGames = false

    if (match.mode === 'BO2') { playAllGames = true; winningThreshold = 2 }
    if (match.mode === 'BO3') winningThreshold = 2
    if (match.mode === 'BO4') { playAllGames = true; winningThreshold = 4 }
    if (match.mode === 'BO5') winningThreshold = 3
    if (match.mode === 'BO7') winningThreshold = 4

    const finishedGamesCount = games.filter(g => g.winner).length

    const isMatchFinished =
        (playAllGames && finishedGamesCount === winningThreshold) ||
        (!playAllGames && (teamAScore >= winningThreshold || teamBScore >= winningThreshold))

    const latestGameId = games.length > 0 ? games[games.length - 1].id : null

    const resolveInitialTab = () => {
        if (gameIdParam) {
            if (games.some(g => g.id === gameIdParam)) return gameIdParam
            if (gameIdParam.startsWith('new-')) return gameIdParam
            if (gameIdParam === 'summary' && isMatchFinished) return 'summary'
        }
        // If match is finished and no specific game selected, go to summary
        if (isMatchFinished) return 'summary'

        return latestGameId || 'new-1'
    }

    const [activeTab, setActiveTab] = useState<string>(resolveInitialTab())

    const onTabChange = (val: string) => {
        setActiveTab(val)
        const params = new URLSearchParams(searchParams)
        params.set('game', val)
        router.replace(`${pathname}?${params.toString()}`)
    }

    useEffect(() => {
        const gameParam = searchParams.get('game')
        if (gameParam && gameParam !== activeTab) {
            // Validate if gameParam exists in games
            if (games.some(g => g.id === gameParam) || gameParam === 'summary' || gameParam?.startsWith('new-')) {
                setActiveTab(gameParam)
            }
        }
    }, [searchParams, activeTab, games])

    // Helper to get picks for a team across all games
    const getGlobalUsedHeroes = (teamName: string, currentGameNumber: number) => {
        const usedIds: string[] = []
        games.forEach(g => {
            if (g.game_number < currentGameNumber) {
                const isBlue = g.blue_team_name === teamName
                const picks = g.picks || []
                picks.forEach(p => {
                    if (p.type === 'PICK') {
                        if ((isBlue && p.side === 'BLUE') || (!isBlue && p.side === 'RED')) {
                            usedIds.push(p.hero_id)
                        }
                    }
                })
            }
        })
        return usedIds
    }

    return (
        <div className={`flex flex-col ${isFullscreen ? 'h-screen' : 'h-[calc(100vh)]'} bg-slate-950 text-white`}>
            {/* Match Header - Hidden in Fullscreen */}
            {!isFullscreen && (
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
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={toggleFullscreen}
                            className="h-8 w-8 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="Enter Focus Mode"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col relative min-h-0">
                <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
                    <div className={`shrink-0 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between gap-4 overflow-x-auto ${isFullscreen ? 'px-4 py-1' : 'px-6 py-2'}`}>
                        <TabsList className="bg-slate-800 text-slate-400 h-10 p-1 shrink-0">
                            {seriesArray.map((num) => {
                                const game = games.find(g => g.game_number === num)
                                const isCreated = !!game

                                // Allow showing uncreated games to enable creating them
                                if (!isCreated && isMatchFinished) return null

                                const prevGame = games.find(g => g.game_number === num - 1)
                                const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))

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

                            {isMatchFinished && (
                                <TabsTrigger value="summary" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white px-4">
                                    <Trophy className="w-3 h-3 mr-2" />
                                    Summary
                                </TabsTrigger>
                            )}
                        </TabsList>

                        {/* Fullscreen Controls */}
                        {isFullscreen && (
                            <div className="flex items-center gap-1 ml-auto bg-slate-800 p-1 rounded-lg border border-slate-700">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={toggleFullscreen}
                                    className="h-8 w-8 hover:bg-slate-700 text-slate-300 hover:text-white"
                                    title="Exit Focus Mode"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 relative bg-slate-950 min-h-0">
                        {seriesArray.map((num) => {
                            const game = games.find(g => g.game_number === num)
                            const isCreated = !!game

                            if (!isCreated && isMatchFinished) return null

                            const prevGame = games.find(g => g.game_number === num - 1)
                            const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))

                            if (!isCreated) {
                                return (
                                    <TabsContent key={num} value={`new-${num}`} className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0">
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
                                    </TabsContent>
                                )
                            }

                            if (!game) return null;

                            const teamAGlobalBans = getGlobalUsedHeroes(match.team_a_name, num)
                            const teamBGlobalBans = getGlobalUsedHeroes(match.team_b_name, num)

                            return (
                                <TabsContent key={num} value={game.id} className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0">
                                    <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
                                        <DraftInterface
                                            match={match}
                                            game={game}
                                            initialHeroes={heroes}
                                            teamAGlobalBans={teamAGlobalBans}
                                            teamBGlobalBans={teamBGlobalBans}
                                        />
                                    </div>
                                </TabsContent>
                            )
                        })}

                        {isMatchFinished && (
                            <TabsContent value="summary" className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0 bg-slate-950">
                                <MatchSummary match={match} games={games} heroes={heroes} />
                            </TabsContent>
                        )}
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
