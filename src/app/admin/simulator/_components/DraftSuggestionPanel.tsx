'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, Loader2, Target, History, Shield } from 'lucide-react';
import Image from 'next/image';
import { Hero } from '@/utils/types';

export interface Suggestion {
    hero: Hero;
    score: number;
    reason?: string;
    type: 'counter' | 'comfort' | 'meta' | 'hybrid' | 'ban';
}

interface DraftSuggestionPanelProps {
    side: 'BLUE' | 'RED';
    teamName: string;
    isActive: boolean;
    onGenerate: (mode: string) => void;
    suggestions: Suggestion[];
    isLoading: boolean;
    onSelectHero?: (hero: Hero) => void;
}

export default function DraftSuggestionPanel({
    side,
    teamName,
    isActive,
    onGenerate,
    suggestions,
    isLoading,
    onSelectHero
}: DraftSuggestionPanelProps) {
    const [mode, setMode] = useState('hybrid');

    const handleGenerate = () => {
        onGenerate(mode);
    };

    const borderColor = side === 'BLUE' ? 'border-blue-500/30' : 'border-red-500/30';
    const bgColor = side === 'BLUE' ? 'bg-blue-950/20' : 'bg-red-950/20';

    return (
        <Card className={`border ${borderColor} ${bgColor} backdrop-blur-sm`}>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Brain className={`w-4 h-4 ${isActive ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300">
                        {teamName} Advisor
                    </CardTitle>
                </div>
                {isActive && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] animate-pulse">
                        ACTIVE TURN
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {/* Controls */}
                <div className="flex gap-2">
                    <Select value={mode} onValueChange={setMode}>
                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700">
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                            <SelectItem value="hybrid">✨ Hybrid (Smart)</SelectItem>
                            <SelectItem value="analyst">📊 Meta Analysis</SelectItem>
                            <SelectItem value="history">📜 Team History</SelectItem>
                            <SelectItem value="counter">🛡️ Counter Picks</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        size="sm"
                        className={`h-8 text-xs gap-1 ${isLoading ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        onClick={handleGenerate}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {isLoading ? 'Thinking...' : 'Generate'}
                    </Button>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-4 gap-2 min-h-[60px]">
                    {suggestions.length > 0 ? (
                        suggestions.map((s) => (
                            <button
                                key={s.hero.id}
                                onClick={() => onSelectHero && onSelectHero(s.hero)}
                                className="relative group flex flex-col items-center gap-1 p-1 rounded hover:bg-white/5 transition-colors"
                            >
                                <div className="relative w-10 h-10 rounded overflow-hidden border border-slate-700 group-hover:border-indigo-400 transition-colors">
                                    <Image src={s.hero.icon_url} alt={s.hero.name} fill className="object-cover" />
                                </div>
                                <div className="text-[9px] font-bold text-slate-300 text-center w-full truncate px-0.5">
                                    {s.hero.name}
                                </div>
                                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 z-10">
                                    <Badge className="px-1 py-0 h-4 text-[8px] min-w-4 justify-center bg-indigo-600 text-white border-0">
                                        {s.score.toFixed(0)}
                                    </Badge>
                                </div>
                                {s.type === 'counter' && <div className="absolute top-0 left-0 text-[8px] bg-red-900/80 text-red-200 px-1 rounded-br">VS</div>}
                                {s.type === 'comfort' && <div className="absolute top-0 left-0 text-[8px] bg-blue-900/80 text-blue-200 px-1 rounded-br">★</div>}
                            </button>
                        ))
                    ) : (
                        !isLoading && (
                            <div className="col-span-4 text-center text-xs text-slate-500 py-4 italic">
                                Ready to assist. Select mode and generate.
                            </div>
                        )
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
