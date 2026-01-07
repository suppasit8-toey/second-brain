import { useState, useEffect } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import { Trophy, ShieldBan, Crown, Brain, Zap, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getMatchAnalysis } from '../actions'

interface MatchSummaryProps {
    match: DraftMatch;
    games: DraftGame[];
    heroes: Hero[];
}

export default function MatchSummary({ match, games, heroes }: MatchSummaryProps) {
    // Helper to get hero
    const getHero = (id: string | undefined) => heroes.find(h => h.id === id)

    // State for Analysis
    const [activeTab, setActiveTab] = useState('overview')
    const [analysisData, setAnalysisData] = useState<{
        laneAnalysis?: Record<string, any[]>;
        comboAnalysis?: Record<string, { blue: any[], red: any[] }>;
        keyPlayerAnalysis?: Record<string, { blue: any[], red: any[] }>;
    } | null>(null)

    useEffect(() => {
        const loadAnalysis = async () => {
            const data = await getMatchAnalysis(match.id)
            if (data) setAnalysisData(data)
        }
        loadAnalysis()
    }, [match.id])

    // Calculate Score
    const teamAScore = games.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_a_name) || (g.winner === 'Red' && g.red_team_name === match.team_a_name)).length
    const teamBScore = games.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_b_name) || (g.winner === 'Red' && g.red_team_name === match.team_b_name)).length

    // Logic: Who won?
    let winnerName = 'Draw'
    let winnerColor = 'text-slate-400'
    const winningThreshold = { 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4, 'BO2': 2 }[match.mode] || 1

    if (match.mode === 'BO2') {
        if (teamAScore > teamBScore) { winnerName = match.team_a_name; winnerColor = 'text-blue-400' }
        else if (teamBScore > teamAScore) { winnerName = match.team_b_name; winnerColor = 'text-red-400' }
        else { winnerName = 'Draw'; winnerColor = 'text-yellow-400' }
    } else {
        if (teamAScore > teamBScore) { winnerName = match.team_a_name; winnerColor = 'text-blue-400' }
        else { winnerName = match.team_b_name; winnerColor = 'text-red-400' }
    }

    return (

        <div className="h-full overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-5xl mx-auto space-y-8 pb-20">

                {/* 1. Header & Winner */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-8 bg-slate-900/80 border border-slate-700 rounded-3xl shadow-2xl">
                        <Trophy className={`w-16 h-16 mr-6 ${winnerName === 'Draw' ? 'text-yellow-500' : winnerColor}`} />
                        <div>
                            <h2 className="text-lg text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">Series Result</h2>
                            <div className="text-4xl font-black text-white flex items-center justify-center gap-8">
                                <span className={teamAScore > teamBScore ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'text-slate-600'}>{match.team_a_name}</span>
                                <span className="text-7xl font-mono text-slate-200">{teamAScore} - {teamBScore}</span>
                                <span className={teamBScore > teamAScore ? 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]' : 'text-slate-600'}>{match.team_b_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Tabs: Overview & Analysis */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex justify-center mb-6">
                        <TabsList className="grid w-[400px] grid-cols-2 bg-slate-800">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="analysis" className="gap-2">
                                <Brain className="w-4 h-4" />
                                AI Analysis
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-bold text-white text-center uppercase tracking-widest border-b border-slate-800 pb-2">Match History</h3>

                        {games.sort((a, b) => a.game_number - b.game_number).map((game) => {
                            const isBlueA = game.blue_team_name === match.team_a_name
                            const winningTeamName = game.winner === 'Blue' ? game.blue_team_name : game.red_team_name
                            const winnerColorClass = game.winner === 'Blue' ? 'text-blue-400' : 'text-red-400'

                            // Picks & Bans processing
                            const picks = game.picks || []
                            const blueBans = picks.filter(p => p.type === 'BAN' && p.side === 'BLUE').map(p => p.hero_id)
                            const redBans = picks.filter(p => p.type === 'BAN' && p.side === 'RED').map(p => p.hero_id)
                            const bluePicks = picks.filter(p => p.type === 'PICK' && p.side === 'BLUE').sort((a, b) => a.position_index - b.position_index)
                            const redPicks = picks.filter(p => p.type === 'PICK' && p.side === 'RED').sort((a, b) => a.position_index - b.position_index)

                            const getRoleLabel = (role?: string) => {
                                if (!role) return '?'
                                const map: Record<string, string> = {
                                    'Dark Slayer': 'DS',
                                    'Jungle': 'JG',
                                    'Mid': 'MID',
                                    'Abyssal': 'AD', // or ADV/ADC
                                    'Roam': 'SP'
                                }
                                return map[role] || role.substring(0, 2).toUpperCase()
                            }

                            return (
                                <Card key={game.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                                    <CardHeader className="bg-slate-950 py-3 px-6 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline">Game {game.game_number}</Badge>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-sm">Winner:</span>
                                                <span className={`font-black uppercase ${winnerColorClass}`}>{winningTeamName}</span>
                                            </div>
                                        </div>
                                        {/* Key Players */}
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-blue-400">Blue MVP</span>
                                                {game.blue_key_player_id && (
                                                    <div className="relative w-8 h-8 rounded border border-blue-500/50 overflow-hidden" title={getHero(game.blue_key_player_id)?.name}>
                                                        <Image src={getHero(game.blue_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-red-400">Red MVP</span>
                                                {game.red_key_player_id && (
                                                    <div className="relative w-8 h-8 rounded border border-red-500/50 overflow-hidden" title={getHero(game.red_key_player_id)?.name}>
                                                        <Image src={getHero(game.red_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                                        {/* VS Badge */}
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-slate-800 text-4xl select-none z-0 opacity-20">VS</div>

                                        {/* BLUE SIDE */}
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold text-blue-400">{game.blue_team_name}</h4>
                                                <div className="flex gap-1">
                                                    {blueBans.map((bid, i) => (
                                                        <div key={i} className="w-10 h-10 border border-slate-700 rounded overflow-hidden relative grayscale opacity-70">
                                                            <Image src={getHero(bid)?.icon_url || ''} alt="ban" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {bluePicks.map((pick, i) => (
                                                    <div key={i} className="flex-1 aspect-square rounded overflow-hidden relative border border-blue-500/30 group">
                                                        <Image src={getHero(pick.hero_id)?.icon_url || ''} alt="pick" fill className="object-cover" />
                                                        <div className="absolute bottom-0 inset-x-0 bg-blue-900/80 text-[8px] font-bold text-white text-center py-0.5">
                                                            {getRoleLabel(pick.assigned_role)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* RED SIDE */}
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex gap-1">
                                                    {redBans.map((bid, i) => (
                                                        <div key={i} className="w-10 h-10 border border-slate-700 rounded overflow-hidden relative grayscale opacity-70">
                                                            <Image src={getHero(bid)?.icon_url || ''} alt="ban" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <h4 className="font-bold text-red-400">{game.red_team_name}</h4>
                                            </div>
                                            <div className="flex gap-1">
                                                {redPicks.map((pick, i) => (
                                                    <div key={i} className="flex-1 aspect-square rounded overflow-hidden relative border border-red-500/30 group">
                                                        <Image src={getHero(pick.hero_id)?.icon_url || ''} alt="pick" fill className="object-cover" />
                                                        <div className="absolute bottom-0 inset-x-0 bg-red-900/80 text-[8px] font-bold text-white text-center py-0.5">
                                                            {getRoleLabel(pick.assigned_role)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        {!analysisData ? (
                            <div className="text-center p-12 text-slate-500">
                                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50 animate-pulse" />
                                <p>Analyzing Match Data...</p>
                            </div>
                        ) : (
                            games.sort((a, b) => a.game_number - b.game_number).map((game) => {
                                const lanes = analysisData.laneAnalysis?.[game.id] || []
                                const combos = analysisData.comboAnalysis?.[game.id] || { blue: [], red: [] }

                                return (
                                    <div key={game.id} className="space-y-4">
                                        <div className="flex items-center gap-4 border-b border-slate-800 pb-2">
                                            <Badge variant="outline" className="bg-slate-900">Game {game.game_number}</Badge>
                                            <h3 className="text-lg font-bold text-slate-300">Strategic Analysis</h3>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Lane Matchups */}
                                            <Card className="bg-slate-900/50 border-slate-800">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                        <Swords className="w-4 h-4" />
                                                        Lane Matchups
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    {lanes.length === 0 ? (
                                                        <p className="text-xs text-slate-600 italic">No lane data available</p>
                                                    ) : (
                                                        lanes.map((lane, i) => {
                                                            const blueHero = getHero(lane.blueHeroId)
                                                            const redHero = getHero(lane.redHeroId)
                                                            return (
                                                                <div key={i} className="flex items-center gap-4 text-xs">
                                                                    <div className="w-8 shrink-0 text-right font-bold text-slate-500">{lane.role.substring(0, 2).toUpperCase()}</div>

                                                                    <div className="flex-1 flex items-center gap-2 relative h-8 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                                                        {/* Blue Side */}
                                                                        <div className="absolute left-0 top-0 bottom-0 flex items-center pl-2 gap-2 z-10">
                                                                            <div className="w-6 h-6 relative rounded-full overflow-hidden border border-blue-500/50">
                                                                                <Image src={blueHero?.icon_url || ''} alt="Blue" fill className="object-cover" />
                                                                            </div>
                                                                            <span className={`font-bold ${lane.winRate > 50 ? 'text-blue-400' : 'text-slate-500'}`}>
                                                                                {Math.round(lane.winRate)}%
                                                                            </span>
                                                                        </div>

                                                                        {/* Bar */}
                                                                        <div
                                                                            className="h-full bg-blue-900/30 transition-all"
                                                                            style={{ width: `${lane.winRate}%` }}
                                                                        />
                                                                        <div
                                                                            className="h-full bg-red-900/30 transition-all flex-1"
                                                                        />

                                                                        {/* Red Side */}
                                                                        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 gap-2 z-10 flex-row-reverse">
                                                                            <div className="w-6 h-6 relative rounded-full overflow-hidden border border-red-500/50">
                                                                                <Image src={redHero?.icon_url || ''} alt="Red" fill className="object-cover" />
                                                                            </div>
                                                                            <span className={`font-bold ${lane.winRate < 50 ? 'text-red-400' : 'text-slate-500'}`}>
                                                                                {100 - Math.round(lane.winRate)}%
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </CardContent>
                                            </Card>

                                            {/* Combos */}
                                            <Card className="bg-slate-900/50 border-slate-800">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                        <Zap className="w-4 h-4" />
                                                        Synergy Detection
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-6">
                                                    {/* Blue Combos */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase">Blue Team Synergies</h4>
                                                        {combos.blue.length === 0 ? (
                                                            <p className="text-xs text-slate-600">No known combos detected.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {combos.blue.map((c: any, i: number) => (
                                                                    <div key={i} className="bg-blue-950/20 rounded p-2 border border-blue-900/30 flex items-center gap-3">
                                                                        <div className="flex -space-x-2">
                                                                            <div className="w-8 h-8 rounded-full border border-blue-500/30 relative overflow-hidden bg-slate-900">
                                                                                <Image src={c.hero_a.icon_url || ''} alt="A" fill className="object-cover" />
                                                                            </div>
                                                                            <div className="w-8 h-8 rounded-full border border-blue-500/30 relative overflow-hidden bg-slate-900">
                                                                                <Image src={c.hero_b.icon_url || ''} alt="B" fill className="object-cover" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs font-bold text-slate-300 truncate">{c.description || 'Synergy Pair'}</div>
                                                                            <div className="text-[10px] text-blue-300/70">Synergy Score: {c.synergy_score}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Red Combos */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-red-400 mb-2 uppercase">Red Team Synergies</h4>
                                                        {combos.red.length === 0 ? (
                                                            <p className="text-xs text-slate-600">No known combos detected.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {combos.red.map((c: any, i: number) => (
                                                                    <div key={i} className="bg-red-950/20 rounded p-2 border border-red-900/30 flex items-center gap-3">
                                                                        <div className="flex -space-x-2">
                                                                            <div className="w-8 h-8 rounded-full border border-red-500/30 relative overflow-hidden bg-slate-900">
                                                                                <Image src={c.hero_a.icon_url || ''} alt="A" fill className="object-cover" />
                                                                            </div>
                                                                            <div className="w-8 h-8 rounded-full border border-red-500/30 relative overflow-hidden bg-slate-900">
                                                                                <Image src={c.hero_b.icon_url || ''} alt="B" fill className="object-cover" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs font-bold text-slate-300 truncate">{c.description || 'Synergy Pair'}</div>
                                                                            <div className="text-[10px] text-red-300/70">Synergy Score: {c.synergy_score}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Key Player Analysis */}
                                        <Card className="bg-slate-900/50 border-slate-800">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                    <Crown className="w-4 h-4 text-yellow-500" />
                                                    MVP Win Rate Analysis
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    {/* Blue MVP Analysis */}
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="text-xs font-bold text-blue-400 uppercase">Blue MVP vs Enemy</div>
                                                            {game.blue_key_player_id && (
                                                                <div className="relative w-6 h-6 rounded border border-blue-500/50 overflow-hidden">
                                                                    <Image src={getHero(game.blue_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {analysisData.keyPlayerAnalysis?.[game.id]?.blue?.map((stat: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs bg-slate-950/30 p-1.5 rounded border border-slate-800/50">
                                                                    <div className="relative w-5 h-5 rounded overflow-hidden opacity-80">
                                                                        <Image src={getHero(stat.enemyHeroId)?.icon_url || ''} alt="enemy" fill className="object-cover" />
                                                                    </div>
                                                                    <div className="flex-1 flex items-center justify-between">
                                                                        <span className="text-slate-400 text-[10px]">{getHero(stat.enemyHeroId)?.name}</span>
                                                                        <Badge variant="outline" className={`${stat.winRate >= 50 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'} h-5 text-[10px]`}>
                                                                            {stat.winRate}% WR
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {(!analysisData.keyPlayerAnalysis?.[game.id]?.blue?.length) && <p className="text-slate-600 text-xs italic">No data vs opponents</p>}
                                                        </div>
                                                    </div>

                                                    {/* Red MVP Analysis */}
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="text-xs font-bold text-red-400 uppercase">Red MVP vs Enemy</div>
                                                            {game.red_key_player_id && (
                                                                <div className="relative w-6 h-6 rounded border border-red-500/50 overflow-hidden">
                                                                    <Image src={getHero(game.red_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {analysisData.keyPlayerAnalysis?.[game.id]?.red?.map((stat: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs bg-slate-950/30 p-1.5 rounded border border-slate-800/50">
                                                                    <div className="relative w-5 h-5 rounded overflow-hidden opacity-80">
                                                                        <Image src={getHero(stat.enemyHeroId)?.icon_url || ''} alt="enemy" fill className="object-cover" />
                                                                    </div>
                                                                    <div className="flex-1 flex items-center justify-between">
                                                                        <span className="text-slate-400 text-[10px]">{getHero(stat.enemyHeroId)?.name}</span>
                                                                        <Badge variant="outline" className={`${stat.winRate >= 50 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'} h-5 text-[10px]`}>
                                                                            {stat.winRate}% WR
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {(!analysisData.keyPlayerAnalysis?.[game.id]?.red?.length) && <p className="text-slate-600 text-xs italic">No data vs opponents</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )
                            })
                        )}
                    </TabsContent>
                </Tabs>

            </div>
        </div>
    )
}
