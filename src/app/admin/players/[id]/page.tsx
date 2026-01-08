'use client'

import { useState, useEffect, use } from 'react'
import { getPlayer, updatePlayer } from '../../tournaments/actions'
import { Player } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, User, Shield, Briefcase, Award } from 'lucide-react'
import Link from 'next/link'

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [player, setPlayer] = useState<any | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)

    useEffect(() => {
        const load = async () => {
            const data = await getPlayer(id) // id here can be slug or uuid
            setPlayer(data)
        }
        load()
    }, [id])

    if (!player) return <div className="p-12 text-center text-slate-500">Loading player...</div>

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <Link href="/admin/players" className="inline-flex items-center text-slate-400 hover:text-white mb-4 gap-1 text-sm font-bold transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Players
            </Link>

            <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-8">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    {/* Avatar */}
                    <div className="w-32 h-32 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-lg shadow-black/50">
                        <span className="text-6xl font-black text-indigo-500">
                            {player.name.charAt(0)}
                        </span>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">{player.name}</h1>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-400 font-bold mt-2">
                                    <Shield className="w-4 h-4" />
                                    {player.team?.name || 'Free Agent'}
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                                Edit Profile
                            </Button>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            {player.positions?.map((pos: string) => (
                                <div key={pos} className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider">
                                    {pos === 'Abyssal Dragon' ? 'Abyssal' : pos}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats or Extra Info (Placeholder) */}
                    <div className="flex flex-col gap-2 min-w-[150px]">
                        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
                            <div className="text-green-400 font-mono font-bold">Active</div>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Matches</div>
                            <div className="text-white font-mono font-bold">-</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800 text-white">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold uppercase tracking-wider text-sm">
                            <Briefcase className="w-4 h-4" /> Career History
                        </div>
                        <div className="text-slate-500 text-sm italic">
                            No history data available yet.
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 text-white">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold uppercase tracking-wider text-sm">
                            <Award className="w-4 h-4" /> Achievements
                        </div>
                        <div className="text-slate-500 text-sm italic">
                            No achievements recorded.
                        </div>
                    </CardContent>
                </Card>
            </div>

            <EditPlayerDialog
                player={player}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={(newSlug: string) => {
                    setIsEditOpen(false)
                    // If slug changed, we might need to redirect, but for now simple reload or re-fetch handled by useEffect dependency if we used slug
                    if (newSlug && newSlug !== id && !isUuid(id)) {
                        window.location.href = `/admin/players/${newSlug}`
                    } else {
                        // Reload data
                        const load = async () => {
                            const data = await getPlayer(id)
                            setPlayer(data)
                        }
                        load()
                    }
                }}
            />
        </div>
    )
}

function isUuid(str: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function EditPlayerDialog({ player, open, onOpenChange, onSuccess }: any) {
    const [name, setName] = useState(player.name)
    const [teams, setTeams] = useState<any[]>([]) // Kept for now to avoid breaking if referenced, but unused logic removed below
    const [positions, setPositions] = useState<string[]>(player.positions || [])

    // Load teams for selector - REMOVED logic
    useEffect(() => {
        if (open) {
            // Reset state to match player prop
            setName(player.name)
            // Check for legacy "Abyssal Dragon" and convert to "Abyssal" for the UI state
            const currentPositions = player.positions || []
            const migratedPositions = currentPositions.map((p: string) => p === 'Abyssal Dragon' ? 'Abyssal' : p)
            setPositions(migratedPositions)
        }
    }, [open, player])

    const POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam', 'Coach']

    const handleSubmit = async () => {
        if (!name) return alert('Name is required') // Should use toast

        const formData = new FormData()
        formData.append('id', player.id)
        formData.append('name', name)
        // Team ID is managed via Roster, do not update here
        formData.append('positions', JSON.stringify(positions))

        const res = await updatePlayer(formData)
        if (res.error) {
            alert(res.error)
        } else {
            onSuccess(res.newSlug)
        }
    }

    const togglePosition = (p: string) => {
        setPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Player Name</Label>
                        <Input
                            className="bg-slate-950 border-slate-800"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Team Selector Removed - Team is managed via Roster only */}

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
                        Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
