'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface Matchup {
    position: string;       // My playing position
    win_rate: number;
    enemy_position: string; // Enemy's playing position
    enemy_hero: {
        name: string;
        icon_url: string;
    };
}

// 1. Add Prop Interface
interface HeroMatchupAnalysisProps {
    matchups: Matchup[];
    heroPositions: string[]; // <--- New Prop
}

export default function HeroMatchupAnalysis({ matchups, heroPositions }: HeroMatchupAnalysisProps) {
    const [filter, setFilter] = useState('All');
    const [enemyFilter, setEnemyFilter] = useState('All');

    // 2. Dynamic Filter Options
    // If heroPositions has data, use it. Otherwise, fallback to all.
    const definedPositions = (heroPositions && heroPositions.length > 0)
        ? heroPositions
        : ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'];

    const filterOptions = ['All', ...definedPositions];

    // 1. FILTER LOGIC: Check 'm.position' (My Position) AND 'm.enemy_position' (Enemy Position)
    const filteredData = matchups.filter(m => {
        const matchMyPos = filter === 'All' ? true : m.position === filter;
        const matchEnemyPos = enemyFilter === 'All' ? true : m.enemy_position === enemyFilter;
        return matchMyPos && matchEnemyPos;
    });

    const strong = filteredData.filter(m => m.win_rate >= 50).sort((a, b) => b.win_rate - a.win_rate);
    const weak = filteredData.filter(m => m.win_rate < 50).sort((a, b) => a.win_rate - b.win_rate);

    return (
        <div className="mt-8 space-y-6">

            {/* Filter Section 1: My Position */}
            <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                    When playing as:
                </span>
                <div className="flex flex-wrap gap-2">
                    {filterOptions.map(pos => (
                        <button
                            key={pos}
                            onClick={() => setFilter(pos)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === pos
                                ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Section 2: Enemy Position */}
            <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                    Vs Enemy:
                </span>
                <div className="flex flex-wrap gap-2">
                    {['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(pos => (
                        <button
                            key={pos}
                            onClick={() => setEnemyFilter(pos)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${enemyFilter === pos
                                ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strong Against */}
                <div>
                    <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5" /> Strong Against
                    </h3>
                    <div className="bg-[#1a1b26] p-4 rounded-xl border border-white/10 min-h-[150px] space-y-2">
                        {strong.length > 0 ? strong.map((m, i) => (
                            <MatchupItem key={i} m={m} isWin={true} />
                        )) : <p className="text-gray-500 text-sm italic p-2">No data recorded.</p>}
                    </div>
                </div>

                {/* Weak Against */}
                <div>
                    <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5" /> Weak Against
                    </h3>
                    <div className="bg-[#1a1b26] p-4 rounded-xl border border-white/10 min-h-[150px] space-y-2">
                        {weak.length > 0 ? weak.map((m, i) => (
                            <MatchupItem key={i} m={m} isWin={false} />
                        )) : <p className="text-gray-500 text-sm italic p-2">No data recorded.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 2. Helper Component with Enemy Position Label
function MatchupItem({ m, isWin }: { m: Matchup, isWin: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
            {/* Icon */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                {m.enemy_hero.icon_url && <Image src={m.enemy_hero.icon_url} alt="" fill className="object-cover" />}
            </div>

            <div className="flex-1 min-w-0">
                {/* Name & Rate */}
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white truncate">{m.enemy_hero.name}</span>
                    <span className={`text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                        {m.win_rate}%
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden mb-1">
                    <div
                        className={`h-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${m.win_rate}%` }}
                    />
                </div>

                {/* ENEMY POSITION LABEL */}
                <div className="text-[10px] text-gray-400 font-medium">
                    vs <span className="text-gray-300">{m.enemy_position}</span>
                </div>
            </div>
        </div>
    )
}
