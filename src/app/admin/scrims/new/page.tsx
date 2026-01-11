'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createScrim, getLatestScrimId } from '../actions'
import { getTeams, getScrimPartnerTeams } from '../../tournaments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Gamepad2, FileText, Calendar as CalendarIcon, Check, ChevronsUpDown } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import Link from 'next/link'
import { Version, Tournament, Team } from '@/utils/types'

export default function NewScrimPage() {
    const [loading, setLoading] = useState(false)
    const [versions, setVersions] = useState<Version[]>([])
    const [tournaments, setTournaments] = useState<Tournament[]>([])

    // Split teams
    const [participants, setParticipants] = useState<Team[]>([])
    const [partners, setPartners] = useState<Team[]>([])

    // Combobox Open States
    const [openA, setOpenA] = useState(false)
    const [openB, setOpenB] = useState(false)

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [predictedId, setPredictedId] = useState('Loading...')
    const [versionId, setVersionId] = useState('')
    const [tournamentId, setTournamentId] = useState('')
    const [teamA, setTeamA] = useState('')
    const [teamB, setTeamB] = useState('')
    const [bestOf, setBestOf] = useState('BO4')
    const [mode, setMode] = useState<'FULL' | 'SUMMARY'>('FULL')

    // 1. Load Global Options (Versions, Tournaments)
    useEffect(() => {
        const loadGlobalOptions = async () => {
            const supabase = createClient()
            const [vRes, tRes, nextId] = await Promise.all([
                supabase.from('versions').select('*').order('created_at', { ascending: false }),
                supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
                getLatestScrimId()
            ])

            if (nextId) setPredictedId(nextId)

            if (vRes.data && vRes.data.length > 0) {
                setVersions(vRes.data)
                const active = vRes.data.find((v: Version) => v.is_active)
                setVersionId(active ? active.id.toString() : vRes.data[0].id.toString())
            }
            if (tRes.data && tRes.data.length > 0) {
                setTournaments(tRes.data)
                setTournamentId(tRes.data[0].id)
            }
        }
        loadGlobalOptions()
    }, [])

    // 2. Fetch Teams when Tournament Changes (Participants vs Partners)
    useEffect(() => {
        if (!tournamentId) {
            setParticipants([])
            setPartners([])
            return
        }

        const fetchTeams = async () => {
            const [p, s] = await Promise.all([
                getTeams(tournamentId),
                getScrimPartnerTeams(tournamentId)
            ])
            // Sort
            p.sort((a, b) => a.name.localeCompare(b.name))
            s.sort((a, b) => a.name.localeCompare(b.name))

            setParticipants(p)
            setPartners(s)
        }

        fetchTeams()
    }, [tournamentId])

    // Derived Options
    // Team A: Participants Only
    const teamAOptions = participants

    // Team B: Participants + Partners (Unique)
    const teamBOptions = [...participants, ...partners].filter((t, index, self) =>
        index === self.findIndex((x) => x.id === t.id)
    ).sort((a, b) => a.name.localeCompare(b.name))


    const getVersionLabel = () => {
        if (!versionId) return 'Select patch...'
        const v = versions.find(v => v.id.toString() === versionId)
        return v ? v.name : versionId
    }

    const getTournamentLabel = () => {
        if (!tournamentId) return 'Select event...'
        const t = tournaments.find(t => t.id === tournamentId)
        return t ? t.name : tournamentId
    }

    const getGameCountLabel = () => {
        switch (bestOf) {
            case 'BO1': return '1 Game (BO1)'
            case 'BO2': return '2 Games'
            case 'BO3': return '3 Games'
            case 'BO4': return '4 Games'
            case 'BO5': return '5 Games'
            case 'BO7': return '7 Games (BO7)'
            default: return 'Select Series Length'
        }
    }

    const [error, setError] = useState('')

    async function onSubmit(formData: FormData) {
        setLoading(true)
        setError('')

        try {
            const result = await createScrim(formData)
            if (result?.error) {
                setError(result.error)
                setLoading(false)
            }
        } catch (e: any) {
            if (e.message === 'NEXT_REDIRECT') {
                throw e
            }
            console.error(e)
            setError('An unexpected error occurred: ' + (e.message || 'Unknown'))
            setLoading(false)
        }
    }

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8">
            <div>
                <Link href="/admin/scrims" className="inline-flex items-center text-slate-400 hover:text-white mb-4 gap-1 text-sm font-bold transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Logs
                </Link>
                <h1 className="text-3xl font-black italic text-white tracking-tighter uppercase">New Scrimmage</h1>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <div className="font-bold">Error:</div>
                    {error}
                </div>
            )}

            <form action={onSubmit} className="space-y-8">
                {/* Hidden Inputs for FormData */}
                <input type="hidden" name="match_date" value={date} />
                <input type="hidden" name="version_id" value={versionId} />
                <input type="hidden" name="tournament_id" value={tournamentId} />
                <input type="hidden" name="team_a_name" value={teamA} />
                <input type="hidden" name="team_b_name" value={teamB} />
                <input type="hidden" name="best_of" value={bestOf} />
                <input type="hidden" name="mode" value={mode} />

                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6 space-y-6">

                        <div className="grid grid-cols-2 gap-6">
                            {/* 1. Date */}
                            <div className="space-y-2">
                                <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4" /> Date
                                </Label>
                                <Input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-slate-950 border-slate-800 text-white w-full"
                                />
                            </div>

                            {/* Predicted ID */}
                            <div className="space-y-2">
                                <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider">
                                    Next Match ID
                                </Label>
                                <Input
                                    disabled
                                    value={predictedId}
                                    className="bg-slate-900 border-slate-800 text-slate-400 font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {/* 2. Version */}
                            <div className="space-y-2">
                                <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider">Game Version</Label>
                                <Select value={versionId} onValueChange={setVersionId}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                        <span className="truncate">{getVersionLabel()}</span>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {versions.map(v => (
                                            <SelectItem key={v.id} value={v.id.toString()}>
                                                {v.name} {v.is_active && '(Active)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 3. Tournament */}
                            <div className="space-y-2">
                                <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider">Tournament / Event</Label>
                                <Select value={tournamentId} onValueChange={setTournamentId}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                        <span className="truncate">{getTournamentLabel()}</span>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {tournaments.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Teams - Comboboxes */}
                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                            <div className="space-y-2 flex flex-col">
                                <Label className="text-white uppercase text-xs font-bold tracking-wider mb-2">Team A (Participants)</Label>
                                <Popover open={openA} onOpenChange={setOpenA}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openA}
                                            className="w-full justify-between bg-slate-950 border-slate-800 text-white hover:bg-slate-900 hover:text-white"
                                        >
                                            {teamA
                                                ? teamAOptions.find((t) => t.name === teamA)?.name || teamA
                                                : "Select team..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 bg-slate-900 border-slate-800 text-white">
                                        <Command className="bg-slate-900">
                                            <CommandInput placeholder="Search team..." className="text-white" />
                                            <CommandList>
                                                <CommandEmpty>No team found.</CommandEmpty>
                                                <CommandGroup>
                                                    {teamAOptions.map((t) => (
                                                        <CommandItem
                                                            key={t.id}
                                                            value={t.name}
                                                            onSelect={(currentValue) => {
                                                                setTeamA(currentValue === teamA ? "" : currentValue)
                                                                setOpenA(false)
                                                            }}
                                                            className="text-slate-200 aria-selected:bg-indigo-900/50 aria-selected:text-white"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    teamA === t.name ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {t.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2 flex flex-col">
                                <Label className="text-white uppercase text-xs font-bold tracking-wider mb-2">Team B (Participants + Scrim Partners)</Label>
                                <Popover open={openB} onOpenChange={setOpenB}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openB}
                                            className="w-full justify-between bg-slate-950 border-slate-800 text-white hover:bg-slate-900 hover:text-white"
                                        >
                                            {teamB
                                                ? teamBOptions.find((t) => t.name === teamB)?.name || teamB
                                                : "Select team..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 bg-slate-900 border-slate-800 text-white">
                                        <Command className="bg-slate-900">
                                            <CommandInput placeholder="Search team..." className="text-white" />
                                            <CommandList>
                                                <CommandEmpty>No team found.</CommandEmpty>
                                                <CommandGroup>
                                                    {teamBOptions
                                                        .filter(t => t.name !== teamA) // Exclude current Team A from B
                                                        .map((t) => (
                                                            <CommandItem
                                                                key={t.id}
                                                                value={t.name}
                                                                onSelect={(currentValue) => {
                                                                    setTeamB(currentValue === teamB ? "" : currentValue)
                                                                    setOpenB(false)
                                                                }}
                                                                className="text-slate-200 aria-selected:bg-indigo-900/50 aria-selected:text-white"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        teamB === t.name ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {t.name}
                                                                {/* Show tag if Scrim Partner? */}
                                                                {t.role === 'scrim_partner' && <span className="ml-2 text-xs text-emerald-500 font-bold">[SP]</span>}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Best Of / Game Count */}
                        <div className="space-y-2 pt-4 border-t border-slate-800">
                            <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider">Number of Games</Label>
                            <Select value={bestOf} onValueChange={setBestOf}>
                                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                    <span className="truncate">{getGameCountLabel()}</span>
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                    <SelectItem value="BO1">1 Game (BO1)</SelectItem>
                                    <SelectItem value="BO2">2 Games</SelectItem>
                                    <SelectItem value="BO3">3 Games</SelectItem>
                                    <SelectItem value="BO4">4 Games</SelectItem>
                                    <SelectItem value="BO5">5 Games</SelectItem>
                                    <SelectItem value="BO7">7 Games (BO7)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 4. Mode Selection */}
                        <div className="pt-4 border-t border-slate-800 space-y-4">
                            <Label className="text-slate-400 uppercase text-xs font-bold tracking-wider">Recording Mode</Label>

                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setMode('FULL')}
                                    className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-2 transition-all ${mode === 'FULL' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                                        <Gamepad2 className="w-5 h-5" /> Full Draft Simulator
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Simulate the ban/pick phase step-by-step. Records exact pick order and timing.
                                    </p>
                                </div>

                                <div
                                    onClick={() => setMode('SUMMARY')}
                                    className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-2 transition-all ${mode === 'SUMMARY' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                                        <FileText className="w-5 h-5" /> Quick Result Entry
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Directly input the 5 heroes, roles, and winner. For recording historical matches.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" size="lg" disabled={loading} className="w-full bg-green-600 hover:bg-green-500 font-bold text-lg h-12 mt-6">
                            {loading ? <span className="animate-spin mr-2">⏳</span> : <Save className="w-5 h-5 mr-2" />}
                            Create Scrim Log
                        </Button>

                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
