import { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Sparkles, Loader2, Target, History, Shield, ChevronDown, ChevronUp, Globe, Swords, Users, Link as LinkIcon, ShieldBan, Settings2, ScanSearch } from 'lucide-react';
import Image from 'next/image';
import { Hero, AnalysisLayerConfig } from '@/utils/types';
import Link from 'next/link';
import { ANALYSIS_LAYER_METADATA } from '../../cerebro/constants';

export interface Suggestion {
    hero: Hero;
    score: number;
    cerebroScore?: number;
    historyScore?: number;
    reason?: string;
    type: 'counter' | 'comfort' | 'meta' | 'hybrid' | 'ban' | 'history';
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
    predictions?: any; // Passed from DraftInterface (calculatedEnemyPredictions)
}

// Position filter icons - using abbreviated text
const POSITION_ICONS: Record<string, { label: string, color: string }> = {
    'All': { label: 'ALL', color: 'text-slate-400' },
    'history': { label: 'HISTORY', color: 'text-orange-400' },
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
    upcomingSlots = [],
    predictions
}: DraftSuggestionPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [positionFilters, setPositionFilters] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState('cerebro');

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
    useEffect(() => {
        if (isActive && suggestions.length === 0 && !isLoading) {
            const isBanPhase = upcomingSlots[0]?.type === 'BAN';
            if (!isBanPhase) {
                onGenerate('hybrid');
            }
        }
    }, [isActive, suggestions.length, isLoading, onGenerate, upcomingSlots]);

    // Use ref for onGenerate to avoid infinite loops when it recreates
    const onGenerateRef = useRef(onGenerate);
    useEffect(() => {
        onGenerateRef.current = onGenerate;
    }, [onGenerate]);


    const borderColor = side === 'BLUE' ? 'border-blue-500/30' : 'border-red-500/30';

    // Keywords for filtering
    const HISTORY_KEYWORDS = ['team ban', 'team pool', 'comfort', 'protect', 'deny', 'repair', 'scrim', 'pattern', 'opening ban', 'mvp'];

    // Split Suggestions Logic (UPDATED: CEREBRO AI now allows all suggestions)
    const { cerebroSuggestions, historySuggestions, analysisSuggestions } = useMemo(() => {
        // CEREBRO AI Tab: Use cerebroScore and sort by it
        // If cerebroScore is missing, fallback to score if it's NOT a pure history item
        const cerebro: Suggestion[] = suggestions
            .filter(s => s.cerebroScore !== undefined || (s.type !== 'history' && !s.reason?.includes('Team Comfort')))
            .map(s => ({ ...s, score: s.cerebroScore ?? s.score })) // Map score for display
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);

        // HISTORY Tab: Use historyScore
        const history: Suggestion[] = [];
        suggestions.forEach(s => {
            const reasonLower = s.reason?.toLowerCase() || '';
            const isHistory = s.type === 'history' || HISTORY_KEYWORDS.some(k => reasonLower.includes(k)) || s.historyScore !== undefined;
            if (isHistory && (s.historyScore !== undefined || s.type === 'history')) {
                history.push({
                    ...s,
                    score: s.historyScore ?? s.score // Map score for display
                });
            }
        });
        // Sort history by score
        history.sort((a, b) => b.score - a.score);


        // ANALYSIS Tab: Overlap logic
        const historyHeroIds = new Set(history.map(h => h.hero.id));
        const cerebroHeroIds = new Set(cerebro.map(c => c.hero.id));

        // Find heroes present in both concepts
        const intersectionIds = new Set([...historyHeroIds].filter(x => cerebroHeroIds.has(x)));

        // Get the best suggestion object for these intersection heroes
        const analysis = suggestions.filter(s => intersectionIds.has(s.hero.id));

        // Deduplicate analysis list by Hero ID, keeping highest score
        const uniqueAnalysisMap = new Map<string, Suggestion>();
        analysis.forEach(s => {
            const existing = uniqueAnalysisMap.get(s.hero.id);
            // Use combined score for evaluation
            const currentCombined = (s.cerebroScore || 0) + (s.historyScore || 0);
            const existingCombined = (existing?.cerebroScore || 0) + (existing?.historyScore || 0);

            if (!existing || currentCombined > existingCombined) {
                uniqueAnalysisMap.set(s.hero.id, s);
            }
        });

        const uniqueAnalysis = Array.from(uniqueAnalysisMap.values())
            .sort((a, b) => {
                const scoreA = (a.cerebroScore || 0) + (a.historyScore || 0);
                const scoreB = (b.cerebroScore || 0) + (b.historyScore || 0);
                return scoreB - scoreA;
            })
            .slice(0, 3); // Max 3

        return {
            cerebroSuggestions: cerebro, // Now contains top 20, renderGrid filters then slices to 8 visible
            historySuggestions: history.slice(0, 20), // Max 20 for filtering
            analysisSuggestions: uniqueAnalysis
        };
    }, [suggestions]);

    // Prediction Rendering Logic
    const predictionList = useMemo(() => {
        if (!predictions) return [];
        // Determine Opponent Side based on panel side
        // If Panel is BLUE, we show RED predictions (what the enemy will do)
        const targetSide = side === 'BLUE' ? 'red' : 'blue'; // Lowercase for object key
        const data = predictions[targetSide];
        if (!data || !data.predictions) return [];
        return data.predictions.map((p: any) => ({
            hero: p.hero,
            score: Math.round((p.wins / p.picks) * 100), // Win Rate as score
            picks: p.picks,
            wins: p.wins,
            role: p.role,
            reason: `${p.picks} games (${Math.round((p.wins / p.picks) * 100)}% WR)`,
            type: 'history', // Treat as history-based suggestion
            phase: 'PICK'
        }));
    }, [predictions, side]);


    const renderGrid = (items: Suggestion[], emptyMsg: string) => {
        // Apply position filters if any (excluding 'history' which is now a tab concept mostly)
        const activePosFilters = Array.from(positionFilters).filter(f => f !== 'history');

        const filteredItems = items.filter(s => {
            if (activePosFilters.length === 0) return true;
            const heroPositions = s.hero.main_position || [];
            return activePosFilters.some(filter => {
                const normalizedFilter = filter === 'Abyssal' ? ['Abyssal', 'Abyssal Dragon'] : [filter];
                return heroPositions.some(pos =>
                    normalizedFilter.some(f => pos.toLowerCase().includes(f.toLowerCase()))
                );
            });
        });

        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-6 col-span-4">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    <span className="ml-2 text-xs text-slate-400">Loading...</span>
                </div>
            )
        }

        if (filteredItems.length === 0) {
            return (
                <div className="col-span-4 text-center text-xs text-slate-500 py-4 italic">
                    {emptyMsg}
                </div>
            )
        }

        // Limit to Top 8 for CEREBRO AI
        const topItems = filteredItems.slice(0, 8);

        return (
            <div className="grid grid-cols-4 gap-2">
                {topItems.map((s) => (
                    <TooltipProvider key={s.hero.id} delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectHero && onSelectHero(s.hero);
                                    }}
                                    className="relative group flex flex-col items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-200 shadow-sm"
                                >
                                    {/* Image Container with embedded indicators */}
                                    <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-700 group-hover:border-indigo-400 transition-colors shadow-inner">
                                        <Image src={s.hero.icon_url} alt={s.hero.name} fill className="object-cover" />

                                        {/* Source Indicator: Strategic Picks (P) or Strategic Bans (B) - Bottom Left of Image */}
                                        <div className={`absolute bottom-0 left-0 p-0.5 rounded-tr-md shadow-sm ${s.phase === 'BAN' || s.type === 'ban'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-emerald-600 text-white'
                                            }`}>
                                            {s.phase === 'BAN' || s.type === 'ban' ? <ShieldBan size={10} strokeWidth={3} /> : <Swords size={10} strokeWidth={3} />}
                                        </div>

                                        {/* Type indicators - Top Left of Image */}
                                        {s.type === 'counter' && <div className="absolute top-0 left-0 text-[7px] bg-red-500/90 text-white px-1 py-px rounded-br-md font-bold leading-none">VS</div>}
                                        {s.type === 'comfort' && <div className="absolute top-0 left-0 text-[7px] bg-blue-500/90 text-white px-1 py-px rounded-br-md font-bold leading-none">★</div>}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-200 text-center w-full truncate px-0.5 leading-tight">
                                        {s.hero.name}
                                    </div>

                                    {/* Score Badge - Top Right floating over Card */}
                                    <div className="absolute -top-1.5 -right-1.5 z-10">
                                        <div className="bg-slate-950 text-indigo-400 border border-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md flex items-center justify-center min-w-[20px]">
                                            {/* DISPLAY SCORE - Already mapped in useMemo */}
                                            {s.score.toFixed(0)}
                                        </div>
                                    </div>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 border-slate-700 text-xs text-slate-300">
                                <div className="font-bold text-slate-200 mb-1">{s.hero.name} ({s.score.toFixed(0)} PTS)</div>
                                <div>{s.reason || 'Recommended'}</div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>
        )
    }

    // Detailed Card for Analysis Tab
    const renderAnalysisList = (items: Suggestion[]) => {
        // Apply position filters
        const activePosFilters = Array.from(positionFilters).filter(f => f !== 'history');

        const filterItemsByPosition = (list: Suggestion[]) => {
            return list.filter(s => {
                if (activePosFilters.length === 0) return true;
                const heroPositions = s.hero.main_position || [];
                return activePosFilters.some(filter => {
                    const normalizedFilter = filter === 'Abyssal' ? ['Abyssal', 'Abyssal Dragon'] : [filter];
                    return heroPositions.some(pos =>
                        normalizedFilter.some(f => pos.toLowerCase().includes(f.toLowerCase()))
                    );
                });
            });
        };

        const filteredAnalysis = filterItemsByPosition(items);
        let displayItems = filteredAnalysis;
        let isFallback = false;

        // Fallback Logic: If no overlap found, use History
        // [USER REQUEST] Show History Fallback instead of empty message
        if (filteredAnalysis.length === 0 && !isLoading) {
            const filteredHistory = filterItemsByPosition(historySuggestions);
            if (filteredHistory.length > 0) {
                displayItems = filteredHistory.slice(0, 10); // Limit fallback to top 10
                isFallback = true;
            }
        }

        if (isLoading) return <div className="text-center text-xs text-slate-500 py-4"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Analyzing...</div>;

        if (displayItems.length === 0) {
            return <div className="text-center text-xs text-slate-500 py-4 italic">No high-confidence overlap found.</div>;
        }

        return (
            <div className="space-y-2">
                {isFallback && (
                    <div className="bg-orange-950/20 border border-orange-500/20 rounded p-2 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] text-orange-200">No strict overlap found. Showing <strong>History / Comfort</strong> picks.</span>
                    </div>
                )}

                {displayItems.map(s => (
                    <div
                        key={s.hero.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${isFallback
                                ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/60'
                                : 'bg-indigo-950/30 border-indigo-500/20 hover:bg-indigo-900/40'
                            }`}
                        onClick={() => onSelectHero && onSelectHero(s.hero)}
                    >
                        <div className={`relative w-12 h-12 rounded overflow-hidden border shrink-0 ${isFallback ? 'border-slate-600' : 'border-indigo-400/50'}`}>
                            <Image src={s.hero.icon_url} alt={s.hero.name} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className={`font-bold text-xs ${isFallback ? 'text-slate-300' : 'text-indigo-100'}`}>{s.hero.name}</span>
                                <div className="flex gap-1">
                                    {/* Combined Badge or breakdown */}
                                    <Badge className={`h-4 text-[9px] px-1 ${isFallback ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/80 hover:bg-indigo-500'}`}>
                                        AI: {s.cerebroScore?.toFixed(0) || '-'}
                                    </Badge>
                                    <Badge className={`h-4 text-[9px] px-1 ${isFallback ? 'bg-orange-600/80 text-white' : 'bg-orange-500/80 hover:bg-orange-500'}`}>
                                        H: {s.historyScore?.toFixed(0) || s.score?.toFixed(0) || '-'}
                                    </Badge>
                                </div>
                            </div>
                            <div className={`text-[9px] leading-tight ${isFallback ? 'text-slate-500' : 'text-indigo-300'}`}>
                                {isFallback ? (s.reason || 'History Recommendation') : 'Consensus Analysis'}
                            </div>
                            <div className="flex gap-1 mt-1">
                                {s.phase === 'BAN' || s.type === 'ban'
                                    ? <Badge variant="outline" className="text-[8px] h-3 px-1 border-red-500/50 text-red-400">BAN</Badge>
                                    : <Badge variant="outline" className="text-[8px] h-3 px-1 border-green-500/50 text-green-400">PICK</Badge>
                                }
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // Prediction List - Show ONLY the next predicted enemy pick
    const renderPredictionList = (items: any[]) => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    <span className="ml-2 text-xs text-slate-400">Analyzing...</span>
                </div>
            )
        }

        if (!items || items.length === 0) {
            return (
                <div className="text-center text-xs text-slate-500 py-4 italic">
                    No prediction data available.
                </div>
            )
        }

        // Get ONLY the first prediction (next enemy pick)
        const nextPick = items[0]

        // Determine opponent's next pick order
        const targetSide = side === 'BLUE' ? 'red' : 'blue'
        const nextPhases = predictions?.[targetSide]?.nextPhases || []
        const nextPickOrder = nextPhases.length > 0 ? nextPhases[0] : 'NEXT PICK'

        return (
            <div className="flex flex-col items-center gap-3 py-2">
                {/* Pick Order Badge */}
                <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600 text-white text-xs px-3 py-1 font-bold">
                        {nextPickOrder}
                    </Badge>
                    <span className="text-[10px] text-slate-400">Enemy Prediction</span>
                </div>

                {/* Hero Card - Larger single display */}
                <div
                    className="relative group flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-purple-950/50 to-slate-900/80 border-2 border-purple-500/40 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 cursor-pointer"
                    onClick={() => onSelectHero && onSelectHero(nextPick.hero)}
                >
                    {/* Hero Image */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-lg">
                        <Image src={nextPick.hero.icon_url} alt={nextPick.hero.name} fill className="object-cover" />

                        {/* Role Badge */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent py-1 px-2">
                            <span className="text-[9px] font-bold text-purple-300 uppercase">{nextPick.role}</span>
                        </div>
                    </div>

                    {/* Hero Name */}
                    <div className="text-lg font-black text-white text-center">{nextPick.hero.name}</div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-purple-300">
                            <span className="font-bold">{nextPick.picks}</span>
                            <span className="text-slate-400">games</span>
                        </div>
                        <div className="w-px h-3 bg-slate-600" />
                        <div className="flex items-center gap-1 text-green-400">
                            <span className="font-bold">{nextPick.score}%</span>
                            <span className="text-slate-400">WR</span>
                        </div>
                    </div>

                    {/* Score Badge - Top Right */}
                    <div className="absolute -top-2 -right-2 z-10">
                        <div className="bg-purple-600 text-white text-sm font-black px-2.5 py-1 rounded-full shadow-lg border border-purple-400">
                            {nextPick.score}
                        </div>
                    </div>
                </div>

                {/* Reason */}
                <div className="text-[10px] text-slate-400 text-center max-w-[200px]">
                    Based on opponent's most played hero for <span className="text-purple-300 font-bold">{nextPick.role}</span> role
                </div>
            </div>
        )
    }





    return (
        <Card className={`border ${borderColor} bg-slate-950/90 backdrop-blur-md transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-auto' : ''}`}>
            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <Brain className={`w-4 h-4 shrink-0 ${isActive ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <div className="min-w-0 flex items-center gap-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 truncate">
                            {teamName} ADVISOR
                        </CardTitle>

                        {upcomingSlots.length > 0 && (
                            <Badge className={`text-[9px] px-2 py-0.5 font-bold whitespace-nowrap ${upcomingSlots[0].type === 'BAN'
                                ? 'bg-red-600 text-white'
                                : 'bg-green-600 text-white'}`}>
                                {upcomingSlots[0].type === 'BAN' ? 'BAN' : 'PICK'} {upcomingSlots[0].slotNum}/{upcomingSlots[0].type === 'BAN' ? 4 : 5}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">

                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white p-0">
                        {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </CardHeader>

            {!isCollapsed && (
                <CardContent className="p-0">
                    <Tabs defaultValue="cerebro" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="px-3 pt-2">
                            <TabsList className="grid w-full grid-cols-4 h-6 bg-slate-900/80 rounded-md p-0.5">
                                <TabsTrigger value="cerebro" className="text-[9px] px-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-sm">CEREBRO AI</TabsTrigger>
                                <TabsTrigger value="history" className="text-[9px] px-1 data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-sm">HISTORY</TabsTrigger>
                                <TabsTrigger value="analysis" className="text-[9px] px-1 data-[state=active]:bg-teal-600 data-[state=active]:text-white rounded-sm">ANALYSIS</TabsTrigger>
                                <TabsTrigger value="prediction" className="text-[9px] px-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-sm">PREDICTION</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Common Position Filters */}
                        <div className="px-3 py-1 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-white/5">
                            {Object.entries(POSITION_ICONS).filter(([k]) => k !== 'history').map(([pos, { label, color }]) => {
                                const isSelected = pos === 'All' ? positionFilters.size === 0 : positionFilters.has(pos);
                                return (
                                    <button
                                        key={pos}
                                        onClick={() => togglePositionFilter(pos)}
                                        className={`px-2 h-5 rounded border transition-colors cursor-pointer text-[9px] font-bold flex items-center justify-center whitespace-nowrap ${isSelected
                                            ? `bg-white/10 border-white/30 ${color}`
                                            : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-3 bg-slate-950/50">
                            <TabsContent value="cerebro" className="mt-0">
                                {renderGrid(cerebroSuggestions, "No AI suggestions available.")}
                            </TabsContent>
                            <TabsContent value="history" className="mt-0">
                                {renderGrid(historySuggestions, "No history data found.")}
                            </TabsContent>
                            <TabsContent value="analysis" className="mt-0">
                                {renderAnalysisList(analysisSuggestions)}
                            </TabsContent>
                            <TabsContent value="prediction" className="mt-0">
                                {renderPredictionList(predictionList)}
                            </TabsContent>
                        </div>
                    </Tabs>
                </CardContent>
            )}
        </Card>
    );
}
