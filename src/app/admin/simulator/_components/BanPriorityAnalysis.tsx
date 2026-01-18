'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getBanSlotStats } from '../actions'
import Image from 'next/image'
import { Loader2, ShieldBan } from 'lucide-react'

interface BanPriorityAnalysisProps {
    isOpen: boolean;
    onClose: () => void;
    versionId: number;
    teamAName: string;
    teamBName: string;
}

export default function BanPriorityAnalysis({ isOpen, onClose, versionId, teamAName, teamBName }: BanPriorityAnalysisProps) {
    const [stats, setStats] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen && versionId) {
            setIsLoading(true)
            getBanSlotStats(versionId)
                .then(data => {
                    setStats(data)
                    setIsLoading(false)
                })
                .catch(err => {
                    console.error("Failed to fetch ban stats:", err)
                    setIsLoading(false)
                })
        }
    }, [isOpen, versionId])

    const renderSlotCard = (title: string, data: any[], teamName?: string) => {
        const isTeamA = title.includes('A') || title.includes(teamAName);
        // Map "Blue Ban 1" to Team A/B if passed, but here we used generic labels in backend
        // Backend keys: blueBan1, redBan1...
        // We will map these keys to the UI.

        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 flex flex-col gap-2 min-h-[120px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${title.includes('Blue') ? 'text-blue-400' : 'text-red-400'}`}>
                        {title}
                    </span>
                    {teamName && <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{teamName}</span>}
                </div>

                {data && data.length > 0 ? (
                    <div className="space-y-1">
                        {data.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-950/50 p-1 rounded">
                                <div className="relative w-8 h-8 rounded overflow-hidden border border-slate-700 shrink-0">
                                    <Image src={item.hero.icon_url} alt={item.hero.name} fill className="object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-slate-300 truncate">{item.hero.name}</div>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                                        <span className="text-indigo-400 font-bold">{item.percentage}%</span>
                                        <span>({item.count})</span>
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                <div className="w-1 h-8 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="w-full bg-indigo-500" style={{ height: `${item.percentage}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[10px] text-slate-600 italic">
                        No Data
                    </div>
                )}
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl bg-slate-950 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldBan className="w-5 h-5 text-red-500" />
                        Ban Priority by Slot Analysis
                        <span className="text-xs font-normal text-slate-500 ml-2">(Based on Historical Data for this Patch)</span>
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : stats ? (
                    <div className="space-y-6">
                        {/* Phase 1 */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-1">
                                Phase 1 (First Bans)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Order: Blue 1 -> Red 1 -> Blue 2 -> Red 2 */}
                                {/* We assume Team A is Blue for visualization consistency if not swapped, 
                                    but standard draft is Blue/Red. 
                                    Let's Label as 'Team A (Blue)' style or just Blue/Red */}

                                {renderSlotCard(`Blue Ban 1`, stats.phase1?.blueBan1, teamAName)}
                                {renderSlotCard(`Red Ban 1`, stats.phase1?.redBan1, teamBName)}
                                {renderSlotCard(`Blue Ban 2`, stats.phase1?.blueBan2, teamAName)}
                                {renderSlotCard(`Red Ban 2`, stats.phase1?.redBan2, teamBName)}
                            </div>
                        </div>

                        {/* Phase 2 */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-1">
                                Phase 2 (Second Bans)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Order: Red 3 -> Blue 3 -> Red 4 -> Blue 4 */}
                                {renderSlotCard(`Red Ban 3`, stats.phase2?.redBan3, teamBName)}
                                {renderSlotCard(`Blue Ban 3`, stats.phase2?.blueBan3, teamAName)}
                                {renderSlotCard(`Red Ban 4`, stats.phase2?.redBan4, teamBName)}
                                {renderSlotCard(`Blue Ban 4`, stats.phase2?.blueBan4, teamAName)}
                            </div>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
