'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DraftMatch, Hero } from '@/utils/types'
import { Loader2, ShieldCheck, Trophy, Skull, Swords, AlertTriangle, TrendingUp, ArrowRight, Users, Ban, ListOrdered } from 'lucide-react'
import { getWinConditions } from '@/app/admin/win-conditions/actions'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import { getTeamHeroPoolStats, getEnemyFirstPickStats, getEnemyCounterPickStats } from '@/app/admin/scrims/actions'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PreGameAnalysisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: DraftMatch;
    gameNumber: number;
    onProceed: () => void;
}

export default function PreGameAnalysisDialog({ open, onOpenChange, match, gameNumber, onProceed }: PreGameAnalysisDialogProps) {
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(true)
    const [blueSide, setBlueSide] = useState<string>(match.team_a_name)
    const [winConditions, setWinConditions] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState('team-pool')
    const [heroMap, setHeroMap] = useState<Map<string, Hero>>(new Map())
    const [heroes, setHeroes] = useState<Hero[]>([])
    const [teamStats, setTeamStats] = useState<any[]>([])
    const [firstPickStats, setFirstPickStats] = useState<{ totalGames: number, picks: any[] }>({ totalGames: 0, picks: [] })
    const [counterStats, setCounterStats] = useState<any[]>([])

    // Determine "Us" vs "Enemy" based on selected Blue Side
    const [perspectiveTeam, setPerspectiveTeam] = useState<string>(match.team_a_name)
    const enemyTeam = perspectiveTeam === match.team_a_name ? match.team_b_name : match.team_a_name

    useEffect(() => {
        if (open) {
            setAnalyzing(true)
            const fetchData = async () => {
                // Normalize team name (remove " (Bot)" suffix) to find real stats
                const searchTeam = perspectiveTeam.replace(/\s*\(Bot\)$/i, '')
                const searchEnemy = enemyTeam.replace(/\s*\(Bot\)$/i, '')

                const [conditions, heroesData, stats, fpStats, counters] = await Promise.all([
                    getWinConditions(),
                    getHeroesByVersion(match.version_id),
                    getTeamHeroPoolStats(searchTeam),
                    getEnemyFirstPickStats(searchEnemy), // Fetch for the ENEMY team
                    getEnemyCounterPickStats(searchEnemy)
                ])
                setWinConditions(conditions || [])
                setTeamStats(stats || [])
                setFirstPickStats(fpStats || { totalGames: 0, picks: [] })
                setCounterStats(counters || [])

                // Build hero map
                const map = new Map<string, Hero>()
                const heroList: Hero[] = []
                if (Array.isArray(heroesData)) {
                    heroesData.forEach((h: any) => {
                        map.set(h.id, h)
                        heroList.push(h)
                    })
                }
                setHeroMap(map)
                setHeroes(heroList)

                setAnalyzing(false)
            }
            fetchData()
        }
    }, [open, match.version_id, perspectiveTeam])

    // Filter relevant win conditions
    const relevantAllyConditions = winConditions.filter(c => {
        return c.result && c.result.winRate > 55
    })

    // Calculate Global Ban / Played Heroes for the perspective team
    // Global Ban Pick: Heroes played by the team in previous games are UNAVAILABLE.
    const getUsedHeroIds = (teamName: string) => {
        const usedIds = new Set<string>()
        if (match.games) {
            match.games.forEach(game => {
                // Only count previous games
                if (game.game_number < gameNumber) {
                    // Check which side the team was on
                    const isBlue = game.blue_team_name === teamName
                    const isRed = game.red_team_name === teamName

                    if ((isBlue || isRed) && game.picks) {
                        const side = isBlue ? 'BLUE' : 'RED'
                        game.picks.forEach(pick => {
                            if (pick.side === side && pick.type === 'PICK') {
                                usedIds.add(pick.hero_id)
                            }
                        })
                    }
                }
            })
        }
        return usedIds
    }

    const usedHeroIds = getUsedHeroIds(perspectiveTeam)

    // Group Available Heroes by Role
    const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

    // Helper to categorize
    const getHeroesByRole = (role: string, available: boolean) => {
        return heroes.filter(h => {
            const isUsed = usedHeroIds.has(h.id)
            const matchRole = h.main_position.includes(role)
            return available ? (!isUsed && matchRole) : (isUsed && matchRole)
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-screen h-screen max-w-none rounded-none bg-[#0B1120] border-none text-white flex flex-col p-0 gap-0">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 backdrop-blur-md z-20 relative">
                    <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                        <Swords className="w-6 h-6 text-indigo-400" />
                        Pre-Game Analysis
                        <span className="text-slate-500 text-lg font-normal normal-case ml-2 border-l border-slate-800 pl-4">
                            Game {gameNumber}
                        </span>
                    </DialogTitle>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                        Close
                    </Button>
                </div>

                {/* Top Bar: Perspective Switcher - Fixed Header */}
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4 z-20">
                    <div className="flex-1">
                        <div className="text-sm text-slate-400">
                            Analyzing strategies for <span className="text-white font-bold">{perspectiveTeam}</span>
                        </div>
                    </div>

                    {/* Side Selector */}
                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <button
                            onClick={() => setBlueSide(perspectiveTeam)}
                            className={cn(
                                "px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2",
                                blueSide === perspectiveTeam
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                            )}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Blue Side
                        </button>
                        <button
                            onClick={() => setBlueSide(enemyTeam)}
                            className={cn(
                                "px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2",
                                blueSide !== perspectiveTeam
                                    ? "bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                            )}
                        >
                            <Swords className="w-4 h-4" />
                            Red Side
                        </button>
                    </div>

                    <div className="w-px h-8 bg-slate-800 mx-2 hidden md:block" />

                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                        {[match.team_a_name, match.team_b_name].map(team => (
                            <button
                                key={team}
                                onClick={() => setPerspectiveTeam(team)}
                                className={cn(
                                    "px-6 py-2 text-sm font-bold rounded-md transition-all min-w-[140px]",
                                    perspectiveTeam === team
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                                )}
                            >
                                {team}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 relative z-10">
                    {analyzing ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                            <p className="animate-pulse text-lg">Analyzing Matchup Data...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 h-full">
                                {/* Left Col: Series History */}
                                <div className="space-y-6 xl:col-span-1">
                                    <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900/50 p-6 rounded-2xl border border-indigo-500/20 h-full overflow-y-auto custom-scrollbar">
                                        <h3 className="text-indigo-400 font-bold text-lg mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5" />
                                            Series History
                                        </h3>

                                        <div className="space-y-6">
                                            {(!match.games || match.games.filter(g => g.game_number < gameNumber).length === 0) && (
                                                <p className="text-slate-500 text-sm italic">No previous games played.</p>
                                            )}

                                            {match.games?.filter(g => g.game_number < gameNumber)
                                                .sort((a, b) => a.game_number - b.game_number)
                                                .map(g => {
                                                    const isBlue = g.blue_team_name === perspectiveTeam
                                                    // Verify this team participated (should be true for draft match)
                                                    if (g.blue_team_name !== perspectiveTeam && g.red_team_name !== perspectiveTeam) return null

                                                    const sideLabel = isBlue ? 'Blue Side' : 'Red Side'
                                                    const sideColor = isBlue ? 'text-blue-400' : 'text-rose-400'
                                                    const picks = g.picks?.filter(p => p.side === (isBlue ? 'BLUE' : 'RED') && p.type === 'PICK') || []

                                                    return (
                                                        <div key={g.id} className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Game {g.game_number}</span>
                                                                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900", sideColor)}>
                                                                    {sideLabel}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {picks.map(p => {
                                                                    const hero = heroMap.get(p.hero_id)
                                                                    return (
                                                                        <div
                                                                            key={p.id}
                                                                            className="w-9 h-9 rounded-lg border border-slate-700 overflow-hidden bg-slate-900 relative group"
                                                                            title={hero?.name}
                                                                        >
                                                                            {hero?.icon_url ? (
                                                                                <img src={hero.icon_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={hero?.name} />
                                                                            ) : (
                                                                                <span className="text-[8px] flex items-center justify-center h-full text-slate-600">?</span>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            }
                                        </div>

                                        {/* Stats Summary - Pool Status */}
                                        <div className="mt-8 pt-6 border-t border-indigo-500/20">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pool Status</h4>
                                            {/* Re-calculate stats based on current perspective */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-slate-300">Remaining</span>
                                                <span className="text-emerald-400 font-bold">{Math.max(0, heroes.length - usedHeroIds.size)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-300">Played</span>
                                                <span className="text-slate-500 font-bold">{usedHeroIds.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Col: Analysis Content */}
                                <div className="xl:col-span-3 flex flex-col min-h-0">
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                                        <TabsList className="w-full justify-start bg-transparent border-b border-slate-800 p-0 h-auto gap-6 rounded-none">
                                            <TabsTrigger
                                                value="team-pool"
                                                className="data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:border-b-2 data-[state=active]:border-emerald-400 rounded-none px-0 py-4 text-slate-400 hover:text-white text-base font-bold bg-transparent border-b-2 border-transparent transition-all"
                                            >
                                                <Users className="w-4 h-4 mr-2" />
                                                Team Pool
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="first-pick"
                                                className="data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-400 rounded-none px-0 py-4 text-slate-400 hover:text-white text-base font-bold bg-transparent border-b-2 border-transparent transition-all"
                                            >
                                                <ListOrdered className="w-4 h-4 mr-2" />
                                                First Picks
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="win-conditions"
                                                className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-400 rounded-none px-0 py-4 text-slate-400 hover:text-white text-base font-bold bg-transparent border-b-2 border-transparent transition-all"
                                            >
                                                <Trophy className="w-4 h-4 mr-2" />
                                                Win Conditions
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="draft-counters"
                                                className="data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 rounded-none px-0 py-4 text-slate-400 hover:text-white text-base font-bold bg-transparent border-b-2 border-transparent transition-all"
                                            >
                                                <Swords className="w-4 h-4 mr-2" />
                                                Draft Counters
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="enemy-pool"
                                                className="data-[state=active]:bg-transparent data-[state=active]:text-rose-400 data-[state=active]:border-b-2 data-[state=active]:border-rose-400 rounded-none px-0 py-4 text-slate-400 hover:text-white text-base font-bold bg-transparent border-b-2 border-transparent transition-all"
                                            >
                                                <Skull className="w-4 h-4 mr-2" />
                                                Enemy Threats
                                            </TabsTrigger>
                                        </TabsList>

                                        <div className="mt-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                            <TabsContent value="first-pick" className="space-y-6 m-0 focus-visible:outline-none">
                                                <div className="space-y-6">
                                                    <div>
                                                        <h4 className="flex items-center gap-2 text-rose-400 font-bold text-lg mb-2">
                                                            <ListOrdered className="w-5 h-5" />
                                                            Enemy First Pick Priority ({enemyTeam.replace(/\s*\(Bot\)$/i, '')})
                                                        </h4>
                                                        <p className="text-sm text-slate-500 mb-6">
                                                            When <span className="font-bold text-white">{enemyTeam.replace(/\s*\(Bot\)$/i, '')}</span> is on Blue Side, they prioritize these heroes in the first slot.
                                                            <span className="block text-xs mt-1 bg-slate-900/50 py-1 px-2 rounded-md border border-slate-800 w-fit">
                                                                Based on {firstPickStats.totalGames} Blue Side games (Simulator Only)
                                                            </span>
                                                        </p>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {firstPickStats.picks.map((pick, idx) => {
                                                                const hero = heroMap.get(pick.heroId)
                                                                if (!hero) return null
                                                                return (
                                                                    <div key={pick.heroId} className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50 flex items-center gap-4">
                                                                        <div className="text-2xl font-black text-slate-700 w-8 text-center">#{idx + 1}</div>
                                                                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700">
                                                                            <img src={hero.icon_url} className="w-full h-full object-cover" />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <span className="font-bold text-slate-200">{hero.name}</span>
                                                                                <span className="text-indigo-400 font-bold">{pick.percentage}%</span>
                                                                            </div>
                                                                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                                <div className="h-full bg-indigo-500" style={{ width: `${pick.percentage}%` }} />
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 mt-1">
                                                                                Picked {pick.count} times in slot 1
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                            {firstPickStats.picks.length === 0 && (
                                                                <p className="text-slate-500 col-span-2 text-center py-8 opacity-50">No first pick data available for Blue Side.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="draft-counters" className="space-y-6 m-0 focus-visible:outline-none">
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-amber-400 font-bold text-lg mb-2">
                                                        <Swords className="w-5 h-5" />
                                                        Draft Counter Analysis
                                                    </h4>
                                                    <p className="text-sm text-slate-500 mb-6">
                                                        Analysis of how <span className="font-bold text-white">{enemyTeam.replace(/\s*\(Bot\)$/i, '')}</span> responds to your picks in the same role (Simulator Only).
                                                    </p>

                                                    {counterStats.length === 0 ? (
                                                        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                                                            <p className="text-slate-500">No specific counter patterns found in recent simulator games.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {counterStats.map((stat: any) => {
                                                                const paramsHero = heroMap.get(stat.opponentHeroId)
                                                                if (!paramsHero) return null

                                                                return (
                                                                    <div key={stat.opponentHeroId} className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                                                                        <div className="flex items-center gap-4 mb-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700">
                                                                                    {paramsHero.icon_url && <img src={paramsHero.icon_url} className="w-full h-full object-cover" />}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-sm font-bold text-slate-300">Vs. {paramsHero.name}</div>
                                                                                    <div className="text-xs text-slate-500 uppercase font-bold">{stat.role}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex-1 h-px bg-slate-800" />
                                                                            <div className="text-xs text-slate-500 font-bold uppercase">
                                                                                Encountered {stat.totalEncounters} times
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                            {stat.responses.map((resp: any) => {
                                                                                const respHero = heroMap.get(resp.heroId)
                                                                                if (!respHero) return null

                                                                                const wrColor = resp.winRate >= 60 ? 'text-emerald-400' :
                                                                                    resp.winRate <= 40 ? 'text-rose-400' : 'text-yellow-400'

                                                                                return (
                                                                                    <div key={resp.heroId} className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800">
                                                                                        <div className="w-8 h-8 rounded border border-slate-700 overflow-hidden">
                                                                                            {respHero.icon_url && <img src={respHero.icon_url} className="w-full h-full object-cover" />}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="text-xs font-bold text-white truncate">{respHero.name}</div>
                                                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                                                <span className="text-slate-400">{resp.count} picks</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="team-pool" className="space-y-6 m-0 focus-visible:outline-none">
                                                <div className="space-y-8">
                                                    {/* Available Heroes */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                                                                <ShieldCheck className="w-5 h-5" />
                                                                Available Heroes (Pool)
                                                            </h4>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                                                                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 rounded-sm">#</span>
                                                                <span>= Games played in this position</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-6">
                                                            {roles.map(role => {
                                                                const roleHeroes = getHeroesByRole(role, true)
                                                                if (roleHeroes.length === 0) return null

                                                                // Sort by Specific Role Usage, then Total Usage
                                                                roleHeroes.sort((a, b) => {
                                                                    const statsA = teamStats.find(s => s.heroId === a.id)
                                                                    const countA = statsA?.roles?.find((r: any) => r.role === role)?.count || 0

                                                                    const statsB = teamStats.find(s => s.heroId === b.id)
                                                                    const countB = statsB?.roles?.find((r: any) => r.role === role)?.count || 0

                                                                    if (countB !== countA) return countB - countA
                                                                    return (statsB?.totalPlayed || 0) - (statsA?.totalPlayed || 0)
                                                                })

                                                                return (
                                                                    <div key={role} className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{role}</div>
                                                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-none text-[10px] px-1.5 py-0 h-5">
                                                                                {roleHeroes.length}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {roleHeroes.map(hero => {
                                                                                const stats = teamStats.find(s => s.heroId === hero.id)
                                                                                const totalPlayCount = stats?.totalPlayed || 0
                                                                                const rolePlayCount = stats?.roles?.find((r: any) => r.role === role)?.count || 0

                                                                                let tooltip = hero.name
                                                                                if (totalPlayCount > 0) {
                                                                                    tooltip += `\nTotal Scrims: ${totalPlayCount}`
                                                                                    if (stats?.roles?.length) {
                                                                                        stats.roles
                                                                                            .sort((a: any, b: any) => b.count - a.count)
                                                                                            .forEach((r: any) => {
                                                                                                tooltip += `\n• ${r.role}: ${r.count}`
                                                                                            })
                                                                                    }
                                                                                }

                                                                                return (
                                                                                    <div
                                                                                        key={hero.id}
                                                                                        className="relative group cursor-pointer"
                                                                                        title={tooltip}
                                                                                    >
                                                                                        <div className={cn(
                                                                                            "w-10 h-10 rounded-lg overflow-hidden border transition-all group-hover:scale-110 shadow-sm relative",
                                                                                            rolePlayCount > 0 ? "border-indigo-500/50 shadow-indigo-500/10" : "border-slate-700 group-hover:border-emerald-500"
                                                                                        )}>
                                                                                            {hero.icon_url ? (
                                                                                                <img src={hero.icon_url} className="w-full h-full object-cover" alt={hero.name} />
                                                                                            ) : (
                                                                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500">?</div>
                                                                                            )}

                                                                                            {/* Play Count Badge (Specific Role) */}
                                                                                            {rolePlayCount > 0 && (
                                                                                                <div className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[8px] font-bold px-1 rounded-tl-sm z-10 leading-3">
                                                                                                    {rolePlayCount}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Unavailable Heroes */}
                                                    {usedHeroIds.size > 0 && (
                                                        <div className="opacity-60 grayscale-[0.8]">
                                                            <h4 className="flex items-center gap-2 text-slate-500 font-bold text-lg mb-4">
                                                                <Ban className="w-5 h-5" />
                                                                Unavailable (Played in Previous Games)
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2 p-4 bg-slate-950/50 rounded-xl border border-slate-900">
                                                                {Array.from(usedHeroIds).map(id => {
                                                                    const hero = heroMap.get(id)
                                                                    return hero ? (
                                                                        <div
                                                                            key={id}
                                                                            className="w-8 h-8 rounded-full overflow-hidden border border-slate-800 opacity-70"
                                                                            title={hero.name}
                                                                        >
                                                                            {hero.icon_url && <img src={hero.icon_url} className="w-full h-full object-cover" alt={hero.name} />}
                                                                        </div>
                                                                    ) : null
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="win-conditions" className="space-y-6 m-0 focus-visible:outline-none">
                                                <div className="bg-slate-900/30 border border-emerald-500/20 rounded-2xl p-6">
                                                    <h4 className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-4">
                                                        <ShieldCheck className="w-5 h-5" />
                                                        Recommended Strategies for {perspectiveTeam}
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {relevantAllyConditions.map((cond, idx) => (
                                                            <div key={idx} className="bg-[#0f172a] hover:bg-[#1e293b] transition-colors p-4 rounded-xl border border-slate-800 flex items-center justify-between group">
                                                                <div>
                                                                    <div className="font-bold text-slate-200 text-base mb-2">{cond.name || `Strategy #${cond.id.slice(0, 4)}`}</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {cond.allyConditions.map((c: any, i: number) => {
                                                                            const hero = c.heroId ? heroMap.get(c.heroId) : null
                                                                            const roleName = c.role === 'ANY' ? 'Any' : c.role

                                                                            return (
                                                                                <Badge key={i} variant="outline" className="bg-slate-900 border-slate-700 text-slate-300 gap-1.5 py-1">
                                                                                    {hero ? (
                                                                                        <>
                                                                                            {hero.icon_url && <img src={hero.icon_url} className="w-4 h-4 rounded-full" alt="" />}
                                                                                            <span className={hero ? 'text-indigo-300 font-bold' : ''}>{hero.name}</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <span>Any</span>
                                                                                    )}
                                                                                    <span className="text-slate-500 text-[10px] uppercase">({roleName})</span>
                                                                                </Badge>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right pl-4">
                                                                    <div className="text-2xl font-black text-emerald-400 group-hover:scale-110 transition-transform">{cond.result?.winRate}%</div>
                                                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {relevantAllyConditions.length === 0 && (
                                                            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                                                <p className="text-slate-500 text-sm italic">No specific high-winrate strategies found for this patch/team.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="enemy-pool" className="space-y-6 m-0 focus-visible:outline-none">
                                                <div className="bg-slate-900/30 border border-rose-500/20 rounded-2xl p-6">
                                                    <h4 className="flex items-center gap-2 text-rose-400 font-bold text-lg mb-4">
                                                        <AlertTriangle className="w-5 h-5" />
                                                        High Threat Bans
                                                    </h4>
                                                    <p className="text-sm text-slate-400 mb-6">
                                                        Consider banning these heroes based on global win rates and {enemyTeam}'s preferences.
                                                    </p>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {['Keera', 'Aaya', 'Nakroth', 'Yena'].map(hero => (
                                                            <div key={hero} className="flex flex-col gap-2 bg-[#0f172a] p-4 rounded-xl border border-slate-800 hover:border-rose-500/50 transition-colors group">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="text-lg font-bold text-slate-200">{hero}</div>
                                                                    <div className="w-8 h-8 bg-rose-500/10 rounded-full flex items-center justify-center">
                                                                        <Skull className="w-4 h-4 text-rose-500" />
                                                                    </div>
                                                                </div>
                                                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-rose-500 w-[75%]"></div>
                                                                </div>
                                                                <div className="flex justify-between text-[10px] mt-1">
                                                                    <span className="text-slate-500">Threat Level</span>
                                                                    <span className="text-rose-400 font-bold">High</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center z-10">
                    <div className="flex items-center gap-4">
                        <div className="hidden md:block text-sm text-slate-400">
                            Analysis for <strong>Game {gameNumber}</strong>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onProceed}
                            disabled={loading || analyzing}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 px-8 text-lg shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.5)] transition-all"
                        >
                            <ArrowRight className="w-5 h-5 mr-2" />
                            Proceed to Game Setup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
