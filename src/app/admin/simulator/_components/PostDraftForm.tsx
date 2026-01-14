'use client'

import { useState, useEffect } from 'react'
import { Hero, POSITIONS } from '@/utils/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { Loader2, Save, Trophy, AlertTriangle } from 'lucide-react'
import { finishGame } from '../finish-actions'
import { useRouter } from 'next/navigation'

interface PostDraftFormProps {
    gameId: string;
    blueTeamName: string;
    redTeamName: string;
    bluePicks: Record<number, string>;
    redPicks: Record<number, string>;
    blueBans: string[];
    redBans: string[];
    heroes: Hero[];
}

export default function PostDraftForm({
    gameId,
    blueTeamName,
    redTeamName,
    bluePicks,
    redPicks,
    blueBans,
    redBans,
    heroes
}: PostDraftFormProps) {
    const router = useRouter()
    const [assignments, setAssignments] = useState<Record<string, string>>({})
    const [winner, setWinner] = useState<'Blue' | 'Red' | null>(null)
    const [blueKeyPlayer, setBlueKeyPlayer] = useState<string>("")
    const [redKeyPlayer, setRedKeyPlayer] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // Helper: Get Hero
    const getHero = (id: string) => heroes.find(h => h.id === id)

    // Draft Slot Mappings (Absolute 1-18)
    const BLUE_PICK_SLOTS = [5, 8, 9, 16, 17]
    const RED_PICK_SLOTS = [6, 7, 10, 15, 18]
    const BLUE_BAN_SLOTS = [1, 3, 12, 14]
    const RED_BAN_SLOTS = [2, 4, 11, 13]

    // 1. Auto-fill logic
    useEffect(() => {
        const newAssignments: Record<string, string> = {}
        const allPickIds = [...Object.values(bluePicks), ...Object.values(redPicks)]

        allPickIds.forEach(id => {
            const h = getHero(id)
            if (h && h.main_position && h.main_position.length === 1) {
                newAssignments[id] = h.main_position[0]
            }
        })
        setAssignments(newAssignments)
    }, []) // Run once on mount

    const handleAssignmentChange = (heroId: string, role: string) => {
        setAssignments(prev => ({ ...prev, [heroId]: role }))
    }

    // Check for duplicates
    const getDuplicateWarning = (teamPickIds: string[]) => {
        const roles = teamPickIds.map(id => assignments[id]).filter(Boolean)
        const uniqueRoles = new Set(roles)
        if (roles.length !== uniqueRoles.size) {
            return (
                <div className="flex items-center gap-2 text-amber-400 text-xs mt-2 bg-amber-400/10 p-2 rounded">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Duplicate roles detected!</span>
                </div>
            )
        }
        return null
    }

    const handleSubmit = async () => {
        if (!winner) {
            alert("Please select a Winner.")
            return
        }
        // MVP is optional but recommended

        setSubmitting(true)

        // Compile Data
        const picksData: {
            hero_id: string;
            type: 'BAN' | 'PICK';
            side: 'BLUE' | 'RED';
            position_index: number;
            assigned_role?: string;
        }[] = []

        // Process Blue Picks
        Object.entries(bluePicks).forEach(([idxStr, heroId]) => {
            const idx = parseInt(idxStr) // 0-4
            if (idx >= 0 && idx < BLUE_PICK_SLOTS.length) {
                picksData.push({
                    hero_id: heroId,
                    type: 'PICK' as const,
                    side: 'BLUE' as const,
                    position_index: BLUE_PICK_SLOTS[idx],
                    assigned_role: assignments[heroId] || 'Flex'
                })
            }
        })

        // Process Red Picks
        Object.entries(redPicks).forEach(([idxStr, heroId]) => {
            const idx = parseInt(idxStr) // 0-4
            if (idx >= 0 && idx < RED_PICK_SLOTS.length) {
                picksData.push({
                    hero_id: heroId,
                    type: 'PICK' as const,
                    side: 'RED' as const,
                    position_index: RED_PICK_SLOTS[idx],
                    assigned_role: assignments[heroId] || 'Flex'
                })
            }
        })

        // Process Bans
        blueBans.forEach((heroId, idx) => {
            if (idx >= 0 && idx < BLUE_BAN_SLOTS.length) {
                picksData.push({
                    hero_id: heroId,
                    type: 'BAN' as const,
                    side: 'BLUE' as const,
                    position_index: BLUE_BAN_SLOTS[idx]
                })
            }
        })
        redBans.forEach((heroId, idx) => {
            if (idx >= 0 && idx < RED_BAN_SLOTS.length) {
                picksData.push({
                    hero_id: heroId,
                    type: 'BAN' as const,
                    side: 'RED' as const,
                    position_index: RED_BAN_SLOTS[idx]
                })
            }
        })

        const res = await finishGame({
            gameId,
            winner,
            blueKeyPlayer,
            redKeyPlayer,
            notes,
            picks: picksData
        })

        if (res.success) {
            window.location.reload()
        } else {
            alert("Error saving: " + res.message)
            setSubmitting(false)
        }
    }

    const renderTeamColumn = (side: 'Blue' | 'Red', teamName: string, pickMap: Record<number, string>) => (
        <div className={`flex-1 rounded-xl p-4 border ${side === 'Blue' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
            <h3 className={`text-xl font-bold mb-4 text-center ${side === 'Blue' ? 'text-blue-400' : 'text-red-400'}`}>{teamName}</h3>
            <div className="space-y-3">
                {Object.values(pickMap).map(heroId => {
                    const hero = getHero(heroId)
                    if (!hero) return null
                    return (
                        <div key={heroId} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                            <Image src={hero.icon_url} alt={hero.name} width={40} height={40} className="rounded border border-slate-700" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{hero.name}</p>
                            </div>
                            <div className="w-40">
                                <Select value={assignments[heroId]} onValueChange={(val) => handleAssignmentChange(heroId, val)}>
                                    <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700">
                                        <SelectValue placeholder="Position" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {POSITIONS.map(p => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )
                })}
            </div>
            {getDuplicateWarning(Object.values(pickMap))}
        </div>
    )

    return (
        <div className="max-w-5xl mx-auto p-4 animate-in fade-in zoom-in-95 duration-500">
            <Card className="bg-slate-900 border-slate-800 text-white">
                <CardHeader className="text-center border-b border-slate-800 bg-slate-950/50 rounded-t-xl pb-8 pt-8">
                    <Trophy className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                    <CardTitle className="text-3xl font-black uppercase text-white">Match Complete</CardTitle>
                    <p className="text-slate-400">Assign roles and record the final result</p>
                </CardHeader>
                <CardContent className="p-6">
                    {/* Role Assignment */}
                    <div className="flex flex-col md:flex-row gap-8 mb-8">
                        {renderTeamColumn('Blue', blueTeamName, bluePicks)}
                        {renderTeamColumn('Red', redTeamName, redPicks)}
                    </div>

                    {/* Result Entry */}
                    <div className="bg-slate-950 rounded-xl p-6 border border-slate-800 space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <Label className="text-base mb-3 block">Winning Side</Label>
                                <RadioGroup value={winner || ""} onValueChange={(v) => setWinner(v as 'Blue' | 'Red')} className="grid grid-cols-2 gap-4">
                                    <div>
                                        <RadioGroupItem value="Blue" id="r-blue" className="peer sr-only" />
                                        <Label htmlFor="r-blue" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-slate-800 bg-slate-900 hover:bg-slate-800 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer">
                                            <span className="font-bold">Blue Team</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="Red" id="r-red" className="peer sr-only" />
                                        <Label htmlFor="r-red" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-slate-800 bg-slate-900 hover:bg-slate-800 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:text-red-500 cursor-pointer">
                                            <span className="font-bold">Red Team</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Blue MVP */}
                                <div>
                                    <Label className="text-base mb-3 block text-blue-400">Blue MVP</Label>
                                    <Select value={blueKeyPlayer} onValueChange={setBlueKeyPlayer}>
                                        <SelectTrigger className="h-14 bg-slate-900 border-slate-700 text-lg">
                                            <SelectValue placeholder="Blue MVP" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(bluePicks).map(id => {
                                                const h = getHero(id); if (!h) return null;
                                                return <SelectItem key={id} value={id}>{h.name}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Red MVP */}
                                <div>
                                    <Label className="text-base mb-3 block text-red-400">Red MVP</Label>
                                    <Select value={redKeyPlayer} onValueChange={setRedKeyPlayer}>
                                        <SelectTrigger className="h-14 bg-slate-900 border-slate-700 text-lg">
                                            <SelectValue placeholder="Red MVP" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(redPicks).map(id => {
                                                const h = getHero(id); if (!h) return null;
                                                return <SelectItem key={id} value={id}>{h.name}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Match Notes</Label>
                            <textarea
                                id="notes"
                                className="flex min-h-[80px] w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Enter any key moments or comments about the match..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <Button size="lg" className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            Save Game Record
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
