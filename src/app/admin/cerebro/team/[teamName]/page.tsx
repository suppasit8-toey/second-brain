import React from 'react';
import { ArrowLeft, Brain, Shield } from 'lucide-react';
import Link from 'next/link';
import CerebroDashboard from '../../_components/CerebroDashboard';
import { getVersions } from '../../actions';

export default async function TeamCerebroPage({ params }: { params: Promise<{ teamName: string }> }) {
    const { teamName: rawTeamName } = await params;
    const versions = await getVersions();
    const defaultVersion = versions.find((v: any) => v.is_active) || versions[0];
    const teamName = decodeURIComponent(rawTeamName);

    return (
        <div className="space-y-8 p-8 animate-fade-in text-white min-h-screen">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/admin/cerebro" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors w-fit">
                    <ArrowLeft size={16} />
                    <span>Back to Central Hub</span>
                </Link>

                <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 flex items-center gap-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                    <Shield className="text-orange-400 w-10 h-10" />
                    {teamName} : DEEP DIVE
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl font-light">
                    Targeted analysis of {teamName}'s draft priorities, win conditions, and hero pool.
                </p>
            </div>

            {/* DASHBOARD */}
            <div className="mt-8 border-t border-white/10 pt-8 relative">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                <CerebroDashboard
                    initialVersions={versions}
                    defaultVersionId={defaultVersion?.id}
                    teamName={teamName}
                />
            </div>
        </div>
    );
}
