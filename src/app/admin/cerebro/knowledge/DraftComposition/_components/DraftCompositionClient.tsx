'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Brain } from 'lucide-react';
import DraftCompositionBoard from '../../../_components/DraftCompositionBoard';
import { getCerebroStats } from '../../../actions';

interface DraftCompositionClientProps {
    versions: any[];
    teams: any[];
    tournaments: any[];
}

export default function DraftCompositionClient({ versions, teams, tournaments }: DraftCompositionClientProps) {
    const [versionId, setVersionId] = useState<string>(versions[0]?.id?.toString() || '');
    const [tournamentId, setTournamentId] = useState<string>('ALL');
    const [side, setSide] = useState<string>('ALL'); // 'ALL', 'BLUE', 'RED'

    // Filter teams based on tournament
    const filteredTeams = tournamentId === 'ALL'
        ? teams
        : teams.filter(t => t.tournament_id === tournamentId);

    // Default to first team of filtered list if available, or keep current if valid, else reset
    const [teamName, setTeamName] = useState<string>('');

    // Update team selection when filter changes
    useEffect(() => {
        if (filteredTeams.length > 0) {
            const isCurrentTeamValid = filteredTeams.some(t => t.name === teamName);
            if (!isCurrentTeamValid) {
                setTeamName(filteredTeams[0].name);
            }
        } else {
            setTeamName('');
        }
    }, [tournamentId, filteredTeams, teamName]);

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [heroMap, setHeroMap] = useState<any>(null);

    useEffect(() => {
        if (!versionId || !teamName) return;

        const loadStats = async () => {
            setLoading(true);
            try {
                // FIXED: Use FULL_SIMULATOR as requested
                const data = await getCerebroStats(Number(versionId), 'FULL_SIMULATOR', tournamentId, teamName);
                if (data) {
                    setStats(data.stats);
                    setHeroMap(data.heroMap);
                }
            } catch (error) {
                console.error("Failed to load stats", error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [versionId, teamName, tournamentId]); // side is client-side filter for now, or re-fetch?
    // Side filtering is done in the Board component using stats.sideStats, so no need to re-fetch.
    // However, if we want to filter the *Top Level* stats, we might need to handle it. 
    // But getCerebroStats returns ALL info including sideStats. So we just pass 'side' to the board.

    return (
        <div className="space-y-8">
            {/* Controls */}
            <div className="glass-card p-6 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 items-end md:items-center justify-between relative z-10">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-wrap">

                    {/* Version Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patch Version</label>
                        <Select value={versionId} onValueChange={setVersionId}>
                            <SelectTrigger className="w-[200px] bg-slate-900 border-slate-700 text-white h-10">
                                <SelectValue>
                                    {versions.find(v => v.id.toString() === versionId)?.name || "Select Version"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {versions.map(v => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tournament Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tournament</label>
                        <Select value={tournamentId} onValueChange={setTournamentId}>
                            <SelectTrigger className="w-[250px] bg-slate-900 border-slate-700 text-white h-10">
                                <div className="truncate">
                                    {tournamentId === 'ALL' ? 'All Tournaments' : tournaments.find(t => t.id === tournamentId)?.name || 'Select Tournament'}
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Tournaments</SelectItem>
                                {tournaments.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Team Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Team</label>
                        <Select value={teamName} onValueChange={setTeamName}>
                            <SelectTrigger className="w-[250px] bg-slate-900 border-slate-700 text-white h-10">
                                <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-slate-400" />
                                    <SelectValue placeholder="Select Team" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {filteredTeams.map((t: any) => (
                                    <SelectItem key={t.id} value={t.name}>
                                        <div className="flex items-center gap-2">
                                            {t.logo_url && <img src={t.logo_url} className="w-5 h-5 rounded-full object-cover" />}
                                            {t.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Analyzing Composition...</span>
                    </div>
                )}
            </div>

            {/* Analysis Board */}
            {stats && teamName ? (
                <DraftCompositionBoard stats={stats} heroMap={heroMap} teamName={teamName} side={side} setSide={setSide} />
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <Brain className="w-12 h-12 mb-4 opacity-20" />
                    <p>Select a team to view their composition strategy</p>
                </div>
            )}
        </div>
    );
}
