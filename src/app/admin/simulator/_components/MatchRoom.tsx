'use client'

import { useState, useEffect, useRef } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DraftInterface, { DraftControls } from './DraftInterface'
import NewGameButton from '../../draft/_components/NewGameButton'
import MatchSummary from './MatchSummary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MobileHeaderActions } from '@/components/admin/MobileHeaderContext'
import { Lock, Trophy, ArrowLeft, RefreshCw, Maximize2, Minimize2, Play, Pause, Share2, Check, RotateCcw, Gamepad2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { resetGame, finishMatch } from '../actions'
import { useUI } from '@/context/UIContext'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
interface MatchRoomProps {
    match: DraftMatch;
    heroes: Hero[];
}

export default function MatchRoom({ match, heroes }: MatchRoomProps) {
    const games = match.games || []
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const [resetDialogOpen, setResetDialogOpen] = useState(false)
    const [gameToReset, setGameToReset] = useState<string | null>(null)
    const { isFullscreen, toggleFullscreen } = useUI()
    const draftRef = useRef<DraftControls>(null)
    const [isDraftPaused, setIsDraftPaused] = useState(false)

    const [isMatchCopied, setIsMatchCopied] = useState(false)
    const [isGameMenuOpen, setIsGameMenuOpen] = useState(false)

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

    // Determine Winner / Series End
    // BO2, BO4, BO6: Play ALL games (Draw possible, typical for Scrims)
    // BO1, BO3, BO5, BO7: Competitive Series (First to threshold)
    let winningThreshold = 1
    let playAllGames = false

    if (match.mode === 'BO2') { playAllGames = true; winningThreshold = 2 } // Though threshold technically doesn't apply if we force play all, but we use it for checking 'finished' count
    if (match.mode === 'BO3') winningThreshold = 2
    if (match.mode === 'BO4') { playAllGames = true; winningThreshold = 4 }
    if (match.mode === 'BO5') winningThreshold = 3
    if (match.mode === 'BO7') winningThreshold = 4

    const finishedGamesCount = games.filter(g => g.winner).length

    const isMatchFinished =
        (playAllGames && finishedGamesCount === winningThreshold) ||
        (!playAllGames && (teamAScore >= winningThreshold || teamBScore >= winningThreshold))

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

    // Effect: Auto-finish match if criteria met
    useEffect(() => {
        if (isMatchFinished && match.status !== 'finished') {
            finishMatch(match.id).then(res => {
                if (res.success) {
                    console.log('Match automatically marked as finished')
                    router.refresh()
                }
            })
        }
    }, [isMatchFinished, match.status, match.id, router])

    const handleResetConfirm = async () => {
        if (!gameToReset) return
        await resetGame(gameToReset)
        setResetDialogOpen(false)
        setGameToReset(null)
    }

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

    // Get active game for header actions
    const activeGame = games.find(g => g.id === activeTab) // Fallback to null if not found

    const handleHeaderTogglePause = () => {
        if (draftRef.current) {
            draftRef.current.togglePause()
        }
    }

    const handleHeaderReset = () => {
        if (activeGame) {
            setGameToReset(activeGame.id)
            setResetDialogOpen(true)
        }
    }

    return (
        <div className={`flex flex-col ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-6rem)]'}`}>
            {/* Mobile Header Actions Portal */}
            {!isFullscreen && (
                <MobileHeaderActions>
                    <div className="flex items-center gap-1">
                        <Link href="/admin/simulator">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>

                        {/* Mobile Game Selector Popover */}
                        <Popover open={isGameMenuOpen} onOpenChange={setIsGameMenuOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-slate-400 hover:text-white"
                                >
                                    <Gamepad2 className="h-5 w-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2 bg-slate-900 border-slate-800 shadow-xl ml-2 mt-2" align="start" sideOffset={5}>
                                <TabsList className="flex flex-col h-auto bg-transparent items-stretch gap-1 w-[160px]">
                                    {seriesArray.map((num) => {
                                        const game = games.find(g => g.game_number === num)
                                        const isCreated = !!game
                                        if (!isCreated && isMatchFinished) return null

                                        const prevGame = games.find(g => g.game_number === num - 1)
                                        const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))
                                        const value = isCreated ? game.id : `new-${num}`

                                        return (
                                            <TabsTrigger
                                                key={num}
                                                value={value}
                                                disabled={isLocked}
                                                onClick={() => setIsGameMenuOpen(false)}
                                                className="w-full justify-start px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 hover:text-slate-200"
                                            >
                                                {isLocked ? <Lock className="w-3 h-3 mr-2 opacity-50" /> : null}
                                                Game {num}
                                            </TabsTrigger>
                                        )
                                    })}
                                    {isMatchFinished && (
                                        <TabsTrigger
                                            value="summary"
                                            onClick={() => setIsGameMenuOpen(false)}
                                            className="w-full justify-start px-4 py-2 text-yellow-500 data-[state=active]:bg-yellow-900/20 data-[state=active]:text-yellow-400"
                                        >
                                            <Trophy className="w-3 h-3 mr-2" />
                                            Summary
                                        </TabsTrigger>
                                    )}
                                </TabsList>
                            </PopoverContent>
                        </Popover>

                        {/* Mobile Scoreboard */}
                        <div className="flex items-center gap-2 mx-2">
                            <span className="text-[10px] font-bold text-blue-400 truncate max-w-[60px] text-right leading-tight">
                                {match.team_a_name}
                            </span>
                            <div className="flex items-center gap-1 font-mono font-bold text-xs bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                                <span className={teamAScore > teamBScore ? 'text-blue-400' : 'text-slate-200'}>{teamAScore}</span>
                                <span className="text-slate-600 text-[10px]">:</span>
                                <span className={teamBScore > teamAScore ? 'text-red-400' : 'text-slate-200'}>{teamBScore}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-300 truncate max-w-[60px] text-left leading-tight">
                                {match.team_b_name}
                            </span>
                        </div>

                        <div className="h-4 w-px bg-slate-800 mx-1" />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={() => {
                                const url = `${window.location.origin}/share/match/${match.slug || match.id}`
                                navigator.clipboard.writeText(url)
                                setIsMatchCopied(true)
                                setTimeout(() => setIsMatchCopied(false), 2000)
                            }}
                        >
                            {isMatchCopied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
                        </Button>

                        <div className="hidden sm:flex items-center gap-1">
                            <Badge variant="outline" className="bg-slate-900/50 border-slate-700 text-slate-400 font-mono text-xs">
                                Patch {match.version?.name || '1.60.1.10'}
                            </Badge>
                        </div>

                        <div className="h-4 w-px bg-slate-800 mx-1" />

                        {/* Controls - Only enable if game is active/created */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${!isDraftPaused ? 'text-green-400 hover:text-green-300' : 'text-slate-400 hover:text-white'}`}
                            onClick={handleHeaderTogglePause}
                            disabled={!activeGame}
                        >
                            {!isDraftPaused ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={handleHeaderReset}
                            disabled={!activeGame}
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={toggleFullscreen}
                        >
                            <Maximize2 className="h-4 w-4" />
                        </Button>
                    </div>
                </MobileHeaderActions>
            )}

            {/* Match Header - Hidden on Mobile (Default), Visible on Desktop */}
            {!isFullscreen && (
                <div className="hidden lg:flex shrink-0 bg-slate-900 border-b border-slate-800 p-4 items-center justify-between">
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

                        <div className="w-px h-4 bg-slate-800 mx-2" />

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200"
                            onClick={() => {
                                const url = `${window.location.origin}/share/match/${match.slug || match.id}`
                                navigator.clipboard.writeText(url)
                                // We can rely on a toast or button text change here.
                                // Since MatchRoom is a bigger component, let's use a simple alert or just changing text for a second?
                                // Actually, let's add a local state for 'isCopied' to this component to give feedback.
                                setIsMatchCopied(true)
                                setTimeout(() => setIsMatchCopied(false), 2000)
                            }}
                        >
                            {isMatchCopied ? <Check className="w-3.5 h-3.5 mr-2" /> : <Share2 className="w-3.5 h-3.5 mr-2" />}
                            {isMatchCopied ? 'Link Copied!' : 'Share Match'}
                        </Button>

                        <Badge variant="outline" className="h-8 px-3 border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                            Patch {match.version?.name}
                        </Badge>

                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => draftRef.current?.togglePause()}
                                className="h-8 w-8 hover:bg-slate-700 text-slate-300 hover:text-white"
                                title={isDraftPaused ? "Resume Draft" : "Pause Draft"}
                            >
                                {isDraftPaused ? <Play className="w-4 h-4 text-green-400 fill-green-400" /> : <Pause className="w-4 h-4" />}
                            </Button>

                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                    if (activeTab && !activeTab.startsWith('new-') && activeTab !== 'summary') {
                                        setGameToReset(activeTab)
                                        setResetDialogOpen(true)
                                    }
                                }}
                                className="h-8 w-8 hover:bg-slate-700 text-slate-400 hover:text-red-400"
                                title="Reset Game"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>

                            <div className="w-px h-4 bg-slate-700 mx-1" />

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
                </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col relative min-h-0">
                <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
                    <div className={`hidden md:flex shrink-0 border-b border-slate-800 bg-slate-900/50 items-center justify-between gap-4 overflow-x-auto custom-scrollbar active-scrollbar ${isFullscreen ? 'px-4 py-1' : 'px-6 py-2'}`}>
                        {/* Mobile Dropdown (Popover) - Moved to Header per user request */}

                        {/* Desktop Tabs List */}
                        <TabsList className="hidden md:flex bg-slate-800 text-slate-400 h-10 p-1 shrink-0">
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

                        {/* Mobile/Default Score Display - Moved to Header */}
                        {!isFullscreen && (
                            <div className="lg:mr-0 hidden lg:flex items-center gap-3 shrink-0 ml-auto mr-2">
                                <span className="text-xs font-bold text-blue-400 truncate max-w-[80px] sm:max-w-[120px] md:max-w-none text-right">
                                    {match.team_a_name}
                                </span>

                                <div className="flex items-center gap-2 font-mono font-bold text-sm bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm">
                                    <span className={teamAScore > teamBScore ? 'text-blue-400' : 'text-slate-200'}>{teamAScore}</span>
                                    <span className="text-slate-600 text-xs">:</span>
                                    <span className={teamBScore > teamAScore ? 'text-red-400' : 'text-slate-200'}>{teamBScore}</span>
                                </div>

                                <span className="text-xs font-bold text-slate-300 truncate max-w-[80px] sm:max-w-[120px] md:max-w-none text-left">
                                    {match.team_b_name}
                                </span>
                            </div>
                        )}

                        {/* Fullscreen Compact Match Info */}
                        {isFullscreen && (
                            <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-lg border border-slate-800/50 shadow-sm mx-auto absolute left-1/2 -translate-x-1/2 pointer-events-none">
                                <div className={`font-bold text-sm ${teamAScore > teamBScore ? 'text-blue-400' : 'text-slate-300'}`}>
                                    {match.team_a_name}
                                </div>
                                <div className="flex items-center gap-2 font-mono font-bold text-lg bg-black/40 px-3 py-0.5 rounded text-white">
                                    <span className={teamAScore > teamBScore ? 'text-blue-400' : 'text-white'}>{teamAScore}</span>
                                    <span className="text-slate-600 text-xs">:</span>
                                    <span className={teamBScore > teamAScore ? 'text-red-400' : 'text-white'}>{teamBScore}</span>
                                </div>
                                <div className={`font-bold text-sm ${teamBScore > teamAScore ? 'text-red-400' : 'text-slate-300'}`}>
                                    {match.team_b_name}
                                </div>
                            </div>
                        )}


                        {isFullscreen && (
                            <div className="flex items-center gap-1 ml-auto bg-slate-800 p-1 rounded-lg border border-slate-700">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => draftRef.current?.togglePause()}
                                    className="h-8 w-8 hover:bg-slate-700 text-slate-300 hover:text-white"
                                    title={isDraftPaused ? "Resume Draft" : "Pause Draft"}
                                >
                                    {isDraftPaused ? <Play className="w-4 h-4 text-green-400 fill-green-400" /> : <Pause className="w-4 h-4" />}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                        if (activeTab && !activeTab.startsWith('new-') && activeTab !== 'summary') {
                                            setGameToReset(activeTab)
                                            setResetDialogOpen(true)
                                        }
                                    }}
                                    className="h-8 w-8 hover:bg-slate-700 text-slate-400 hover:text-red-400"
                                    title="Reset Game"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </Button>

                                <div className="w-px h-4 bg-slate-700 mx-1" />

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

                            const value = isCreated ? game.id : `new-${num}`

                            const prevGame = games.find(g => g.game_number === num - 1)
                            const isLocked = !isCreated && (num > 1 && (!prevGame || !prevGame.winner))

                            // Calculate Global Bans for this game number
                            const teamAGlobalBans = getGlobalUsedHeroes(match.team_a_name, num)
                            const teamBGlobalBans = getGlobalUsedHeroes(match.team_b_name, num)

                            return (
                                <TabsContent key={num} value={value} className="absolute inset-0 m-0 data-[state=active]:flex flex-col p-0">
                                    {isCreated ? (
                                        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
                                            <DraftInterface
                                                ref={activeTab === value ? draftRef : undefined}
                                                match={match}
                                                game={game}
                                                initialHeroes={heroes}
                                                teamAGlobalBans={teamAGlobalBans}
                                                teamBGlobalBans={teamBGlobalBans}
                                                onReset={() => {
                                                    setGameToReset(game.id)
                                                    setResetDialogOpen(true)
                                                }}
                                                onPausedChange={setIsDraftPaused}
                                            />
                                        </div>
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

            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-400 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Reset Game?
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Are you sure you want to reset this game? This will:
                            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                                <li>Delete all picks and bans for this game</li>
                                <li>Allow you to re-select Blue/Red sides</li>
                                <li>Restart the draft timer</li>
                            </ul>
                            <p className="mt-4 text-xs text-slate-500">This action cannot be undone.</p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setResetDialogOpen(false)} className="text-slate-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleResetConfirm} className="bg-red-600 hover:bg-red-700 text-white">
                            Reset Game
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
