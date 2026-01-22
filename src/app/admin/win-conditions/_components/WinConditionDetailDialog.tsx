'use client'

import Link from "next/link"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface TeamStat {
    name: string;
    matches: number;
    wins: number;
    winRate: number;
}

interface MatchDetail {
    gameId: string;
    matchId: string;
    date: string;
    team: string; // The team that matched the condition
    enemy: string;
    result: 'WIN' | 'LOSS';
    side: 'BLUE' | 'RED';
}

interface AnalysisResult {
    winRate: number;
    totalMatches: number;
    winCount: number;
    lossCount: number;
    teamStats?: TeamStat[];
    matches?: MatchDetail[];
}

interface WinConditionDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    result: AnalysisResult | null;
}

export function WinConditionDetailDialog({ open, onOpenChange, title, result }: WinConditionDetailDialogProps) {
    if (!result) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl bg-[#0B0E14] border-slate-800 text-slate-200">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <span>Analysis Result</span>
                        <span className="text-slate-500 font-normal text-sm">for {title}</span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Detailed breakdown of matches matching this condition. Click on a match to view details.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Win Rate</div>
                        <div className={cn(
                            "text-3xl font-black",
                            result.winRate > 50 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {result.winRate}%
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Matches</div>
                        <div className="text-3xl font-black text-slate-200">
                            {result.totalMatches}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Record</div>
                        <div className="text-3xl font-black text-slate-200">
                            <span className="text-emerald-400">{result.winCount}</span>
                            <span className="text-slate-600 mx-1">-</span>
                            <span className="text-rose-400">{result.lossCount}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
                    {/* Teams Breakdown */}
                    <div className="flex flex-col h-full overflow-hidden bg-slate-900/30 rounded-xl border border-slate-800">
                        <div className="p-3 bg-slate-900/80 border-b border-slate-800 font-bold text-sm text-slate-300">
                            Teams Performance
                        </div>
                        <ScrollArea className="flex-1 p-0">
                            <div className="divide-y divide-slate-800/50">
                                {result.teamStats?.map((stat, idx) => (
                                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                        <div className="font-bold text-sm text-slate-200">{stat.name}</div>
                                        <div className="text-right">
                                            <div className={cn(
                                                "font-black text-sm",
                                                stat.winRate > 50 ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {stat.winRate.toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {stat.wins}W - {stat.matches - stat.wins}L
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!result.teamStats || result.teamStats.length === 0) && (
                                    <div className="p-8 text-center text-slate-500 text-sm">No team stats available</div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Recent Matches */}
                    <div className="flex flex-col h-full overflow-hidden bg-slate-900/30 rounded-xl border border-slate-800">
                        <div className="p-3 bg-slate-900/80 border-b border-slate-800 font-bold text-sm text-slate-300">
                            Match History
                        </div>
                        <ScrollArea className="flex-1 p-0">
                            <div className="divide-y divide-slate-800/50">
                                {result.matches?.map((match, idx) => (
                                    <Link
                                        key={idx}
                                        href={`/admin/simulator/${match.matchId}`}
                                        className="block hover:bg-slate-800/30 transition-colors group relative"
                                    >
                                        <div className="p-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    {new Date(match.date).toLocaleDateString()}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                                    match.result === 'WIN' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                )}>
                                                    {match.result}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="font-bold text-slate-300">{match.team}</div>
                                                <div className="text-slate-600 text-[10px]">vs</div>
                                                <div className="text-slate-400">{match.enemy}</div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                                {(!result.matches || result.matches.length === 0) && (
                                    <div className="p-8 text-center text-slate-500 text-sm">No matches found</div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
