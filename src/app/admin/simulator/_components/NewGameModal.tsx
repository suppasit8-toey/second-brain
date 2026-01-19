'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createGame } from '../actions'
import { DraftMatch } from '@/utils/types'
import { Loader2, Copy, Check } from 'lucide-react'

interface NewGameModalProps {
    match: DraftMatch;
    nextGameNumber: number;
}

export default function NewGameModal({ match, nextGameNumber }: NewGameModalProps) {
    const [open, setOpen] = useState(false)
    const [blueSide, setBlueSide] = useState<string>(match.team_a_name)
    const [loading, setLoading] = useState(false)
    const [createdGameId, setCreatedGameId] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)

    const router = useRouter()

    const handleCreate = async () => {
        setLoading(true)
        const redSide = blueSide === match.team_a_name ? match.team_b_name : match.team_a_name

        const res = await createGame(match.id, nextGameNumber, blueSide, redSide)
        setLoading(false)

        if (res.success) {
            setCreatedGameId(res.gameId)
        }
    }

    const handleClose = (v: boolean) => {
        setOpen(v)
        if (!v) {
            // Reset state after a delay to allow animation to finish
            setTimeout(() => {
                setCreatedGameId(null)
                setIsCopied(false)
            }, 300)
        }
    }

    if (createdGameId) {
        const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/match/${match.slug || match.id}` : ''

        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300">
                        + Start Game {nextGameNumber}
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-green-400 flex items-center gap-2">
                            <Check className="w-5 h-5" />
                            Game Created Successfully!
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-400">
                            The draft room is ready. You can share this link with others to let them spectate or control the draft.
                        </p>

                        <div className="flex items-center gap-2 p-3 bg-slate-950 rounded border border-slate-800">
                            <code className="flex-1 text-xs truncate text-slate-400 font-mono">{shareUrl}</code>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-slate-800 hover:text-white"
                                onClick={() => {
                                    navigator.clipboard.writeText(shareUrl)
                                    setIsCopied(true)
                                    setTimeout(() => setIsCopied(false), 2000)
                                }}
                            >
                                {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="border-slate-700 hover:bg-slate-800 text-slate-300"
                                onClick={() => handleClose(false)}
                            >
                                Close
                            </Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => router.push(`/admin/simulator/${match.id}/draft/${createdGameId}`)}
                            >
                                Enter Draft Room
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
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
                            {/* Team A Card */}
                            <div>
                                <RadioGroupItem value={match.team_a_name} id="team_a" className="peer sr-only" />
                                {(() => {
                                    const isBlue = blueSide === match.team_a_name;
                                    const colorClass = isBlue
                                        ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                                        : 'border-red-500 text-red-500 bg-red-500/10';
                                    return (
                                        <Label
                                            htmlFor="team_a"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all ${colorClass}`}
                                        >
                                            <span className="text-xl font-bold mb-1">{match.team_a_name}</span>
                                            <span className={`text-xs ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>
                                                {isBlue ? 'BLUE SIDE' : 'RED SIDE'}
                                            </span>
                                        </Label>
                                    );
                                })()}
                            </div>

                            {/* Team B Card */}
                            <div>
                                <RadioGroupItem value={match.team_b_name} id="team_b" className="peer sr-only" />
                                {(() => {
                                    const isBlue = blueSide === match.team_b_name;
                                    const colorClass = isBlue
                                        ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                                        : 'border-red-500 text-red-500 bg-red-500/10';
                                    return (
                                        <Label
                                            htmlFor="team_b"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all ${colorClass}`}
                                        >
                                            <span className="text-xl font-bold mb-1">{match.team_b_name}</span>
                                            <span className={`text-xs ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>
                                                {isBlue ? 'BLUE SIDE' : 'RED SIDE'}
                                            </span>
                                        </Label>
                                    );
                                })()}
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="rounded-lg bg-slate-950 p-4 text-sm text-slate-400">
                        <p>Blue Side: <span className="text-blue-400 font-bold">{blueSide}</span></p>
                        <p>Red Side: <span className="text-red-400 font-bold">{blueSide === match.team_a_name ? match.team_b_name : match.team_a_name}</span></p>
                    </div>

                    <Button onClick={handleCreate} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
