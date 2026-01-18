import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Shuffle, ShieldCheck, Swords, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DraftCompositionBoardProps {
    stats: any;
    teamName: string;
    side: string;
    setSide: (side: string) => void;
    heroMap?: Record<string, any>;
}

export default function DraftCompositionBoard({ stats, teamName, side, setSide, heroMap }: DraftCompositionBoardProps) {
    const [activeTab, setActiveTab] = useState('PRIORITIES');

    // Helper to get Hero Info
    const getHeroInfo = (id: string) => {
        const fromStats = stats.heroStats?.[id];
        if (fromStats) return { name: fromStats.name, icon: fromStats.icon };
        const fromMap = heroMap?.[id];
        if (fromMap) return { name: fromMap.name, icon: fromMap.icon_url };
        return { name: 'Unknown', icon: '' };
    };

    // --- LOGIC: Role Priority by Slot ---
    // stats.pickOrderStats: Record<number, Record<string, number>> (Slot -> Role -> Count)
    // Filter Pick Order Stats based on Side
    const roleTimeline = useMemo(() => {
        const timeline: any[] = [];
        // If Side Filter is active, show slots relevant to that side
        let targetStats = stats.pickOrderStats;
        if (side === 'BLUE' && stats.sideStats?.BLUE?.pickOrderStats) {
            targetStats = stats.sideStats.BLUE.pickOrderStats;
        } else if (side === 'RED' && stats.sideStats?.RED?.pickOrderStats) {
            targetStats = stats.sideStats.RED.pickOrderStats;
        }

        // Iterate potential slots
        for (let i = 1; i <= 20; i++) {
            const roleData = targetStats?.[i] || {};
            const total = Object.values(roleData).reduce((a: any, b: any) => a + b, 0) as number;

            if (total > 0) {
                const topRoles = Object.entries(roleData)
                    .map(([role, count]: [string, any]) => ({ role, count, pct: total > 0 ? (count / total) * 100 : 0 }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 2);

                timeline.push({ slot: i, topRoles });
            }
        }
        return timeline;
    }, [stats, side]);


    // --- LOGIC: Phase 1 Flex Picks (Refined with Matchups) ---
    // Heroes played in >= 2 roles AND strong against common Meta Threats.
    const flexPicks = useMemo(() => {
        // 1. Identify Top Meta Threats (same as Phase 2)
        const enemyFrequency: Record<string, number> = {};
        const matchupData = stats.matchupStats || {};
        Object.values(matchupData).forEach((enemies: any) => {
            Object.entries(enemies).forEach(([enemyId, data]: [string, any]) => {
                enemyFrequency[enemyId] = (enemyFrequency[enemyId] || 0) + data.games;
            });
        });
        const topEnemies = Object.entries(enemyFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        return Object.values(stats.heroStats || {})
            .map((h: any) => {
                const rolesPlayed = Object.keys(h.roleStats || {}).length;

                // Calculate Matchup Score
                const strongAgainst: Array<{ id: string; name: string; winRate: number }> = [];
                let matchupBonus = 0;

                topEnemies.forEach(enemyId => {
                    const mStats = matchupData[h.id]?.[enemyId];
                    if (mStats && mStats.games > 0) {
                        const mWr = (mStats.wins / mStats.games) * 100;
                        if (mWr > 50) {
                            strongAgainst.push({
                                id: enemyId,
                                name: getHeroInfo(enemyId).name, // Use helper
                                winRate: mWr
                            });
                            matchupBonus += (mWr - 50);
                        }
                    }
                });

                // Score = (Roles * 100) + MatchupBonus + (PickRate * 10)
                // Need to balance Flex vs Meta Strength
                const pickRateScore = Math.min(h.picks, 50); // Cap raw pick influence
                const score = (rolesPlayed * 50) + matchupBonus + pickRateScore;

                return { ...h, rolesPlayed, strongAgainst, score };
            })
            .filter((h: any) => h.rolesPlayed >= 2 && h.picks > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 10);
    }, [stats, heroMap]);


    // --- LOGIC: Phase 2 Win Conditions ---
    // Heroes picked in Phase 2 (Slots 6-10 / 15-18) that correlate with high win rates AND counter common enemies.
    const phase2Closers = useMemo(() => {
        // 1. Identify Top 5 Most Common Enemy Heroes
        const enemyFrequency: Record<string, number> = {};
        const matchupData = stats.matchupStats || {};
        Object.values(matchupData).forEach((enemies: any) => {
            Object.entries(enemies).forEach(([enemyId, data]: [string, any]) => {
                enemyFrequency[enemyId] = (enemyFrequency[enemyId] || 0) + data.games;
            });
        });
        const topEnemies = Object.entries(enemyFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        // 2. Aggregate Phase 2 Candidate Picks
        const targetSlots = [7, 8, 9, 10];

        const aggregated: Record<string, number> = {};
        let targetHeroPickStats = stats.heroPickOrderStats;
        if (side === 'BLUE' && stats.sideStats?.BLUE?.heroPickOrderStats) {
            targetHeroPickStats = stats.sideStats.BLUE.heroPickOrderStats;
        } else if (side === 'RED' && stats.sideStats?.RED?.heroPickOrderStats) {
            targetHeroPickStats = stats.sideStats.RED.heroPickOrderStats;
        }

        targetSlots.forEach(slot => {
            // @ts-ignore
            const slotData = targetHeroPickStats?.[slot] || {};
            Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                aggregated[heroId] = (aggregated[heroId] || 0) + count;
            });
        });

        // 3. Score Candidates
        return Object.entries(aggregated)
            .map(([heroId, count]) => {
                const heroInfo = getHeroInfo(heroId);
                const hero = stats.heroStats?.[heroId];

                const picks = hero ? hero.picks : count;
                const wins = hero ? hero.wins : 0;
                const winRate = picks > 0 ? (wins / picks) * 100 : 0;

                // Matchup Analysis
                const strongAgainst: Array<{ id: string; name: string; winRate: number }> = [];
                let matchupBonus = 0;

                topEnemies.forEach(enemyId => {
                    const mStats = matchupData[heroId]?.[enemyId];
                    if (mStats && mStats.games > 0) {
                        const mWr = (mStats.wins / mStats.games) * 100;
                        if (mWr > 50) {
                            strongAgainst.push({
                                id: enemyId,
                                name: getHeroInfo(enemyId).name,
                                winRate: mWr
                            });
                            matchupBonus += (mWr - 50);
                        }
                    }
                });

                const score = winRate + (matchupBonus / (topEnemies.length || 1));

                return {
                    id: heroId,
                    name: heroInfo.name,
                    icon: heroInfo.icon,
                    count, // Picked in P2 count
                    totalPicks: picks,
                    winRate,
                    score,
                    strongAgainst
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }, [stats, side, heroMap]);


    // --- LOGIC: Lane Counters (Position vs Position) ---
    // For each role, find top enemy picks and their best counters
    const laneCounters = useMemo(() => {
        const results: any[] = [];
        const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'];

        roles.forEach(role => {
            const roleMatchups = stats.laneMatchups?.[role] || {}; // EnemyHero -> MyHero -> Stats

            // 1. Find Top 3 Enemy Heroes for this Role
            const enemyCounts: Record<string, number> = {};
            Object.keys(roleMatchups).forEach(enemyId => {
                // Sum all games against this enemy in this role
                const totalGamesAgainst = Object.values(roleMatchups[enemyId])
                    .reduce((sum: number, s: any) => sum + s.games, 0);
                enemyCounts[enemyId] = totalGamesAgainst;
            });

            const topEnemies = Object.entries(enemyCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3) // Top 3 Most Frequent Enemies
                .map(([id]) => id);

            // 2. For each top enemy, find our best counters
            const enemyAnalysis: any[] = [];

            topEnemies.forEach(enemyId => {
                const myPerformance = roleMatchups[enemyId] || {}; // MyHero -> Stats
                const enemyInfo = getHeroInfo(enemyId); // Lookup Name/Icon

                const counters = Object.entries(myPerformance)
                    .map(([myId, s]: [string, any]) => {
                        const myInfo = getHeroInfo(myId);
                        return {
                            id: myId,
                            name: myInfo.name,
                            icon: myInfo.icon,
                            games: s.games,
                            wins: s.wins,
                            winRate: (s.wins / s.games) * 100
                        };
                    })
                    .filter(c => c.games >= 1 && c.winRate >= 50) // Minimum confidence
                    .sort((a, b) => b.games - a.games) // Prioritize experience (games played) then WinRate? Or match Phase 2 logic?
                    .sort((a, b) => b.winRate - a.winRate) // Let's prioritize Win Rate first for "Counter" meaning
                    .slice(0, 3);

                if (counters.length > 0) {
                    enemyAnalysis.push({
                        enemy: {
                            id: enemyId,
                            name: enemyInfo.name,
                            icon: enemyInfo.icon,
                            games: enemyCounts[enemyId]
                        },
                        counters
                    });
                }
            });

            // Always push the role block even if empty (UI might want to show empty state per role, or we can filter later)
            // The UI expects { role, matches: [] }
            results.push({
                role,
                matches: enemyAnalysis
            });
        });

        return results;
    }, [stats]);




    return (
        <Card className="glass-card border-none text-slate-200">
            <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Brain className="text-pink-500" />
                        Draft Composition {teamName && <span className="text-slate-500">for {teamName}</span>}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SIDE</label>
                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                {['ALL', 'BLUE', 'RED'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSide?.(s)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${side === s
                                            ? s === 'BLUE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                                : s === 'RED' ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                                                    : 'bg-slate-700 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
                            <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-700">
                                <TabsTrigger value="TIMELINE">Priorities</TabsTrigger>
                                <TabsTrigger value="STRATEGY">Phases</TabsTrigger>
                                <TabsTrigger value="MATCHING">Counters</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">

                {activeTab === 'TIMELINE' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="text-cyan-400 w-5 h-5" />
                            <h3 className="font-bold text-lg">Pick Order Priority (Most frequent roles per slot)</h3>
                        </div>

                        <div className="grid grid-cols-5 gap-4">
                            {roleTimeline.map((slotData) => (
                                <div key={slotData.slot} className="bg-slate-900/50 p-4 rounded-xl border border-white/5 relative group hover:border-pink-500/30 transition-colors">
                                    <div className="absolute -top-3 -left-2 bg-slate-950 text-slate-400 text-xs px-2 py-1 rounded border border-slate-800 font-mono">
                                        PICK #{slotData.slot}
                                    </div>
                                    <div className="mt-2 space-y-3">
                                        {slotData.topRoles.length > 0 ? (
                                            slotData.topRoles.map((r, idx) => (
                                                <div key={r.role} className="flex items-center justify-between">
                                                    <Badge variant="outline" className={`
                                                        ${idx === 0 ? 'bg-pink-500/10 text-pink-200 border-pink-500/30' : 'text-slate-400 border-slate-700'}
                                                    `}>
                                                        {r.role}
                                                    </Badge>
                                                    <span className="text-xs font-mono text-slate-500">{r.pct.toFixed(0)}%</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-slate-600 italic py-2">No data</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-lg text-sm text-slate-400 border border-dashed border-slate-800">
                            <strong>Insight:</strong> Use this to predict what role the opponent (or your team) prioritizes early.
                            For example, if Slot 1 is 80% Jungle, you know they prioritize securing their Jungler first.
                        </div>
                    </div>
                )}

                {activeTab === 'STRATEGY' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

                        {/* PHASE 1: FLEX PICKS */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Shuffle className="text-purple-400 w-5 h-5" />
                                <h3 className="font-bold text-lg text-purple-100">Phase 1: Flex Picks</h3>
                            </div>
                            <p className="text-xs text-slate-400">
                                Heroes played in multiple roles. Drafting these early hides your strategy.
                            </p>

                            <div className="space-y-2">
                                {flexPicks.map((hero: any) => (
                                    <div key={hero.id} className="bg-purple-900/10 p-3 rounded-lg border border-purple-500/20 flex flex-col gap-2">
                                        <div className="flex items-center gap-4">
                                            <img src={hero.icon} className="w-10 h-10 rounded-full border border-purple-500/30" />
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-purple-200">{hero.name}</div>
                                                <div className="flex gap-1 mt-1">
                                                    {Object.keys(hero.roleStats).map(r => (
                                                        <span key={r} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-black text-purple-500/40">{hero.rolesPlayed} Roles</div>
                                            </div>
                                        </div>

                                        {/* Matchup Info */}
                                        {hero.strongAgainst && hero.strongAgainst.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1 pl-[56px]">
                                                <span className="text-[10px] text-slate-500 mr-1 self-center">Strong vs:</span>
                                                {hero.strongAgainst.slice(0, 3).map((enemy: any) => (
                                                    <Badge key={enemy.id} variant="secondary" className="px-1 py-0 h-5 text-[10px] bg-purple-900/20 text-purple-400 border-purple-500/20 hover:bg-purple-900/30">
                                                        {enemy.name} ({enemy.winRate.toFixed(0)}%)
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PHASE 2: CLOSERS */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Swords className="text-orange-400 w-5 h-5" />
                                <h3 className="font-bold text-lg text-orange-100">Phase 2: Win Conditions</h3>
                            </div>
                            <p className="text-xs text-slate-400">
                                Heroes picked late (Phase 2) that correlate with high win rates.
                            </p>

                            <div className="space-y-2">
                                {phase2Closers.map((item: any) => (
                                    <div key={item.id} className="bg-orange-900/10 p-3 rounded-lg border border-orange-500/20 flex flex-col gap-2">
                                        <div className="flex items-center gap-4">
                                            <img src={item.icon} className="w-10 h-10 rounded-md border border-orange-500/30" />
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-orange-200">{item.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    Picked late {item.count} times
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-sm font-bold ${item!.winRate >= 60 ? 'text-green-400' : 'text-slate-300'}`}>
                                                    {item!.winRate.toFixed(1)}% WR
                                                </div>
                                            </div>
                                        </div>

                                        {/* Matchup Info */}
                                        {item!.strongAgainst && item!.strongAgainst.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1 pl-[56px]">
                                                <span className="text-[10px] text-slate-500 mr-1 self-center">Strong vs:</span>
                                                {item!.strongAgainst.slice(0, 3).map((enemy: any) => (
                                                    <Badge key={enemy.id} variant="secondary" className="px-1 py-0 h-5 text-[10px] bg-green-900/20 text-green-400 border-green-500/20 hover:bg-green-900/30">
                                                        {enemy.name} ({enemy.winRate.toFixed(0)}%)
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'MATCHING' && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="text-emerald-400 w-5 h-5" />
                            <h3 className="font-bold text-lg">Lane Counters (Position vs Position)</h3>
                        </div>
                        <p className="text-sm text-slate-400 -mt-4 mb-4">
                            If Opponent picks <strong>[Hero A]</strong>, we should Counter with <strong>[Hero B]</strong> in the same role.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {laneCounters.map((roleBlock: any) => (
                                <div key={roleBlock.role} className="flex flex-col gap-3">
                                    <div className="bg-slate-900/80 p-2 rounded text-center font-bold text-slate-500 text-xs uppercase border border-slate-800">
                                        {roleBlock.role}
                                    </div>

                                    <div className="space-y-3">
                                        {roleBlock.matches.map((match: any, idx: number) => (
                                            <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-lg p-2 flex flex-col gap-2">
                                                {/* Enemy Header */}
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/50">
                                                    <div className="w-8 h-8 rounded bg-red-900/20 border border-red-500/20 flex items-center justify-center relative">
                                                        {match.enemy ? (
                                                            <img src={match.enemy.icon} className="w-full h-full rounded object-cover opacity-80" />
                                                        ) : <div className="w-4 h-4 bg-red-500/20 rounded-full" />}
                                                        <div className="absolute -bottom-1 -right-1 bg-slate-950 text-[8px] px-1 rounded text-slate-500 border border-slate-800">VS</div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-slate-300 truncate">{match.enemy?.name || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-600">Encountered {match.enemy?.games || 0} times</div>
                                                    </div>
                                                </div>

                                                {/* Our Counters */}
                                                <div className="space-y-1">
                                                    {match.counters.length > 0 ? match.counters.map((c: any) => (
                                                        <div key={c.id} className="flex items-center justify-between text-xs bg-emerald-900/10 p-1.5 rounded hover:bg-emerald-900/20 transition-colors cursor-help group">
                                                            <div className="flex items-center gap-2">
                                                                <img src={c.icon} className="w-6 h-6 rounded-full border border-emerald-500/20" />
                                                                <span className="text-emerald-100 font-medium truncate w-[60px]">{c.name}</span>
                                                            </div>
                                                            <span className="font-mono font-bold text-emerald-400 group-hover:text-emerald-300">
                                                                {c.winRate.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    )) : (
                                                        <div className="text-[10px] text-slate-600 text-center py-2 italic">No clear counter</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {roleBlock.matches.length === 0 && (
                                            <div className="text-center py-8 text-xs text-slate-600 italic">No data</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}



            </CardContent>
        </Card>
    );
}
