'use client';

import { useState, useEffect } from 'react';
import { getSuggestedCombos, saveCombo } from '../actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Save, Loader2, Link as LinkIcon, X, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface Props {
    versionId: number;
    onComboAdded?: () => void;
}

export default function ComboSuggestions({ versionId, onComboAdded }: Props) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [pool, setPool] = useState<any[]>([]); // Store remaining suggestions
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const data = await getSuggestedCombos(versionId);
            // Ensure winRate (Synergy) is rounded to 5% steps initially
            const formatted = data.map((d: any) => ({
                ...d,
                score: Math.round(d.winRate / 5) * 5
            }));

            // Initial split: Top 10 visible, rest in pool
            setSuggestions(formatted.slice(0, 10));
            setPool(formatted.slice(10));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (versionId) loadSuggestions();
    }, [versionId]);

    // Helper to remove an item and optionally fill from pool
    const removeAndReplace = (uniqueKey: string) => {
        setSuggestions(prev => {
            const temp = prev.filter(s => `${s.heroA}-${s.heroB}` !== uniqueKey);

            // If we have items in the pool, pop one and add to the list
            if (pool.length > 0) {
                const [nextItem, ...remainingPool] = pool;
                setPool(remainingPool);
                return [...temp, nextItem];
            }

            return temp;
        });
    };

    const handleSave = async (item: any) => {
        const uniqueKey = `${item.heroA}-${item.heroB}`;
        setProcessingId(uniqueKey);
        try {
            const res = await saveCombo({
                hero_a_id: item.heroA,
                hero_a_position: item.posA,
                hero_b_id: item.heroB,
                hero_b_position: item.posB,
                synergy_score: item.score,
                description: "AI Suggestion from Scrim Logs",
                version_id: versionId
            });

            if (res.success) {
                removeAndReplace(uniqueKey);
                if (onComboAdded) onComboAdded();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = (item: any) => {
        const uniqueKey = `${item.heroA}-${item.heroB}`;
        removeAndReplace(uniqueKey);
    };

    if (loading) return <div className="p-8 text-center text-purple-400 animate-pulse">Analyzing Synergy Matrices...</div>;
    if (suggestions.length === 0) return null;

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-950 border-purple-900/50 shadow-[0_0_20px_rgba(168,85,247,0.1)] overflow-hidden transition-all">
            <CardHeader className="pb-3 border-b border-purple-900/30">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-purple-400">
                        <Brain className="w-6 h-6 animate-pulse" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            SYNERGY DISCOVERIES
                        </span>
                        <Badge variant="outline" className="ml-2 border-purple-800 text-purple-500 bg-purple-950/30 text-[10px] tracking-widest">
                            {Math.max(suggestions.length + pool.length, 0)} PAIRS FOUND
                        </Badge>
                    </CardTitle>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </Button>
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    {suggestions.map((item, idx) => {
                        const uniqueKey = `${item.heroA}-${item.heroB}`;
                        const isProcessing = processingId === uniqueKey;

                        return (
                            <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-purple-700/50 transition-all group gap-3 sm:gap-0">

                                {/* Combo Info */}
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {/* Hero A */}
                                    <div className="relative">
                                        <Image src={item.heroAData?.icon_url} alt={item.heroAData?.name} width={36} height={36} className="rounded-full border border-purple-500/50" />
                                        <div className="absolute -bottom-1 -right-1 bg-black/80 text-[8px] text-white px-1 rounded border border-white/10 uppercase">
                                            {item.posA.slice(0, 3)}
                                        </div>
                                    </div>

                                    <LinkIcon size={14} className="text-purple-500/50 rotate-45 shrink-0" />

                                    {/* Hero B */}
                                    <div className="relative">
                                        <Image src={item.heroBData?.icon_url} alt={item.heroBData?.name} width={36} height={36} className="rounded-full border border-pink-500/50" />
                                        <div className="absolute -bottom-1 -right-1 bg-black/80 text-[8px] text-white px-1 rounded border border-white/10 uppercase">
                                            {item.posB.slice(0, 3)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col ml-2 min-w-0">
                                        <span className="text-sm font-bold text-slate-200 leading-tight truncate max-w-[150px] sm:max-w-none">
                                            {item.heroAData?.name} <span className="text-slate-500 text-xs">&</span> {item.heroBData?.name}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {item.games} Matches
                                        </span>
                                    </div>
                                </div>

                                {/* Actions: Score Display, Reject, Save */}
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                                    {/* Score - Read Only */}
                                    <div className="flex items-center justify-center bg-slate-950 rounded-lg px-3 py-1 border border-slate-800 h-8">
                                        <span className={`font-black text-sm ${item.score >= 50 ? 'text-green-400' : 'text-slate-400'}`}>
                                            {item.score}%
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
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
                                            className="h-8 px-3 text-xs bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20"
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
