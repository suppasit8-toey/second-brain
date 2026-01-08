'use client'

import { useState, useEffect, use } from 'react'
import { getTournament, getTeams, createTeam, deleteTeam, getPlayers, createPlayer, deletePlayer } from '../actions'
import { Tournament, Team } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Trash2, Plus, Users, ArrowLeft, Shield, Upload, X } from 'lucide-react'
import { CldUploadButton } from 'next-cloudinary'
// import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import Image from 'next/image'

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [uploadedLogo, setUploadedLogo] = useState('')
    // const { toast } = useToast()

    useEffect(() => {
        loadData()
    }, [id])

    const loadData = async () => {
        const t = await getTournament(id)
        if (t) {
            setTournament(t)
            const teamsData = await getTeams(t.id)
            setTeams(teamsData)
        }
    }

    async function handleCreateTeam(formData: FormData) {
        if (!tournament) return
        formData.append('tournament_id', tournament.id)
        formData.append('path', `/admin/tournaments/${id}`)

        const res = await createTeam(formData)

        if (res.error) {
            alert('Error: ' + res.error)
        } else {
            // alert('Success: Team added!')
            // alert('Success: Team added!')
            setIsOpen(false)
            setUploadedLogo('')
            loadData()
        }
    }

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm('Area you sure?')) return
        const res = await deleteTeam(teamId, id)
        if (res.error) {
            alert('Error: ' + res.error)
        } else {
            // alert('Success: Team removed')
            loadData()
        }
    }

    if (!tournament) return <div className="p-8 text-slate-500">Loading tournament...</div>

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <Link href="/admin/tournaments" className="inline-flex items-center text-slate-400 hover:text-white mb-4 gap-1 text-sm font-bold transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Tournaments
                </Link>
                <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                            <Shield className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{tournament.name}</h1>
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs font-bold bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 uppercase">{tournament.status}</span>
                            </div>
                        </div>
                    </div>
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open)
                        if (!open) setUploadedLogo('')
                    }}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                <Plus className="w-4 h-4" /> Add Team
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-800 text-white">
                            <DialogHeader>
                                <DialogTitle>Add Team to Tournament</DialogTitle>
                            </DialogHeader>
                            <form action={handleCreateTeam} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Team Name</Label>
                                    <Input id="name" name="name" placeholder="Full Team Name" required className="bg-slate-950 border-slate-800" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="short_name">Short Name (Tag)</Label>
                                        <Input id="short_name" name="short_name" placeholder="e.g. BAC" className="bg-slate-950 border-slate-800" />
                                    </div>
                                    <div>
                                        <Label>Team Logo</Label>
                                        <input type="hidden" name="logo_url" value={uploadedLogo} />
                                        <div className="mt-1 flex items-center gap-3">
                                            <div className="relative w-10 h-10 bg-slate-950 rounded border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                {uploadedLogo ? (
                                                    <Image src={uploadedLogo} alt="Logo" fill className="object-contain" />
                                                ) : (
                                                    <Upload className="w-4 h-4 text-slate-600" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <CldUploadButton
                                                    uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default'}
                                                    onSuccess={(result: any) => setUploadedLogo(result.info.secure_url)}
                                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded border border-slate-700 transition-colors"
                                                >
                                                    {uploadedLogo ? 'Change Logo' : 'Upload Logo'}
                                                </CldUploadButton>
                                            </div>
                                            {uploadedLogo && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-slate-500 hover:text-red-400"
                                                    onClick={() => setUploadedLogo('')}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Add Team</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Teams Grid */}
            <div>
                <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Participating Teams ({teams.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {teams.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                            No teams added yet.
                        </div>
                    )}
                    {teams.map(team => (
                        <Card key={team.id} className="bg-slate-900 border-slate-800 text-white group hover:border-indigo-500/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-lg font-bold truncate pr-2">{team.name}</CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-400 -mr-2" onClick={() => handleDeleteTeam(team.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                        {team.logo_url ? (
                                            <Image src={team.logo_url} alt={team.name} width={40} height={40} className="object-contain" />
                                        ) : (
                                            <span className="text-xs font-bold text-slate-600">{team.short_name || '?'}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tag</div>
                                        <div className="font-mono text-indigo-400 font-bold">{team.short_name || 'N/A'}</div>
                                    </div>
                                </div>
                                <ManageRosterButton team={team} tournamentId={id} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}

function ManageRosterButton({ team, tournamentId }: { team: Team, tournamentId: string }) {
    return (
        <Link href={`/admin/tournaments/${tournamentId}/teams/${team.slug || team.id}`} className="block">
            <Button variant="outline" size="sm" className="w-full border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <Users className="w-4 h-4 mr-2" /> Manage Roster
            </Button>
        </Link>
    )
}

