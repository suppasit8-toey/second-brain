'use client';

import { useState, useEffect } from 'react';
import { getSuggestedCombos, saveCombo } from '../actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Save, Loader2, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface Props {
    versionId: number;
    onComboAdded?: () => void;
}

export default function ComboSuggestions({ versionId, onComboAdded }: Props) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const data = await getSuggestedCombos(versionId);
            // Ensure winRate (Synergy) is rounded to 5% steps initially
            const formatted = data.map((d: any) => ({
                ...d,
                score: Math.round(d.winRate / 5) * 5
            }));
            setSuggestions(formatted.slice(0, 10)); // Top 10
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
                // Remove from list
                setSuggestions(prev => prev.filter(s => `${s.heroA}-${s.heroB}` !== uniqueKey));
                if (onComboAdded) onComboAdded();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    const updateScore = (index: number, delta: number) => {
        const newSuggestions = [...suggestions];
        const current = newSuggestions[index].score;
        newSuggestions[index].score = Math.min(100, Math.max(0, current + delta));
        setSuggestions(newSuggestions);
    }

    if (loading) return <div className="p-8 text-center text-purple-400 animate-pulse">Analyzing Synergy Matrices...</div>;
    if (suggestions.length === 0) return null;

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-950 border-purple-900/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
            <CardHeader className="pb-3 border-b border-purple-900/30">
                <CardTitle className="flex items-center gap-2 text-purple-400">
                    <Brain className="w-6 h-6 animate-pulse" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                        SYNERGY DISCOVERIES
                    </span>
                    <Badge variant="outline" className="ml-2 border-purple-800 text-purple-500 bg-purple-950/30 text-[10px] tracking-widest">
                        {suggestions.length} PAIRS FOUND
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map((item, idx) => {
                    const uniqueKey = `${item.heroA}-${item.heroB}`;
                    const isProcessing = processingId === uniqueKey;

                    return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-purple-700/50 transition-all group">

                            {/* Combo Info */}
                            <div className="flex items-center gap-3">
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

                                <div className="flex flex-col ml-2">
                                    <span className="text-sm font-bold text-slate-200 leading-tight">
                                        {item.heroAData?.name} <span className="text-slate-500 text-xs">&</span> {item.heroBData?.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {item.games} Matches
                                    </span>
                                </div>
                            </div>

                            {/* Actions with Edit Controls */}
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                                    <button
                                        onClick={() => updateScore(idx, -5)}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className={`w-10 text-center font-black text-sm ${item.score >= 50 ? 'text-green-400' : 'text-slate-400'}`}>
                                        {item.score}%
                                    </span>
                                    <button
                                        onClick={() => updateScore(idx, 5)}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs transition-colors"
                                    >
                                        +
                                    </button>
                                </div>

                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20"
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
