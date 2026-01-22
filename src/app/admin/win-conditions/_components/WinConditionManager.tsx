'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateWinConditionDialog } from './CreateWinConditionDialog'
import { WinConditionCard } from './WinConditionCard'
import { WinCondition, Hero } from './types'

interface WinConditionManagerProps {
    heroes: Hero[];
    versions: string[];
    tournaments: { id: string; name: string }[];
}

import { analyzeWinCondition } from '../actions'

export function WinConditionManager({ heroes, versions, tournaments }: WinConditionManagerProps) {
    const [conditions, setConditions] = useState<WinCondition[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const handleCreate = async (data: Omit<WinCondition, 'id' | 'createdAt'>) => {
        // Auto-analyze immediately
        let initialResult = undefined;
        try {
            const res = await analyzeWinCondition({
                version: data.version,
                patch: "",
                tournamentId: data.tournamentId,
                allyConditions: data.allyConditions,
                enemyConditions: data.enemyConditions
            })
            if (res.success) {
                initialResult = {
                    winRate: res.winRate || 0,
                    totalMatches: res.totalMatches || 0,
                    winCount: res.winCount || 0,
                    lossCount: res.lossCount || 0,
                    teamStats: res.teamStats,
                    matches: res.matches
                }
            }
        } catch (e) {
            console.error("Auto-analysis failed", e)
        }

        const newCondition: WinCondition = {
            ...data,
            id: Math.random().toString(36).substring(7),
            createdAt: Date.now(),
            result: initialResult
        }
        setConditions([newCondition, ...conditions])
    }

    const handleDelete = (id: string) => {
        setConditions(conditions.filter(c => c.id !== id))
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Create Button Card */}
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 rounded-xl hover:border-violet-500/50 hover:bg-violet-500/5 transition-all text-slate-500 hover:text-violet-400 h-[280px]"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:border-violet-500/50 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                        <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm">CREATE NEW CONDITION</span>
                </button>

                {/* Condition Cards */}
                {conditions.map(condition => (
                    <WinConditionCard
                        key={condition.id}
                        condition={condition}
                        heroes={heroes}
                        onDelete={handleDelete}
                        tournamentName={tournaments.find(t => t.id === condition.tournamentId)?.name}
                    />
                ))}
            </div>

            <CreateWinConditionDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                heroes={heroes}
                versions={versions}
                tournaments={tournaments}
                onSave={handleCreate}
            />
        </div>
    )
}
