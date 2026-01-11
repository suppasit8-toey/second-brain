'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus } from 'lucide-react'
import { getTournaments, getTeams, addScrimPartners } from '../../actions'
import { Tournament, Team } from '@/utils/types'

interface ImportTeamDialogProps {
    targetTournamentId: string;
    onImportSuccess: () => void;
}

export default function ImportTeamDialog({ targetTournamentId, onImportSuccess }: ImportTeamDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [sourceTournamentId, setSourceTournamentId] = useState<string>('')
    const [sourceTeams, setSourceTeams] = useState<Team[]>([])
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])

    useEffect(() => {
        if (open) {
            loadTournaments()
        }
    }, [open])

    useEffect(() => {
        if (sourceTournamentId) {
            loadTeams(sourceTournamentId)
        } else {
            setSourceTeams([])
            setSelectedTeamIds([])
        }
    }, [sourceTournamentId])

    const loadTournaments = async () => {
        const data = await getTournaments()
        setTournaments(data.filter((t: Tournament) => t.id !== targetTournamentId))
    }

    const loadTeams = async (tId: string) => {
        const data = await getTeams(tId)
        setSourceTeams(data)
    }

    const toggleTeam = (teamId: string) => {
        setSelectedTeamIds(prev =>
            prev.includes(teamId)
                ? prev.filter(id => id !== teamId)
                : [...prev, teamId]
        )
    }

    const toggleAll = () => {
        if (selectedTeamIds.length === sourceTeams.length) {
            setSelectedTeamIds([])
        } else {
            setSelectedTeamIds(sourceTeams.map(t => t.id))
        }
    }

    const handleImport = async () => {
        if (selectedTeamIds.length === 0) return
        setLoading(true)

        const res = await addScrimPartners(targetTournamentId, selectedTeamIds)

        if (res.success) {
            setOpen(false)
            onImportSuccess()
        } else {
            alert('Import failed: ' + res.error)
        }
        setLoading(false)
    }

    const selectedTournamentName = tournaments.find(t => t.id === sourceTournamentId)?.name

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <Plus className="w-4 h-4" /> Import Scrim Partner
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle>Import Scrim Partners</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>From Tournament Folder</Label>
                        <Select value={sourceTournamentId} onValueChange={setSourceTournamentId}>
                            <SelectTrigger className="bg-slate-950 border-slate-800">
                                {selectedTournamentName || <span className="text-slate-500">Select Tournament...</span>}
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                {tournaments.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sourceTournamentId && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Select Teams ({selectedTeamIds.length})</Label>
                                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-6 text-xs text-indigo-400 hover:text-indigo-300">
                                    {selectedTeamIds.length === sourceTeams.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 rounded-md p-2">
                                <ScrollArea className="h-[200px] w-full pr-4">
                                    {sourceTeams.length === 0 ? (
                                        <div className="text-slate-500 text-sm text-center py-4">No teams found in this tournament.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {sourceTeams.map(team => (
                                                <div key={team.id} className="flex items-center space-x-2 hover:bg-slate-900 p-2 rounded cursor-pointer" onClick={() => toggleTeam(team.id)}>
                                                    <Checkbox
                                                        id={`team-${team.id}`}
                                                        checked={selectedTeamIds.includes(team.id)}
                                                        onCheckedChange={() => toggleTeam(team.id)}
                                                        className="border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                    />
                                                    <label
                                                        htmlFor={`team-${team.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 text-slate-200"
                                                    >
                                                        {team.name} <span className="text-slate-500 ml-1">({team.short_name})</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleImport}
                        disabled={selectedTeamIds.length === 0 || loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                    >
                        {loading ? 'Importing...' : `Import ${selectedTeamIds.length} Teams`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
