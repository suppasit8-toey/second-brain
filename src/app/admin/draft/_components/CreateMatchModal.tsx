'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Version } from '@/utils/types'
import { createMatch } from '../actions'
import { useRouter } from 'next/navigation'

interface CreateMatchModalProps {
    versions: Version[]
}

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700">
            {pending ? 'Creating...' : 'Start Match'}
        </Button>
    )
}

const initialState = {
    message: '',
    success: false,
    matchId: undefined
}

export default function CreateMatchModal({ versions }: CreateMatchModalProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    // Setup initial version if available
    const activeVersion = versions.find(v => v.is_active) || versions[0]
    const [selectedVersion, setSelectedVersion] = useState(activeVersion?.id.toString())
    const [selectedMode, setSelectedMode] = useState("BO5")

    async function action(prevState: any, formData: FormData) {
        const result = await createMatch(prevState, formData)
        if (result.success && result.matchId) {
            setOpen(false)
            router.push(`/admin/draft/${result.matchId}`)
        }
        return result
    }

    const [state, formAction] = useActionState(action, initialState)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                    + Create New Match
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Setup New Match</DialogTitle>
                </DialogHeader>

                <form action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="version">Patch Version</Label>
                        <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select Version" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                {versions.map((v) => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.name} {v.is_active && '(Active)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <input type="hidden" name="version_id" value={selectedVersion} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="team_a">Team A Name</Label>
                            <Input
                                id="team_a"
                                name="team_a_name"
                                placeholder="e.g. Bacon Time"
                                className="bg-slate-800 border-slate-700"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="team_b">Team B Name</Label>
                            <Input
                                id="team_b"
                                name="team_b_name"
                                placeholder="e.g. Buriram"
                                className="bg-slate-800 border-slate-700"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mode">Mode</Label>
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
                        <input type="hidden" name="mode" value={selectedMode} />
                    </div>

                    <div className="pt-4">
                        <SubmitButton />
                    </div>
                    {state.message && (
                        <div className="text-red-500 text-sm">{state.message}</div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    )
}
