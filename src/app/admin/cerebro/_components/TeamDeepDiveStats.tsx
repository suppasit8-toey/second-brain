'use client';

import { useEffect, useState, useMemo } from 'react';
import { getTeamDetailedStats } from '../actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords, Shield, Skull, Crown, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import Image from 'next/image';

interface Props {
    teamName: string;
    versionId: number;
}

export default function TeamDeepDiveStats({ teamName, versionId }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await getTeamDetailedStats(teamName, versionId);
                setData(res);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        if (teamName && versionId) load();
    }, [teamName, versionId]);

    if (loading) return <div className="h-64 flex items-center justify-center animate-pulse text-cyan-500">Scanning neural pathways...</div>;
    if (!data) return null;

    const { stats, heroMap } = data;
    const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-cyan-400 mb-6">
                <Crown size={24} />
                <h2 className="text-xl font-bold tracking-wider">ROSTER DOMINANCE ANALYSIS</h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                {roles.map(role => {
                    const roleData = stats.roles[role];
                    const player = roleData?.player || role;

                    // Sort Heroes by Pick Count then WR
                    const topHeroes = Object.entries(roleData.heroes as Record<string, any>)
                        .sort((a, b) => b[1].picks - a[1].picks || b[1].wins - a[1].wins)
                        .slice(0, 5);

                    // Analyze Matchups: Find Best/Worst
                    const matchups = Object.entries(roleData.matchups as Record<string, any>);
                    const bestMatchups = matchups.filter(([_, s]) => (s.wins / s.games) >= 0.6 && s.games >= 2).sort((a, b) => b[1].wins - a[1].wins);
                    const worstMatchups = matchups.filter(([_, s]) => (s.wins / s.games) <= 0.4 && s.games >= 2).sort((a, b) => a[1].wins - b[1].wins);

                    return (
                        <Card key={role} className="bg-slate-900/50 border-slate-800 text-white flex flex-col h-full overflow-hidden hover:border-cyan-500/30 transition-colors">
                            <div className="p-3 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-slate-700">
                                <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">{role}</div>
                                <div className="text-lg font-black text-white truncate text-cyan-300">{player}</div>
                            </div>

                            <div className="p-3 flex-1 flex flex-col gap-4">
                                {/* Signature Heroes */}
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                        <TrendingUp size={12} /> SIGNATURE PICKS
                                    </div>
                                    <div className="space-y-2">
                                        {topHeroes.map(([hid, s]: any) => {
                                            const h = heroMap[hid];
                                            const wr = (s.wins / s.picks) * 100;
                                            return (
                                                <div key={hid} className="flex items-center justify-between text-sm group">
                                                    <div className="flex items-center gap-2">
                                                        {h && <Image src={h.icon_url} alt={h.name} width={24} height={24} className="rounded border border-slate-700" />}
                                                        <span className="text-slate-300 group-hover:text-white transition-colors">{h?.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-bold ${wr >= 60 ? 'text-green-400' : wr <= 40 ? 'text-red-400' : 'text-slate-400'}`}>
                                                            {wr.toFixed(0)}%
                                                        </div>
                                                        <div className="text-[10px] text-slate-600">{s.picks} Games</div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {topHeroes.length === 0 && <div className="text-xs text-slate-600 italic">No data</div>}
                                    </div>
                                </div>

                                {/* Lane Matchups */}
                                {(bestMatchups.length > 0 || worstMatchups.length > 0) && (
                                    <div className="border-t border-slate-800 pt-3 mt-auto">
                                        <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                            <Swords size={12} /> LANE MATCHUPS
                                        </div>

                                        {bestMatchups.length > 0 && (
                                            <div className="mb-2">
                                                <div className="text-[10px] text-green-500/70 mb-1 uppercase">Dominates Against</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {bestMatchups.slice(0, 3).map(([hid, s]: any) => {
                                                        const h = heroMap[hid];
                                                        return (
                                                            <div key={hid} className="relative group/tooltip" title={`${s.wins}/${s.games} Wins`}>
                                                                <Image src={h?.icon_url} alt={h?.name} width={20} height={20} className="rounded border border-green-900/50 opacity-80" />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {worstMatchups.length > 0 && (
                                            <div>
                                                <div className="text-[10px] text-red-500/70 mb-1 uppercase">Struggles Against</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {worstMatchups.slice(0, 3).map(([hid, s]: any) => {
                                                        const h = heroMap[hid];
                                                        return (
                                                            <div key={hid} className="relative group/tooltip" title={`${s.games - s.wins}/${s.games} Losses`}>
                                                                <Image src={h?.icon_url} alt={h?.name} width={20} height={20} className="rounded border border-red-900/50 opacity-80" />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
}
