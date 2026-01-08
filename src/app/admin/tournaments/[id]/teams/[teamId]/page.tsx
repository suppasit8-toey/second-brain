'use client'

import { useState, useEffect, use } from 'react'
import { getTournament, getTeams, getPlayers, getAllPlayers, assignPlayerToRoster, removePlayerFromRoster } from '../../../actions'
import { Team, Player, Tournament } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Plus, X, Users, Shield, Search } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface RosterSlot {
    role: string
    label: string
    player?: Player
}

const ROSTER_STRUCTURE = [
    { role: 'Dark Slayer', label: 'Dark Slayer Lane' },
    { role: 'Jungle', label: 'Jungle' },
    { role: 'Mid', label: 'Mid Lane' },
    { role: 'Abyssal', label: 'Abyssal Lane' },
    { role: 'Roam', label: 'Roam' },
    { role: 'Sub1', label: 'Substitute 1' },
    { role: 'Sub2', label: 'Substitute 2' },
    { role: 'Coach', label: 'Coach' },
]

export default function TeamRosterPage({ params }: { params: Promise<{ id: string, teamId: string }> }) {
    const { id, teamId } = use(params)
    const [team, setTeam] = useState<Team | null>(null)
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [roster, setRoster] = useState<RosterSlot[]>(ROSTER_STRUCTURE)
    const [allPlayers, setAllPlayers] = useState<any[]>([])

    // Selection Modal
    const [isSelectOpen, setIsSelectOpen] = useState(false)
    const [activeRole, setActiveRole] = useState('')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadData()
    }, [id, teamId])

    const loadData = async () => {
        const t = await getTournament(id)
        if (t) {
            setTournament(t)
            const teams = await getTeams(t.id)
            const currentTeam = teams.find(tm => tm.id === teamId || tm.slug === teamId)
            setTeam(currentTeam || null)

            // Load Roster Players
            if (currentTeam) {
                const teamPlayers = await getPlayers(currentTeam.id)
                const globalPlayers = await getAllPlayers()
                setAllPlayers(globalPlayers)

                // Map players to slots
                const updatedRoster = ROSTER_STRUCTURE.map(slot => {
                    const assigned = teamPlayers.find((p: any) => p.roster_role === slot.role)
                    return { ...slot, player: assigned }
                })
                setRoster(updatedRoster)
            }
        }
    }

    const handleAssign = async (player: any) => {
        if (!activeRole) return
        const res = await assignPlayerToRoster(player.id, teamId, activeRole, id)
        if (res.error) {
            alert(res.error)
        } else {
            setIsSelectOpen(false)
            setSearchTerm('')
            loadData()
        }
    }

    const handleRemove = async (player: any) => {
        if (!confirm(`Remove ${player.name} from this slot?`)) return
        await removePlayerFromRoster(player.id, id, teamId)
        loadData()
    }

    // Filter State
    const [filterPosition, setFilterPosition] = useState<string>('All')

    const filteredCandidates = allPlayers.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesPosition = filterPosition === 'All' || p.positions?.includes(filterPosition)
        return matchesSearch && matchesPosition
    })

    if (!team || !tournament) return <div className="p-12 text-center text-slate-500">Loading...</div>

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <Link href={`/admin/tournaments/${id}`} className="inline-flex items-center text-slate-400 hover:text-white mb-4 gap-1 text-sm font-bold transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Tournament
                </Link>
                <div className="flex items-center gap-6 bg-slate-900 border border-slate-800 p-6 rounded-xl">
                    <div className="w-20 h-20 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                        {team.logo_url ? (
                            <Image src={team.logo_url} alt={team.name} fill className="object-contain p-2" />
                        ) : (
                            <span className="text-2xl font-bold text-slate-700">{team.short_name}</span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">{team.name}</h1>
                        <div className="text-indigo-400 font-bold font-mono text-lg tracking-widest">{team.short_name}</div>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-sm text-slate-500 uppercase font-bold tracking-wider">Tournament</div>
                        <div className="text-slate-200 font-bold">{tournament.name}</div>
                    </div>
                </div>
            </div>

            {/* Roster Grid */}
            <div>
                <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Active Roster
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    {/* Main 5 Roles */}
                    {roster.slice(0, 5).map(slot => (
                        <RosterSlotCard
                            key={slot.role}
                            slot={slot}
                            onAssign={() => {
                                setActiveRole(slot.role)
                                // Auto-filter if it's a standard role
                                const standardRoles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
                                if (standardRoles.includes(slot.role)) {
                                    setFilterPosition(slot.role)
                                } else {
                                    setFilterPosition('All')
                                }
                                setIsSelectOpen(true)
                            }}
                            onRemove={handleRemove}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-800 pt-8">
                    {/* Subs & Coach */}
                    {roster.slice(5).map(slot => (
                        <RosterSlotCard
                            key={slot.role}
                            slot={slot}
                            onAssign={() => {
                                setActiveRole(slot.role)
                                if (slot.role === 'Coach') {
                                    setFilterPosition('Coach')
                                } else {
                                    setFilterPosition('All')
                                }
                                setIsSelectOpen(true)
                            }}
                            onRemove={handleRemove}
                        />
                    ))}
                </div>
            </div>

            {/* Player Selection Modal */}
            <Dialog open={isSelectOpen} onOpenChange={setIsSelectOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Assign Player to {roster.find(r => r.role === activeRole)?.label}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2 pb-2 overflow-x-auto">
                            {['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam', 'Coach'].map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => setFilterPosition(pos)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${filterPosition === pos
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-500 ml-2" />
                            <Input
                                placeholder="Search player..."
                                className="bg-transparent border-0 focus-visible:ring-0 text-white h-8"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {filteredCandidates.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm italic">
                                    No players found for this role.
                                </div>
                            ) : filteredCandidates.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleAssign(p)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center font-bold text-slate-600 border border-slate-800 group-hover:text-white">
                                            {p.name.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm group-hover:text-indigo-400 transition-colors">{p.name}</div>
                                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                {p.team?.name || 'Free Agent'} • {p.positions?.join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    <Plus className="w-4 h-4 text-slate-600 group-hover:text-indigo-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function RosterSlotCard({ slot, onAssign, onRemove }: { slot: RosterSlot, onAssign: () => void, onRemove: (p: any) => void }) {
    const isAssigned = !!slot.player

    return (
        <Card className={`bg-slate-900 border-slate-800 transition-all ${isAssigned ? 'border-indigo-500/30' : 'border-dashed'}`}>
            <CardContent className="p-4 flex flex-col items-center text-center h-full justify-between min-h-[160px]">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{slot.label}</div>

                {isAssigned ? (
                    <div className="relative w-full group">
                        <div className="w-12 h-12 mx-auto bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2 shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                            {slot.player!.name.charAt(0)}
                        </div>
                        <div className="font-black text-lg text-white truncate w-full">{slot.player!.name}</div>
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onRemove(slot.player)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                ) : (
                    <Button variant="ghost" className="h-16 w-16 rounded-full border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:text-indigo-400 text-slate-600 transition-all" onClick={onAssign}>
                        <Plus className="w-6 h-6" />
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
