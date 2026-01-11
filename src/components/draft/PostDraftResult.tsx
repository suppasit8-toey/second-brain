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
            <div className={`flex-1 rounded-xl p-2 border ${side === 'Blue' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                <div className="flex justify-between items-center mb-2">
                    <h3 className={`text-lg font-bold ${side === 'Blue' ? 'text-blue-400' : 'text-red-400'}`}>{teamName}</h3>
                    {isDupe && <Badge variant="destructive" className="animate-pulse h-5 text-xs">Duplicate!</Badge>}
                </div>

                <div className="space-y-1">
                    {pickIds.map(heroId => {
                        const hero = getHero(heroId)
                        if (!hero) return null
                        const currentRole = assignments[heroId]

                        return (
                            <div key={heroId} className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                                <Image src={hero.icon_url} alt={hero.name} width={32} height={32} className="rounded border border-slate-700" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs truncate">{hero.name}</p>
                                </div>
                                <div className="w-32">
                                    <Select value={currentRole} onValueChange={(val) => handleAssignmentChange(heroId, val)}>
                                        <SelectTrigger className={`h-7 text-xs border-slate-700 ${!currentRole ? 'text-yellow-500 border-yellow-500/50' : 'bg-slate-800'}`}>
                                            <SelectValue placeholder="Pos" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 overflow-y-auto">
                                            {POSITIONS.map(p => {
                                                const isTaken = usedRoles.includes(p) && currentRole !== p
                                                return (
                                                    <SelectItem key={p} value={p} className={isTaken ? 'text-yellow-500' : ''}>
                                                        {p} {isTaken && '*'}
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
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-950">
            <div className="flex-1 w-full overflow-y-auto p-2 custom-scrollbar">
                <div className="max-w-full mx-auto space-y-2 pb-10 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                        <CardHeader className="text-center border-b border-slate-800 bg-slate-950/50 rounded-t-xl py-3">
                            <Trophy className="w-6 h-6 mx-auto text-yellow-500 mb-1" />
                            <CardTitle className="text-xl font-black uppercase text-white">Match Analysis & Result</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                            {/* 1. Role Assignment */}
                            <div className="flex flex-col xl:flex-row gap-3 mb-4">
                                {renderTeamColumn('Blue', blueTeamName, bluePicks)}
                                {renderTeamColumn('Red', redTeamName, redPicks)}
                            </div>

                            {/* 2. Analysis & Result */}
                            {/* 2. Analysis & Result (2-Col Grid) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                                {/* LEFT: Stats & MVP (Spans 7) */}
                                <div className="lg:col-span-7 bg-slate-950/50 rounded-xl p-3 border border-slate-800 flex flex-col gap-3">
                                    {/* Win Prediction */}
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                                        <div className="flex justify-between mb-1.5">
                                            <Label className="text-xs font-bold text-blue-400">BLUE WIN %</Label>
                                            <span className="text-xs font-mono text-white">{winPrediction}%</span>
                                            <span className="text-xs font-mono text-white">{100 - winPrediction}%</span>
                                            <Label className="text-xs font-bold text-red-400">RED WIN %</Label>
                                        </div>
                                        <div className="relative h-2 w-full rounded-full overflow-hidden bg-slate-800">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${winPrediction}%` }}
                                            />
                                            <div
                                                className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-300"
                                                style={{ width: `${100 - winPrediction}%` }}
                                            />
                                            {/* Slider Thumb (Invisible but interactive) */}
                                            <input
                                                type="range"
                                                min="0" max="100"
                                                value={winPrediction}
                                                onChange={(e) => setWinPrediction(Number(e.target.value))}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* Key Players Grid */}
                                    <div className="grid grid-cols-2 gap-3 flex-1">
                                        <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-lg flex flex-col justify-center">
                                            <Label className="text-[10px] mb-1.5 block text-blue-400 font-bold uppercase tracking-wider text-center">Blue MVP</Label>
                                            <Select value={blueKeyPlayer} onValueChange={setBlueKeyPlayer}>
                                                <SelectTrigger className="bg-slate-900 border-blue-500/30 h-8 text-xs focus:ring-blue-500/50">
                                                    <span className={!blueKeyPlayer ? "text-slate-500" : "font-bold text-blue-100"}>
                                                        {blueKeyPlayer ? getHero(blueKeyPlayer)?.name : "Select..."}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(bluePicks).map(id => {
                                                        const h = getHero(id); if (!h) return null;
                                                        return <SelectItem key={id} value={id}>
                                                            <div className="flex items-center gap-2">
                                                                <Image src={h.icon_url} alt={h.name} width={20} height={20} className="rounded" />
                                                                <span>{h.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            {blueKeyPlayer && getHero(blueKeyPlayer) && (
                                                <div className="mt-2 flex justify-center">
                                                    <Image src={getHero(blueKeyPlayer)!.icon_url} alt="MVP" width={48} height={48} className="rounded-md shadow-lg shadow-blue-900/50 ring-2 ring-blue-500/20" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-red-950/20 border border-red-500/20 p-3 rounded-lg flex flex-col justify-center">
                                            <Label className="text-[10px] mb-1.5 block text-red-400 font-bold uppercase tracking-wider text-center">Red MVP</Label>
                                            <Select value={redKeyPlayer} onValueChange={setRedKeyPlayer}>
                                                <SelectTrigger className="bg-slate-900 border-red-500/30 h-8 text-xs focus:ring-red-500/50">
                                                    <span className={!redKeyPlayer ? "text-slate-500" : "font-bold text-red-100"}>
                                                        {redKeyPlayer ? getHero(redKeyPlayer)?.name : "Select..."}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(redPicks).map(id => {
                                                        const h = getHero(id); if (!h) return null;
                                                        return <SelectItem key={id} value={id}>
                                                            <div className="flex items-center gap-2">
                                                                <Image src={h.icon_url} alt={h.name} width={20} height={20} className="rounded" />
                                                                <span>{h.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            {redKeyPlayer && getHero(redKeyPlayer) && (
                                                <div className="mt-2 flex justify-center">
                                                    <Image src={getHero(redKeyPlayer)!.icon_url} alt="MVP" width={48} height={48} className="rounded-md shadow-lg shadow-red-900/50 ring-2 ring-red-500/20" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: Result & Save (Spans 5) */}
                                <div className="lg:col-span-5 bg-slate-950/50 rounded-xl p-3 border border-slate-800 flex flex-col gap-3">
                                    <Label className="text-xs block text-center uppercase tracking-widest text-slate-500 font-bold mb-1">Match Result</Label>
                                    <RadioGroup value={winner || ""} onValueChange={(v) => setWinner(v as 'Blue' | 'Red')} className="grid grid-cols-2 gap-2 flex-1">
                                        {/* BLUE OPTION */}
                                        <div className="h-full">
                                            <RadioGroupItem value="Blue" id="r-blue" className="peer sr-only" />
                                            <Label htmlFor="r-blue" className={`
                                            h-full flex flex-col items-center justify-center p-2 rounded-lg border-2 cursor-pointer transition-all duration-300
                                            ${winner === 'Blue'
                                                    ? 'bg-gradient-to-br from-blue-600/30 to-blue-900/30 border-blue-500 scale-[1.02] shadow-lg shadow-blue-900/20'
                                                    : winner === 'Red'
                                                        ? 'bg-slate-900/30 border-slate-800 opacity-40 grayscale'
                                                        : 'bg-slate-900/50 border-slate-800 hover:border-blue-500/30'
                                                }
                                        `}>
                                                <div className="text-center">
                                                    <div className={`text-lg font-black uppercase leading-tight ${winner === 'Blue' ? 'text-blue-400 drop-shadow-md' : 'text-slate-500'}`}>
                                                        Blue<br />Win
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>

                                        {/* RED OPTION */}
                                        <div className="h-full">
                                            <RadioGroupItem value="Red" id="r-red" className="peer sr-only" />
                                            <Label htmlFor="r-red" className={`
                                            h-full flex flex-col items-center justify-center p-2 rounded-lg border-2 cursor-pointer transition-all duration-300
                                            ${winner === 'Red'
                                                    ? 'bg-gradient-to-br from-red-600/30 to-red-900/30 border-red-500 scale-[1.02] shadow-lg shadow-red-900/20'
                                                    : winner === 'Blue'
                                                        ? 'bg-slate-900/30 border-slate-800 opacity-40 grayscale'
                                                        : 'bg-slate-900/50 border-slate-800 hover:border-red-500/30'
                                                }
                                        `}>
                                                <div className="text-center">
                                                    <div className={`text-lg font-black uppercase leading-tight ${winner === 'Red' ? 'text-red-400 drop-shadow-md' : 'text-slate-500'}`}>
                                                        Red<br />Win
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                    </RadioGroup>

                                    {showSuccess ? (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-2 flex items-center justify-center gap-2 text-green-400">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="font-bold text-xs">Saved!</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="w-full h-10 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md"
                                                onClick={() => {
                                                    if (matchId) {
                                                        const matchThresholds: Record<string, number> = { 'BO1': 1, 'BO3': 2, 'BO5': 3, 'BO7': 4 };
                                                        const threshold = matchThresholds[matchMode] || 1;

                                                        let isFinished = false
                                                        if (matchMode === 'BO2') {
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
                                                Next <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button size="lg" className="w-full h-12 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-900/20 mt-1" onClick={handleSubmit} disabled={submitting}>
                                            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                            {initialData ? "UPDATE" : "SAVE"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
