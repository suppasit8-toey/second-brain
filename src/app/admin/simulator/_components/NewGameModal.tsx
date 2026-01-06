'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createGame } from '../actions'
import { DraftMatch } from '@/utils/types'
import { Loader2 } from 'lucide-react'

interface NewGameModalProps {
    match: DraftMatch;
    nextGameNumber: number;
}

export default function NewGameModal({ match, nextGameNumber }: NewGameModalProps) {
    const [open, setOpen] = useState(false)
    const [blueSide, setBlueSide] = useState<string>(match.team_a_name)
    const [loading, setLoading] = useState(false)

    const handleCreate = async () => {
        setLoading(true)
        const redSide = blueSide === match.team_a_name ? match.team_b_name : match.team_a_name

        const res = await createGame(match.id, nextGameNumber, blueSide, redSide)
        setLoading(false)

        if (res.success) {
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300">
                    + Start Game {nextGameNumber}
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Setup Game {nextGameNumber}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-4">
                        <Label className="text-base">Select Blue Side (First Pick)</Label>
                        <RadioGroup value={blueSide} onValueChange={setBlueSide} className="grid grid-cols-2 gap-4">
                            <div>
                                <RadioGroupItem value={match.team_a_name} id="team_a" className="peer sr-only" />
                                <Label
                                    htmlFor="team_a"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-slate-700 bg-slate-800 p-4 hover:bg-slate-700 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer transition-all"
                                >
                                    <span className="text-xl font-bold mb-1">{match.team_a_name}</span>
                                    <span className="text-xs text-slate-400">Team A</span>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value={match.team_b_name} id="team_b" className="peer sr-only" />
                                <Label
                                    htmlFor="team_b"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-slate-700 bg-slate-800 p-4 hover:bg-slate-700 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer transition-all"
                                >
                                    <span className="text-xl font-bold mb-1">{match.team_b_name}</span>
                                    <span className="text-xs text-slate-400">Team B</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="rounded-lg bg-slate-950 p-4 text-sm text-slate-400">
                        <p>Blue Side: <span className="text-blue-400 font-bold">{blueSide}</span></p>
                        <p>Red Side: <span className="text-red-400 font-bold">{blueSide === match.team_a_name ? match.team_b_name : match.team_a_name}</span></p>
                    </div>

                    <Button onClick={handleCreate} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create & Enter Draft
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
