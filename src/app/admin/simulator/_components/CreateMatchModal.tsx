'use client'

import { useState, useEffect, useActionState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Version, Tournament, Team } from '@/utils/types'
import { createMatch } from '../actions'
import { getTeams } from '../../tournaments/actions'
import { useRouter } from 'next/navigation'

interface CreateMatchModalProps {
    versions: Version[]
    tournaments: Tournament[]
}

const initialState = {
    message: '',
    success: false,
    matchId: ''
}

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700">
            {pending ? 'Creating...' : 'Start Match'}
        </Button>
    )
}

export default function CreateMatchModal({ versions, tournaments }: CreateMatchModalProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Setup initial version if available
    const activeVersion = versions.find(v => v.is_active) || versions[0]

    // Form State
    const [state, formAction] = useActionState(createMatch, initialState)

    // UI States
    const [selectedMode, setSelectedMode] = useState<string>('BO5')
    const [isCustomTeams, setIsCustomTeams] = useState(false)

    // Tournament Logic
    const [selectedTournament, setSelectedTournament] = useState<string>('none')
    const [tournamentTeams, setTournamentTeams] = useState<Team[]>([])
    const [loadingTeams, setLoadingTeams] = useState(false)
    const [teamA, setTeamA] = useState('')
    const [teamB, setTeamB] = useState('')


    // Fetch teams when tournament changes
    useEffect(() => {
        if (selectedTournament && selectedTournament !== 'none') {
            startTransition(async () => {
                setLoadingTeams(true)
                const teams = await getTeams(selectedTournament)
                setTournamentTeams(teams)
                setLoadingTeams(false)
            })
        } else {
            setTournamentTeams([])
            setTeamA('')
            setTeamB('')
        }
    }, [selectedTournament])

    // Handle Success Redirect
    useEffect(() => {
        if (state.success && state.matchId) {
            setOpen(false)
            router.push(`/admin/simulator/${state.matchId}`)
        }
    }, [state, router])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                    + Create New Match
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Setup New Match</DialogTitle>
                </DialogHeader>

                <form action={formAction} className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
                    {state.message && !state.success && (
                        <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
                            {state.message}
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label>Patch Version</Label>
                        {/* Hidden input to ensure version_id is sent */}
                        <input type="hidden" name="version_id" value={activeVersion?.id} />
                        <Input
                            readOnly
                            disabled
                            value={activeVersion?.name || 'Unknown Version'}
                            className="bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed font-medium"
                        />
                    </div>

                    {/* Tournament Selection */}
                    <div className="grid gap-2">
                        <Label>Tournament (Optional)</Label>
                        <input type="hidden" name="tournament_id" value={selectedTournament === 'none' ? '' : selectedTournament} />
                        <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select Tournament" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 hover:!bg-slate-800">
                                <SelectItem value="none">None (Friendly Match)</SelectItem>
                                {tournaments.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4 rounded-lg bg-slate-950/50 p-4 border border-slate-800">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-slate-300">Team Names</Label>
                            {selectedTournament === 'none' && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => setIsCustomTeams(!isCustomTeams)}
                                    className="h-auto p-0 text-xs text-blue-400 hover:text-blue-300"
                                >
                                    {isCustomTeams ? 'Reset to Default' : 'Customize Team Names'}
                                </Button>
                            )}
                        </div>

                        {/* Team Selection Logic */}
                        {selectedTournament !== 'none' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs text-slate-400">Team A</Label>
                                    <input type="hidden" name="team_a_name" value={teamA} />
                                    <Select value={teamA} onValueChange={setTeamA}>
                                        <SelectTrigger className="bg-slate-800 border-slate-700" disabled={loadingTeams}>
                                            <SelectValue placeholder={loadingTeams ? "Loading..." : "Select Team A"} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            {tournamentTeams.map(t => (
                                                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs text-slate-400">Team B</Label>
                                    <input type="hidden" name="team_b_name" value={teamB} />
                                    <Select value={teamB} onValueChange={setTeamB}>
                                        <SelectTrigger className="bg-slate-800 border-slate-700" disabled={loadingTeams}>
                                            <SelectValue placeholder={loadingTeams ? "Loading..." : "Select Team B"} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            {tournamentTeams.map(t => (
                                                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : !isCustomTeams ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-center gap-3 text-lg font-bold bg-slate-900 p-3 rounded border border-slate-800/50">
                                    <span className="text-blue-400">Team A</span>
                                    <span className="text-slate-600 text-sm font-normal">VS</span>
                                    <span className="text-red-400">Team B</span>
                                    <input type="hidden" name="team_a_name" value="Team A" />
                                    <input type="hidden" name="team_b_name" value="Team B" />
                                </div>
                                <p className="text-xs text-center text-slate-500">Default generic team names will be used.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="team_a" className="text-xs text-slate-400">Team A</Label>
                                        <Input
                                            id="team_a"
                                            name="team_a_name"
                                            placeholder="Team A Name"
                                            defaultValue="Team A"
                                            className="bg-slate-800 border-slate-700"
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="team_b" className="text-xs text-slate-400">Team B</Label>
                                        <Input
                                            id="team_b"
                                            name="team_b_name"
                                            placeholder="Team B Name"
                                            defaultValue="Team B"
                                            className="bg-slate-800 border-slate-700"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Preset Buttons */}
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {['Bacon Time', 'Buriram United', 'Talon', 'Hydra', 'eArena', 'Full Sense', 'King of Gamers', 'PSG Esports'].map(team => (
                                        <button
                                            key={team}
                                            type="button"
                                            onClick={() => {
                                                const form = document.querySelector('form') as HTMLFormElement
                                                const teamA = form.elements.namedItem('team_a_name') as HTMLInputElement
                                                const teamB = form.elements.namedItem('team_b_name') as HTMLInputElement

                                                if (teamA && teamB) {
                                                    if (teamA.value === 'Team A' || !teamA.value) teamA.value = team;
                                                    else if ((teamB.value === 'Team B' || !teamB.value) && teamA.value !== team) teamB.value = team;
                                                }
                                            }}
                                            className="text-[10px] px-2 py-1 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                        >
                                            {team}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mode">Mode</Label>
                        <input type="hidden" name="mode" value={selectedMode} />
                        <Select value={selectedMode} onValueChange={setSelectedMode}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select Series Type" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="BO1">Best of 1</SelectItem>
                                <SelectItem value="BO2">Best of 2</SelectItem>
                                <SelectItem value="BO3">Best of 3</SelectItem>
                                <SelectItem value="BO5">Best of 5</SelectItem>
                                <SelectItem value="BO7">Best of 7</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-4">
                        <SubmitButton />
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
