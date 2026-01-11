'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { saveScrimSummary } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Save, ArrowLeft, Loader2, ChevronsUpDown, Check, Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

// Simple utility for class names
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ')
}

const ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

export default function ScrimSummaryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [match, setMatch] = useState<any>(null)
    const [heroes, setHeroes] = useState<any[]>([])
    const [existingGames, setExistingGames] = useState<any[]>([])
    const [globalBans, setGlobalBans] = useState<{ A: Set<string>, B: Set<string> }>({ A: new Set(), B: new Set() })
    const [loading, setLoading] = useState(true)
    const [swapSides, setSwapSides] = useState(false) // If true, Team B is Blue
    const [winner, setWinner] = useState('')
    const [selections, setSelections] = useState<Record<string, string>>({})

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()

            // Fetch Match (Support UUID or Slug)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

            let query = supabase.from('draft_matches').select('*')
            if (isUUID) {
                query = query.eq('id', id)
            } else {
                query = query.eq('slug', id)
            }

            const { data: m, error } = await query.single()

            if (error || !m) {
                console.error('Error fetching match:', error)
                setMatch(null)
                setLoading(false)
                return
            }

            setMatch(m)

            // Fetch Games & Picks for Global Ban Logic (Use Resolved match.id)
            const { data: games } = await supabase.from('draft_games')
                .select(`
                    *,
                    picks:draft_picks(hero_id, side)
                `)
                .eq('match_id', m.id)
                .order('game_number', { ascending: true })

            setExistingGames(games || [])

            // Calculate Global Bans
            // Logic: 
            // If Game 1: Team A is Blue, Team B is Red.
            // If Game 2: Team A is Red, Team B is Blue. (Unless side swap logic is custom per game, but standard is A=Blue, B=Red initially)
            // Actually, the DB stores `blue_team_name` and `red_team_name`.
            // So we can map picks to Team names.

            const bansA = new Set<string>()
            const bansB = new Set<string>()

            if (m && games) {
                games.forEach((g: any) => {
                    // Identify which team was which side
                    const isTeamABlue = g.blue_team_name === m.team_a_name

                    g.picks?.forEach((p: any) => {
                        if (p.type === 'PICK') { // Only picks count for Global Ban usually? Or Bans too? strict Global Ban usually means "Cannot play used heroes". Let's assume Picks.
                            if (p.side === 'BLUE') {
                                if (isTeamABlue) bansA.add(p.hero_id)
                                else bansB.add(p.hero_id)
                            } else {
                                if (isTeamABlue) bansB.add(p.hero_id)
                                else bansA.add(p.hero_id)
                            }
                        }
                    })
                })
            }
            setGlobalBans({ A: bansA, B: bansB })

            // Fetch Heroes
            if (m) {
                const { data: h } = await supabase
                    .from('heroes')
                    .select('id, name, icon_url, main_position')
                    .order('name', { ascending: true })
                setHeroes(h || [])
            }
            setLoading(false)
        }
        load()
    }, [id])

    // ... (rest of loading/finished checks same as before) ...
    if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>
    if (!match) return <div className="p-12 text-center text-red-500">Match not found</div>

    const totalGames = parseInt(match.mode.replace('BO', '')) || 1
    const currentGameNum = existingGames.length + 1
    const isFinished = existingGames.length >= totalGames

    if (isFinished) {
        return (
            <div className="p-12 text-center space-y-4">
                <h1 className="text-3xl font-bold text-green-500">Match Completed</h1>
                <p className="text-slate-400">All {totalGames} games have been recorded.</p>
                <Link href="/admin/scrims">
                    <Button variant="outline">Back to Logs</Button>
                </Link>
            </div>
        )
    }

    const blueTeamName = swapSides ? match.team_b_name : match.team_a_name
    const redTeamName = swapSides ? match.team_a_name : match.team_b_name

    // Determine which set of banned heroes applies to Blue/Red side for THIS game
    const blueGlobalBans = swapSides ? globalBans.B : globalBans.A
    const redGlobalBans = swapSides ? globalBans.A : globalBans.B

    // Track selections for current game to prevent duplicates
    // moved to top level

    const handleSelect = (name: string, heroId: string) => {
        setSelections(prev => ({ ...prev, [name]: heroId }))
    }

    // Combine Global Bans with Current Selections for exclusion
    const currentUsedIds = new Set(Object.values(selections))

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link href="/admin/scrims" className="inline-flex items-center text-slate-400 hover:text-white mb-2 gap-1 text-sm font-bold transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to Logs
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black italic text-white tracking-tighter uppercase">Quick Result Entry</h1>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded text-sm font-bold border border-indigo-500/50">
                            GAME {currentGameNum} / {totalGames}
                        </div>
                        <div className="text-slate-500 text-sm hidden md:block">{match.slug}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 rounded-lg self-end md:self-auto">
                    <button
                        type="button"
                        onClick={() => setSwapSides(false)}
                        className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${!swapSides ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        A = BLUE
                    </button>
                    <button
                        type="button"
                        onClick={() => setSwapSides(true)}
                        className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${swapSides ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        B = BLUE
                    </button>
                </div>
            </div>

            <form action={saveScrimSummary as any} className="space-y-8">
                <input type="hidden" name="match_id" value={match.id} />
                <input type="hidden" name="match_slug" value={match.slug} />
                <input type="hidden" name="game_number" value={currentGameNum} />
                <input type="hidden" name="total_games" value={totalGames} />
                <input type="hidden" name="blue_team_name" value={blueTeamName} />
                <input type="hidden" name="red_team_name" value={redTeamName} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {/* BLUE TEAM */}
                    <Card className="bg-slate-900 border-blue-500/30 overflow-visible">
                        <CardHeader className="bg-blue-950/30 border-b border-blue-500/20 pb-4">
                            <CardTitle className="text-blue-400 text-lg md:text-xl font-bold uppercase flex justify-between items-center">
                                <span className="truncate mr-2">{blueTeamName}</span>
                                <span className="text-[10px] md:text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded shrink-0">BLUE SIDE</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-4">
                            {ROLES.map((role, i) => (
                                <div key={`blue-${i}`} className="flex items-center gap-2 md:gap-3 z-50 relative">
                                    <div className="w-16 md:w-24 text-[10px] md:text-xs font-bold text-slate-500 uppercase text-right shrink-0">{role}</div>
                                    <input type="hidden" name={`blue_role_${i}`} value={role} />
                                    <div className="flex-1 min-w-0">
                                        <HeroCombobox
                                            name={`blue_pick_${i}`}
                                            heroes={heroes}
                                            excludedIds={new Set([...blueGlobalBans, ...currentUsedIds])}
                                            onChange={(id) => handleSelect(`blue_pick_${i}`, id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* RED TEAM */}
                    <Card className="bg-slate-900 border-red-500/30 overflow-visible">
                        <CardHeader className="bg-red-950/30 border-b border-red-500/20 pb-4">
                            <CardTitle className="text-red-400 text-lg md:text-xl font-bold uppercase flex justify-between items-center">
                                <span className="truncate mr-2">{redTeamName}</span>
                                <span className="text-[10px] md:text-xs bg-red-900 text-red-200 px-2 py-1 rounded shrink-0">RED SIDE</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-4">
                            {ROLES.map((role, i) => (
                                <div key={`red-${i}`} className="flex items-center gap-2 md:gap-3 z-50 relative">
                                    <div className="w-16 md:w-24 text-[10px] md:text-xs font-bold text-slate-500 uppercase text-right shrink-0">{role}</div>
                                    <input type="hidden" name={`red_role_${i}`} value={role} />
                                    <div className="flex-1 min-w-0">
                                        <HeroCombobox
                                            name={`red_pick_${i}`}
                                            heroes={heroes}
                                            excludedIds={new Set([...redGlobalBans, ...currentUsedIds])}
                                            onChange={(id) => handleSelect(`red_pick_${i}`, id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* RESULT */}
                <div className="space-y-4">
                    <div className="text-center text-slate-500 font-bold tracking-widest text-xs uppercase">Official Result</div>
                    <input type="hidden" name="winner" value={winner} />

                    <div className="flex gap-4 md:gap-8 h-32 md:h-40">
                        {/* BLUE */}
                        <button
                            type="button"
                            onClick={() => setWinner('blue')}
                            className={cn(
                                "flex-1 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group",
                                winner === 'blue'
                                    ? "border-blue-500 bg-blue-500/10 shadow-[0_0_50px_-10px_theme(colors.blue.500/0.4)] z-10 scale-105"
                                    : winner === 'red'
                                        ? "border-slate-800 bg-slate-900/40 opacity-60 hover:opacity-100 hover:border-slate-700 grayscale"
                                        : "border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:border-slate-700 hover:text-blue-400"
                            )}>
                            <span className={cn(
                                "text-3xl md:text-5xl font-black italic tracking-tighter uppercase transition-colors",
                                winner === 'blue' ? "text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]" : "text-slate-600 group-hover:text-blue-400/50"
                            )}>
                                {winner === 'blue' ? 'Victory' : (winner === 'red' ? 'Defeat' : 'Victory')}
                            </span>
                            <span className={cn("text-xs font-bold uppercase tracking-widest mt-2", winner === 'blue' ? "text-blue-300" : "text-slate-600 group-hover:text-slate-400")}>
                                Blue Team
                            </span>

                            {/* Glow Effect */}
                            {winner === 'blue' && <div className="absolute inset-0 bg-blue-500/5 blur-xl pointer-events-none" />}
                        </button>

                        {/* RED */}
                        <button
                            type="button"
                            onClick={() => setWinner('red')}
                            className={cn(
                                "flex-1 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group",
                                winner === 'red'
                                    ? "border-red-500 bg-red-500/10 shadow-[0_0_50px_-10px_theme(colors.red.500/0.4)] z-10 scale-105"
                                    : winner === 'blue'
                                        ? "border-slate-800 bg-slate-900/40 opacity-60 hover:opacity-100 hover:border-slate-700 grayscale"
                                        : "border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:border-slate-700 hover:text-red-400"
                            )}>
                            <span className={cn(
                                "text-3xl md:text-5xl font-black italic tracking-tighter uppercase transition-colors",
                                winner === 'red' ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]" : "text-slate-600 group-hover:text-red-400/50"
                            )}>
                                {winner === 'red' ? 'Victory' : (winner === 'blue' ? 'Defeat' : 'Victory')}
                            </span>
                            <span className={cn("text-xs font-bold uppercase tracking-widest mt-2", winner === 'red' ? "text-red-300" : "text-slate-600 group-hover:text-slate-400")}>
                                Red Team
                            </span>

                            {/* Glow Effect */}
                            {winner === 'red' && <div className="absolute inset-0 bg-red-500/5 blur-xl pointer-events-none" />}
                        </button>
                    </div>
                </div>

                {/* FAB / Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur border-t border-slate-800 flex justify-end gap-4 z-50 md:static md:bg-transparent md:border-0 md:p-0">
                    <Button type="submit" size="lg" className="bg-green-600 hover:bg-green-500 font-bold text-lg px-8 w-full md:w-auto shadow-lg shadow-green-900/20">
                        <Save className="w-5 h-5 mr-2" />
                        {currentGameNum < totalGames ? 'Save & Next Game' : 'Save & Finish Match'}
                    </Button>
                </div>
            </form>
        </div>
    )
}

import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { POSITIONS } from '@/utils/types'

// --- Custom Combobox ---
function HeroCombobox({ name, heroes, excludedIds, onChange }: { name: string, heroes: any[], excludedIds?: Set<string>, onChange?: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const [selectedHeroId, setSelectedHeroId] = useState("")
    const [search, setSearch] = useState("")
    const [selectedRole, setSelectedRole] = useState<string | null>(null)

    const selectedHero = heroes.find(h => h.id === selectedHeroId)

    // Filter heroes: Match search AND not excluded AND Match Role
    const filteredHeroes = heroes.filter(h => {
        const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase())

        let matchesRole = !selectedRole

        if (selectedRole && h.main_position) {
            if (Array.isArray(h.main_position)) {
                matchesRole = h.main_position.includes(selectedRole)
            } else if (typeof h.main_position === 'string') {
                // Handle case where it might be a JSON string or just a comma-separated string
                matchesRole = h.main_position.includes(selectedRole)
            }
        }

        const isNotExcluded = !excludedIds || !excludedIds.has(h.id) || h.id === selectedHeroId

        return matchesSearch && matchesRole && isNotExcluded
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <input type="hidden" name={name} value={selectedHeroId} />

            <DialogTrigger asChild>
                <div
                    className={cn(
                        "flex items-center justify-between w-full bg-slate-950 border rounded-lg cursor-pointer transition-all min-h-[50px] group",
                        selectedHero ? "border-indigo-500/50 bg-indigo-500/5 p-2" : "border-slate-800 hover:border-slate-700 px-3 py-2"
                    )}
                >
                    {selectedHero ? (
                        <div className="flex items-center gap-3 w-full">
                            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-indigo-500/30 shadow-sm shrink-0">
                                <Image src={selectedHero.icon_url} alt={selectedHero.name} fill className="object-cover" />
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-white text-sm font-bold truncate group-hover:text-indigo-300 transition-colors">{selectedHero.name}</span>
                                <span className="text-[10px] text-indigo-200/50 truncate">
                                    {selectedHero.main_position?.join(', ') || 'Hero'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-slate-500 text-sm">Select Hero...</span>
                    )}
                    <ChevronsUpDown className="w-4 h-4 text-slate-500 opacity-50 ml-2 shrink-0 group-hover:opacity-100" />
                </div>
            </DialogTrigger>

            <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden outline-none">
                <div className="p-4 md:p-6 pb-2 border-b border-slate-800 bg-slate-950/95 backdrop-blur z-10 flex flex-col gap-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-400" />
                        Select Hero
                    </DialogTitle>

                    {/* Search Bar */}
                    <div className="flex items-center px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <Search className="w-5 h-5 text-slate-400 mr-3" />
                        <input
                            className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-slate-500"
                            placeholder="Search hero by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')}>
                                <X className="w-5 h-5 text-slate-500 hover:text-white" />
                            </button>
                        )}
                    </div>

                    {/* Role Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar -mx-2 px-2 md:mx-0 md:px-0">
                        <button
                            type="button"
                            onClick={() => setSelectedRole(null)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                                !selectedRole
                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                            )}
                        >
                            All Roles
                        </button>
                        {POSITIONS.map(role => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setSelectedRole(role === selectedRole ? null : role)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                                    selectedRole === role
                                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                )}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 custom-scrollbar bg-slate-950/50">
                    {filteredHeroes.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                            <Search className="w-16 h-16" />
                            <p className="text-lg">No heroes found matching "{search}"</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4 pb-8">
                            {filteredHeroes.map(h => {
                                const isSelected = selectedHeroId === h.id
                                const isExcluded = excludedIds?.has(h.id) && !isSelected

                                return (
                                    <div
                                        key={h.id}
                                        title={h.name}
                                        className={cn(
                                            "group relative aspect-square rounded-md cursor-pointer overflow-hidden transition-all border",
                                            isSelected ? "ring-2 ring-indigo-500 border-indigo-500 shadow-xl shadow-indigo-500/20 scale-105 z-10" : "border-slate-800/50 bg-slate-900 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-105 hover:z-10",
                                            isExcluded && "opacity-30 grayscale pointer-events-none"
                                        )}
                                        onClick={() => {
                                            if (!isExcluded) {
                                                setSelectedHeroId(h.id)
                                                if (onChange) onChange(h.id)
                                                setOpen(false)
                                                setSearch("")
                                            }
                                        }}
                                    >
                                        <Image
                                            src={h.icon_url}
                                            alt={h.name}
                                            fill
                                            className={cn(
                                                "object-cover transition-transform duration-500",
                                                !isSelected && "group-hover:scale-110"
                                            )}
                                        />

                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                        {isExcluded && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                                                <span className="text-[10px] font-bold text-white border border-white/20 px-1.5 py-0.5 rounded bg-black/40 shadow-sm">
                                                    PICKED
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
