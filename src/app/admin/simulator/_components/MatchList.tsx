
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RotateCcw, Trash2, Copy, Check } from 'lucide-react'
import { deleteMatch } from '../actions'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

interface MatchListProps {
    matches: any[]
}

export default function MatchList({ matches }: MatchListProps) {
    const [year, setYear] = useState<string>('all')
    const [month, setMonth] = useState<string>('all')
    const [day, setDay] = useState<string>('all')
    const [patch, setPatch] = useState<string>('all')
    const [mode, setMode] = useState<string>('all')

    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    // Extract unique options
    const years = Array.from(new Set(matches.map(m => new Date(m.created_at).getFullYear()))).sort((a, b) => b - a)
    const months = Array.from(new Set(matches.map(m => new Date(m.created_at).getMonth() + 1))).sort((a, b) => a - b)
    const days = Array.from(new Set(matches.map(m => new Date(m.created_at).getDate()))).sort((a, b) => a - b)
    const patches = Array.from(new Set(matches.map(m => m.version?.name).filter(Boolean))).sort()
    const modes = Array.from(new Set(matches.map(m => m.mode).filter(Boolean))).sort()

    const filteredMatches = matches.filter(match => {
        const date = new Date(match.created_at)
        const matchYear = date.getFullYear().toString()
        const matchMonth = (date.getMonth() + 1).toString()
        const matchDay = date.getDate().toString()
        const matchPatch = match.version?.name || ''
        const matchMode = match.mode || ''

        if (year !== 'all' && matchYear !== year) return false
        if (month !== 'all' && matchMonth !== month) return false
        if (day !== 'all' && matchDay !== day) return false
        if (patch !== 'all' && matchPatch !== patch) return false
        if (mode !== 'all' && matchMode !== mode) return false

        return true
    })

    const resetFilters = () => {
        setYear('all')
        setMonth('all')
        setDay('all')
        setPatch('all')
        setMode('all')
    }

    const handleDeleteClick = (id: string) => {
        setDeleteId(id)
    }

    const handleConfirmDelete = async () => {
        if (!deleteId) return

        try {
            await deleteMatch(deleteId)
            setDeleteId(null)
        } catch (error) {
            console.error('Failed to delete match:', error)
            alert('Failed to delete match')
        }
    }

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
                <span className="text-sm font-medium text-slate-400">Filters:</span>

                <Select value={year === 'all' ? undefined : year} onValueChange={setYear}>
                    <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all" className="focus:bg-slate-800 focus:text-white">All</SelectItem>
                        {years.map(y => <SelectItem key={y} value={y.toString()} className="focus:bg-slate-800 focus:text-white">{y}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={month === 'all' ? undefined : month} onValueChange={setMonth}>
                    <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all" className="focus:bg-slate-800 focus:text-white">All</SelectItem>
                        {months.map(m => <SelectItem key={m} value={m.toString()} className="focus:bg-slate-800 focus:text-white">{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={day === 'all' ? undefined : day} onValueChange={setDay}>
                    <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all" className="focus:bg-slate-800 focus:text-white">All</SelectItem>
                        {days.map(d => <SelectItem key={d} value={d.toString()} className="focus:bg-slate-800 focus:text-white">{d}</SelectItem>)}
                    </SelectContent>
                </Select>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                <Select value={patch === 'all' ? undefined : patch} onValueChange={setPatch}>
                    <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Patch" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all" className="focus:bg-slate-800 focus:text-white">All</SelectItem>
                        {patches.map((p: any) => <SelectItem key={p} value={p} className="focus:bg-slate-800 focus:text-white">{p}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={mode === 'all' ? undefined : mode} onValueChange={setMode}>
                    <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all" className="focus:bg-slate-800 focus:text-white">All</SelectItem>
                        {modes.map((m: any) => <SelectItem key={m} value={m} className="focus:bg-slate-800 focus:text-white">{m}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset Filters" className="text-slate-400 hover:text-white ml-auto">
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>

            {/* Match List Rows */}
            <div className="space-y-3">
                {filteredMatches.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                        <p className="text-slate-400">No matches found for selected criteria.</p>
                    </div>
                ) : (
                    filteredMatches.map((match) => (
                        <Card key={match.id} className="bg-slate-900 border-slate-800 text-slate-200 hover:border-indigo-500/30 transition-all duration-200 shadow-none">
                            <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">

                                {/* Status & Meta */}
                                <div className="flex items-center gap-4 min-w-[150px] w-full md:w-auto justify-between md:justify-start">
                                    <div className="flex items-center gap-2">
                                        {match.status === 'ongoing' ? (
                                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 whitespace-nowrap">
                                                LIVE
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-800 text-slate-400 hover:bg-slate-700 whitespace-nowrap">Finished</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end md:items-start">
                                        <span className="text-xs text-slate-500">Patch {match.version?.name}</span>
                                        <span className="text-xs font-mono text-slate-400">{match.mode}</span>
                                    </div>
                                </div>

                                {/* Teams (Center) */}
                                <div className="flex-1 flex items-center justify-center gap-8 w-full md:w-auto">
                                    <h3 className="text-base font-bold text-white text-right flex-1 truncate">{match.team_a_name}</h3>
                                    <span className="text-slate-600 font-mono text-xs">VS</span>
                                    <h3 className="text-base font-bold text-white text-left flex-1 truncate">{match.team_b_name}</h3>
                                </div>

                                {/* Date & Action */}
                                <div className="flex items-center gap-3 md:gap-6 min-w-full md:min-w-[200px] justify-between md:justify-end mt-2 md:mt-0 border-t md:border-0 border-slate-800/50 pt-2 md:pt-0">
                                    <span className="text-sm text-slate-500 block md:hidden lg:block text-xs">
                                        {new Date(match.created_at).toLocaleDateString(undefined, {
                                            year: '2-digit',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>

                                    <div className="flex items-center gap-2 ml-auto">
                                        <Link href={`/admin/simulator/${match.slug || match.id}`}>
                                            <Button size="sm" variant={match.status === 'ongoing' ? "default" : "outline"} className={match.status === 'ongoing' ? "bg-indigo-600 hover:bg-indigo-700 h-8 text-xs text-white" : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 h-8 text-xs text-slate-300"}>
                                                {match.status === 'ongoing' ? 'Enter Room' : 'View Summary'}
                                            </Button>
                                        </Link>

                                        {match.status === 'ongoing' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 h-8 w-8 p-0"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/share/match/${match.slug || match.id}`
                                                    navigator.clipboard.writeText(url)
                                                    setCopiedId(match.id)
                                                    setTimeout(() => setCopiedId(null), 2000)
                                                }}
                                                title="Copy Match Link"
                                            >
                                                {copiedId === match.id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                            onClick={() => handleDeleteClick(match.id)}
                                            title="Delete Match"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <div className="text-slate-400 text-sm mt-2">
                            This action cannot be undone. This will permanently delete the match and all associated data including games and picks.
                        </div>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteId(null)}
                            className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                            Delete Match
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
