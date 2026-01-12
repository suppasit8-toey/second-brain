'use client';

import { useState, useEffect } from 'react';
import { getSuggestedMatchups, saveMatchups } from '../actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Save, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface Props {
    versionId: number;
    onMatchupAdded?: () => void;
}

export default function MatchupSuggestions({ versionId, onMatchupAdded }: Props) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const data = await getSuggestedMatchups(versionId);
            const roundedData = data.map((d: any) => ({
                ...d,
                winRate: Math.round(d.winRate / 5) * 5
            }));
            setSuggestions(roundedData.slice(0, 10)); // Top 10 suggestions
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (versionId) loadSuggestions();
    }, [versionId]);

    const handleSave = async (item: any) => {
        setProcessingId(`${item.heroId}-${item.enemyId}`);
        try {
            // Save Bidirectional Matchup
            const res = await saveMatchups(versionId, item.heroId, item.role, [
                { enemyId: item.enemyId, enemyPosition: item.enemyRole, winRate: Math.round(item.winRate) }
            ]);

            if (res.success) {
                // Remove from list (Both this one AND the reverse if it exists)
                setSuggestions(prev => prev.filter(s => {
                    // Remove the saved item
                    if (s === item) return false;
                    // Remove the reverse item (Enemy vs Hero) because saveMatchups saves bidirectional
                    if (s.heroId === item.enemyId && s.enemyId === item.heroId) return false;
                    return true;
                }));
                if (onMatchupAdded) onMatchupAdded();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-cyan-500 animate-pulse">Wait! Scanning neural network...</div>;
    if (suggestions.length === 0) return null;

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-950 border-cyan-900/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <CardHeader className="pb-3 border-b border-cyan-900/30">
                <CardTitle className="flex items-center gap-2 text-cyan-400">
                    <Brain className="w-6 h-6 animate-pulse" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                        CEREBRO AI DISCOVERIES
                    </span>
                    <Badge variant="outline" className="ml-2 border-cyan-800 text-cyan-500 bg-cyan-950/30 text-[10px] tracking-widest">
                        {suggestions.length} NEW INSIGHTS
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {suggestions.map((item, idx) => {
                    const isProcessing = processingId === `${item.heroId}-${item.enemyId}`;

                    const updateRate = (delta: number) => {
                        const newSuggestions = [...suggestions];
                        newSuggestions[idx].winRate = Math.min(100, Math.max(0, newSuggestions[idx].winRate + delta));
                        setSuggestions(newSuggestions);
                    };

                    return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-700/50 transition-all group">

                            {/* Matchup Info */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 relative">
                                    <div className="relative">
                                        <Image src={item.hero?.icon_url} alt={item.hero?.name} width={40} height={40} className="rounded-md border border-slate-700" />
                                    </div>
                                    <div className="text-slate-500 font-black italic text-xs">VS</div>
                                    <Image src={item.enemy?.icon_url} alt={item.enemy?.name} width={40} height={40} className="rounded-md border border-slate-700 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-200">
                                        {item.hero?.name} <span className="text-slate-500 font-normal">vs</span> {item.enemy?.name}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Badge variant="secondary" className="px-1 py-0 h-5 bg-slate-800 text-slate-400">
                                            {item.role}
                                        </Badge>
                                        <span className="text-slate-600 font-bold">VS</span>
                                        <Badge variant="secondary" className="px-1 py-0 h-5 bg-slate-800 text-slate-400">
                                            {item.enemyRole}
                                        </Badge>
                                        <span className="text-slate-600">•</span>
                                        <span>{item.games} Matches</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions with Edit Controls */}
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                                    <button
                                        onClick={() => updateRate(-5)}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-cyan-500 text-xs transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className={`w-10 text-center font-black text-sm ${item.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                        {Math.round(item.winRate)}%
                                    </span>
                                    <button
                                        onClick={() => updateRate(5)}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-cyan-500 text-xs transition-colors"
                                    >
                                        +
                                    </button>
                                </div>

                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20"
                                    onClick={() => handleSave(item)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    );
}
