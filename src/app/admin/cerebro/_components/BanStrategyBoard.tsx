import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldBan, Target, Zap } from 'lucide-react';

interface BanStrategyBoardProps {
    stats: any;
    teamName?: string;
}

export default function BanStrategyBoard({ stats, teamName }: BanStrategyBoardProps) {
    const [phase, setPhase] = useState<'PHASE_1' | 'PHASE_2'>('PHASE_1');

    // Helper to get top heroes for a set of slots
    const getTopHeroesForSlots = (slots: number[], type: 'PICK' | 'BAN') => {
        const aggregated: Record<string, number> = {};

        slots.forEach(slot => {
            let source;
            if (type === 'BAN') {
                source = stats.banOrderStats;
            } else {
                // Try strict hero stats first (newly added), fallback to generic pickOrderStats (Role based) will fail for Hero ID lookup.
                // So we must assume heroPickOrderStats exists, or else we can't find specific heroes by slot.
                source = stats.heroPickOrderStats || {};
            }

            const slotData = source?.[slot] || {};
            Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                // If the source is Role-based (fallback), 'heroId' is actually a role name. 
                // stats.heroStats[roleName] will be undefined.
                // We trust that actions.ts now provides heroPickOrderStats.
                aggregated[heroId] = (aggregated[heroId] || 0) + count;
            });
        });

        return Object.entries(aggregated)
            .map(([heroId, count]) => ({
                heroId,
                count,
                hero: stats.heroStats[heroId]
            }))
            .filter(item => item.hero) // Safety filter: Remove entries where hero lookup failed (e.g. Role data or missing ID)
            .sort((a, b) => b.count - a.count);
    };

    // Phase 1 Bans: Slots 1, 2, 3, 4
    const phase1Bans = useMemo(() => getTopHeroesForSlots([1, 2, 3, 4], 'BAN'), [stats]);

    // Phase 2 Bans: Slots 11, 12, 13, 14
    const phase2Bans = useMemo(() => getTopHeroesForSlots([11, 12, 13, 14], 'BAN'), [stats]);

    // Strategic Suggestions (Phase 2)
    // Logic: Identify heroes this team PICKS in Phase 2 (Slots 15, 16, 17, 18).
    // These are the heroes they rely on filling later.
    // If we ban them in Phase 2, we disrupt their late draft.
    const phase2PickImpact = useMemo(() => {
        // Get picks in slots 15-18
        const picks = getTopHeroesForSlots([15, 16, 17, 18], 'PICK');

        // Enhance with Win Rate (Impact)
        return picks.map(p => {
            const winRate = p.hero.picks > 0 ? (p.hero.wins / p.hero.picks) * 100 : 0;
            return { ...p, winRate };
        }).sort((a, b) => b.winRate - a.winRate); // Sort by Win Rate (Highest Impact)
    }, [stats]);


    if (!teamName) return null;

    return (
        <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
            <CardHeader className="bg-slate-950/30 border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldBan className="text-red-400" />
                        Ban Strategy: <span className="text-cyan-400">{teamName}</span>
                    </CardTitle>
                    <Tabs value={phase} onValueChange={(v) => setPhase(v as any)} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-700">
                            <TabsTrigger value="PHASE_1">Phase 1 (Opening)</TabsTrigger>
                            <TabsTrigger value="PHASE_2">Phase 2 (Closing)</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {phase === 'PHASE_1' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="text-cyan-400 h-5 w-5" />
                            <h3 className="font-bold text-slate-200">Most Frequent Opening Bans</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {phase1Bans.slice(0, 8).map((item, idx) => (
                                <div key={item.heroId} className="bg-white/5 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                                    <div className="relative">
                                        <img src={item.hero?.icon} alt={item.hero?.name} className="w-10 h-10 rounded-md" />
                                        <div className="absolute -top-2 -left-2 bg-slate-900 text-slate-400 text-[10px] w-5 h-5 flex items-center justify-center rounded-full border border-slate-700">
                                            #{idx + 1}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-200">{item.hero?.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {item.count} games <span className="opacity-50">({item.hero?.bansPhase1} p1)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg mt-4 text-sm text-blue-200">
                            <strong>Strategy Note:</strong> These are the heroes {teamName} removes immediately.
                            Expect these to be unavailable. If they leave one open, it might be a trap or a specific counter-strategy.
                        </div>
                    </div>
                )}

                {phase === 'PHASE_2' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

                        {/* 1. What they BAN */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldBan className="text-red-400 h-5 w-5" />
                                <h3 className="font-bold text-slate-200">Their Phase 2 Bans (What they fear)</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {phase2Bans.slice(0, 4).map((item, idx) => (
                                    <div key={item.heroId} className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center gap-3">
                                        <img src={item.hero?.icon} alt={item.hero?.name} className="w-10 h-10 rounded-md grayscale opacity-80" />
                                        <div>
                                            <div className="font-bold text-sm text-red-200">{item.hero?.name}</div>
                                            <div className="text-xs text-red-400/70">{item.count} bans</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. What they PICK (Suggestion Base) */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="text-yellow-400 h-5 w-5" />
                                <h3 className="font-bold text-slate-200">Recommended Bans (High Impact Targets)</h3>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                Heroes {teamName} frequently picks in Phase 2 (Slots 15-18).
                                Banning these disrupts their closing strategy.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {phase2PickImpact.slice(0, 6).map((item, idx) => (
                                    <div key={item.heroId} className="bg-gradient-to-r from-yellow-500/10 to-transparent p-3 rounded-lg border border-yellow-500/20 flex items-center justify-between group cursor-pointer hover:border-yellow-500/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={item.hero?.icon} alt={item.hero?.name} className="w-12 h-12 rounded-lg group-hover:scale-105 transition-transform" />
                                                {item.winRate > 60 && (
                                                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                                        High WR
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-yellow-100">{item.hero?.name}</div>
                                                <div className="flex gap-2 text-xs text-slate-400">
                                                    <span>WR: <span className={item.winRate > 50 ? 'text-green-400' : 'text-red-400'}>{item.winRate.toFixed(0)}%</span></span>
                                                    <span>•</span>
                                                    <span>Picked: {item.count}x</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono text-slate-500 uppercase">Priority</div>
                                            <div className="text-lg font-black text-white/20">#{idx + 1}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </CardContent>
        </Card>
    );
}
