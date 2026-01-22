'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Trash2, Trophy, Skull } from 'lucide-react'
import { WinCondition, Hero } from './types'
import { analyzeWinCondition } from '../actions'
import { cn } from '@/lib/utils'

interface WinConditionCardProps {
    condition: WinCondition;
    heroes: Hero[];
    tournamentName?: string;
    onDelete: (id: string) => void;
}

import { WinConditionDetailDialog } from './WinConditionDetailDialog'

export function WinConditionCard({ condition, heroes, tournamentName, onDelete }: WinConditionCardProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [result, setResult] = useState<any>(condition.result || null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const getHeroName = (id: string) => heroes.find(h => h.id === id)?.name || 'Unknown'
    const getHeroImage = (id: string) => heroes.find(h => h.id === id)?.image_url

    const handleAnalyze = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        // If we already have detailed result (matches array), just open dialog
        if (result && result.matches) {
            setIsDetailOpen(true)
            return
        }

        setIsAnalyzing(true)
        try {
            const res = await analyzeWinCondition({
                version: condition.version,
                patch: "",
                tournamentId: condition.tournamentId,
                allyConditions: condition.allyConditions,
                enemyConditions: condition.enemyConditions
            })

            if (res.success) {
                setResult(res)
                setIsDetailOpen(true)
            }
        } catch (error) {
            console.error('Analysis error', error)
        } finally {
            setIsAnalyzing(false)
        }
    }

    return (
        <>
            <Card
                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors group relative overflow-hidden cursor-pointer"
                onClick={handleAnalyze}
            >
                {/* Background Gradient for Win Rate */}
                {result && (
                    <div
                        className={cn(
                            "absolute inset-0 opacity-10 pointer-events-none transition-all duration-1000",
                            (result.winRate || 0) > 50 ? "bg-gradient-to-br from-emerald-500 to-transparent" : "bg-gradient-to-br from-rose-500 to-transparent"
                        )}
                    />
                )}

                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-slate-950/50 border-slate-700 text-slate-400">
                                    {condition.version}
                                </Badge>
                            </div>
                            <CardTitle className="text-slate-200 text-sm font-bold">
                                {tournamentName || (condition.name ? condition.name : `Condition #${condition.id.slice(0, 4)}`)}
                            </CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-red-400 hover:bg-red-950/20 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(condition.id);
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Allies */}
                    {condition.allyConditions.length > 0 && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                                <Trophy className="w-3 h-3" /> Team
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {condition.allyConditions.map(c => (
                                    <div key={c.id} className="relative group/hero">
                                        <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={getHeroImage(c.heroId)} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full px-1 border border-slate-800 text-[8px] text-slate-300">
                                            {c.role === 'ANY' ? '*' : c.role[0]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enemies */}
                    {condition.enemyConditions.length > 0 && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                                <Skull className="w-3 h-3" /> Enemy Avoid
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {condition.enemyConditions.map(c => (
                                    <div key={c.id} className="relative group/hero">
                                        <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 overflow-hidden grayscale opacity-80">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={getHeroImage(c.heroId)} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        {isAnalyzing && (
                            <div className="flex items-center justify-center gap-2 py-2 text-xs text-violet-400 animate-pulse">
                                <Play className="w-3 h-3" /> Analyzing...
                            </div>
                        )}

                        {!isAnalyzing && result && (
                            <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/50 p-2 rounded border border-slate-800">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">Win Rate</div>
                                    <div className={cn(
                                        "text-lg font-black",
                                        (result.winRate || 0) > 50 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {result.winRate}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">Matches</div>
                                    <div className="text-lg font-bold text-slate-300">{result.totalMatches}</div>
                                </div>
                            </div>
                        )}

                        {!isAnalyzing && !result && (
                            <div className="text-center py-2 text-xs text-slate-500 bg-slate-950/30 rounded border border-slate-800/50 hover:bg-slate-950/50 transition-colors">
                                Click to Analyze
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <WinConditionDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                title={tournamentName || 'This Condition'}
                result={result}
            />
        </>
    )
}
