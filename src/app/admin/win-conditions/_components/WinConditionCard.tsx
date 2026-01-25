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
    teams?: { id: string; name: string; logo_url: string }[];
    tournamentName?: string;
    onDelete: (id: string) => void;
}

import Link from 'next/link'

export function WinConditionCard({ condition, heroes, teams, tournamentName, onDelete }: WinConditionCardProps) {
    const getHeroImage = (id: string) => heroes.find(h => h.id === id)?.image_url
    const getTeamLogo = (name: string) => teams?.find(t => t.name === name)?.logo_url

    return (
        <div className="relative group">
            <Link href={`/admin/win-conditions/${condition.id}`}>
                <Card
                    className="bg-slate-900 border-slate-800 hover:border-violet-500/30 transition-all duration-300 group-hover:shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)] overflow-hidden cursor-pointer h-full"
                >
                    {/* Background Gradient for Win Rate */}
                    {condition.result && (
                        <div
                            className={cn(
                                "absolute inset-0 opacity-5 pointer-events-none transition-all duration-1000",
                                (condition.result.winRate || 0) > 50 ? "bg-gradient-to-br from-emerald-500 to-transparent" : "bg-gradient-to-br from-rose-500 to-transparent"
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
                            {condition.result && (
                                <>
                                    <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/50 p-2 rounded border border-slate-800">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase">Win Rate</div>
                                            <div className={cn(
                                                "text-lg font-black",
                                                (condition.result.winRate || 0) > 50 ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {condition.result.winRate}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase">Matches</div>
                                            <div className="text-lg font-bold text-slate-300">{condition.result.totalMatches}</div>
                                        </div>
                                    </div>

                                    {/* Winning Condition For */}
                                    {(() => {
                                        const teamStats = (condition.result as any).teamStats || []
                                        const strongTeams = teamStats.filter((t: any) => t.winRate >= 70 && t.matches > 0)

                                        if (strongTeams.length > 0) {
                                            return (
                                                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded p-2 mt-2">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <Trophy className="w-3 h-3 text-emerald-400" />
                                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Winning Condition</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {strongTeams.map((t: any, i: number) => {
                                                            const logo = getTeamLogo(t.name)
                                                            return (
                                                                <div key={i} title={t.name} className="relative">
                                                                    {logo ? (
                                                                        <div className="w-6 h-6 rounded border border-emerald-500/30 bg-emerald-900/40 overflow-hidden">
                                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img src={logo} alt={t.name} className="w-full h-full object-contain" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[9px] font-bold text-white bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                                            {t.name}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                </>
                            )}

                            {!condition.result && (
                                <div className="text-center py-2 text-xs text-slate-500 bg-slate-950/30 rounded border border-slate-800/50 hover:bg-slate-950/50 transition-colors">
                                    View Analysis
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Link>

            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-slate-600 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(condition.id);
                }}
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div >
    )
}
