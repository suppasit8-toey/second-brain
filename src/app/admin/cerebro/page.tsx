'use server';

import React from 'react';
import { Brain, Sparkles, BookOpen, Microscope, BarChart2, Lightbulb } from 'lucide-react';
import CerebroDashboard from './_components/CerebroDashboard';
import { getVersions, getCerebroStats } from './actions';

export default async function CerebroPage() {
    const versions = await getVersions();
    const defaultVersion = versions.find((v: any) => v.is_active) || versions[0];

    return (
        <div className="space-y-8 p-8 animate-fade-in text-white min-h-screen">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 flex items-center gap-4 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                    <Brain className="text-cyan-400 w-10 h-10" />
                    CEREBRO AI
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl font-light">
                    Central intelligence hub for data gathering, draft analysis, and strategic learning.
                </p>
            </div>

            {/* Main Grid for Navigation / Context */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Knowledge Base Card */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent hover:border-cyan-500/30 transition-all duration-300 group cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                            <BookOpen size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-slate-100 group-hover:text-cyan-100">Knowledge Base</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Teach Cerebro about hero synergies, counter-picks, and game mechanics.
                        </p>
                    </div>
                </div>

                {/* Analytics Card (Highlight) */}
                <div className="glass-card p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/10 to-transparent relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/50 text-xs font-bold text-purple-300 animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                            LIVE
                        </div>
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                            <BarChart2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-slate-100">Deep Analytics</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Comprehensive breakdown of meta trends, win rates, and team performance.
                        </p>
                    </div>
                </div>

                {/* Insights Card */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                            <Lightbulb size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-slate-100 group-hover:text-emerald-100">Strategic Insights</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            AI-driven suggestions for draft adaptation strategy.
                        </p>
                    </div>
                </div>
            </div>

            {/* DASHBOARD SECTION */}
            <div className="mt-8">
                <CerebroDashboard
                    initialVersions={versions}
                    defaultVersionId={defaultVersion?.id}
                    fetchStats={getCerebroStats}
                />
            </div>

            {/* Footer / Status */}
            <div className="p-1 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-blue-500/10 opacity-50">
                <div className="bg-black/80 backdrop-blur-md rounded-[22px] p-4 text-center border border-white/5 flex items-center justify-center gap-3">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <p className="text-xs text-slate-500">
                        Cerebro v1.0.0 Online • Learning from {versions.length} Data Versions
                    </p>
                </div>
            </div>
        </div>
    );
}
