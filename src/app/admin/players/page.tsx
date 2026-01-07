'use client'

import { useState, useEffect } from 'react'
import { getAllPlayers, getAllTeams, createPlayer } from '../tournaments/actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Search, Shield, Plus } from 'lucide-react'
import Image from 'next/image'

export default function PlayersPage() {
    const [players, setPlayers] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [teams, setTeams] = useState<any[]>([])

    useEffect(() => {
        loadData()
        loadTeams()
    }, [])

    const loadData = async () => {
        setLoading(true)
        const data = await getAllPlayers()
        setPlayers(data)
        setLoading(false)
    }

    const loadTeams = async () => {
        const t = await getAllTeams()
        setTeams(t)
    }

    const filteredPlayers = players.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team?.short_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 flex items-center gap-3 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                        <Users className="text-indigo-400" size={32} />
                        PLAYER DATABASE
                    </h1>
                    <p className="text-slate-400 mt-2">Manage and view all registered professional players.</p>
                </div>
                <div className="flex gap-2">
                    <CreatePlayerDialog
                        teams={teams}
                        open={isCreateOpen}
                        onOpenChange={setIsCreateOpen}
                        onSuccess={() => {
                            setIsCreateOpen(false)
                            loadData()
                        }}
                    />
                </div>
            </div>

            {/* Filter */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                <Search className="w-5 h-5 text-slate-500" />
                <Input
                    placeholder="Search by Player Name or Team..."
                    className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-slate-600"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading players...</div>
            ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    No players found.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPlayers.map(player => (
                        <Card key={player.id} className="bg-slate-900 border-slate-800 text-white group hover:border-indigo-500/50 transition-colors">
                            <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center font-bold text-indigo-500 border border-slate-800 shrink-0">
                                    {player.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <CardTitle className="text-base font-bold truncate">{player.name}</CardTitle>
                                    <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                                        <Shield className="w-3 h-3" />
                                        {player.team?.short_name || player.team?.name || 'Free Agent'}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {player.positions && player.positions.map((pos: string) => (
                                        <span key={pos} className="text-[10px] px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-400 font-medium">
                                            {pos}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

function CreatePlayerDialog({ teams, open, onOpenChange, onSuccess }: any) {
    const [name, setName] = useState('')
    const [teamId, setTeamId] = useState('')
    const [positions, setPositions] = useState<string[]>([])

    const POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam', 'Coach']

    const handleSubmit = async () => {
        if (!name) return alert('Name is required')

        const formData = new FormData()
        formData.append('name', name)
        if (teamId) formData.append('team_id', teamId)
        formData.append('positions', JSON.stringify(positions))
        formData.append('tournament_id', 'global') // Fallback ID for global context

        const res = await createPlayer(formData)
        if (res.error) {
            alert(res.error)
        } else {
            setName('')
            setTeamId('')
            setPositions([])
            onSuccess()
        }
    }

    const togglePosition = (p: string) => {
        setPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    <Plus className="w-5 h-5" /> Add Player
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Register New Player</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Player Name</Label>
                        <Input
                            placeholder="e.g. TaoX"
                            className="bg-slate-950 border-slate-800"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Team</Label>
                        <Select value={teamId} onValueChange={setTeamId}>
                            <SelectTrigger className="bg-slate-950 border-slate-800">
                                <SelectValue placeholder="Select Team" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                {teams.map((t: any) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name} ({t.short_name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Positions</Label>
                        <div className="flex flex-wrap gap-2">
                            {POSITIONS.map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => togglePosition(pos)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${positions.includes(pos)
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 mt-4">
                        Register Player
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
