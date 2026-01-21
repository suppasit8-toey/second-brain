import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, Sparkles, Loader2, Target, History, Shield, ChevronDown, ChevronUp, Globe, Swords, Users, Link as LinkIcon, ShieldBan, Settings2 } from 'lucide-react';
import Image from 'next/image';
import { Hero, AnalysisLayerConfig } from '@/utils/types';
import Link from 'next/link';
import { ANALYSIS_LAYER_METADATA } from '../../cerebro/constants';

export interface Suggestion {
    hero: Hero;
    score: number;
    reason?: string;
    type: 'counter' | 'comfort' | 'meta' | 'hybrid' | 'ban';
    phase?: 'PICK' | 'BAN';
}

interface DraftSuggestionPanelProps {
    side: 'BLUE' | 'RED';
    teamName: string;
    isActive: boolean;
    onGenerate: (mode: string) => void;
    suggestions: Suggestion[];
    isLoading: boolean;
    onSelectHero?: (hero: Hero) => void;
    activeLayers: AnalysisLayerConfig[];
    upcomingSlots?: { type: 'BAN' | 'PICK', slotNum: number }[];
}

// Position filter icons - using abbreviated text
const POSITION_ICONS: Record<string, { label: string, color: string }> = {
    'All': { label: 'ALL', color: 'text-slate-400' },
    'Dark Slayer': { label: 'DS', color: 'text-red-400' },
    'Jungle': { label: 'JG', color: 'text-green-400' },
    'Mid': { label: 'MID', color: 'text-purple-400' },
    'Abyssal': { label: 'AB', color: 'text-yellow-400' },
    'Roam': { label: 'SP', color: 'text-cyan-400' }
}

