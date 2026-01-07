'use client'

import { useState, useEffect } from 'react'
import { getTournaments, createTournament, deleteTournament } from './actions'
import { Tournament } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { Trash2, Plus, Calendar, Trophy, ChevronRight } from 'lucide-react'

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [status, setStatus] = useState('upcoming')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        const data = await getTournaments()
        setTournaments(data)
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Area you sure you want to delete this tournament? All teams associated will be deleted.')) return

        const res = await deleteTournament(id)
        if (res.error) {
            alert('Error: ' + res.error)
        } else {
            // alert('Success: Tournament deleted')
            loadData()
        }
    }

    async function handleCreate(formData: FormData) {
        const res = await createTournament(formData)
        if (res.error) {
            alert('Error: ' + res.error)
        } else {
            // alert('Success: Tournament created!')
            setIsOpen(false)
            loadData()
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Tournaments</h1>
                    <p className="text-slate-400">Manage esports events and participating teams.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                            <Plus className="w-4 h-4" /> Create Tournament
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle>New Tournament</DialogTitle>
                        </DialogHeader>
                        <form action={handleCreate} className="space-y-4">
                            <div>
                                <Label htmlFor="name">Tournament Name</Label>
                                <Input id="name" name="name" placeholder="e.g. RPL Summer 2026" required className="bg-slate-950 border-slate-800" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="start_date">Start Date</Label>
                                    <Input id="start_date" name="start_date" type="date" className="bg-slate-950 border-slate-800" />
                                </div>
                                <div>
                                    <Label htmlFor="end_date">End Date</Label>
                                    <Input id="end_date" name="end_date" type="date" className="bg-slate-950 border-slate-800" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <input type="hidden" name="status" value={status} />
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="upcoming">Upcoming</SelectItem>
                                        <SelectItem value="ongoing">Ongoing</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Create Tournament</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                        No tournaments found. Create one to get started.
                    </div>
                )}
                {tournaments.map(t => (
                    <Link key={t.id} href={`/admin/tournaments/${t.id}`}>
                        <Card className="bg-slate-900 border-slate-800 text-white hover:border-indigo-500/50 transition-colors group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => handleDelete(t.id, e)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
                                        <Trophy className="w-6 h-6" />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${t.status === 'ongoing' ? 'bg-green-500/20 text-green-400 border-green-500/50 animate-pulse' :
                                        t.status === 'completed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                            'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                        }`}>
                                        {t.status}
                                    </span>
                                </div>
                                <CardTitle className="text-xl group-hover:text-indigo-400 transition-colors">{t.name}</CardTitle>
                                <CardDescription className="text-slate-500 line-clamp-1">
                                    {t.slug || 'No slug'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBA'}
                                    {' - '}
                                    {t.end_date ? new Date(t.end_date).toLocaleDateString() : 'TBA'}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t border-slate-800 pt-4 bg-slate-950/30 group-hover:bg-indigo-900/10 transition-colors">
                                <div className="w-full flex justify-between items-center text-sm font-bold text-slate-400 group-hover:text-indigo-300">
                                    <span>Manage Teams</span>
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </CardFooter>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
