'use client';

import { useState, useMemo, useEffect } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
} from 'chart.js';
import { Brain, Swords, Shield, Trophy, LayoutGrid, ListFilter, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { CerebroMode, getCerebroStats } from '../actions';
import { getTournaments } from '../../tournaments/actions';
import TeamDeepDiveStats from './TeamDeepDiveStats';

// Register ChartJS
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface DashboardProps {
    initialVersions: any[];
    defaultVersionId: number;
    fetchStats?: (versionId: number, mode: CerebroMode) => Promise<any>; // Made optional
    teamName?: string; // New Prop
}

export default function CerebroDashboard({ initialVersions, defaultVersionId, teamName }: DashboardProps) {
    const [versionId, setVersionId] = useState<string>(String(defaultVersionId));
    const [mode, setMode] = useState<CerebroMode>('ALL');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [roleFilter, setRoleFilter] = useState<string>('ALL');

    // New Filters
    const [tournamentId, setTournamentId] = useState<string>('ALL');
    const [tournaments, setTournaments] = useState<any[]>([]);

    // Fetch tournaments
    useEffect(() => {
        getTournaments().then(setTournaments);
    }, []);

    // Fetch data on change
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Use imported action directly to support new params
                const data = await getCerebroStats(
                    Number(versionId),
                    mode,
                    tournamentId === 'ALL' ? undefined : tournamentId,
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
    }, [versionId, mode, tournamentId, teamName]);

    // Derivations
    const sortedHeroes = useMemo(() => {
        if (!stats?.heroStats) return [];
        let heroes = Object.values(stats.heroStats as Record<string, any>);

        // Filter by Role
        if (roleFilter !== 'ALL') {
            heroes = heroes.filter(h => {
                // Check if hero has picks in this role
                const picksInRole = h.roleStats && h.roleStats[roleFilter];
                return picksInRole && picksInRole > 0;
            });
        }

        return heroes.sort((a, b) => b.picks - a.picks);
    }, [stats, roleFilter]);

    const topCombos = useMemo(() => {
        if (!stats?.combos) return [];
        return Object.entries(stats.combos as Record<string, any>)
            .map(([key, val]) => ({ ...val, key }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [stats])

    if (!stats) return <div className="p-10 text-center text-slate-500">Initializing Core...</div>;

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <Brain size={24} />
                        <h2 className="text-xl font-bold tracking-wider">ANALYSIS PROTOCOL</h2>
                    </div>
                    <div className="h-8 w-[1px] bg-white/10"></div>

                    {/* Version Selector */}
                    <Select value={versionId} onValueChange={setVersionId}>
                        <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                            <span className="truncate">
                                {initialVersions.find(v => String(v.id) === versionId)?.name || "Select Version"}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {initialVersions.map((v) => (
                                <SelectItem key={v.id} value={String(v.id)}>
                                    {v.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Tournament Selector */}
                    <Select value={tournamentId} onValueChange={setTournamentId}>
                        <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                            <span className="truncate">
                                {tournaments.find(t => t.id === tournamentId)?.name || "All Tournaments"}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Tournaments</SelectItem>
                            {tournaments.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-white">
                            <div className="flex items-center gap-2">
                                <ListFilter size={16} className="text-slate-400" />
                                <SelectValue placeholder="All Roles" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Roles</SelectItem>
                            <SelectItem value="Dark Slayer">Dark Slayer</SelectItem>
                            <SelectItem value="Jungle">Jungle</SelectItem>
                            <SelectItem value="Mid">Mid</SelectItem>
                            <SelectItem value="Abyssal">Abyssal</SelectItem>
                            <SelectItem value="Roam">Roam</SelectItem>
                        </SelectContent>
                    </Select>

                    <Tabs value={mode} onValueChange={(v) => setMode(v as CerebroMode)} className="w-full md:w-auto">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-700">
                            <TabsTrigger value="ALL">All Sources</TabsTrigger>
                            <TabsTrigger value="SCRIM_SUMMARY">Quick Logs</TabsTrigger>
                            <TabsTrigger value="FULL_SIMULATOR">Simulator</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* KPI Cards */}
                    <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-white col-span-1 md:col-span-1">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full">
                            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-2">Total Games</h3>
                            <div className="text-5xl font-black text-white">{stats.totalGames}</div>
                            <div className="mt-2 text-xs text-slate-500">{stats.totalMatches} Matches Logged</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-white col-span-1 md:col-span-1">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 uppercase">First Pick Win Rate</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold flex items-end gap-2">
                                {stats.firstPickWinRate.total > 0
                                    ? ((stats.firstPickWinRate.wins / stats.firstPickWinRate.total) * 100).toFixed(1)
                                    : 0}%
                                <span className="text-sm text-slate-500 mb-1 font-normal">Blue Side</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-white col-span-1 md:col-span-2">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 uppercase">Team Performance Leaderboard</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                                {Object.values(stats.teamStats as Record<string, any>)
                                    .sort((a, b) => b.wins - a.wins)
                                    .map((team, idx) => (
                                        <Link
                                            key={team.name}
                                            href={`/admin/cerebro/team/${encodeURIComponent(team.name)}`}
                                            className="flex justify-between items-center text-sm p-2 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                                        >
                                            <span className="font-bold flex items-center gap-2">
                                                <span className="text-slate-500 w-4">{idx + 1}.</span>
                                                <span className="group-hover:text-cyan-400 transition-colors">{team.name}</span>
                                            </span>
                                            <div className="flex gap-3">
                                                <span className="text-slate-400">{team.wins}W - {team.games - team.wins}L</span>
                                                <span className={((team.wins / team.games) > 0.5 ? "text-green-400" : "text-red-400")}>
                                                    {((team.wins / team.games) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Main Content Area */}
                    <div className="md:col-span-3 space-y-6">

                        {/* TEAM DEEP DIVE MODULE */}
                        {teamName && (
                            <div className="mb-8">
                                <TeamDeepDiveStats teamName={teamName} versionId={Number(versionId)} />
                            </div>
                        )}

                        {/* Hero Table */}
                        <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
                            <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <Swords className="text-cyan-400" />
                                        Hero Meta Analysis
                                    </CardTitle>
                                    <Tabs value={roleFilter} onValueChange={setRoleFilter} className="w-full md:w-auto">
                                        <TabsList className="bg-slate-900 border border-slate-700 h-9">
                                            <TabsTrigger value="ALL" className="text-xs px-3">All</TabsTrigger>
                                            <TabsTrigger value="Dark Slayer" className="text-xs px-3">DSL</TabsTrigger>
                                            <TabsTrigger value="Jungle" className="text-xs px-3">JUG</TabsTrigger>
                                            <TabsTrigger value="Mid" className="text-xs px-3">MID</TabsTrigger>
                                            <TabsTrigger value="Abyssal" className="text-xs px-3">ADL</TabsTrigger>
                                            <TabsTrigger value="Roam" className="text-xs px-3">SUP</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-bold">
                                            <tr>
                                                <th className="px-6 py-4">Hero</th>
                                                <th className="px-6 py-4 text-center">Picks</th>
                                                <th className="px-6 py-4 text-center">Ban Rate</th>
                                                <th className="px-6 py-4 text-center">Win Rate</th>
                                                <th className="px-6 py-4">Positions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedHeroes.slice(0, 10).map((hero: any) => {
                                                const winRate = hero.picks > 0 ? (hero.wins / hero.picks) * 100 : 0;
                                                const banRate = stats.totalGames > 0 ? (hero.bans / stats.totalGames) * 100 : 0;
                                                const topRole = Object.entries(hero.roleStats).sort((a: any, b: any) => b[1] - a[1])[0];

                                                return (
                                                    <tr key={hero.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-3 flex items-center gap-3 font-medium">
                                                            <Image src={hero.icon} alt={hero.name} width={32} height={32} className="rounded" />
                                                            {hero.name}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <Badge variant="outline" className="bg-slate-800 border-slate-700 text-white">
                                                                {hero.picks}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-3 text-center text-slate-400">
                                                            {mode !== 'SCRIM_SUMMARY' ? `${banRate.toFixed(1)}%` : '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <div className={`font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {winRate.toFixed(1)}%
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {Object.entries(hero.roleStats)
                                                                    .sort((a: any, b: any) => b[1] - a[1])
                                                                    .map(([role, count]: any) => (
                                                                        <Badge
                                                                            key={role}
                                                                            variant="secondary"
                                                                            className={`bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0 ${roleFilter !== 'ALL' && role === roleFilter ? 'ring-1 ring-cyan-500 text-cyan-400' : ''}`}
                                                                        >
                                                                            {role} ({count})
                                                                        </Badge>
                                                                    ))}
                                                                {Object.keys(hero.roleStats).length === 0 && '-'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* DRAFT LOGIC ANALYSIS */}
                        {(mode === 'FULL_SIMULATOR' || mode === 'ALL') && stats?.pickOrderStats && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-cyan-400 mt-8 mb-4">
                                    <Brain size={24} />
                                    <h2 className="text-xl font-bold tracking-wider">DRAFT LOGIC & BAN ANALYSIS</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Pick Order Priority */}
                                    <Card className="bg-slate-900 border-slate-800 text-white">
                                        <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <ListFilter className="text-purple-400" size={18} />
                                                Role Priority by Pick Slot
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="space-y-6">
                                                {[1, 2, 3, 4, 5].map((slot) => {
                                                    const roleData = stats.pickOrderStats[slot] || {};
                                                    const sortedRoles = Object.entries(roleData)
                                                        .sort((a: any, b: any) => b[1] - a[1])
                                                        .slice(0, 3); // Top 3 roles per slot
                                                    const totalPicksInSlot = Object.values(roleData).reduce((a: any, b: any) => a + b, 0) as number;

                                                    return (
                                                        <div key={slot} className="flex items-center gap-4">
                                                            <div className="w-16 flex-shrink-0 font-mono text-sm text-slate-500">
                                                                Pick {slot}
                                                            </div>
                                                            <div className="flex-1 flex gap-2 h-8">
                                                                {sortedRoles.map(([role, count]: any, idx) => {
                                                                    const percent = totalPicksInSlot > 0 ? (count / totalPicksInSlot) * 100 : 0;
                                                                    return (
                                                                        <div
                                                                            key={role}
                                                                            className={`h-full flex items-center justify-center px-2 text-xs font-bold rounded relative overflow-hidden ${role === 'Roam' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                                                                                role === 'Mid' ? 'bg-red-500/20 text-red-500 border border-red-500/50' :
                                                                                    role === 'Jungle' ? 'bg-green-500/20 text-green-500 border border-green-500/50' :
                                                                                        role === 'Dark Slayer' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/50' :
                                                                                            'bg-blue-500/20 text-blue-500 border border-blue-500/50'
                                                                                }`}
                                                                            style={{ width: `${percent}%` }}
                                                                            title={`${role}: ${percent.toFixed(1)}%`}
                                                                        >
                                                                            <span className="truncate">{role === 'Roam' ? 'SUP' : role === 'Dark Slayer' ? 'DSL' : role === 'Abyssal' ? 'ADL' : role === 'Jungle' ? 'JUG' : 'MID'}</span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Ban Analysis */}
                                    <Card className="bg-slate-900 border-slate-800 text-white">
                                        <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Shield className="text-red-400" size={18} />
                                                Most Dangerous (Top Bans)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-bold">
                                                        <tr>
                                                            <th className="px-4 py-3">Hero</th>
                                                            <th className="px-4 py-3 text-center">Ban Rate</th>
                                                            <th className="px-4 py-3 text-right">Phase Priority</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {sortedHeroes
                                                            .sort((a, b) => b.bans - a.bans)
                                                            .filter(h => h.bans > 0)
                                                            .slice(0, 8)
                                                            .map((hero: any) => {
                                                                const banRate = stats.totalGames > 0 ? (hero.bans / stats.totalGames) * 100 : 0;
                                                                let phase1Bans = 0;
                                                                let phase2Bans = 0;
                                                                if (stats.banOrderStats) {
                                                                    phase1Bans = (stats.banOrderStats[1]?.[hero.id] || 0) + (stats.banOrderStats[2]?.[hero.id] || 0);
                                                                    phase2Bans = (stats.banOrderStats[3]?.[hero.id] || 0) + (stats.banOrderStats[4]?.[hero.id] || 0);
                                                                }
                                                                const isPhase1 = phase1Bans >= phase2Bans;

                                                                return (
                                                                    <tr key={hero.id} className="hover:bg-white/5">
                                                                        <td className="px-4 py-2 flex items-center gap-3">
                                                                            <div className="w-8 h-8 relative rounded overflow-hidden border border-white/10">
                                                                                <Image src={hero.icon} alt={hero.name} fill className="object-cover" />
                                                                            </div>
                                                                            <span className="font-medium text-slate-200">{hero.name}</span>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center text-red-400 font-bold">
                                                                            {banRate.toFixed(1)}%
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right">
                                                                            <Badge variant="outline" className={isPhase1 ? "border-red-500/50 text-red-500" : "border-yellow-500/50 text-yellow-500"}>
                                                                                {isPhase1 ? "Phase 1" : "Phase 2"}
                                                                            </Badge>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Stats */}
                    <div className="md:col-span-1 space-y-6">

                        {/* Top Combos */}
                        <Card className="bg-slate-900 border-slate-800 text-white">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                                    <Users size={16} className="text-purple-400" /> Top Duos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-white/5">
                                    {topCombos.map((combo: any, idx) => {
                                        const h1 = sortedHeroes.find((h: any) => h.id === combo.heroes[0]);
                                        const h2 = sortedHeroes.find((h: any) => h.id === combo.heroes[1]);
                                        const wr = (combo.wins / combo.count) * 100;

                                        if (!h1 || !h2) return null;

                                        return (
                                            <div key={combo.key} className="p-3 flex items-center justify-between hover:bg-white/5">
                                                <div className="flex items-center -space-x-2">
                                                    <div className="w-8 h-8 rounded-full border-2 border-slate-900 relative z-10">
                                                        <Image src={h1.icon} alt={h1.name} fill className="rounded-full object-cover" />
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full border-2 border-slate-900 relative z-0">
                                                        <Image src={h2.icon} alt={h2.name} fill className="rounded-full object-cover" />
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-white">{combo.count} Picks</div>
                                                    <div className={`text-[10px] ${wr >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {wr.toFixed(0)}% WR
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {topCombos.length === 0 && <div className="p-4 text-center text-xs text-slate-500">No combo data available</div>}
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                </div>
            )
            }
        </div >
    );
}
