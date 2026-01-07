'use client'

import { useState, useEffect } from 'react'
import { Hero, POSITIONS } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Trophy, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { finishGame } from '@/app/actions/draftActions'
import { useRouter } from 'next/navigation'

interface PostDraftResultProps {
    gameId: string;
    blueTeamName: string;
    redTeamName: string;
    bluePicks: Record<number, string>;
    redPicks: Record<number, string>;
    blueBans: string[];
    redBans: string[];
    heroes: Hero[];
    nextGameId?: string;
    matchId?: string;
    manualLanes?: Record<string, string>;
    initialData?: {
        winner?: 'Blue' | 'Red' | null;
        blueKeyPlayer?: string;
        redKeyPlayer?: string;
        winPrediction?: number;
        notes?: string;
    }
    seriesScore: { blue: number, red: number };
    matchMode: string;
}

export default function PostDraftResult({
    gameId,
    blueTeamName,
    redTeamName,
    bluePicks,
    redPicks,
    blueBans,
    redBans,
    heroes,
    nextGameId,
    matchId,
    manualLanes = {},
    initialData,
    seriesScore = { blue: 0, red: 0 },
    matchMode
}: PostDraftResultProps) {
    const router = useRouter()
    const [assignments, setAssignments] = useState<Record<string, string>>(manualLanes)
    // ... existing state ... 
    const [winner, setWinner] = useState<'Blue' | 'Red' | null>(initialData?.winner || null)
    const [blueKeyPlayer, setBlueKeyPlayer] = useState<string>(initialData?.blueKeyPlayer || "")
    const [redKeyPlayer, setRedKeyPlayer] = useState<string>(initialData?.redKeyPlayer || "")
    const [winPrediction, setWinPrediction] = useState<number>(initialData?.winPrediction || 50)
    const [notes, setNotes] = useState(initialData?.notes || "")
    const [submitting, setSubmitting] = useState(false)

    // Helper: Get Hero
    const getHero = (id: string | number) => heroes.find(h => String(h.id) === String(id))

    // 1. Auto-fill logic
    useEffect(() => {
        const newAssignments: Record<string, string> = { ...assignments }
        const allPickIds = [...Object.values(bluePicks), ...Object.values(redPicks)]

        allPickIds.forEach(id => {
            // Only auto-assign if NOT manually set during draft
            if (!newAssignments[id]) {
                const h = getHero(id)
                // Filter main_position to find one that matches valid POSITIONS
                // This prevents assigning "Mage" or "Marksman" if they are not in POSITIONS
                const validRole = h?.main_position?.find(p => (POSITIONS as readonly string[]).includes(p))

                if (validRole) {
                    newAssignments[id] = validRole
                }
            }
        })
        setAssignments(newAssignments)
    }, [])

    const handleAssignmentChange = (heroId: string, role: string) => {
        setAssignments(prev => ({ ...prev, [heroId]: role }))
    }

    // Validation: Check for duplicates within a team
    const getUsedRoles = (teamPickIds: string[]) => {
        return teamPickIds.map(id => assignments[id]).filter(Boolean)
    }

    const hasDuplicateRoles = (teamPickIds: string[]) => {
        const roles = getUsedRoles(teamPickIds)
        const uniqueRoles = new Set(roles)
        return roles.length !== uniqueRoles.size
    }

    const [showSuccess, setShowSuccess] = useState(false)

    // ... existing helper ...

    // ... existing logic ...

    const handleSubmit = async () => {
        // ... (validation) ...
        if (!winner || !blueKeyPlayer || !redKeyPlayer) {
            alert("Please select a Winner and Key Players for BOTH teams.")
            return
        }
        const blueIds = Object.values(bluePicks)
        const redIds = Object.values(redPicks)

        if (hasDuplicateRoles(blueIds) || hasDuplicateRoles(redIds)) {
            if (!confirm("Warning: Duplicate roles detected. Do you want to proceed?")) return;
        }

        setSubmitting(true)

        // Compile Data
        const picksData: any[] = []

        // Process Blue Picks
        Object.entries(bluePicks).forEach(([idx, heroId]) => {
            picksData.push({
                hero_id: heroId,
                type: 'PICK',
                side: 'BLUE',
                position_index: parseInt(idx) + 1,
                assigned_role: assignments[heroId] || 'Flex'
            })
        })

        // Process Red Picks
        Object.entries(redPicks).forEach(([idx, heroId]) => {
            picksData.push({
                hero_id: heroId,
                type: 'PICK',
                side: 'RED',
                position_index: parseInt(idx) + 1,
                assigned_role: assignments[heroId] || 'Flex'
            })
        })

        // Process Bans (Standard)
        blueBans.forEach((heroId, idx) => picksData.push({ hero_id: heroId, type: 'BAN', side: 'BLUE', position_index: idx + 1 }))
        redBans.forEach((heroId, idx) => picksData.push({ hero_id: heroId, type: 'BAN', side: 'RED', position_index: idx + 1 }))

        const res = await finishGame({
            gameId,
            winner,
            blueKeyPlayer,
            redKeyPlayer,
            winPrediction: { blue: winPrediction, red: 100 - winPrediction },
            notes,
            picks: picksData
        })

        if (res.success) {
            router.refresh()
            setShowSuccess(true)
            setSubmitting(false)
        } else {
            alert("Error saving: " + res.message)
            setSubmitting(false)
        }
    }

    const renderTeamColumn = (side: 'Blue' | 'Red', teamName: string, pickMap: Record<number, string>) => {
        const pickIds = Object.values(pickMap)
        const usedRoles = getUsedRoles(pickIds)
        const isDupe = hasDuplicateRoles(pickIds)

        return (
            <div className={`flex-1 rounded-xl p-4 border ${side === 'Blue' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-xl font-bold ${side === 'Blue' ? 'text-blue-400' : 'text-red-400'}`}>{teamName}</h3>
                    {isDupe && <Badge variant="destructive" className="animate-pulse">Duplicate Roles!</Badge>}
                </div>

                <div className="space-y-3">
                    {pickIds.map(heroId => {
                        const hero = getHero(heroId)
                        if (!hero) return null
                        const currentRole = assignments[heroId]

                        return (
                            <div key={heroId} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                                <Image src={hero.icon_url} alt={hero.name} width={40} height={40} className="rounded border border-slate-700" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{hero.name}</p>
                                </div>
                                <div className="w-40">
                                    <Select value={currentRole} onValueChange={(val) => handleAssignmentChange(heroId, val)}>
                                        <SelectTrigger className={`h-8 text-xs border-slate-700 ${!currentRole ? 'text-yellow-500 border-yellow-500/50' : 'bg-slate-800'}`}>
                                            <SelectValue placeholder="Position" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 overflow-y-auto">
                                            {POSITIONS.map(p => {
                                                const isTaken = usedRoles.includes(p) && currentRole !== p
                                                return (
                                                    <SelectItem key={p} value={p} className={isTaken ? 'text-yellow-500' : ''}>
                                                        {p} {isTaken && '(Taken)'}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-6xl mx-auto space-y-4 pb-20">
                <Card className="bg-slate-900 border-slate-800 text-white shadow-2xl">
                    <CardHeader className="text-center border-b border-slate-800 bg-slate-950/50 rounded-t-xl py-6">
                        <Trophy className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
                        <CardTitle className="text-2xl font-black uppercase text-white">Match Analysis & Result</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {/* 1. Role Assignment */}
                        <div className="flex flex-col xl:flex-row gap-6 mb-8">
                            {renderTeamColumn('Blue', blueTeamName, bluePicks)}
                            {renderTeamColumn('Red', redTeamName, redPicks)}
                        </div>

                        {/* 2. Analysis & Result */}
                        <div className="bg-slate-950 rounded-xl p-6 border border-slate-800 space-y-8">

                            {/* Win Prediction */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <Label className="text-base text-blue-400">Blue Win %: {winPrediction}%</Label>
                                    <Label className="text-base text-red-400">Red Win %: {100 - winPrediction}%</Label>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={winPrediction}
                                    onChange={(e) => setWinPrediction(Number(e.target.value))}
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${winPrediction}%, #ef4444 ${winPrediction}%, #ef4444 100%)`
                                    }}
                                    className="w-full h-4 rounded-lg appearance-none cursor-pointer border border-slate-700 hover:opacity-90 transition-opacity"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest px-1">
                                    <span className={winPrediction > 50 ? "text-blue-500 transition-colors" : "transition-colors"}>Blue Favored</span>
                                    <span className={winPrediction < 50 ? "text-red-500 transition-colors" : "transition-colors"}>Red Favored</span>
                                </div>
                            </div>

                            {/* Key Players */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label className="text-sm mb-2 block text-blue-400 font-bold uppercase">Blue Team Key Player</Label>
                                    <Select value={blueKeyPlayer} onValueChange={setBlueKeyPlayer}>
                                        <SelectTrigger className="bg-slate-900 border-blue-900/50 h-12">
                                            <span className={!blueKeyPlayer ? "text-slate-500" : ""}>
                                                {blueKeyPlayer ? getHero(blueKeyPlayer)?.name : "Select Blue MVP"}
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(bluePicks).map(id => {
                                                const h = getHero(id); if (!h) return null;
                                                return <SelectItem key={id} value={id}>
                                                    <div className="flex items-center gap-2">
                                                        <Image src={h.icon_url} alt={h.name} width={24} height={24} className="rounded" />
                                                        <span>{h.name}</span>
                                                    </div>
                                                </SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-sm mb-2 block text-red-400 font-bold uppercase">Red Team Key Player</Label>
                                    <Select value={redKeyPlayer} onValueChange={setRedKeyPlayer}>
                                        <SelectTrigger className="bg-slate-900 border-red-900/50 h-12">
                                            <span className={!redKeyPlayer ? "text-slate-500" : ""}>
                                                {redKeyPlayer ? getHero(redKeyPlayer)?.name : "Select Red MVP"}
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(redPicks).map(id => {
                                                const h = getHero(id); if (!h) return null;
                                                return <SelectItem key={id} value={id}>
                                                    <div className="flex items-center gap-2">
                                                        <Image src={h.icon_url} alt={h.name} width={24} height={24} className="rounded" />
                                                        <span>{h.name}</span>
                                                    </div>
                                                </SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Winner Selection */}
                            <div className="pt-4 border-t border-slate-800">
                                <Label className="text-base mb-4 block text-center uppercase tracking-widest text-slate-500 font-bold">Official Result</Label>
                                <RadioGroup value={winner || ""} onValueChange={(v) => setWinner(v as 'Blue' | 'Red')} className="grid grid-cols-2 gap-4">
                                    {/* BLUE OPTION */}
                                    <div>
                                        <RadioGroupItem value="Blue" id="r-blue" className="peer sr-only" />
                                        <Label htmlFor="r-blue" className={`
                                            flex flex-col items-center justify-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-300
                                            ${winner === 'Blue'
                                                ? 'bg-blue-600/20 border-blue-500 scale-105 shadow-[0_0_30px_rgba(37,99,235,0.3)]'
                                                : winner === 'Red'
                                                    ? 'bg-slate-900/50 border-slate-800 opacity-50 grayscale'
                                                    : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'
                                            }
                                        `}>
                                            <div className="text-center">
                                                <div className={`text-3xl font-black uppercase mb-1 ${winner === 'Blue' ? 'text-blue-400 drop-shadow-lg' : 'text-slate-500'}`}>
                                                    {winner === 'Blue' ? 'VICTORY' : winner === 'Red' ? 'DEFEAT' : 'BLUE WIN'}
                                                </div>
                                                <div className="text-xs font-bold tracking-wider opacity-70">BLUE TEAM</div>
                                            </div>
                                        </Label>
                                    </div>

                                    {/* RED OPTION */}
                                    <div>
                                        <RadioGroupItem value="Red" id="r-red" className="peer sr-only" />
                                        <Label htmlFor="r-red" className={`
                                            flex flex-col items-center justify-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-300
                                            ${winner === 'Red'
                                                ? 'bg-red-600/20 border-red-500 scale-105 shadow-[0_0_30px_rgba(220,38,38,0.3)]'
                                                : winner === 'Blue'
                                                    ? 'bg-slate-900/50 border-slate-800 opacity-50 grayscale'
                                                    : 'bg-slate-900 border-slate-800 hover:border-red-500/50'
                                            }
                                        `}>
                                            <div className="text-center">
                                                <div className={`text-3xl font-black uppercase mb-1 ${winner === 'Red' ? 'text-red-400 drop-shadow-lg' : 'text-slate-500'}`}>
                                                    {winner === 'Red' ? 'VICTORY' : winner === 'Blue' ? 'DEFEAT' : 'RED WIN'}
                                                </div>
                                                <div className="text-xs font-bold tracking-wider opacity-70">RED TEAM</div>
                                            </div>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {showSuccess ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center justify-center gap-3 text-green-400">
                                        <CheckCircle className="w-6 h-6" />
                                        <span className="font-bold text-lg">Result Saved Successfully!</span>
                                    </div>
                                    <Button
                                        size="lg"
                                        className="w-full h-16 text-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20"
                                        onClick={() => {
                                            if (matchId) {
                                                const matchThresholds: Record<string, number> = { 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 };
                                                const threshold = matchThresholds[matchMode] || 1;

                                                let isFinished = false
                                                if (matchMode === 'BO2') {
                                                    // This is tricky without game count. But typically if nextGameId is missing it might mean end.
                                                    // Let's rely on checking if this was the last game?
                                                    // Actually, we can check specific BO2 rule: if seriesScore + this game = 2 games played.
                                                    // seriesScore.blue + seriesScore.red = games played BEFORE this one.
                                                    // So total games = (blue + red) + 1. If == 2, then finished.
                                                    if ((seriesScore.blue + seriesScore.red + 1) >= 2) isFinished = true
                                                } else {
                                                    const newBlueScore = seriesScore.blue + (winner === 'Blue' ? 1 : 0)
                                                    const newRedScore = seriesScore.red + (winner === 'Red' ? 1 : 0)
                                                    if (newBlueScore >= threshold || newRedScore >= threshold) isFinished = true
                                                }

                                                if (isFinished) {
                                                    router.push(`/admin/simulator/${matchId}?game=summary`)
                                                } else {
                                                    router.push(`/admin/simulator/${matchId}${nextGameId ? `?game=${nextGameId}` : ''}`)
                                                }
                                            }
                                        }}
                                    >
                                        {((matchMode === 'BO2' && (seriesScore.blue + seriesScore.red + 1) >= 2) ||
                                            (matchMode !== 'BO2' && (
                                                (seriesScore.blue + (winner === 'Blue' ? 1 : 0)) >= (({ 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 } as Record<string, number>)[matchMode] || 1) ||
                                                (seriesScore.red + (winner === 'Red' ? 1 : 0)) >= (({ 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 } as Record<string, number>)[matchMode] || 1)
                                            )))
                                            ? "VIEW MATCH SUMMARY"
                                            : "GO TO NEXT GAME"
                                        }
                                        {((matchMode === 'BO2' && (seriesScore.blue + seriesScore.red + 1) >= 2) ||
                                            (matchMode !== 'BO2' && (
                                                (seriesScore.blue + (winner === 'Blue' ? 1 : 0)) >= (({ 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 } as Record<string, number>)[matchMode] || 1) ||
                                                (seriesScore.red + (winner === 'Red' ? 1 : 0)) >= (({ 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 } as Record<string, number>)[matchMode] || 1)
                                            )))
                                            ? <Trophy className="w-6 h-6 ml-2 text-yellow-500" />
                                            : <ArrowRight className="w-6 h-6 ml-2" />
                                        }
                                    </Button>
                                </div>
                            ) : (
                                <Button size="lg" className="w-full h-16 text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-900/20" onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
                                    {initialData ? "UPDATE RESULT" : "SAVE RESULT"}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div >
    )
}
