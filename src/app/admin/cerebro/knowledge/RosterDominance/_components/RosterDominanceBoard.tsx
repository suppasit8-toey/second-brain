'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, ShieldCheck, Swords, AlertTriangle } from 'lucide-react';

interface RosterDominanceBoardProps {
    stats: any;
    teamName: string;
    heroMap?: Record<string, any>;
}

export default function RosterDominanceBoard({ stats, teamName, heroMap }: RosterDominanceBoardProps) {

    // Helper to safely get hero data
    const getHeroInfo = (heroId: string) => {
        if (!heroMap) return { id: heroId, name: 'Unknown', icon: '' };
        const h = heroMap[heroId];
        return {
            id: heroId,
            name: h?.name || 'Unknown',
            icon: h?.icon_url || ''
        };
    };

    // --- LOGIC: Roster Dominance ---
    // 1. Signature Picks: Our best heroes per Role.
    // 2. Target Weakness: Enemies we dominate in this Role.
    // 3. Avoid: Enemies we struggle against in this Role.
    const rosterDominance = useMemo(() => {
        if (!stats) return [];
        const results: any[] = [];
        const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'];

        roles.forEach(role => {
            // 1. Signature Picks
            const signatures = Object.values(stats.heroStats || {})
                .map((h: any) => {
                    const rStats = h.roleStats?.[role];
                    if (!rStats || rStats.picks < 1) return null;
                    const winRate = (rStats.wins / rStats.picks) * 100;
                    return { ...h, rolePicks: rStats.picks, roleWinRate: winRate };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => b.rolePicks - a.rolePicks || b.roleWinRate - a.roleWinRate)
                .slice(0, 3); // Top 3

            // 2. Lane Matchups
            const roleMatchups = stats.laneMatchups?.[role] || {};
            const enemyPerformance: any[] = [];

            Object.entries(roleMatchups).forEach(([enemyId, myHeroes]: [string, any]) => {
                let totalGames = 0;
                let totalWins = 0;
                Object.values(myHeroes).forEach((s: any) => {
                    totalGames += s.games;
                    totalWins += s.wins;
                });

                if (totalGames > 0) {
                    enemyPerformance.push({
                        enemyId,
                        games: totalGames,
                        wins: totalWins,
                        winRate: (totalWins / totalGames) * 100
                    });
                }
            });

            const targetWeakness = enemyPerformance
                .filter(e => e.games >= 1 && e.winRate >= 50)
                .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
                .slice(0, 3);

            const avoid = enemyPerformance
                .filter(e => e.games >= 1 && e.winRate < 50)
                .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
                .slice(0, 3);

            results.push({
                role,
                signatures,
                targetWeakness: targetWeakness.map(e => ({ ...getHeroInfo(e.enemyId), ...e })),
                avoid: avoid.map(e => ({ ...getHeroInfo(e.enemyId), ...e }))
            });
        });

        return results;
    }, [stats, heroMap]);

    if (!stats) return null;

    return (
        <Card className="glass-card border-none text-slate-200">
            <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Crown className="text-amber-500" />
                        Roster Dominance Analysis {teamName && <span className="text-slate-500">for {teamName}</span>}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <p className="text-sm text-slate-400 mb-4">
                        Identify our <strong>Signature Picks</strong> and exploit <strong>Enemy Weaknesses</strong> for each role.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {rosterDominance.map((roleBlock: any) => (
                            <div key={roleBlock.role} className="flex flex-col gap-3 bg-slate-900/30 p-2 rounded-xl border border-white/5">
                                <div className="bg-slate-950/80 p-2 rounded text-center font-bold text-amber-500/80 text-xs uppercase border border-amber-900/20">
                                    {roleBlock.role}
                                </div>

                                {/* 1. Our Signatures */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-cyan-500" /> Our Signatures
                                    </div>
                                    {roleBlock.signatures.length > 0 ? roleBlock.signatures.map((h: any) => (
                                        <div key={h.id} className="flex items-center justify-between text-xs bg-cyan-950/20 p-1.5 rounded border border-cyan-500/10">
                                            <div className="flex items-center gap-2">
                                                <img src={h.icon} className="w-6 h-6 rounded border border-cyan-500/30" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-cyan-200">{h.name}</span>
                                                    <span className="text-[9px] text-slate-500">{h.rolePicks} Picks</span>
                                                </div>
                                            </div>
                                            <span className={`font-mono font-bold ${h.roleWinRate >= 60 ? 'text-green-400' : 'text-slate-400'}`}>
                                                {h.roleWinRate.toFixed(0)}%
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="text-[10px] text-slate-600 italic">No data</div>
                                    )}
                                </div>

                                <div className="h-px bg-white/5 my-1" />

                                {/* 2. Target Weakness */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Swords className="w-3 h-3 text-green-500" /> Attack Weakness
                                    </div>
                                    {roleBlock.targetWeakness.length > 0 ? roleBlock.targetWeakness.map((e: any) => (
                                        <div key={e.enemyId} className="flex items-center justify-between text-xs bg-green-950/20 p-1.5 rounded border border-green-500/10 group">
                                            <div className="flex items-center gap-2">
                                                <img src={e.icon} className="w-5 h-5 rounded opacity-80 grayscale group-hover:grayscale-0 transition-all" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-green-100">{e.name}</span>
                                                    <span className="text-[9px] text-green-500/50">We Dominate</span>
                                                </div>
                                            </div>
                                            <span className="font-bold text-green-400 text-[10px]">{e.winRate.toFixed(0)}% WR</span>
                                        </div>
                                    )) : (
                                        <div className="text-[10px] text-slate-600 italic">No exploited weakness</div>
                                    )}
                                </div>

                                {/* 3. Avoid */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-red-500" /> Caution / Ban
                                    </div>
                                    {roleBlock.avoid.length > 0 ? roleBlock.avoid.map((e: any) => (
                                        <div key={e.enemyId} className="flex items-center justify-between text-xs bg-red-950/20 p-1.5 rounded border border-red-500/10 group">
                                            <div className="flex items-center gap-2">
                                                <img src={e.icon} className="w-5 h-5 rounded opacity-80 grayscale group-hover:grayscale-0 transition-all" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-red-100">{e.name}</span>
                                                    <span className="text-[9px] text-red-500/50">We Struggle</span>
                                                </div>
                                            </div>
                                            <span className="font-bold text-red-400 text-[10px]">{e.winRate.toFixed(0)}% WR</span>
                                        </div>
                                    )) : (
                                        <div className="text-[10px] text-slate-600 italic">No major threats</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
