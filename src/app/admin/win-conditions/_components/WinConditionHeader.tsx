'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, Trophy, Skull } from 'lucide-react'
import { WinCondition, Hero } from './types'
import { WinConditionDialog } from './WinConditionDialog'
import { updateWinCondition, analyzeWinCondition } from '../actions'
import { useRouter } from 'next/navigation'

interface WinConditionHeaderProps {
    condition: WinCondition;
    heroes: Hero[];
    versions: string[];
    tournaments: { id: string; name: string }[];
}

export function WinConditionHeader({ condition, heroes, versions, tournaments }: WinConditionHeaderProps) {
    const router = useRouter()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const getHeroImage = (id: string) => heroes.find(h => String(h.id) === String(id))?.image_url

    const handleUpdate = async (data: Omit<WinCondition, 'id' | 'createdAt'>) => {
        setIsSaving(true)
        try {
            // Update DB
            const res = await updateWinCondition(condition.id, data)
            if (!res.success) {
                alert("Failed to update: " + res.error)
                return
            }

            // Trigger re-analysis automatically? 
            // The Page will re-render and might re-fetch fresh data or just re-analyze.
            // Since the page calls analyzeWinCondition on load, refreshing should be enough.
            // But we might want to force a refresh.
            router.refresh()
        } catch (e) {
            console.error("Update failed", e)
        } finally {
            setIsSaving(false)
            setIsDialogOpen(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-white mb-2">
                        {condition.name || `Condition #${condition.id.substring(0, 6)}`}
                    </h1>
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-slate-400 border border-slate-700 hover:bg-slate-700">
                            v{condition.version}
                        </Badge>
                        {condition.tournamentId && (
                            <Badge variant="outline" className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                {tournaments.find(t => t.id === condition.tournamentId)?.name || 'Tournament'}
                            </Badge>
                        )}
                    </div>
                </div>
                <Button
                    onClick={() => setIsDialogOpen(true)}
                    variant="outline"
                    className="border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Condition
                </Button>
            </div>

            {/* Visual Condition Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ally Team */}
                <div className="p-4 bg-slate-900/50 rounded-xl border border-cyan-900/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Trophy className="w-16 h-16 text-cyan-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3 text-cyan-400 font-bold uppercase tracking-wider text-sm">
                            <Trophy className="w-4 h-4" /> Team Composition
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {condition.allyConditions.length === 0 && (
                                <span className="text-slate-500 text-sm italic">Any hero allowed</span>
                            )}
                            {condition.allyConditions.map(c => (
                                <div key={c.id} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1 pr-3">
                                    <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden border border-slate-600">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={getHeroImage(c.heroId)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-slate-300 font-bold">{c.role === 'ANY' ? 'Any Role' : c.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Enemy Avoid */}
                <div className="p-4 bg-slate-900/50 rounded-xl border border-rose-900/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Skull className="w-16 h-16 text-rose-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3 text-rose-400 font-bold uppercase tracking-wider text-sm">
                            <Skull className="w-4 h-4" /> Enemy Avoid
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {condition.enemyConditions.length === 0 && (
                                <span className="text-slate-500 text-sm italic">No restrictions</span>
                            )}
                            {condition.enemyConditions.map(c => (
                                <div key={c.id} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1 pr-3">
                                    <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden border border-slate-600 grayscale opacity-80">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={getHeroImage(c.heroId)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-slate-300 font-bold">{c.role === 'ANY' ? 'Any Role' : c.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <WinConditionDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                heroes={heroes}
                versions={versions}
                tournaments={tournaments}
                onSave={handleUpdate}
                initialValues={condition}
            />
        </div>
    )
}
