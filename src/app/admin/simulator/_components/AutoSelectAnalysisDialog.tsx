import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, History, Swords, ShieldAlert, Target, LockOpen } from "lucide-react"
import Image from "next/image" // Assuming Next.js Image component
import { Hero } from "@/utils/types" // Adjust path as needed

interface AutoSelectAnalysisDialogProps {
    isOpen: boolean
    onClose: () => void
    hero: Hero | null
    analysis: {
        aiScore: number
        historyScore: number
        reasons: string[] // Combined reasons from AI and History
        matchupData?: {
            strongAgainst: Hero[]
            weakAgainst: Hero[]
            synergyWith: Hero[]
        }
    } | null
    context?: {
        remainingAllyRoles: string[]
        remainingEnemyRoles: string[]
    }
}

export default function AutoSelectAnalysisDialog({ isOpen, onClose, hero, analysis, context }: AutoSelectAnalysisDialogProps) {
    if (!hero || !analysis) return null

    // Helper to categorize reasons
    const categorizeReasons = (reasons: string[]) => {
        const currentCounters: string[] = [] // Counters existing enemies
        const futureThreats: string[] = [] // Deny, Risk, Meta, Comfort
        const teamBenefits: string[] = [] // Synergy, Team Comfort, History
        const protectedAllies: string[] = [] // NEW: Heroes we can play if we ban this

        reasons.forEach(r => {
            const lower = r.toLowerCase()
            // Extract Protected Heroes
            if (r.includes('Protect') || r.includes('Threatens')) {
                // Format: "Protect Keera (High Threat)" or "Protect Team (Threatens Keera, Zata)"
                // Extract hero names
                const match = r.match(/Protect (.*?) \(|Threatens (.*?)\)/)
                let rawNames = ""
                if (match) {
                    rawNames = match[1] || match[2] || ""
                } else if (r.startsWith("Protect ")) {
                    rawNames = r.replace("Protect ", "").split(" +")[0]
                }

                if (rawNames) {
                    // Clean up names
                    const names = rawNames.split(', ').map(n => n.trim())
                    protectedAllies.push(...names)
                }
                // Also add to future threats context generally, or interpret as "Unlock"
            }

            if (lower.includes('beat') || lower.includes('counter') || lower.includes('win rate')) {
                currentCounters.push(r.trim())
            } else if (lower.includes('deny') || lower.includes('risk') || lower.includes('terror') || lower.includes('ban') || lower.includes('meta') || lower.includes('comfort') || lower.includes('protect')) {
                // Keep 'Protect' here too as a general reason, but maybe distinguishing the UI is better.
                // If we show "Safe to Pick", maybe we don't need it in generic list?
                // Let's keep it in future threats for completeness but we visualize it specially.
                futureThreats.push(r.trim())
            } else {
                teamBenefits.push(r.trim())
            }
        })

        return { currentCounters, futureThreats, teamBenefits, protectedAllies: Array.from(new Set(protectedAllies)) }
    }

    const { currentCounters, futureThreats, teamBenefits, protectedAllies } = categorizeReasons(analysis.reasons)
    const totalScore = analysis.aiScore + analysis.historyScore

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-indigo-500/30 text-slate-100 max-w-md md:max-w-lg">
                <DialogHeader className="border-b border-indigo-500/30 pb-4">
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold tracking-tight">
                        <Brain className="w-6 h-6 text-indigo-400" />
                        <span>AI Auto-Select Analysis</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Hero Header */}
                    <div className="flex items-center gap-5">
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                            {hero.icon_url && <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h2 className="text-2xl font-black uppercase tracking-wider text-white">{hero.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/50">
                                    Score: {Math.round(totalScore)}
                                </Badge>
                                {analysis.aiScore > 0 && <span className="text-xs text-slate-400">AI: {Math.round(analysis.aiScore)}</span>}
                                {analysis.historyScore > 0 && <span className="text-xs text-slate-400">History: {Math.round(analysis.historyScore)}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Analysis Content */}
                    <div className="space-y-4">
                        {/* 1. Current Phase Counters (Strong vs Existing) */}
                        {currentCounters.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase">
                                    <Swords className="w-4 h-4" />
                                    <span>Counters Enemy (Current Pick)</span>
                                </div>
                                <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-lg space-y-1">
                                    {currentCounters.map((r, i) => (
                                        <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-rose-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Future/Strategic Benefits (Deny/Prevent) */}
                        {futureThreats.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase">
                                    <ShieldAlert className="w-4 h-4" />
                                    <span>ผลกระทบเชิงกลยุทธ์ (อนาคต/เมต้า)</span>
                                </div>
                                <div className="bg-amber-950/30 border border-amber-500/20 p-3 rounded-lg space-y-1">
                                    {futureThreats.map((r, i) => (
                                        <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-amber-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Team/General Benefits */}
                        {teamBenefits.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase">
                                    <Target className="w-4 h-4" />
                                    <span>ประโยชน์ต่อทีม (Team Benefit)</span>
                                </div>
                                <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-lg space-y-1">
                                    {teamBenefits.map((r, i) => (
                                        <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-emerald-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. Ban Context (Board State) - Thai Request */}
                        {context && (
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                                <div className="bg-slate-950/50 p-2 rounded border border-white/10">
                                    <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">ทีมเราเหลือตำแหน่ง</div>
                                    <div className="flex flex-wrap gap-1">
                                        {context.remainingAllyRoles.length > 0 ? (
                                            context.remainingAllyRoles.map(r => (
                                                <Badge key={r} variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-600 text-slate-300">{r}</Badge>
                                            ))
                                        ) : <span className="text-[10px] text-slate-600">- ครบแล้ว -</span>}
                                    </div>
                                </div>
                                <div className="bg-slate-950/50 p-2 rounded border border-white/10">
                                    <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">ทีมตรงข้ามเหลือตำแหน่ง</div>
                                    <div className="flex flex-wrap gap-1">
                                        {context.remainingEnemyRoles.length > 0 ? (
                                            context.remainingEnemyRoles.map(r => (
                                                <Badge key={r} variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-600 text-slate-300">{r}</Badge>
                                            ))
                                        ) : <span className="text-[10px] text-slate-600">- ครบแล้ว -</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* 5. PROTECTED ALLIES (Unlockable Picks) - User Request */}
                        {protectedAllies.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm uppercase">
                                    <LockOpen className="w-4 h-4" />
                                    <span>ตัวที่เล่นได้ (เพราะแบนตัวแก้ทางแล้ว)</span>
                                </div>
                                <div className="bg-blue-950/30 border border-blue-500/20 p-3 rounded-lg flex flex-wrap gap-2">
                                    {protectedAllies.map((name, i) => (
                                        <Badge key={i} className="bg-blue-500/20 text-blue-200 border-blue-500/50 hover:bg-blue-500/30">
                                            {name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 6. GENERAL MATCHUPS (Strong/Weak) - User Request */}
                        {analysis.matchupData && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                {/* Strong Against */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm uppercase">
                                        <Swords className="w-4 h-4" />
                                        <span>ชนะทาง (Strong Vs)</span>
                                    </div>
                                    <div className="bg-green-950/20 border border-green-500/20 p-2 rounded-lg min-h-[60px]">
                                        {analysis.matchupData.strongAgainst.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {analysis.matchupData.strongAgainst.slice(0, 8).map((hero, i) => (
                                                    <div key={i} className="group relative flex flex-col items-center">
                                                        <div className="relative w-10 h-10 rounded-full border border-green-500/50 overflow-hidden shadow-sm shadow-green-900/50 bg-green-950">
                                                            {hero.icon_url ? (
                                                                <Image
                                                                    src={hero.icon_url}
                                                                    alt={hero.name}
                                                                    fill
                                                                    className="object-cover"
                                                                    sizes="40px"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[10px] text-green-500 font-bold">
                                                                    {hero.name.substring(0, 2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-green-200 mt-1 max-w-[48px] truncate text-center leading-tight">
                                                            {hero.name}
                                                        </span>
                                                    </div>
                                                ))}
                                                {analysis.matchupData.strongAgainst.length > 8 && <span className="text-[10px] text-zinc-500 flex items-center">+{analysis.matchupData.strongAgainst.length - 8}</span>}
                                            </div>
                                        ) : <span className="text-zinc-600 text-xs">ไม่มีข้อมูล</span>}
                                    </div>
                                </div>

                                {/* Weak Against */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase">
                                        <ShieldAlert className="w-4 h-4" />
                                        <span>แพ้ทาง (Weak Vs)</span>
                                    </div>
                                    <div className="bg-red-950/20 border border-red-500/20 p-2 rounded-lg min-h-[60px]">
                                        {analysis.matchupData.weakAgainst.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {analysis.matchupData.weakAgainst.slice(0, 8).map((hero, i) => (
                                                    <div key={i} className="group relative flex flex-col items-center">
                                                        <div className="relative w-10 h-10 rounded-full border border-red-500/50 overflow-hidden shadow-sm shadow-red-900/50 bg-red-950">
                                                            {hero.icon_url ? (
                                                                <Image
                                                                    src={hero.icon_url}
                                                                    alt={hero.name}
                                                                    fill
                                                                    className="object-cover"
                                                                    sizes="40px"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[10px] text-red-500 font-bold">
                                                                    {hero.name.substring(0, 2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-red-200 mt-1 max-w-[48px] truncate text-center leading-tight">
                                                            {hero.name}
                                                        </span>
                                                    </div>
                                                ))}
                                                {analysis.matchupData.weakAgainst.length > 8 && <span className="text-[10px] text-zinc-500 flex items-center">+{analysis.matchupData.weakAgainst.length - 8}</span>}
                                            </div>
                                        ) : <span className="text-zinc-600 text-xs">ไม่มีข้อมูล</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
