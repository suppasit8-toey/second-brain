'use client';

import { useState, useEffect } from 'react';
import { getSuggestedMatchups, saveMatchups } from '../actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Save, CheckCircle2, Loader2, Sparkles, X, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface Props {
    versionId: number;
    onMatchupAdded?: () => void;
    onCountChange?: (count: number) => void;
}

export default function MatchupSuggestions({ versionId, onMatchupAdded, onCountChange }: Props) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [pool, setPool] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const data = await getSuggestedMatchups(versionId);
            const roundedData = data.map((d: any) => ({
                ...d,
                winRate: Math.round(d.winRate / 5) * 5
            }));

            // Initial split: Top 10 visible, rest in pool
            setSuggestions(roundedData.slice(0, 10));
            setPool(roundedData.slice(10));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (versionId) loadSuggestions();
    }, [versionId]);

    useEffect(() => {
        if (onCountChange) {
            onCountChange(suggestions.length + pool.length);
        }
    }, [suggestions, pool, onCountChange]);

    // Helper to remove an item and optionally fill from pool
    const removeAndReplace = (itemToRemove: any) => {
        setSuggestions(prev => {
            const temp = prev.filter(s => {
                // Determine if this is the item to remove (or its reverse pair)
                const isTarget = s === itemToRemove;
                const isReverse = s.heroId === itemToRemove.enemyId && s.enemyId === itemToRemove.heroId;
                return !isTarget && !isReverse;
            });

            // If we have items in the pool, pop one and add to the list
            if (pool.length > 0) {
                const [nextItem, ...remainingPool] = pool;
                setPool(remainingPool);
                return [...temp, nextItem];
            }

            return temp;
        });
    };

    const handleUpdateWinRate = (item: any, adjustment: number) => {
        setSuggestions(prev => prev.map(s => {
            if (s === item) {
                const newRate = Math.min(100, Math.max(0, s.winRate + adjustment));
                return { ...s, winRate: newRate };
            }
            return s;
        }));
    };

    const handleSave = async (item: any) => {
        setProcessingId(`${item.heroId}-${item.enemyId}`);
        try {
            // Save Bidirectional Matchup
            const res = await saveMatchups(versionId, item.heroId, item.role, [
                { enemyId: item.enemyId, enemyPosition: item.enemyRole, winRate: Math.round(item.winRate) }
            ]);

            if (res.success) {
                removeAndReplace(item);
                if (onMatchupAdded) onMatchupAdded();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = (item: any) => {
        removeAndReplace(item);
    };

    if (loading) return <div className="p-8 text-center text-cyan-500 animate-pulse">Wait! Scanning neural network...</div>;
    if (suggestions.length === 0) return null;

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-950 border-cyan-900/50 shadow-[0_0_20px_rgba(34,211,238,0.1)] overflow-hidden transition-all">
            <CardHeader className="pb-3 border-b border-cyan-900/30">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-cyan-400">
                        <Brain className="w-6 h-6 animate-pulse" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                            CEREBRO AI DISCOVERIES
                        </span>
                        <Badge variant="outline" className="ml-2 border-cyan-800 text-cyan-500 bg-cyan-950/30 text-[10px] tracking-widest hidden sm:inline-flex">
                            {Math.max(suggestions.length + pool.length, 0)} NEW INSIGHTS
                        </Badge>
                    </CardTitle>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </Button>
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    {suggestions.map((item, idx) => {
                        const isProcessing = processingId === `${item.heroId}-${item.enemyId}`;

                        return (
                            <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-700/50 transition-all group gap-4 sm:gap-0">

                                {/* Matchup Info */}
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="flex items-center gap-2 relative shrink-0">
                                        <div className="relative">
                                            <Image src={item.hero?.icon_url} alt={item.hero?.name} width={40} height={40} className="rounded-md border border-slate-700" />
                                        </div>
                                        <div className="text-slate-500 font-black italic text-xs">VS</div>
                                        <Image src={item.enemy?.icon_url} alt={item.enemy?.name} width={40} height={40} className="rounded-md border border-slate-700 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="text-sm font-bold text-slate-200 truncate max-w-[150px] sm:max-w-none">
                                            {item.hero?.name} <span className="text-slate-500 font-normal">vs</span> {item.enemy?.name}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                            <Badge variant="secondary" className="px-1 py-0 h-4 bg-slate-800 text-slate-400 text-[10px]">
                                                {item.role}
                                            </Badge>
                                            <span className="text-slate-600 font-bold hidden sm:inline">VS</span>
                                            <Badge variant="secondary" className="px-1 py-0 h-4 bg-slate-800 text-slate-400 text-[10px]">
                                                {item.enemyRole}
                                            </Badge>
                                            <span className="text-slate-600 hidden sm:inline">•</span>
                                            <span className="text-[10px] whitespace-nowrap">{item.games} Matches</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions: Score Display, Reject, Save */}
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                                    {/* Score Control */}
                                    <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 h-8">
                                        <button
                                            onClick={() => handleUpdateWinRate(item, -5)}
                                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-l-lg transition-colors"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className={`font-black text-sm w-10 text-center ${item.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {Math.round(item.winRate)}%
                                        </span>
                                        <button
                                            onClick={() => handleUpdateWinRate(item, 5)}
                                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-green-400 hover:bg-slate-900 rounded-r-lg transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Reject Button */}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20"
                                            onClick={() => handleReject(item)}
                                            disabled={isProcessing}
                                            title="Reject Suggestion"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>

                                        {/* Save Button */}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 text-xs bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20"
                                            onClick={() => handleSave(item)}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            )}
        </Card>
    );
}
