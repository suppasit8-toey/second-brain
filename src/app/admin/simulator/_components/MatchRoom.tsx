'use client'

import { useState, useEffect } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DraftInterface from './DraftInterface'
import NewGameButton from '../../draft/_components/NewGameButton'
import MatchSummary from './MatchSummary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Lock, Trophy, ArrowLeft } from 'lucide-react'

// Reuse types or ensure they are compatible
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
    const maxGames = getMaxGames(match.mode || 'BO1')
    const seriesArray = Array.from({ length: maxGames }, (_, i) => i + 1)

    // 2. Score Calculation
    const teamAScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_a_name || g.winner === 'Red' && g.red_team_name === match.team_a_name).length
    const teamBScore = games.filter(g => g.winner === 'Blue' && g.blue_team_name === match.team_b_name || g.winner === 'Red' && g.red_team_name === match.team_b_name).length

    // 3. Tab Logic
    const gameIdParam = searchParams.get('game')

    // Determine Winner / Series End
    // BO1: 1 win
    // BO3: 2 wins
    // BO5: 3 wins
    // BO7: 4 wins
    // BO2: Play ALL 2 games (Draw possible)
    let winningThreshold = 1
    if (match.mode === 'BO3') winningThreshold = 2
    if (match.mode === 'BO5') winningThreshold = 3
    if (match.mode === 'BO7') winningThreshold = 4

    const isMatchFinished =
        (match.mode === 'BO2' && games.filter(g => g.winner).length === 2) ||
        (teamAScore >= winningThreshold) ||
        (teamBScore >= winningThreshold)

    const latestGameId = games.length > 0 ? games[games.length - 1].id : (games.length === 0 ? 'new-1' : `new-${games.length + 1}`)

    const resolveInitialTab = () => {
        if (gameIdParam) {
            if (games.some(g => g.id === gameIdParam)) return gameIdParam
            if (gameIdParam.startsWith('new-')) return gameIdParam
            if (gameIdParam === 'summary' && isMatchFinished) return 'summary'
        }
        // If match is finished and no specific game selected, go to summary
        if (isMatchFinished) return 'summary'

        return latestGameId
    }

    const [activeTab, setActiveTab] = useState<string>(resolveInitialTab())

    const onTabChange = (val: string) => {
        setActiveTab(val)
        const params = new URLSearchParams(searchParams)
        params.set('game', val)
        router.replace(`${pathname}?${params.toString()}`)
    }

    // Effect: Keep url synced if games change (e.g. creating new game)
    useEffect(() => {
        const gameParam = searchParams.get('game')
        if (gameParam && gameParam !== activeTab) {
            setActiveTab(gameParam)
        }
    }, [searchParams, activeTab])

    // NEW: Global Ban Logic (Previously Picked)
    // We need to pass previously picked heroes to the DraftInterface for filtering
    // logic: get all picks from games *before* the current game number
    // But DraftInterface is per-game.
    // So we calculate it here and pass it down.

    // Helper to get picks for a team across all games
    const getGlobalUsedHeroes = (teamName: string, currentGameNumber: number) => {
        const usedIds: string[] = []
        games.forEach(g => {
            if (g.game_number < currentGameNumber) {
                // Find picks for this team in this game
                const isBlue = g.blue_team_name === teamName
                const picks = g.picks || []
                picks.forEach(p => {
                    if (p.type === 'PICK') {
                        // Check side
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
                    {/* Back to Lobby Button */}
                    <Link href="/admin/simulator">
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Lobby
                        </Button>
                    </Link>

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
                                // If match is already finished, do we show future unplayed games?
                                // e.g. BO5 finished 3-0. Should we show Game 4/5?
                                // User flow: Just show Summary.
                                // Logic: If game is created OR it's the immediate next game AND match not finished
                                const game = games.find(g => g.game_number === num)
                                const isCreated = !!game

                                // Hiding unplayed games if match finished
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

                            {/* Summary Tab - Only if finished */}
                            {isMatchFinished && (
                                <TabsTrigger value="summary" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white px-4">
                                    <Trophy className="w-3 h-3 mr-2" />
                                    Summary
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="flex-1 relative bg-slate-950">
                        {seriesArray.map((num) => {
                            const game = games.find(g => g.game_number === num)
                            const isCreated = !!game

                            if (!isCreated && isMatchFinished) return null

                            const value = isCreated ? game.id : `new-${num}`

                            const prevGame = games.find(g => g.game_number === num - 1)
                            const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))

                            // Calculate Global Bans for this game number
                            const teamAGlobalBans = getGlobalUsedHeroes(match.team_a_name, num)
                            const teamBGlobalBans = getGlobalUsedHeroes(match.team_b_name, num)

                            return (
                                <TabsContent key={num} value={value} className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0">
                                    {isCreated ? (
                                        <DraftInterface
                                            match={match}
                                            game={game}
                                            initialHeroes={heroes}
                                            teamAGlobalBans={teamAGlobalBans}
                                            teamBGlobalBans={teamBGlobalBans}
                                        />
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
