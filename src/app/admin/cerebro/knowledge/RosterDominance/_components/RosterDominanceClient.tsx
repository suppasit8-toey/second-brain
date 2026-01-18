'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Crown } from 'lucide-react';
import RosterDominanceBoard from './RosterDominanceBoard';
import { getCerebroStats } from '../../../actions';

interface RosterDominanceClientProps {
    versions: any[];
    teams: any[];
    tournaments: any[];
}

export default function RosterDominanceClient({ versions, teams, tournaments }: RosterDominanceClientProps) {
    const [versionId, setVersionId] = useState<string>(versions[0]?.id?.toString() || '');
    const [tournamentId, setTournamentId] = useState<string>('ALL');

    // Filter teams based on tournament
    const filteredTeams = tournamentId === 'ALL'
        ? teams
        : teams.filter(t => t.tournament_id === tournamentId);

    // Default to first team of filtered list if available
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
                // Determine Simulator Mode based on what data we need. 
                // Using 'FULL_SIMULATOR' ensures we get the most comprehensive data including lane matchups.
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
    }, [versionId, teamName, tournamentId]);

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
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Team Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Team</label>
                        <Select value={teamName} onValueChange={setTeamName}>
                            <SelectTrigger className="w-[250px] bg-slate-900 border-slate-700 text-white h-10">
                                <SelectValue placeholder="Select Team" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredTeams.map(t => (
                                    <SelectItem key={t.id} value={t.name}>
                                        <div className="flex items-center gap-2">
                                            {t.logo_url && <img src={t.logo_url} className="w-4 h-4 rounded-full object-cover" />}
                                            {t.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-slate-500 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                    <p className="animate-pulse">Analyzing Roster Dominance...</p>
                </div>
            ) : !stats ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <Crown className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a team to view analysis</p>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <RosterDominanceBoard
                        stats={stats}
                        teamName={teamName}
                        heroMap={heroMap}
                    />
                </div>
            )}
        </div>
    );
}
