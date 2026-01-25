'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createGame } from '../actions'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, ShieldCheck } from 'lucide-react'
import { DraftMatch } from '@/utils/types'
import PreGameAnalysisDialog from './PreGameAnalysisDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface NewGameButtonProps {
    match: DraftMatch;
    gameNumber: number;
    disabled?: boolean;
}

export default function NewGameButton({ match, gameNumber, disabled }: NewGameButtonProps) {
    const [analysisOpen, setAnalysisOpen] = useState(false)
    const [setupOpen, setSetupOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [blueSide, setBlueSide] = useState<string>(match.team_a_name)

    const router = useRouter()

    const handleAnalysisProceed = () => {
        setAnalysisOpen(false)
        setSetupOpen(true)
    }

    const handleCreateGame = async () => {
        setLoading(true)
        const redSide = blueSide === match.team_a_name ? match.team_b_name : match.team_a_name

        const res = await createGame(match.id, gameNumber, blueSide, redSide)
        if (res.success && res.gameId) {
            setSetupOpen(false)
            router.refresh()
            const params = new URLSearchParams(window.location.search)
            params.set('game', res.gameId)
            router.push(`${window.location.pathname}?${params.toString()}`)
        } else {
            alert('Failed to start game: ' + res.message)
            setLoading(false)
        }
    }

    return (
        <>
            <Button
                disabled={disabled || loading}
                onClick={() => setAnalysisOpen(true)}
                variant="outline"
                className="w-full h-full min-h-[200px] border-dashed border-2 bg-slate-900/50 hover:bg-slate-900 border-slate-700 hover:border-indigo-500/50 flex flex-col items-center justify-center gap-4 group"
            >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                    <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400">Start Game {gameNumber}</h3>
                    <p className="text-sm text-slate-500">Click to enter analysis & draft</p>
                </div>
            </Button>

            {/* Step 1: Analysis */}
            <PreGameAnalysisDialog
                open={analysisOpen}
                onOpenChange={setAnalysisOpen}
                match={match}
                gameNumber={gameNumber}
                onProceed={handleAnalysisProceed}
            />

            {/* Step 2: Setup (Side Selection) */}
            <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">Setup Game {gameNumber}</DialogTitle>
                    </DialogHeader>

                    <div className="py-6 space-y-6">
                        <div className="text-center space-y-2">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-widest">Select Blue Side (First Pick)</h4>
                        </div>

                        <RadioGroup value={blueSide} onValueChange={setBlueSide} className="grid grid-cols-2 gap-4">
                            {/* Team A Card */}
                            <div>
                                <RadioGroupItem value={match.team_a_name} id={`team_a_g${gameNumber}`} className="peer sr-only" />
                                {(() => {
                                    const isBlue = blueSide === match.team_a_name;
                                    const colorClass = isBlue
                                        ? 'border-blue-500 text-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                        : 'border-red-500 text-red-500 bg-red-500/10 opacity-60 grayscale-[0.5]';
                                    return (
                                        <Label
                                            htmlFor={`team_a_g${gameNumber}`}
                                            className={`flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${colorClass}`}
                                        >
                                            <ShieldCheck className={`w-8 h-8 ${isBlue ? 'fill-blue-500/20' : 'fill-red-500/20'}`} />
                                            <span className="text-lg font-bold text-center px-2 break-words w-full">{match.team_a_name}</span>
                                            <span className="text-[10px] font-black tracking-widest uppercase">
                                                {isBlue ? 'BLUE SIDE' : 'RED SIDE'}
                                            </span>
                                        </Label>
                                    );
                                })()}
                            </div>

                            {/* Team B Card */}
                            <div>
                                <RadioGroupItem value={match.team_b_name} id={`team_b_g${gameNumber}`} className="peer sr-only" />
                                {(() => {
                                    const isBlue = blueSide === match.team_b_name;
                                    const colorClass = isBlue
                                        ? 'border-blue-500 text-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                        : 'border-red-500 text-red-500 bg-red-500/10 opacity-60 grayscale-[0.5]';
                                    return (
                                        <Label
                                            htmlFor={`team_b_g${gameNumber}`}
                                            className={`flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${colorClass}`}
                                        >
                                            <ShieldCheck className={`w-8 h-8 ${isBlue ? 'fill-blue-500/20' : 'fill-red-500/20'}`} />
                                            <span className="text-lg font-bold text-center px-2 break-words w-full">{match.team_b_name}</span>
                                            <span className="text-[10px] font-black tracking-widest uppercase">
                                                {isBlue ? 'BLUE SIDE' : 'RED SIDE'}
                                            </span>
                                        </Label>
                                    );
                                })()}
                            </div>
                        </RadioGroup>

                        <Button
                            onClick={handleCreateGame}
                            disabled={loading}
                            size="lg"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-12"
                        >
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            Start Draft Phase
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
