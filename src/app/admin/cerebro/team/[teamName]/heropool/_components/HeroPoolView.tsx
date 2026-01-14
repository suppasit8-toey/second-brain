'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, ArrowLeft, Trophy, Swords, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getCerebroStats } from '../../../../actions';
import { CerebroMode } from '../../../../actions';

interface HeroPoolViewProps {
    teamName: string;
    initialStats: any;
    versions: any[];
    defaultVersionId: number;
}

export default function HeroPoolView({ teamName, initialStats, versions, defaultVersionId }: HeroPoolViewProps) {
    const [versionId, setVersionId] = useState<string>(String(defaultVersionId));
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [stats, setStats] = useState<any>(initialStats);
    const [loading, setLoading] = useState(false);

    // Fetch data on version change
    useEffect(() => {
        // Skip initial load as we have initialStats
        if (versionId === String(defaultVersionId)) return;

        const load = async () => {
            setLoading(true);
            try {
                // Fetch ALL modes for this team to get comprehensive pool data
                const data = await getCerebroStats(
                    Number(versionId),
                    'ALL', // Mode
                    undefined, // Tournament ID (ALL)
                    teamName
                );
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [versionId, teamName, defaultVersionId]);

    // Derived Data
    const poolHeroes = useMemo(() => {
        if (!stats?.heroStats) return [];
        let heroes = Object.values(stats.heroStats as Record<string, any>);

        if (roleFilter === 'ALL') {
            return heroes.filter(h => h.picks > 0).sort((a, b) => b.picks - a.picks);
        } else {
            // Filter and Map to Role-Specific Stats
            return heroes
                .filter(h => h.roleStats && h.roleStats[roleFilter] && h.roleStats[roleFilter].picks > 0)
                .map(h => ({
                    ...h,
                    picks: h.roleStats[roleFilter].picks,
                    wins: h.roleStats[roleFilter].wins
                }))
                .sort((a, b) => b.picks - a.picks);
        }
    }, [stats, roleFilter]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/cerebro/team/${encodeURIComponent(teamName)}`} className="text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex items-center gap-2 text-cyan-400">
                        <LayoutGrid size={24} />
                        <h2 className="text-xl font-bold tracking-wider">HERO POOL ANALYSIS</h2>
                    </div>
                    <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                    <h3 className="text-white font-medium">{decodeURIComponent(teamName)}</h3>
                </div>

                <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="bg-cyan-950/50 text-cyan-400 border-cyan-500/30 text-base px-4 py-1.5 h-10">
                        Pool Size: {poolHeroes.length}
                    </Badge>

                    <Select value={versionId} onValueChange={setVersionId}>
                        <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                            <span className="truncate">
                                {versions.find(v => String(v.id) === versionId)?.name || "Select Version"}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {versions.map((v) => (
                                <SelectItem key={v.id} value={String(v.id)}>
                                    {v.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
                        <CardHeader className="border-b border-white/5 bg-slate-950/30 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Swords className="text-cyan-400" />
                                Comprehensive Hero Pool
                            </CardTitle>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-white h-8 text-xs">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Roles</SelectItem>
                                    <SelectItem value="Dark Slayer">DSL</SelectItem>
                                    <SelectItem value="Jungle">Jungle</SelectItem>
                                    <SelectItem value="Mid">Mid</SelectItem>
                                    <SelectItem value="Abyssal">Abyssal</SelectItem>
                                    <SelectItem value="Roam">Roam</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-bold">
                                        <tr>
                                            <th className="px-6 py-4">Hero</th>
                                            <th className="px-6 py-4 text-center">Picks</th>
                                            <th className="px-6 py-4 text-center">Win Rate</th>
                                            <th className="px-6 py-4">Role Distribution</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {poolHeroes.map((hero: any) => {
                                            const winRate = hero.picks > 0 ? (hero.wins / hero.picks) * 100 : 0;

                                            // Sort roles by count
                                            const sortedRoles = Object.entries(hero.roleStats)
                                                .sort((a: any, b: any) => b[1].picks - a[1].picks);

                                            return (
                                                <tr key={hero.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-3 flex items-center gap-3 font-medium">
                                                        <div className="w-10 h-10 relative rounded overflow-hidden border border-white/10">
                                                            <Image src={hero.icon} alt={hero.name} fill className="object-cover" />
                                                        </div>
                                                        <span className="text-base">{hero.name}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        <Badge variant="outline" className="bg-slate-800 border-slate-700 text-white text-sm px-3 py-1">
                                                            {hero.picks}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className={`font-bold text-base ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {winRate.toFixed(1)}%
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {hero.wins}W - {hero.picks - hero.wins}L
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            {sortedRoles.map(([role, statsObj]: any) => {
                                                                const count = statsObj.picks;
                                                                const playerName = stats.roster ? stats.roster[role] : null;

                                                                return (
                                                                    <Badge
                                                                        key={role}
                                                                        variant="secondary"
                                                                        className={`bg-slate-800 text-slate-300 border border-white/5 text-xs px-2 py-1 flex items-center gap-1.5 ${roleFilter === role ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-400' : ''}`}
                                                                    >
                                                                        <span className={`w-2 h-2 rounded-full ${role === 'Roam' ? 'bg-yellow-500' :
                                                                            role === 'Mid' ? 'bg-red-500' :
                                                                                role === 'Jungle' ? 'bg-green-500' :
                                                                                    role === 'Dark Slayer' ? 'bg-purple-500' :
                                                                                        'bg-blue-500'
                                                                            }`}></span>
                                                                        {role} {playerName && <span className="text-cyan-400 font-bold">({playerName})</span>} <span className="opacity-50">|</span> {count}
                                                                    </Badge>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {poolHeroes.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                    No pool data found for this team in the selected version.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
