import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

    const getLayerIcon = (id: string) => {
        switch (id) {
            case 'meta': return { icon: Globe, color: 'text-purple-400' }
            case 'counter': return { icon: Swords, color: 'text-red-400' }
            case 'comfort': return { icon: Users, color: 'text-blue-400' }
            case 'synergy': return { icon: LinkIcon, color: 'text-emerald-400' }
            case 'roster': return { icon: Target, color: 'text-cyan-400' }
            case 'ban': return { icon: ShieldBan, color: 'text-orange-400' }
            case 'composition': return { icon: Brain, color: 'text-pink-400' }
            default: return { icon: Brain, color: 'text-slate-400' }
        }
    }

    return (
        <Card className={`border ${borderColor} ${bgColor} backdrop-blur-sm transition-all duration-300 ${isCollapsed ? 'h-auto' : ''}`}>
            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center gap-2">
                    <Brain className={`w-4 h-4 ${isActive ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300">
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
                    {/* Active Protocols Icons + Phase Badge */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {activeLayers.map(layer => {
                            const { icon: Icon, color } = getLayerIcon(layer.id);
                            // Get Path from Metadata if available
                            const metadata = ANALYSIS_LAYER_METADATA[layer.id];
                            const path = metadata?.path;

                            const IconContent = (
                                <div className="p-1.5 rounded bg-slate-900/50 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer" title={metadata?.name || layer.name}>
                                    <Icon className={`w-3 h-3 ${color}`} />
                                </div>
                            )

                            if (path) {
                                return (
                                    <Link key={layer.id} href={path} target="_blank" rel="noopener noreferrer">
                                        {IconContent}
                                    </Link>
                                )
                            }

                            return (
                                <div key={layer.id}>
                                    {IconContent}
                                </div>
                            )
                        })}
                        {activeLayers.length === 0 && <span className="text-[10px] text-slate-500">No active protocols</span>}
                    </div>

                    {/* Results Grid */}
                    <div className="grid grid-cols-4 gap-2 min-h-[60px]">
                        {isLoading ? (
                            <div className="col-span-4 flex items-center justify-center py-6">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                <span className="ml-2 text-xs text-slate-400">Loading recommendations...</span>
                            </div>
                        ) : suggestions.length > 0 ? (
                            suggestions.map((s) => (
                                <button
                                    key={s.hero.id}
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
