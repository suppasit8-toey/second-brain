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
import { Brain, Swords, Trophy, LayoutGrid, ListFilter, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    const router = useRouter();
    const [versionId, setVersionId] = useState<string>(String(defaultVersionId));
    const [mode, setMode] = useState<CerebroMode>('ALL');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [metaRoleFilter, setMetaRoleFilter] = useState<string>('ALL'); // Decoupled filter for Meta Table
    const [draftSide, setDraftSide] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');


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
                return picksInRole && picksInRole.picks > 0;
            });
        }

        return heroes.sort((a, b) => b.picks - a.picks);
    }, [stats, roleFilter]);

    // Independent sorted list for the Meta Table
    const sortedMetaHeroes = useMemo(() => {
        if (!stats?.heroStats) return [];
        let heroes = Object.values(stats.heroStats as Record<string, any>);

        // Filter by Role using metaRoleFilter
        if (metaRoleFilter !== 'ALL') {
            heroes = heroes.filter(h => {
                const picksInRole = h.roleStats && h.roleStats[metaRoleFilter];
                return picksInRole && picksInRole.picks > 0;
            });
        }

        return heroes.sort((a, b) => b.picks - a.picks);
    }, [stats, metaRoleFilter]);

    const topCombos = useMemo(() => {
        if (!stats?.combos) return [];
        return Object.entries(stats.combos as Record<string, any>)
            .map(([key, val]) => ({ ...val, key }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [stats])

    const poolHeroCount = useMemo(() => {
        if (!stats?.heroStats) return 0;
        return Object.values(stats.heroStats as Record<string, any>).filter(h => h.picks > 0).length;
    }, [stats]);

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {/* KPI Cards */}
                    <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-white col-span-1">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full">
                            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-2">Total Games</h3>
                            <div className="text-5xl font-black text-white">{stats.totalGames}</div>
                            <div className="mt-2 text-xs text-slate-500 mb-1">{stats.totalMatches} Matches Logged</div>

                            {/* Side Distribution */}
                            {(stats.gamesOnBlue > 0 || stats.gamesOnRed > 0) && (
                                <div className="flex gap-3 text-xs w-full justify-center border-t border-slate-800 pt-2 mt-2">
                                    <span className="text-blue-400 font-medium">
                                        {stats.gamesOnBlue} Blue <span className="opacity-70">({((stats.gamesOnBlue / stats.totalGames) * 100).toFixed(0)}%)</span>
                                    </span>
                                    <span className="text-red-400 font-medium">
                                        {stats.gamesOnRed} Red <span className="opacity-70">({((stats.gamesOnRed / stats.totalGames) * 100).toFixed(0)}%)</span>
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-white col-span-1">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 uppercase">Side Win Rates</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                {/* Blue / First Pick */}
                                {(() => {
                                    // Determine Blue Stats
                                    let blueWins = 0, blueGames = 0, blueWR = 0;
                                    if (teamName) {
                                        // Team Specific
                                        blueWins = stats.winsOnBlue || 0;
                                        blueGames = stats.gamesOnBlue || 0;
                                    } else {
                                        // Global
                                        blueWins = stats.firstPickWinRate.wins;
                                        blueGames = stats.firstPickWinRate.total;
                                    }
                                    blueWR = blueGames > 0 ? (blueWins / blueGames) * 100 : 0;

                                    return (
                                        <div>
                                            <div className="text-2xl font-bold flex items-end gap-2 text-blue-400">
                                                {blueWR.toFixed(1)}%
                                                <span className="text-xs text-slate-500 mb-1.5 font-normal uppercase">First Pick (Blue)</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-800 rounded-full mt-1 mb-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${blueWR}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                {blueWins} Wins / {blueGames} Games
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Red / Second Pick */}
                                {(() => {
                                    // Determine Red Stats
                                    let redWins = 0, redGames = 0, redWR = 0;
                                    if (teamName) {
                                        // Team Specific
                                        redWins = stats.winsOnRed || 0;
                                        redGames = stats.gamesOnRed || 0;
                                    } else {
                                        // Global
                                        // Red Wins = Total - Blue Wins
                                        const total = stats.firstPickWinRate.total;
                                        const blueWins = stats.firstPickWinRate.wins;
                                        redWins = total - blueWins;
                                        redGames = total;
                                    }
                                    redWR = redGames > 0 ? (redWins / redGames) * 100 : 0;

                                    return (
                                        <div>
                                            <div className="text-2xl font-bold flex items-end gap-2 text-red-400">
                                                {redWR.toFixed(1)}%
                                                <span className="text-xs text-slate-500 mb-1.5 font-normal uppercase">Second Pick (Red)</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-800 rounded-full mt-1 mb-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500 rounded-full"
                                                    style={{ width: `${redWR}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                {redWins} Wins / {redGames} Games
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="bg-slate-900 border-slate-800 text-white col-span-1 cursor-pointer hover:bg-slate-800 transition-all group"
                        onClick={() => {
                            if (teamName) {
                                router.push(`/admin/cerebro/team/${encodeURIComponent(teamName)}/heropool`);
                            } else {
                                document.getElementById('hero-analysis')?.scrollIntoView({ behavior: 'smooth' });
                            }
                        }}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-400 uppercase flex items-center gap-2">
                                <LayoutGrid size={16} /> Hero Pool
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold flex items-end gap-2 group-hover:text-cyan-400 transition-colors">
                                {poolHeroCount}
                                <span className="text-sm text-slate-500 mb-1 font-normal">Heroes</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-white col-span-1 md:col-span-2 lg:col-span-2">
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
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-6">

                        {/* TEAM DEEP DIVE MODULE */}
                        {teamName && (
                            <div className="mb-8">
                                <TeamDeepDiveStats teamName={teamName} versionId={Number(versionId)} />
                            </div>
                        )}

                        {/* Hero Table */}
                        <Card id="hero-analysis" className="bg-slate-900 border-slate-800 text-white overflow-hidden scroll-mt-20">
                            <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <Swords className="text-cyan-400" />
                                        Hero Meta Analysis
                                    </CardTitle>
                                    <Tabs value={metaRoleFilter} onValueChange={setMetaRoleFilter} className="w-full md:w-auto">
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
                                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-bold sticky top-0 z-10 backdrop-blur-md">
                                            <tr>
                                                <th className="px-6 py-4">Hero</th>
                                                <th className="px-6 py-4 text-center">Picks</th>
                                                <th className="px-6 py-4 text-center">Ban Rate</th>
                                                <th className="px-6 py-4 text-center">Win Rate</th>
                                                <th className="px-6 py-4">Positions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedMetaHeroes.map((hero: any) => {
                                                const winRate = hero.picks > 0 ? (hero.wins / hero.picks) * 100 : 0;
                                                const banRate = stats.totalGames > 0 ? (hero.bans / stats.totalGames) * 100 : 0;
                                                const topRole = Object.entries(hero.roleStats).sort((a: any, b: any) => b[1].picks - a[1].picks)[0];

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
                                                                    .sort((a: any, b: any) => b[1].picks - a[1].picks)
                                                                    .map(([role, stats]: any) => (
                                                                        <Badge
                                                                            key={role}
                                                                            variant="secondary"
                                                                            className={`bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0 ${metaRoleFilter !== 'ALL' && role === metaRoleFilter ? 'ring-1 ring-cyan-500 text-cyan-400' : ''}`}
                                                                        >
                                                                            {role} ({stats.picks})
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
                                <div className="flex flex-col md:flex-row md:items-center justify-between mt-8 mb-4 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-cyan-400">
                                            <Brain size={24} />
                                            <h2 className="text-xl font-bold tracking-wider uppercase">Draft Logic & Ban Analysis</h2>
                                        </div>
                                        {teamName && (
                                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest ml-8">
                                                Analyzing bans made by <span className="text-slate-300">{teamName}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-slate-950/50 border-slate-800 text-slate-500 font-mono text-[10px] py-1 px-3">
                                            Source: Simulator
                                        </Badge>
                                        <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-mono text-[10px] py-1 px-3">
                                            Games: {draftSide === 'ALL' ? stats.simulatorGames : (draftSide === 'BLUE' ? stats.simulatorGamesOnBlue : stats.simulatorGamesOnRed)}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Pick Order Priority */}
                                    <Card className="bg-slate-900 border-slate-800 text-white">
                                        <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <ListFilter className="text-purple-400" size={18} />
                                                    Role Priority by Pick Slot
                                                </CardTitle>
                                                <Tabs value={draftSide} onValueChange={(v) => setDraftSide(v as any)} className="w-[300px]">
                                                    <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-700 h-8">
                                                        <TabsTrigger value="ALL" className="text-xs">Total</TabsTrigger>
                                                        <TabsTrigger value="BLUE" className="text-xs data-[state=active]:text-blue-400">Blue Side</TabsTrigger>
                                                        <TabsTrigger value="RED" className="text-xs data-[state=active]:text-red-400">Red Side</TabsTrigger>
                                                    </TabsList>
                                                </Tabs>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="space-y-6">
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-1">Phase 1 (Picks)</div>
                                                {[5, 6, 7, 8, 9, 10].map((slot) => {
                                                    // Determine Source Data
                                                    let roleData = stats.pickOrderStats[slot] || {};
                                                    if (draftSide === 'BLUE') roleData = stats.sideStats?.BLUE.pickOrderStats[slot] || {};
                                                    if (draftSide === 'RED') roleData = stats.sideStats?.RED.pickOrderStats[slot] || {};

                                                    const sortedRoles = Object.entries(roleData)
                                                        .sort((a: any, b: any) => b[1] - a[1])
                                                        .slice(0, 3); // Top 3 roles per slot
                                                    const totalPicksInSlot = Object.values(roleData).reduce((a: any, b: any) => a + b, 0) as number;

                                                    // Labeling Logic based on User Mappings
                                                    let teamTag = '';
                                                    let relIdx = '';
                                                    let isTargetTeam = false;

                                                    if (draftSide === 'BLUE') {
                                                        const blueMap = {
                                                            5: { tag: 'TEAM A', idx: 'PICK 1', target: true },
                                                            6: { tag: 'TEAM B', idx: 'PICK 1', target: false },
                                                            7: { tag: 'TEAM B', idx: 'PICK 2', target: false },
                                                            8: { tag: 'TEAM A', idx: 'PICK 2', target: true },
                                                            9: { tag: 'TEAM A', idx: 'PICK 3', target: true },
                                                            10: { tag: 'TEAM B', idx: 'PICK 3', target: false },
                                                        } as any;
                                                        teamTag = blueMap[slot].tag;
                                                        relIdx = blueMap[slot].idx;
                                                        isTargetTeam = blueMap[slot].target;
                                                    } else {
                                                        const redMap = {
                                                            5: { tag: 'TEAM B', idx: 'PICK 1', target: false },
                                                            6: { tag: 'TEAM A', idx: 'PICK 1', target: true },
                                                            7: { tag: 'TEAM A', idx: 'PICK 2', target: true },
                                                            8: { tag: 'TEAM B', idx: 'PICK 2', target: false },
                                                            9: { tag: 'TEAM B', idx: 'PICK 3', target: false },
                                                            10: { tag: 'TEAM A', idx: 'PICK 3', target: true },
                                                        } as any;
                                                        teamTag = redMap[slot].tag;
                                                        relIdx = redMap[slot].idx;
                                                        isTargetTeam = redMap[slot].target;
                                                    }

                                                    return (
                                                        <div key={slot} className="flex items-center gap-4">
                                                            <div className={`w-28 flex-shrink-0 font-mono text-[10px] leading-tight flex flex-col ${isTargetTeam ? 'text-cyan-400' : 'text-slate-500 opacity-70'}`}>
                                                                <span className="font-bold">{teamTag} {relIdx}</span>
                                                                <span className="opacity-50 text-[8px]">Slot {slot}</span>
                                                            </div>
                                                            <div className="flex-1 flex gap-2 h-8">
                                                                {sortedRoles.map(([role, count]: any, idx) => {
                                                                    const percent = totalPicksInSlot > 0 ? (count / totalPicksInSlot) * 100 : 0;
                                                                    const playerName = stats.roster ? stats.roster[role] : null;

                                                                    return (
                                                                        <div
                                                                            key={role}
                                                                            className={`h-full flex items-center justify-center px-2 text-[10px] font-bold rounded relative overflow-hidden ${role === 'Roam' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                                                                                role === 'Mid' ? 'bg-red-500/20 text-red-500 border border-red-500/50' :
                                                                                    role === 'Jungle' ? 'bg-green-500/20 text-green-500 border border-green-500/50' :
                                                                                        role === 'Dark Slayer' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/50' :
                                                                                            'bg-blue-500/20 text-blue-500 border border-blue-500/50'
                                                                                }`}
                                                                            style={{ width: `${percent}%` }}
                                                                            title={`${role} ${playerName ? `(${playerName})` : ''}: ${percent.toFixed(1)}%`}
                                                                        >
                                                                            <span className="truncate">
                                                                                {role === 'Roam' ? 'SUP' : role === 'Dark Slayer' ? 'DSL' : role === 'Abyssal' ? 'ADL' : role === 'Jungle' ? 'JUG' : 'MID'}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                                {sortedRoles.length === 0 && <span className="text-[10px] text-slate-600 self-center">No data</span>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                <div className="pt-2 border-t border-white/5 mx-4"></div>
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-1">Phase 2 (Picks)</div>
                                                {[15, 16, 17, 18].map((slot) => {
                                                    let roleData = stats.pickOrderStats[slot] || {};
                                                    if (draftSide === 'BLUE') roleData = stats.sideStats?.BLUE.pickOrderStats[slot] || {};
                                                    if (draftSide === 'RED') roleData = stats.sideStats?.RED.pickOrderStats[slot] || {};

                                                    const sortedRoles = Object.entries(roleData)
                                                        .sort((a: any, b: any) => b[1] - a[1])
                                                        .slice(0, 3);
                                                    const totalPicksInSlot = Object.values(roleData).reduce((a: any, b: any) => a + b, 0) as number;

                                                    let teamTag = '';
                                                    let relIdx = '';
                                                    let isTargetTeam = false;

                                                    if (draftSide === 'BLUE') {
                                                        const blueMap = {
                                                            15: { tag: 'TEAM B', idx: 'PICK 4', target: false },
                                                            16: { tag: 'TEAM A', idx: 'PICK 4', target: true },
                                                            17: { tag: 'TEAM A', idx: 'PICK 5', target: true },
                                                            18: { tag: 'TEAM B', idx: 'PICK 5', target: false },
                                                        } as any;
                                                        teamTag = blueMap[slot].tag;
                                                        relIdx = blueMap[slot].idx;
                                                        isTargetTeam = blueMap[slot].target;
                                                    } else {
                                                        const redMap = {
                                                            15: { tag: 'TEAM A', idx: 'PICK 4', target: true },
                                                            16: { tag: 'TEAM B', idx: 'PICK 4', target: false },
                                                            17: { tag: 'TEAM B', idx: 'PICK 5', target: false },
                                                            18: { tag: 'TEAM A', idx: 'PICK 5', target: true },
                                                        } as any;
                                                        teamTag = redMap[slot].tag;
                                                        relIdx = redMap[slot].idx;
                                                        isTargetTeam = redMap[slot].target;
                                                    }

                                                    return (
                                                        <div key={slot} className="flex items-center gap-4">
                                                            <div className={`w-28 flex-shrink-0 font-mono text-[10px] leading-tight flex flex-col ${isTargetTeam ? 'text-cyan-400' : 'text-slate-500 opacity-70'}`}>
                                                                <span className="font-bold">{teamTag} {relIdx}</span>
                                                                <span className="opacity-50 text-[8px]">Slot {slot}</span>
                                                            </div>
                                                            <div className="flex-1 flex gap-2 h-8">
                                                                {sortedRoles.map(([role, count]: any) => {
                                                                    const percent = totalPicksInSlot > 0 ? (count / totalPicksInSlot) * 100 : 0;
                                                                    const playerName = stats.roster ? stats.roster[role] : null;
                                                                    return (
                                                                        <div
                                                                            key={role}
                                                                            className={`h-full flex items-center justify-center px-2 text-[10px] font-bold rounded relative overflow-hidden ${role === 'Roam' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                                                                                role === 'Mid' ? 'bg-red-500/20 text-red-500 border border-red-500/50' :
                                                                                    role === 'Jungle' ? 'bg-green-500/20 text-green-500 border border-green-500/50' :
                                                                                        role === 'Dark Slayer' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/50' :
                                                                                            'bg-blue-500/20 text-blue-500 border border-blue-500/50'
                                                                                }`}
                                                                            style={{ width: `${percent}%` }}
                                                                            title={`${role} ${playerName ? `(${playerName})` : ''}: ${percent.toFixed(1)}%`}
                                                                        >
                                                                            <span className="truncate">
                                                                                {role === 'Roam' ? 'SUP' : role === 'Dark Slayer' ? 'DSL' : role === 'Abyssal' ? 'ADL' : role === 'Jungle' ? 'JUG' : 'MID'}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                                {sortedRoles.length === 0 && <span className="text-[10px] text-slate-600 self-center">No data</span>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Ban Priority by Slot */}
                                    <Card className="bg-slate-900 border-slate-800 text-white">
                                        <CardHeader className="border-b border-white/5 bg-slate-950/30">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <div className="text-red-400">🚫</div>
                                                    Ban Priority by Slot
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="space-y-6">
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-1">Phase 1 (Bans)</div>
                                                <div className="flex flex-wrap gap-x-8 gap-y-6">
                                                    {[1, 2, 3, 4].map((slot) => {
                                                        let banData = stats.banOrderStats[slot] || {};
                                                        if (draftSide === 'BLUE') banData = stats.sideStats?.BLUE.banOrderStats[slot] || {};
                                                        if (draftSide === 'RED') banData = stats.sideStats?.RED.banOrderStats[slot] || {};

                                                        const sortedBans = Object.entries(banData)
                                                            .sort((a: any, b: any) => b[1] - a[1])
                                                            .slice(0, 3);
                                                        const totalBansInSlot = Object.values(banData).reduce((a: any, b: any) => a + b, 0) as number;

                                                        let teamTag = '';
                                                        let relIdx = '';
                                                        let isTargetTeam = false;
                                                        let isRedColor = false;

                                                        if (draftSide === 'BLUE') {
                                                            const blueMap = {
                                                                1: { tag: 'TEAM A', idx: 'BAN 1', target: true, red: false },
                                                                2: { tag: 'TEAM B', idx: 'BAN 1', target: false, red: true },
                                                                3: { tag: 'TEAM A', idx: 'BAN 2', target: true, red: false },
                                                                4: { tag: 'TEAM B', idx: 'BAN 2', target: false, red: true },
                                                            } as any;
                                                            teamTag = blueMap[slot].tag;
                                                            relIdx = blueMap[slot].idx;
                                                            isTargetTeam = blueMap[slot].target;
                                                            isRedColor = blueMap[slot].red;
                                                        } else {
                                                            const redMap = {
                                                                1: { tag: 'TEAM B', idx: 'BAN 1', target: false, red: false },
                                                                2: { tag: 'TEAM A', idx: 'BAN 1', target: true, red: true },
                                                                3: { tag: 'TEAM B', idx: 'BAN 2', target: false, red: false },
                                                                4: { tag: 'TEAM A', idx: 'BAN 2', target: true, red: true },
                                                            } as any;
                                                            teamTag = redMap[slot].tag;
                                                            relIdx = redMap[slot].idx;
                                                            isTargetTeam = redMap[slot].target;
                                                            isRedColor = redMap[slot].red;
                                                        }

                                                        return (
                                                            <div key={slot} className="flex min-w-[200px] flex-col gap-1.5 flex-1">
                                                                <div className={`w-28 flex-shrink-0 font-mono text-[10px] leading-tight flex flex-col ${isRedColor ? 'text-red-400' : 'text-blue-400'} ${!isTargetTeam && 'opacity-70'}`}>
                                                                    <span className="font-bold">{teamTag} {relIdx}</span>
                                                                    <span className="opacity-50 text-[8px]">Slot {slot}</span>
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    {sortedBans.map(([heroId, count]: any) => {
                                                                        const percent = totalBansInSlot > 0 ? (count / totalBansInSlot) * 100 : 0;
                                                                        const hero = stats.heroStats[heroId];
                                                                        if (!hero) return null;
                                                                        return (
                                                                            <div
                                                                                key={heroId}
                                                                                className={`h-8 flex items-center justify-start px-2 text-xs font-bold rounded relative overflow-hidden border ${isRedColor
                                                                                    ? 'bg-red-500/10 border-red-500/30 text-red-100'
                                                                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-100'
                                                                                    }`}
                                                                                title={`${hero.name}: ${percent.toFixed(1)}%`}
                                                                            >
                                                                                <div className="flex items-center gap-1 relative z-10 w-full px-1">
                                                                                    <img src={hero.icon} className="w-5 h-5 rounded-full flex-shrink-0" alt={hero.name} />
                                                                                    <span className="text-[10px] font-bold">
                                                                                        {percent.toFixed(0)}% <span className="text-[9px] opacity-60 font-medium">({count})</span>
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                    {sortedBans.length === 0 && <span className="text-[10px] text-slate-600 self-center">No data</span>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="pt-2 border-t border-white/5 mx-4"></div>
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-1">Phase 2 (Bans)</div>
                                                <div className="flex flex-wrap gap-x-8 gap-y-6">
                                                    {[11, 12, 13, 14].map((slot) => {
                                                        let banData = stats.banOrderStats[slot] || {};
                                                        if (draftSide === 'BLUE') banData = stats.sideStats?.BLUE.banOrderStats[slot] || {};
                                                        if (draftSide === 'RED') banData = stats.sideStats?.RED.banOrderStats[slot] || {};

                                                        const sortedBans = Object.entries(banData)
                                                            .sort((a: any, b: any) => b[1] - a[1])
                                                            .slice(0, 3);
                                                        const totalBansInSlot = Object.values(banData).reduce((a: any, b: any) => a + b, 0) as number;

                                                        let teamTag = '';
                                                        let relIdx = '';
                                                        let isTargetTeam = false;
                                                        let isRedColor = false;

                                                        if (draftSide === 'BLUE') {
                                                            const blueMap = {
                                                                11: { tag: 'TEAM B', idx: 'BAN 3', target: false, red: true },
                                                                12: { tag: 'TEAM A', idx: 'BAN 3', target: true, red: false },
                                                                13: { tag: 'TEAM B', idx: 'BAN 4', target: false, red: true },
                                                                14: { tag: 'TEAM A', idx: 'BAN 4', target: true, red: false },
                                                            } as any;
                                                            teamTag = blueMap[slot].tag;
                                                            relIdx = blueMap[slot].idx;
                                                            isTargetTeam = blueMap[slot].target;
                                                            isRedColor = blueMap[slot].red;
                                                        } else {
                                                            const redMap = {
                                                                11: { tag: 'TEAM A', idx: 'BAN 3', target: true, red: true },
                                                                12: { tag: 'TEAM B', idx: 'BAN 3', target: false, red: false },
                                                                13: { tag: 'TEAM A', idx: 'BAN 4', target: true, red: true },
                                                                14: { tag: 'TEAM B', idx: 'BAN 4', target: false, red: false },
                                                            } as any;
                                                            teamTag = redMap[slot].tag;
                                                            relIdx = redMap[slot].idx;
                                                            isTargetTeam = redMap[slot].target;
                                                            isRedColor = redMap[slot].red;
                                                        }

                                                        return (
                                                            <div key={slot} className="flex min-w-[200px] flex-col gap-1.5 flex-1">
                                                                <div className={`w-28 flex-shrink-0 font-mono text-[10px] leading-tight flex flex-col ${isRedColor ? 'text-red-400' : 'text-blue-400'} ${!isTargetTeam && 'opacity-70'}`}>
                                                                    <span className="font-bold">{teamTag} {relIdx}</span>
                                                                    <span className="opacity-50 text-[8px]">Slot {slot}</span>
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    {sortedBans.map(([heroId, count]: any) => {
                                                                        const percent = totalBansInSlot > 0 ? (count / totalBansInSlot) * 100 : 0;
                                                                        const hero = stats.heroStats[heroId];
                                                                        if (!hero) return null;
                                                                        return (
                                                                            <div
                                                                                key={heroId}
                                                                                className={`h-8 flex items-center justify-start px-2 text-xs font-bold rounded relative overflow-hidden border ${isRedColor
                                                                                    ? 'bg-red-500/10 border-red-500/30 text-red-100'
                                                                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-100'
                                                                                    }`}
                                                                                title={`${hero.name}: ${percent.toFixed(1)}%`}
                                                                            >
                                                                                <div className="flex items-center gap-1 relative z-10 w-full px-1">
                                                                                    <img src={hero.icon} className="w-5 h-5 rounded-full flex-shrink-0" alt={hero.name} />
                                                                                    <span className="text-[10px] font-bold">
                                                                                        {percent.toFixed(0)}% <span className="text-[9px] opacity-60 font-medium">({count})</span>
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                    {sortedBans.length === 0 && <span className="text-[10px] text-slate-600 self-center">No data</span>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {/* End of Ban Priority Card */}
                                </div>
                            </div>
                        )
                        }
                    </div >
                    {/* End of Main Content (col-span-4) */}

                    {/* Sidebar Stats (col-span-1) */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-1 space-y-6">

                        {/* Knowledge Base Link */}
                        <Link href="/admin/cerebro/knowledge">
                            <Card className="bg-slate-900/50 border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer group mb-6">
                                <CardHeader className="bg-cyan-950/20 border-b border-cyan-500/10">
                                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                                        <Brain className="w-6 h-6 text-cyan-400" />
                                    </div>
                                    <CardTitle className="text-white group-hover:text-cyan-400 transition-colors text-lg">Knowledge Base</CardTitle>
                                    <p className="text-xs text-slate-400 leading-relaxed">Teach Cerebro about hero synergies, counter-picks, and game mechanics.</p>
                                </CardHeader>
                            </Card>
                        </Link>

                        {/* Recent Trophies */}
                        <Card className="bg-slate-900 border-slate-800 text-white">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                                    <Trophy size={16} className="text-yellow-400" /> Recent Trophies
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="text-center py-6 text-slate-500 text-xs italic">
                                    No tournaments won yet... time to grind!
                                </div>
                            </CardContent>
                        </Card>

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
                                        // Use ALL stats to find heroes, ensuring filter doesn't hide them
                                        const h1 = stats.heroStats[combo.heroes[0]];
                                        const h2 = stats.heroStats[combo.heroes[1]];
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
                </div >
            )}
        </div >
    );
}
