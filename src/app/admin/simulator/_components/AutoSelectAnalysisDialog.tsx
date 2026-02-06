import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, History, Swords, ShieldAlert, Target, LockOpen, ChevronDown } from "lucide-react"
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
        recommendedRole?: string
    } | null
    context?: {
        remainingAllyRoles: string[]
        remainingEnemyRoles: string[]
        enemyHeroIds?: string[] // For highlighting
        enemyMatchups?: { hero: Hero, role: string, advantage: 'Strong' | 'Weak' | 'Neutral' }[]
        predictedEnemyHeroes?: { role: string, hero: Hero, reason: string }[]
    }
    phase?: 'BAN' | 'PICK'
}

const CollapsibleSection = ({ title, icon: Icon, colorClass, children, defaultOpen = false }: { title: string, icon: any, colorClass: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    return (
        <div className="space-y-1.5 md:space-y-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 font-bold text-xs md:text-sm uppercase w-full hover:opacity-80 transition-opacity ${colorClass}`}
            >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="flex-1 text-left">{title}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    )
}

export default function AutoSelectAnalysisDialog({ isOpen, onClose, hero, analysis, context, phase }: AutoSelectAnalysisDialogProps) {
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
            <DialogContent className="bg-slate-900 border-indigo-500/30 text-slate-100 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl">
                <DialogHeader className="border-b border-indigo-500/30 pb-4 mb-2">
                    <DialogTitle className="flex items-center justify-between gap-3 text-lg md:text-xl font-bold tracking-tight pr-12">
                        <div className="flex items-center gap-2">
                            <Brain className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                            <span>AI Auto-Select Analysis</span>
                        </div>
                        {phase && (
                            <Badge variant={phase === 'BAN' ? "destructive" : "default"} className={`${phase === 'BAN' ? 'bg-red-500/20 text-red-300 border-red-500/50' : 'bg-green-500/20 text-green-300 border-green-500/50'} border`}>
                                {phase} PHASE
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 md:gap-6 pb-2">
                    {/* Hero Header */}
                    <div className="flex items-center gap-4 md:gap-5">
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] shrink-0">
                            {hero.icon_url && <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white">{hero.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/50 text-[10px] md:text-xs">
                                    Score: {Math.round(totalScore)}
                                </Badge>
                                {analysis.recommendedRole && (
                                    <Badge variant="outline" className="text-[10px] md:text-xs border-amber-500/50 text-amber-300 bg-amber-950/30">
                                        ตำแหน่ง: {analysis.recommendedRole}
                                    </Badge>
                                )}
                                {analysis.aiScore > 0 && <span className="text-[10px] md:text-xs text-slate-400">AI: {Math.round(analysis.aiScore)}</span>}
                                {analysis.historyScore > 0 && <span className="text-[10px] md:text-xs text-slate-400">History: {Math.round(analysis.historyScore)}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Analysis Content */}
                    <div className="space-y-3 md:space-y-4">
                        {/* 0. NEW: Detailed Enemy Matchup Analysis (User Request) */}
                        {((context?.enemyMatchups && context.enemyMatchups.length > 0) || (context?.predictedEnemyHeroes && context.predictedEnemyHeroes.length > 0)) && (
                            <CollapsibleSection
                                title={phase === 'BAN' ? "วิเคราะห์ผลกระทบต่อทีมเรา (Team Threat Analysis)" : "วิเคราะห์การเจอกับทีมตรงข้าม (Enemy Team Analysis)"}
                                icon={phase === 'BAN' ? ShieldAlert : Swords}
                                colorClass={phase === 'BAN' ? "text-red-400" : "text-indigo-400"}
                                defaultOpen={true}
                            >
                                <div className="grid grid-cols-1 gap-2">
                                    {(context?.enemyMatchups || []).map((matchup, i) => (
                                        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${matchup.advantage === 'Strong' ? 'bg-green-950/30 border-green-500/30' : matchup.advantage === 'Weak' ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-950/50 border-white/10'}`}>
                                            {/* Enemy Hero */}
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                                                    {matchup.hero.icon_url && <Image src={matchup.hero.icon_url} alt={matchup.hero.name} fill className="object-cover" />}
                                                </div>
                                                <Badge variant="secondary" className="absolute -bottom-2 -right-2 text-[8px] px-1 h-3.5 bg-indigo-900 border-indigo-500/50 text-indigo-200">
                                                    {matchup.role}
                                                </Badge>
                                            </div>

                                            {/* VS Status */}
                                            <div className="flex-1 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white">{matchup.hero.name}</span>
                                                    <span className="text-[10px] text-slate-400">VS</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {matchup.advantage === 'Strong' && (
                                                        <Badge className={phase === 'BAN' ? "bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30" : "bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30"}>
                                                            {phase === 'BAN' ? "อันตราย (Threat)" : "ชนะทาง (Strong)"}
                                                        </Badge>
                                                    )}
                                                    {matchup.advantage === 'Weak' && (
                                                        <Badge className={phase === 'BAN' ? "bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30"}>
                                                            {phase === 'BAN' ? "ปลอดภัย (Safe)" : "แพ้ทาง (Weak)"}
                                                        </Badge>
                                                    )}
                                                    {matchup.advantage === 'Neutral' && (
                                                        <span className="text-xs text-slate-500 font-medium">
                                                            Neutral
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}
                        {currentCounters.length > 0 && (
                            <CollapsibleSection title="Counters Enemy (Current Pick)" icon={Swords} colorClass="text-rose-400">
                                <div className="bg-rose-950/30 border border-rose-500/20 p-2 md:p-3 rounded-lg space-y-1">
                                    {currentCounters.map((r, i) => (
                                        <div key={i} className="text-xs md:text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-rose-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* 2. Future/Strategic Benefits (Deny/Prevent) */}
                        {futureThreats.length > 0 && (
                            <CollapsibleSection title="ผลกระทบเชิงกลยุทธ์ (อนาคต/เมต้า)" icon={ShieldAlert} colorClass="text-amber-400">
                                <div className="bg-amber-950/30 border border-amber-500/20 p-2 md:p-3 rounded-lg space-y-1">
                                    {futureThreats.map((r, i) => (
                                        <div key={i} className="text-xs md:text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-amber-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* 3. Team/General Benefits */}
                        {teamBenefits.length > 0 && (
                            <CollapsibleSection title="ประโยชน์ต่อทีม (Team Benefit)" icon={Target} colorClass="text-emerald-400">
                                <div className="bg-emerald-950/30 border border-emerald-500/20 p-2 md:p-3 rounded-lg space-y-1">
                                    {teamBenefits.map((r, i) => (
                                        <div key={i} className="text-xs md:text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-emerald-500 mt-1">•</span>
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}


                        {/* 5. PROTECTED ALLIES (Unlockable Picks) - User Request */}
                        {protectedAllies.length > 0 && (
                            <CollapsibleSection title="ตัวที่เล่นได้ (เพราะแบนตัวแก้ทางแล้ว)" icon={LockOpen} colorClass="text-blue-400">
                                <div className="bg-blue-950/30 border border-blue-500/20 p-2 md:p-3 rounded-lg flex flex-wrap gap-2">
                                    {protectedAllies.map((name, i) => (
                                        <Badge key={i} className="bg-blue-500/20 text-blue-200 border-blue-500/50 hover:bg-blue-500/30 text-[10px] md:text-xs">
                                            {name}
                                        </Badge>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* 6. GENERAL MATCHUPS (Strong/Weak) - User Request */}
                        {analysis.matchupData && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pt-2 border-t border-white/5">
                                {/* Strong Against */}
                                <CollapsibleSection title="ชนะทาง (Strong Vs)" icon={Swords} colorClass="text-green-400">
                                    <div className="bg-green-950/20 border border-green-500/20 p-2 rounded-lg min-h-[60px]">
                                        {analysis.matchupData.strongAgainst.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {analysis.matchupData.strongAgainst.slice(0, 10).map((hero, i) => {
                                                    const isEnemy = context?.enemyHeroIds?.includes(String(hero.id))
                                                    return (
                                                        <div key={i} className="group relative flex flex-col items-center">
                                                            <div className={`relative w-9 h-9 md:w-10 md:h-10 rounded-full border ${isEnemy ? 'border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]' : 'border-green-500/50'} overflow-hidden shadow-sm shadow-green-900/50 bg-green-950`}>
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
                                                            {isEnemy && (
                                                                <div className="absolute -top-1.5 -right-1 z-10 bg-red-600 text-white text-[8px] px-1 rounded-full font-bold shadow-sm border border-red-400">
                                                                    PICK!
                                                                </div>
                                                            )}
                                                            <span className={`text-[8px] md:text-[9px] mt-1 max-w-[48px] truncate text-center leading-tight ${isEnemy ? 'text-red-300 font-bold' : 'text-green-200'}`}>
                                                                {hero.name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                                {analysis.matchupData.strongAgainst.length > 10 && <span className="text-[10px] text-zinc-500 flex items-center">+{analysis.matchupData.strongAgainst.length - 10}</span>}
                                            </div>
                                        ) : <span className="text-zinc-600 text-xs">ไม่มีข้อมูล</span>}
                                    </div>
                                </CollapsibleSection>

                                {/* Weak Against */}
                                <CollapsibleSection title="แพ้ทาง (Weak Vs)" icon={ShieldAlert} colorClass="text-red-400">
                                    <div className="bg-red-950/20 border border-red-500/20 p-2 rounded-lg min-h-[60px]">
                                        {analysis.matchupData.weakAgainst.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {analysis.matchupData.weakAgainst.slice(0, 10).map((hero, i) => {
                                                    const isEnemy = context?.enemyHeroIds?.includes(String(hero.id))
                                                    return (
                                                        <div key={i} className="group relative flex flex-col items-center">
                                                            <div className={`relative w-9 h-9 md:w-10 md:h-10 rounded-full border ${isEnemy ? 'border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]' : 'border-red-500/50'} overflow-hidden shadow-sm shadow-red-900/50 bg-red-950`}>
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
                                                            {isEnemy && (
                                                                <div className="absolute -top-1.5 -right-1 z-10 bg-red-600 text-white text-[8px] px-1 rounded-full font-bold shadow-sm border border-red-400">
                                                                    PICK!
                                                                </div>
                                                            )}
                                                            <span className={`text-[8px] md:text-[9px] mt-1 max-w-[48px] truncate text-center leading-tight ${isEnemy ? 'text-red-300 font-bold' : 'text-red-200'}`}>
                                                                {hero.name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                                {analysis.matchupData.weakAgainst.length > 10 && <span className="text-[10px] text-zinc-500 flex items-center">+{analysis.matchupData.weakAgainst.length - 10}</span>}
                                            </div>
                                        ) : <span className="text-zinc-600 text-xs">ไม่มีข้อมูล</span>}
                                    </div>
                                </CollapsibleSection>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