export default function DraftSuggestionPanel({
    side,
    teamName,
    isActive,
    onGenerate,
    suggestions,
    isLoading,
    onSelectHero,
    activeLayers,
    upcomingSlots = []
}: DraftSuggestionPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [positionFilters, setPositionFilters] = useState<Set<string>>(new Set());

    // Toggle position filter
    const togglePositionFilter = (pos: string) => {
        if (pos === 'All') {
            // Clear all filters
            setPositionFilters(new Set());
        } else {
            setPositionFilters(prev => {
                const newSet = new Set(prev);
                if (newSet.has(pos)) {
                    newSet.delete(pos);
                } else {
                    newSet.add(pos);
                }
                return newSet;
            });
        }
    };

    // Auto-generate when active phase starts
    // For BAN phase, suggestions are set by DraftInterface from Strategic Bans
    // For PICK phase, auto-generate hybrid suggestions
    useEffect(() => {
        if (isActive && suggestions.length === 0 && !isLoading) {
            const isBanPhase = upcomingSlots[0]?.type === 'BAN';
            // Only auto-generate for PICK phase, BAN phase is handled by DraftInterface
            if (!isBanPhase) {
                onGenerate('hybrid');
            }
        }
    }, [isActive, suggestions.length, isLoading, onGenerate, upcomingSlots]);

    const borderColor = side === 'BLUE' ? 'border-blue-500/30' : 'border-red-500/30';
    const bgColor = side === 'BLUE' ? 'bg-blue-950/20' : 'bg-red-950/20';

    // Filter suggestions by position (multiple selection)
    const filteredSuggestions = positionFilters.size === 0
        ? suggestions
        : suggestions.filter(s => {
            const heroPositions = s.hero.main_position || [];
            // Check if hero matches ANY of the selected filters
            return Array.from(positionFilters).some(filter => {
                const normalizedFilter = filter === 'Abyssal' ? ['Abyssal', 'Abyssal Dragon'] : [filter];
                return heroPositions.some(pos =>
                    normalizedFilter.some(f => pos.toLowerCase().includes(f.toLowerCase()))
                );
            });
        });

    return (
        <Card className={`border ${borderColor} bg-slate-950/90 backdrop-blur-md transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-auto' : ''}`}>
            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <Brain className={`w-4 h-4 shrink-0 ${isActive ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 truncate">
                            {teamName} Advisor
                        </CardTitle>
                        {/* Current Slot Badge - Combined with Phase */}
                        {upcomingSlots.length > 0 && (
                            <Badge className={`text-[9px] px-2 py-0.5 font-bold mt-0.5 ${upcomingSlots[0].type === 'BAN'
                                ? 'bg-red-600 text-white'
                                : 'bg-green-600 text-white'}`}>
                                {upcomingSlots[0].type === 'BAN' ? 'BAN' : 'PICK'} #{upcomingSlots[0].slotNum}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isActive && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] animate-pulse">
                            ACTIVE
                        </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white p-0">
                        {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </CardHeader>
            {!isCollapsed && (
                <CardContent className="p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Position Filter Icons */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {Object.entries(POSITION_ICONS).map(([pos, { label, color }]) => {
                            const isSelected = pos === 'All' ? positionFilters.size === 0 : positionFilters.has(pos);
                            return (
                                <button
                                    key={pos}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePositionFilter(pos);
                                    }}
                                    className={`px-2 py-1 rounded border transition-colors cursor-pointer text-[10px] font-bold ${isSelected
                                        ? `bg-white/10 border-white/30 ${color}`
                                        : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                                        }`}
                                    title={pos}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Results Grid */}
                    <div className="grid grid-cols-4 gap-2 min-h-[60px]">
                        {isLoading ? (
                            <div className="col-span-4 flex items-center justify-center py-6">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                <span className="ml-2 text-xs text-slate-400">Loading recommendations...</span>
                            </div>
                        ) : filteredSuggestions.length > 0 ? (
                            filteredSuggestions.map((s) => (
                                <TooltipProvider key={s.hero.id} delayDuration={300}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectHero && onSelectHero(s.hero);
                                                }}
                                                className="relative group flex flex-col items-center gap-1 p-1 rounded hover:bg-white/5 transition-colors"
                                            >
                                                <div className="relative w-10 h-10 rounded overflow-hidden border border-slate-700 group-hover:border-indigo-400 transition-colors">
                                                    <Image src={s.hero.icon_url} alt={s.hero.name} fill className="object-cover" />
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-300 text-center w-full truncate px-0.5">
                                                    {s.hero.name}
                                                </div>
                                                {/* Score Badge */}
                                                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 z-10">
                                                    <Badge className="px-1 py-0 h-4 text-[8px] min-w-4 justify-center bg-indigo-600 text-white border-0">
                                                        {s.score.toFixed(0)}
                                                    </Badge>
                                                </div>
                                                {/* Source Indicator: Strategic Picks (P) or Strategic Bans (B) */}
                                                <div className={`absolute bottom-6 left-0 text-[7px] font-bold px-1 rounded-tr ${s.phase === 'BAN' || s.type === 'ban'
                                                    ? 'bg-red-600/90 text-white'
                                                    : 'bg-green-600/90 text-white'
                                                    }`}>
                                                    {s.phase === 'BAN' || s.type === 'ban' ? 'B' : 'P'}
                                                </div>
                                                {/* Type indicators */}
                                                {s.type === 'counter' && <div className="absolute top-0 left-0 text-[8px] bg-red-900/80 text-red-200 px-1 rounded-br">VS</div>}
                                                {s.type === 'comfort' && <div className="absolute top-0 left-0 text-[8px] bg-blue-900/80 text-blue-200 px-1 rounded-br">★</div>}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 border-slate-700 text-xs text-slate-300">
                                            <div className="font-bold text-slate-200 mb-1">{s.hero.name} ({s.score.toFixed(0)} PTS)</div>
                                            <div>{s.reason || 'Recommended'}</div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))
                        ) : suggestions.length > 0 && filteredSuggestions.length === 0 ? (
                            <div className="col-span-4 text-center text-xs text-slate-500 py-4 italic">
                                No heroes found for selected positions
                            </div>
                        ) : (
                            <div className="col-span-4 text-center text-xs text-slate-500 py-4 italic">
                                Ready to assist. Select mode and generate.
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
