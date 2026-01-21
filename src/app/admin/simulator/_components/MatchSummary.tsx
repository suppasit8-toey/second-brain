import { useState, useEffect } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import { Trophy, ShieldBan, Crown, Brain, Zap, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { getMatchAnalysis, updateGameMVP } from '../actions'
import { Edit2, Check, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
    const [editingMVP, setEditingMVP] = useState<{ gameId: string, side: 'blue' | 'red' } | null>(null)
    const [tempMVP, setTempMVP] = useState<string>("")

    const handleStartEdit = (gameId: string, side: 'blue' | 'red', currentId: string | undefined) => {
        setEditingMVP({ gameId, side })
        setTempMVP(currentId || "")
    }

    const handleSaveMVP = async () => {
        if (!editingMVP) return
        await updateGameMVP(editingMVP.gameId, editingMVP.side, tempMVP)
        setEditingMVP(null)
        setTempMVP("")
    }

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
                    <div className="inline-flex flex-col md:flex-row items-center justify-center p-4 md:p-8 bg-slate-900/80 border border-slate-700 rounded-3xl shadow-2xl w-full md:w-auto">
                        <Trophy className={`w-12 h-12 md:w-16 md:h-16 mb-4 md:mb-0 md:mr-6 ${winnerName === 'Draw' ? 'text-yellow-500' : winnerColor}`} />
                        <div className="flex flex-col items-center">
                            <h2 className="text-sm md:text-lg text-slate-500 font-bold uppercase tracking-[0.2em] mb-2 md:mb-4">Series Result</h2>
                            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-8">
                                <span className={`text-xl md:text-4xl font-black text-center ${teamAScore > teamBScore ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'text-slate-600'}`}>{match.team_a_name}</span>
                                <span className="text-5xl md:text-7xl font-mono text-slate-200 my-2 md:my-0">{teamAScore} - {teamBScore}</span>
                                <span className={`text-xl md:text-4xl font-black text-center ${teamBScore > teamAScore ? 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]' : 'text-slate-600'}`}>{match.team_b_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Tabs: Overview & Analysis */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex justify-center mb-6">
                        <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-slate-800">
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
                            const gameBans = picks.filter(p => p.type === 'BAN').sort((a, b) => (a.position_index || 0) - (b.position_index || 0))
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
                                    <CardHeader className="bg-slate-950 py-3 px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
                                        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
                                            <Badge variant="outline" className="w-fit mx-auto md:mx-0">Game {game.game_number}</Badge>
                                            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                                                <span className="text-slate-400 text-sm">Winner:</span>
                                                <span className={`font-black uppercase text-sm md:text-base ${winnerColorClass}`}>{winningTeamName}</span>
                                            </div>
                                        </div>
                                        {/* Key Players */}
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-blue-400">Blue MVP</span>
                                                <Dialog open={editingMVP?.gameId === game.id && editingMVP.side === 'blue'} onOpenChange={(open) => !open && setEditingMVP(null)}>
                                                    <DialogTrigger asChild>
                                                        <div
                                                            onClick={() => handleStartEdit(game.id, 'blue', game.blue_key_player_id)}
                                                            className="group relative cursor-pointer hover:scale-105 transition-all active:scale-95"
                                                        >
                                                            {game.blue_key_player_id ? (
                                                                <div className="relative w-8 h-8 rounded border border-blue-500/50 overflow-hidden ring-offset-1 ring-offset-slate-950 group-hover:ring-2 group-hover:ring-blue-400 transition-all" title={getHero(game.blue_key_player_id)?.name}>
                                                                    <Image src={getHero(game.blue_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                                    {/* Hover Overlay */}
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                                                                        <Edit2 className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded border border-blue-500/20 bg-blue-500/5 flex items-center justify-center group-hover:bg-blue-500/10 group-hover:border-blue-400/50 transition-all">
                                                                    <Plus className="w-4 h-4 text-blue-500/50 group-hover:text-blue-400 transition-colors" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-md bg-slate-950 border-slate-800">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-blue-400">Select Blue Team MVP</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="flex flex-wrap gap-4 justify-center py-4">
                                                            {bluePicks.map(p => {
                                                                const h = getHero(p.hero_id)
                                                                if (!h) return null
                                                                const isSelected = tempMVP === h.id
                                                                return (
                                                                    <button
                                                                        key={h.id}
                                                                        onClick={() => setTempMVP(h.id)}
                                                                        className={cn(
                                                                            "relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all hover:scale-105",
                                                                            isSelected ? "border-blue-400 ring-2 ring-blue-500/50 scale-105 shadow-[0_0_20px_rgba(96,165,250,0.5)]" : "border-slate-800 opacity-60 hover:opacity-100 grayscale hover:grayscale-0"
                                                                        )}
                                                                        title={h.name}
                                                                    >
                                                                        <Image src={h.icon_url} alt={h.name} fill className="object-cover" />
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                        <DialogFooter>
                                                            <Button onClick={handleSaveMVP} className="w-full bg-blue-600 hover:bg-blue-700">Save MVP</Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-red-400">Red MVP</span>
                                                <Dialog open={editingMVP?.gameId === game.id && editingMVP.side === 'red'} onOpenChange={(open) => !open && setEditingMVP(null)}>
                                                    <DialogTrigger asChild>
                                                        <div
                                                            onClick={() => handleStartEdit(game.id, 'red', game.red_key_player_id)}
                                                            className="group relative cursor-pointer hover:scale-105 transition-all active:scale-95"
                                                        >
                                                            {game.red_key_player_id ? (
                                                                <div className="relative w-8 h-8 rounded border border-red-500/50 overflow-hidden ring-offset-1 ring-offset-slate-950 group-hover:ring-2 group-hover:ring-red-400 transition-all" title={getHero(game.red_key_player_id)?.name}>
                                                                    <Image src={getHero(game.red_key_player_id)?.icon_url || ''} alt="MVP" fill className="object-cover" />
                                                                    {/* Hover Overlay */}
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                                                                        <Edit2 className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded border border-red-500/20 bg-red-500/5 flex items-center justify-center group-hover:bg-red-500/10 group-hover:border-red-400/50 transition-all">
                                                                    <Plus className="w-4 h-4 text-red-500/50 group-hover:text-red-400 transition-colors" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-md bg-slate-950 border-slate-800">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-red-400">Select Red Team MVP</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="flex flex-wrap gap-4 justify-center py-4">
                                                            {redPicks.map(p => {
                                                                const h = getHero(p.hero_id)
                                                                if (!h) return null
                                                                const isSelected = tempMVP === h.id
                                                                return (
                                                                    <button
                                                                        key={h.id}
                                                                        onClick={() => setTempMVP(h.id)}
                                                                        className={cn(
                                                                            "relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all hover:scale-105",
                                                                            isSelected ? "border-red-400 ring-2 ring-red-500/50 scale-105 shadow-[0_0_20px_rgba(248,113,113,0.5)]" : "border-slate-800 opacity-60 hover:opacity-100 grayscale hover:grayscale-0"
                                                                        )}
                                                                        title={h.name}
                                                                    >
                                                                        <Image src={h.icon_url} alt={h.name} fill className="object-cover" />
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                        <DialogFooter>
                                                            <Button onClick={handleSaveMVP} className="w-full bg-red-600 hover:bg-red-700">Save MVP</Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-2 md:p-4 space-y-6 relative">
                                        {/* VS Badge (Hidden on mobile) */}
                                        <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-slate-800 text-4xl select-none z-0 opacity-10">VS</div>

                                        <div className="grid grid-cols-2 gap-2 md:gap-12 relative">
                                            {/* BLUE TEAM SECTION */}
                                            <div className="space-y-2 md:space-y-6 relative z-10">
                                                <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-3 mb-1 md:mb-2">
                                                    <div className="w-full h-1 md:w-1.5 md:h-6 bg-blue-500 rounded-full" />
                                                    <h4 className="font-bold text-xs md:text-lg text-blue-400 truncate w-full">{game.blue_team_name}</h4>
                                                </div>

                                                {/* Blue Phase 1 */}
                                                <div className="bg-slate-950/40 p-1.5 md:p-3 rounded-lg border border-blue-500/10 space-y-1 md:space-y-3">
                                                    <div className="flex justify-between items-center px-0.5 md:px-1">
                                                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-500/60">Phase 1</span>
                                                    </div>
                                                    <div className="flex flex-col md:flex-row gap-1 md:gap-4">
                                                        {/* Blue Phase 1 Bans */}
                                                        <div className="flex gap-1">
                                                            {[1, 3].map(idx => {
                                                                const ban = gameBans.find(b => b.position_index === idx);
                                                                const hero = ban ? getHero(ban.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`w-6 h-6 md:w-10 md:h-10 border rounded overflow-hidden relative grayscale opacity-60 ${ban ? 'border-slate-700' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="ban" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] md:text-[10px] text-slate-700">?</div>}
                                                                        <div className="absolute top-0 right-0 bg-blue-600 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="hidden md:block w-px h-10 bg-white/5" />
                                                        {/* Blue Phase 1 Picks */}
                                                        <div className="flex gap-1 flex-1">
                                                            {[5, 8, 9].map(idx => {
                                                                const pick = picks.find(p => p.type === 'PICK' && p.position_index === idx);
                                                                const hero = pick ? getHero(pick.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`flex-1 aspect-square rounded overflow-hidden relative border ${pick ? 'border-blue-500/40' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="pick" fill className="object-cover" /> : null}
                                                                        <div className="absolute top-0 right-0 bg-blue-600/80 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                        {pick && (
                                                                            <div className="hidden md:block absolute bottom-0 inset-x-0 bg-blue-900/90 text-[8px] font-bold text-white text-center py-0.5 pointer-events-none">
                                                                                {getRoleLabel(pick.assigned_role)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Blue Phase 2 */}
                                                <div className="bg-slate-950/40 p-1.5 md:p-3 rounded-lg border border-blue-500/10 space-y-1 md:space-y-3">
                                                    <div className="flex justify-between items-center px-0.5 md:px-1">
                                                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-500/60">Phase 2</span>
                                                    </div>
                                                    <div className="flex flex-col md:flex-row gap-1 md:gap-4">
                                                        {/* Blue Phase 2 Bans */}
                                                        <div className="flex gap-1">
                                                            {[12, 14].map(idx => {
                                                                const ban = gameBans.find(b => b.position_index === idx);
                                                                const hero = ban ? getHero(ban.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`w-6 h-6 md:w-10 md:h-10 border rounded overflow-hidden relative grayscale opacity-60 ${ban ? 'border-slate-700' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="ban" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] md:text-[10px] text-slate-700">?</div>}
                                                                        <div className="absolute top-0 right-0 bg-blue-600 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="hidden md:block w-px h-10 bg-white/5" />
                                                        {/* Blue Phase 2 Picks */}
                                                        <div className="flex gap-1 flex-1">
                                                            {[16, 17].map(idx => {
                                                                const pick = picks.find(p => p.type === 'PICK' && p.position_index === idx);
                                                                const hero = pick ? getHero(pick.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`flex-1 aspect-square rounded overflow-hidden relative border ${pick ? 'border-blue-500/40' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="pick" fill className="object-cover" /> : null}
                                                                        <div className="absolute top-0 right-0 bg-blue-600/80 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                        {pick && (
                                                                            <div className="hidden md:block absolute bottom-0 inset-x-0 bg-blue-900/90 text-[8px] font-bold text-white text-center py-0.5 pointer-events-none">
                                                                                {getRoleLabel(pick.assigned_role)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className="flex-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* RED TEAM SECTION */}
                                            <div className="space-y-2 md:space-y-6 relative z-10">
                                                <div className="flex flex-col md:flex-row items-end md:items-center justify-end gap-1 md:gap-3 mb-1 md:mb-2 text-right">
                                                    <h4 className="font-bold text-xs md:text-lg text-red-400 truncate w-full">{game.red_team_name}</h4>
                                                    <div className="w-full h-1 md:w-1.5 md:h-6 bg-red-500 rounded-full" />
                                                </div>

                                                {/* Red Phase 1 */}
                                                <div className="bg-slate-950/40 p-1.5 md:p-3 rounded-lg border border-red-500/10 space-y-1 md:space-y-3">
                                                    <div className="flex justify-between items-center px-0.5 md:px-1">
                                                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-red-500/60">Phase 1</span>
                                                    </div>
                                                    <div className="flex flex-col-reverse md:flex-row gap-1 md:gap-4 direction-rtl">
                                                        <div className="flex gap-1 flex-1">
                                                            {[6, 7, 10].map(idx => {
                                                                const pick = picks.find(p => p.type === 'PICK' && p.position_index === idx);
                                                                const hero = pick ? getHero(pick.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`flex-1 aspect-square rounded overflow-hidden relative border ${pick ? 'border-red-500/40' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="pick" fill className="object-cover" /> : null}
                                                                        <div className="absolute top-0 right-0 bg-red-600/80 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                        {pick && (
                                                                            <div className="hidden md:block absolute bottom-0 inset-x-0 bg-red-900/90 text-[8px] font-bold text-white text-center py-0.5 pointer-events-none">
                                                                                {getRoleLabel(pick.assigned_role)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="hidden md:block w-px h-10 bg-white/5" />
                                                        <div className="flex gap-1 justify-end">
                                                            {[2, 4].map(idx => {
                                                                const ban = gameBans.find(b => b.position_index === idx);
                                                                const hero = ban ? getHero(ban.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`w-6 h-6 md:w-10 md:h-10 border rounded overflow-hidden relative grayscale opacity-60 ${ban ? 'border-slate-700' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="ban" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] md:text-[10px] text-slate-700">?</div>}
                                                                        <div className="absolute top-0 right-0 bg-red-600 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Red Phase 2 */}
                                                <div className="bg-slate-950/40 p-1.5 md:p-3 rounded-lg border border-red-500/10 space-y-1 md:space-y-3">
                                                    <div className="flex justify-between items-center px-0.5 md:px-1">
                                                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-red-500/60">Phase 2</span>
                                                    </div>
                                                    <div className="flex flex-col-reverse md:flex-row gap-1 md:gap-4 direction-rtl">
                                                        <div className="flex gap-1 flex-1">
                                                            {[15, 18].map(idx => {
                                                                const pick = picks.find(p => p.type === 'PICK' && p.position_index === idx);
                                                                const hero = pick ? getHero(pick.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`flex-1 aspect-square rounded overflow-hidden relative border ${pick ? 'border-red-500/40' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="pick" fill className="object-cover" /> : null}
                                                                        <div className="absolute top-0 right-0 bg-red-600/80 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                        {pick && (
                                                                            <div className="hidden md:block absolute bottom-0 inset-x-0 bg-red-900/90 text-[8px] font-bold text-white text-center py-0.5 pointer-events-none">
                                                                                {getRoleLabel(pick.assigned_role)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className="flex-1" />
                                                        </div>
                                                        <div className="hidden md:block w-px h-10 bg-white/5" />
                                                        <div className="flex gap-1 justify-end">
                                                            {[11, 13].map(idx => {
                                                                const ban = gameBans.find(b => b.position_index === idx);
                                                                const hero = ban ? getHero(ban.hero_id) : null;
                                                                return (
                                                                    <div key={idx} className={`w-6 h-6 md:w-10 md:h-10 border rounded overflow-hidden relative grayscale opacity-60 ${ban ? 'border-slate-700' : 'border-slate-800 bg-slate-900/50'}`}>
                                                                        {hero ? <Image src={hero.icon_url || ''} alt="ban" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] md:text-[10px] text-slate-700">?</div>}
                                                                        <div className="absolute top-0 right-0 bg-red-600 w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white">{idx}</div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
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
