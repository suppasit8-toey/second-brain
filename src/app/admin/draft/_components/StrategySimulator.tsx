import React, { useState, useMemo, useEffect } from 'react'
import { Hero } from '@/utils/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrainCircuit, Shield, Swords, User, Play, RotateCcw, Ban, Sparkles, AlertTriangle, CheckCircle2, XCircle, Flag, ChevronLeft, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StrategySimulatorProps {
    winConditions: any[];
    firstPickStats: { totalGames: number; picks: any[] };
    enemyThreats: any[];
    heroMap: Map<string, Hero>;
    globalBanIds?: Set<string>;
    enemyGlobalBanIds?: Set<string>;
    currentPicks?: any[];
    myTeamName?: string;
    myTeamStats?: any[]; // Ally Team Scrim Stats
    realGameSide?: 'BLUE' | 'RED';
    combos?: any[];
    matchups?: any[];
    blueTeamName?: string;
    redTeamName?: string;
}

interface DraftStep {
    step: number;
    side: 'BLUE' | 'RED';
    slot: number;
    isMe: boolean;
    heroId?: string;
    description: string;
    type: 'BAN' | 'PICK';
    details?: string[]; // Detailed analysis points
    topCandidates?: {
        heroId: string;
        score: number;
        reason: string;
        details: string[];
    }[];
}

export default function StrategySimulator({
    winConditions,
    firstPickStats,
    enemyThreats,
    heroMap,
    globalBanIds,
    enemyGlobalBanIds,
    currentPicks,
    myTeamName,
    myTeamStats = [],
    realGameSide,
    blueTeamName = 'Blue Team',
    redTeamName = 'Red Team',
    combos = [],
    matchups = []
}: StrategySimulatorProps) {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)
    const [mySide, setMySide] = useState<'BLUE' | 'RED'>(realGameSide || 'BLUE')
    const [simulation, setSimulation] = useState<DraftStep[]>([])
    const [isSimulated, setIsSimulated] = useState(false)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [showAlternatives, setShowAlternatives] = useState(false)

    // Full Draft Sequence (Tournament Mode)
    const draftSequence = [
        { side: 'BLUE', slot: 1, type: 'BAN' },
        { side: 'RED', slot: 1, type: 'BAN' },
        { side: 'BLUE', slot: 2, type: 'BAN' },
        { side: 'RED', slot: 2, type: 'BAN' },
        { side: 'BLUE', slot: 1, type: 'PICK' },
        { side: 'RED', slot: 1, type: 'PICK' },
        { side: 'RED', slot: 2, type: 'PICK' },
        { side: 'BLUE', slot: 2, type: 'PICK' },
        { side: 'BLUE', slot: 3, type: 'PICK' },
        { side: 'RED', slot: 3, type: 'PICK' },
        { side: 'RED', slot: 3, type: 'BAN' },
        { side: 'BLUE', slot: 3, type: 'BAN' },
        { side: 'RED', slot: 4, type: 'BAN' },
        { side: 'BLUE', slot: 4, type: 'BAN' },
        { side: 'RED', slot: 4, type: 'PICK' },
        { side: 'BLUE', slot: 4, type: 'PICK' },
        { side: 'BLUE', slot: 5, type: 'PICK' },
        { side: 'RED', slot: 5, type: 'PICK' },
    ]

    const selectedStrategy = useMemo(() =>
        winConditions.find(wc => wc.id === selectedStrategyId),
        [selectedStrategyId, winConditions])

    // --- HELPER: Parse Roles safely ---
    const getHeroRoles = (h: Hero): string[] => {
        let roles: string[] = []
        if ((h as any).position) {
            try {
                if (typeof (h as any).position === 'string' && (h as any).position.startsWith('[')) {
                    roles = JSON.parse((h as any).position)
                } else if (Array.isArray((h as any).position)) {
                    roles = (h as any).position as string[]
                } else {
                    roles = [(h as any).position] as string[]
                }
            } catch { }
        }
        if (roles.length === 0) {
            const mp = (h as any).main_position
            if (Array.isArray(mp)) roles.push(...mp)
            else if (mp) roles.push(mp)
        }
        // Normalize
        return roles.map(r => r === 'Abyssal' ? 'Abyssal Dragon' : (r === 'Support' ? 'Roam' : r))
    }

    const getHeroStatus = (heroId: string) => {
        if (globalBanIds && globalBanIds.has(heroId)) return { status: 'GLOBAL_BAN', color: 'text-slate-600', icon: Ban, tooltip: 'Global Ban' }
        if (currentPicks && currentPicks.length > 0) {
            const pick = currentPicks.find(p => p.hero_id === heroId)
            if (pick) {
                if (pick.type === 'BAN') return { status: 'BANNED', color: 'text-red-400 grayscale', icon: Ban, tooltip: 'Banned' }
                if (realGameSide) {
                    if (pick.side === realGameSide) return { status: 'PICKED_FRIENDLY', color: 'text-emerald-500', icon: CheckCircle2, tooltip: 'Picked by Us' }
                    else return { status: 'PICKED_ENEMY', color: 'text-rose-500 line-through', icon: XCircle, tooltip: 'Picked by Enemy' }
                }
                return { status: 'PICKED', color: 'text-slate-500 line-through', icon: XCircle, tooltip: 'Picked' }
            }
        }
        return { status: 'AVAILABLE', color: '', icon: null, tooltip: 'Available' }
    }

    const getConditionStatus = (heroId: string, type: 'CORE' | 'AVOID') => {
        const base = getHeroStatus(heroId)
        if (type === 'CORE') {
            if (base.status === 'GLOBAL_BAN') return { ...base, style: 'opacity-30 grayscale decoration-slate-500 line-through' }
            if (base.status === 'BANNED') return { ...base, style: 'opacity-40 grayscale text-red-500 line-through' }
            if (base.status === 'PICKED_FRIENDLY') return { ...base, style: 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300 opacity-100' }
            if (base.status === 'PICKED_ENEMY') return { ...base, style: 'opacity-40 grayscale text-rose-500 line-through decoration-rose-500' }
            if (base.status === 'PICKED') return { ...base, style: 'opacity-50 text-slate-500 line-through' }
        }
        if (type === 'AVOID') {
            if (base.status === 'PICKED_ENEMY') return { status: 'ACTIVE_THREAT', color: 'text-red-500 animate-pulse', icon: AlertTriangle, tooltip: 'ENEMY PICKED!', style: 'bg-red-950/90 border-red-500 font-bold shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-pulse' }
            if (base.status === 'PICKED_FRIENDLY') return { ...base, style: 'opacity-30 grayscale border-emerald-500/20', tooltip: 'Denied' }
            if (base.status === 'BANNED') return { ...base, style: 'opacity-30 grayscale', tooltip: 'Banned' }
        }
        return { ...base, style: '' }
    }

    // Live Simulation State
    const simulationRef = React.useRef<{
        steps: DraftStep[];
        currentPickedOrBanned: Set<string>;
        blueTeamIds: string[];
        redTeamIds: string[];
        blueRolesFilled: Set<string>;
        redRolesFilled: Set<string>;
        myStrategyTargets: Set<string>;
        avoidList: Set<string>;
        enemyThreatSet: Set<string>;
        firstPickSet: Set<string>;
        missingRoles: string[];
        allHeroes: Hero[];
        STANDARD_ROLES: string[];
    } | null>(null)

    const startSimulation = (overrideId?: string) => {
        // 1. Resolve Strategy & Setup Context
        const targetId = typeof overrideId === 'string' ? overrideId : selectedStrategyId
        if (!targetId) return

        const strategy = winConditions.find(wc => wc.id === targetId)
        if (!strategy) return

        if (typeof overrideId === 'string') setSelectedStrategyId(overrideId)

        // Reset UI State
        setSimulation([])
        setIsSimulated(true)
        setCurrentStepIndex(0)
        setIsPlaying(true)

        // 2. Build Initial Simulation Context
        const allHeroes = Array.from(heroMap.values())
        const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']

        // Strategy Sets
        let myStrategyTargets = new Set<string>(strategy.heroes || [])
        // Handle different Strategy structures (flat heroes vs allyConditions)
        if (myStrategyTargets.size === 0 && strategy.allyConditions) {
            strategy.allyConditions.forEach((c: any) => { if (c.heroId) myStrategyTargets.add(c.heroId) })
        }

        let avoidList = new Set<string>(strategy.avoidHeroes || [])
        if (avoidList.size === 0 && strategy.enemyConditions) {
            strategy.enemyConditions.forEach((c: any) => { if (c.heroId) avoidList.add(c.heroId) })
        }

        let enemyThreatSet = new Set<string>(enemyThreats.map(t => t.heroId))
        let firstPickSet = new Set<string>(firstPickStats.picks.slice(0, 5).map(p => p.heroId))

        // Availability Sets
        const currentPickedOrBanned = new Set<string>()
        if (currentPicks) currentPicks.forEach(p => currentPickedOrBanned.add(String(p.hero_id)))

        const blueTeamIds: string[] = []
        const redTeamIds: string[] = []
        const blueRolesFilled = new Set<string>()
        const redRolesFilled = new Set<string>()

        // Pre-fill
        if (currentPicks) {
            currentPicks.forEach(p => {
                if (p.type === 'PICK') {
                    const h = heroMap.get(String(p.hero_id))
                    if (!h) return
                    if (p.side === 'BLUE') {
                        blueTeamIds.push(h.id)
                        const roles = getHeroRoles(h)
                        const r = roles.find(rl => STANDARD_ROLES.includes(rl) && !blueRolesFilled.has(rl)) || roles[0]
                        if (r) blueRolesFilled.add(r)
                    } else {
                        redTeamIds.push(h.id)
                        const roles = getHeroRoles(h)
                        const r = roles.find(rl => STANDARD_ROLES.includes(rl) && !redRolesFilled.has(rl)) || roles[0]
                        if (r) redRolesFilled.add(r)
                    }
                }
            })
        }

        // Store in Ref for the Loop
        simulationRef.current = {
            steps: [],
            currentPickedOrBanned,
            blueTeamIds,
            redTeamIds,
            blueRolesFilled,
            redRolesFilled,
            myStrategyTargets,
            avoidList,
            enemyThreatSet,
            firstPickSet,
            missingRoles: [],
            allHeroes,
            STANDARD_ROLES
        }
    }

    // --- GAME LOOP ---
    useEffect(() => {
        if (!isPlaying || !simulationRef.current) return

        const ctx = simulationRef.current
        const stepIndex = currentStepIndex

        if (stepIndex >= draftSequence.length) {
            setIsPlaying(false)
            return
        }

        const runStep = () => {
            const seq = draftSequence[stepIndex]
            if (!seq) {
                console.warn(`[Sim] No sequence for index ${stepIndex}`)
                return
            }
            console.log(`[Sim] Running Step ${stepIndex}`, seq)

            const side = seq.side as 'BLUE' | 'RED'
            const isBan = seq.type === 'BAN'
            const isMe = side === mySide

            // Determine Needs
            const filledRoles = side === 'BLUE' ? ctx.blueRolesFilled : ctx.redRolesFilled
            const missingRoles = ctx.STANDARD_ROLES.filter(r => !filledRoles.has(r))

            // --- SCORING (Localized) ---
            const scoreHero = (hero: Hero) => {
                // 1. Availability
                if (ctx.currentPickedOrBanned.has(String(hero.id))) return { score: -9999, reason: 'ถูกเลือก/แบนแล้ว', details: [] }

                // 2. Global Bans
                if (side === mySide) {
                    if (globalBanIds && globalBanIds.has(String(hero.id))) return { score: -9999, reason: 'Global Ban (เราใช้ไปแล้ว)', details: [] }
                } else {
                    if (enemyGlobalBanIds && enemyGlobalBanIds.has(String(hero.id))) return { score: -9999, reason: 'Global Ban (ศัตรูใช้ไปแล้ว)', details: [] }
                }

                let score = 0
                let reasons: string[] = []
                let detailedLog: string[] = []
                const heroRoles = getHeroRoles(hero)

                // Access context helpers
                const allyIds = side === 'BLUE' ? ctx.blueTeamIds : ctx.redTeamIds
                const enemyIds = side === 'BLUE' ? ctx.redTeamIds : ctx.blueTeamIds

                // --- BAN PHASE ---
                if (isBan) {
                    // PROTECT CORE
                    if (ctx.myStrategyTargets.has(hero.id)) {
                        return { score: -50000, reason: "ห้ามแบน (ตัวหลักแผน)", details: ["Protected Strategy Core"] }
                    }

                    if (isMe) {
                        // WASTE BAN CHECK
                        if (enemyGlobalBanIds && enemyGlobalBanIds.has(String(hero.id))) {
                            return { score: -9999, reason: "เปลืองแบน (ศัตรูใช้ไปแล้ว)", details: [] }
                        }

                        // 1. MUST BAN: Strategy Threats
                        if (ctx.avoidList.has(hero.id)) {
                            score += 5000
                            reasons.push("ตัวอันตรายสำหรับแผน");
                            detailedLog.push("ต้องแบน: แพ้ทางแผนที่เลือกมา");
                        }

                        // 2. Counter Logic
                        if (ctx.enemyThreatSet.has(hero.id)) {
                            score += 200;
                            reasons.push("ตัวถนัดฝั่งตรงข้าม");
                        }
                    } else {
                        // ENEMY BANNING ME
                        if (globalBanIds && globalBanIds.has(String(hero.id))) {
                            return { score: -9999, reason: "เปลืองแบน", details: [] }
                        }

                        // Enemy bans Meta or My Comfort
                        if (myTeamStats.some((s: any) => s.hero_id === hero.id && s.win_rate > 60)) {
                            score += 300
                            reasons.push("ตัดตัวถนัดเรา");
                        }
                        if (ctx.firstPickSet.has(hero.id)) {
                            score += 100
                            reasons.push("ตัวเมต้า");
                        }
                    }
                    return { score, reason: reasons[0] || "ตามเมต้า", details: detailedLog }
                }

                // --- PICK PHASE ---
                let primaryReason = ""

                // 1. Role Filling (Baseline)
                const fillsMissingRole = heroRoles.some(r => missingRoles.includes(r))
                if (fillsMissingRole) {
                    score += 1000
                } else {
                    score -= 5000
                    detailedLog.push(`ตำแหน่งทับซ้อน`)
                }

                // 2. Base Power
                const stats = (hero as any).hero_stats?.[0]
                if (stats && stats.win_rate) score += stats.win_rate
                if (ctx.firstPickSet.has(hero.id)) score += 50

                // 3. Strategy & Comfort
                if (isMe) {
                    // Strategy Core
                    if (ctx.myStrategyTargets.has(hero.id)) {
                        score += 10000
                        primaryReason = "ตัวหลักแผนการเล่น"
                        detailedLog.push(">>> หัวใจสำคัญของแผน <<<")
                    }

                    // My Comfort
                    const comfort = myTeamStats.find((s: any) => s.hero_id === hero.id)
                    if (comfort) {
                        score += (comfort.win_rate) + (comfort.matches_played * 5)
                        if (!primaryReason) primaryReason = "ตัวถนัดทีมเรา"
                    }
                } else {
                    // Enemy Comfort
                    if (ctx.enemyThreatSet.has(hero.id)) {
                        score += 500
                        if (!primaryReason) primaryReason = "ตัวถนัดศัตรู"
                    }
                }

                // 4. Counters (Reactive) - HIGH PRIORITY
                if (matchups.length > 0) {
                    enemyIds.forEach(enemyId => {
                        const m = matchups.find(mat => mat.hero_id === hero.id && mat.opponent_id === enemyId)
                        if (m && m.win_rate > 52) {
                            // Boost Score Significantly
                            const winDiff = m.win_rate - 50
                            score += winDiff * 50 // e.g. 54% WR = +200, 58% WR = +400

                            // HARD COUNTER BONUS
                            if (m.win_rate > 54) {
                                score += 1500
                                const enemyName = heroMap.get(enemyId)?.name
                                const reasonText = `แก้ทาง ${enemyName} (WR ${m.win_rate}%)`
                                detailedLog.push(reasonText)
                                // Override reason if it's a hard counter and not a core strategy piece
                                if (primaryReason !== "ตัวหลักแผนการเล่น") {
                                    primaryReason = reasonText
                                }
                            }
                        }
                    })
                }

                // 5. Synergy - MEDIUM PRIORITY
                if (combos.length > 0) {
                    let synScore = 0
                    allyIds.forEach(allyId => {
                        const cb = combos.find(c => (c.hero_a_id === hero.id && c.hero_b_id === allyId) || (c.hero_a_id === allyId && c.hero_b_id === hero.id))
                        if (cb && cb.synergy_score > 5) {
                            synScore += cb.synergy_score
                            const allyName = heroMap.get(allyId)?.name
                            detailedLog.push(`คอมโบกับ ${allyName}`)
                        }
                    })
                    score += synScore * 10 // Increased Weight
                    if (synScore > 15 && !primaryReason.includes("แก้ทาง") && primaryReason !== "ตัวหลักแผนการเล่น") {
                        // Find strong combo partner
                        const validCombo = combos.find(c => c.synergy_score > 15 && ((c.hero_a_id === hero.id && allyIds.includes(c.hero_b_id)) || (c.hero_a_id === hero.id && allyIds.includes(c.hero_b_id))))
                        if (validCombo) {
                            const partnerId = validCombo.hero_a_id === hero.id ? validCombo.hero_b_id : validCombo.hero_a_id
                            const partnerName = heroMap.get(partnerId)?.name
                            primaryReason = `คอมโบกับ ${partnerName}`
                        } else {
                            primaryReason = "คอมโบทีม"
                        }
                    }
                }

                return { score, reason: primaryReason || "เลือกตามตำแหน่ง", details: detailedLog }
            }

            // Calculate Best
            const candidates = ctx.allHeroes.map(hero => {
                const res = scoreHero(hero)
                return { hero, ...res }
            })
                .filter(c => c.score > -5000)
                .sort((a, b) => b.score - a.score)

            console.log(`[Sim] Candidates for Step ${stepIndex}:`, candidates.length, candidates[0])

            let best = candidates[0]
            if (!best && ctx.allHeroes.length > 0) {
                // Debug Fallback: Pick random available NOT in banned
                const random = ctx.allHeroes.find(h => !ctx.currentPickedOrBanned.has(String(h.id)))
                if (random) {
                    best = { hero: random, score: -999, reason: "DEBUG FALLBACK (Check Logs)", details: [`Heroes Available: ${ctx.allHeroes.length}`] }
                }
            }

            if (best) {
                // Update Context
                ctx.currentPickedOrBanned.add(String(best.hero.id))

                let desc = best.reason
                if (seq.type === 'PICK') {
                    const roles = getHeroRoles(best.hero)
                    const role = roles.find(r => missingRoles.includes(r))
                    if (role) {
                        filledRoles.add(role)
                        if (desc === "เลือกตามตำแหน่ง" || desc === "ตัวถนัด/เมต้า") desc = `เลือก ${role}`
                    }
                    (seq.side === 'BLUE' ? ctx.blueTeamIds : ctx.redTeamIds).push(String(best.hero.id))
                } else {
                    desc = `แบน ${desc}`
                }

                const topCandidates = candidates.slice(0, 5).map(c => ({
                    heroId: c.hero.id,
                    score: c.score,
                    reason: c.reason,
                    details: c.details
                }))

                const newStep: DraftStep = {
                    step: stepIndex + 1,
                    side: seq.side as 'BLUE' | 'RED',
                    slot: seq.slot,
                    isMe,
                    type: seq.type as 'BAN' | 'PICK',
                    heroId: best.hero.id,
                    description: desc,
                    details: best.details,
                    topCandidates
                }

                setSimulation(prev => [...prev, newStep])
            }
        }

        const timer = setTimeout(() => {
            runStep()
            setCurrentStepIndex(prev => prev + 1)
        }, 600) // Delay for visual effect

        return () => clearTimeout(timer)

    }, [isPlaying, currentStepIndex, mySide, winConditions, selectedStrategyId])


    const currentStep = simulation[currentStepIndex]
    const currentHero = currentStep?.heroId ? heroMap.get(currentStep.heroId) : null

    // --- SORTING: Feasibility Analysis ---
    const sortedStrategies = useMemo(() => {
        return [...winConditions].sort((a, b) => {
            // Helper to get denied count (core heroes that are Banned or Picked by Enemy)
            const getDeniedCount = (wc: any) => {
                let denied = 0
                const checkHero = (hid: string) => {
                    // Check if Global Banned (My Team)
                    if (globalBanIds?.has(hid)) return true
                    // Check if Picked by Enemy or Banned in Draft
                    const pick = (currentPicks || []).find(p => p.heroId === hid)
                    if (pick) {
                        if (pick.type === 'BAN') return true
                        if (pick.type === 'PICK' && pick.side !== mySide) return true // Enemy took it
                    }
                    return false
                }

                if (wc.heroes && Array.isArray(wc.heroes)) {
                    wc.heroes.forEach((h: string) => { if (checkHero(h)) denied++ })
                } else if (wc.allyConditions) {
                    wc.allyConditions.forEach((c: any) => { if (c.heroId && checkHero(c.heroId)) denied++ })
                }
                return denied
            }

            const aDenied = getDeniedCount(a)
            const bDenied = getDeniedCount(b)

            // 1. Sort by Denied Count (Ascending) - 0 denied is best
            if (aDenied !== bDenied) return aDenied - bDenied

            // 2. Sort by Win Rate (Descending) if feasibility is same
            return (b.winRate || 0) - (a.winRate || 0)
        })
    }, [winConditions, currentPicks, globalBanIds, mySide])

    const { strategyCoreIds, strategyAvoidIds } = useMemo(() => {
        const heroIds: string[] = []
        const avoidIds: string[] = []

        if (selectedStrategy) {
            if (selectedStrategy.heroes && Array.isArray(selectedStrategy.heroes)) {
                heroIds.push(...selectedStrategy.heroes)
            } else if (selectedStrategy.allyConditions && Array.isArray(selectedStrategy.allyConditions)) {
                selectedStrategy.allyConditions.forEach((c: any) => {
                    if (c.heroId) heroIds.push(c.heroId)
                })
            }

            if (selectedStrategy.enemyConditions && Array.isArray(selectedStrategy.enemyConditions)) {
                selectedStrategy.enemyConditions.forEach((c: any) => {
                    if (c.heroId) avoidIds.push(c.heroId)
                })
            } else if (selectedStrategy.avoidHeroes && Array.isArray(selectedStrategy.avoidHeroes)) {
                avoidIds.push(...selectedStrategy.avoidHeroes)
            }
        }
        return { strategyCoreIds: heroIds, strategyAvoidIds: avoidIds }
    }, [selectedStrategy])
    // Force Reset on Mount (Fix for HMR/Stuck State)
    useEffect(() => {
        setIsSimulated(false)
        setIsPlaying(false)
        setSimulation([])
        setCurrentStepIndex(0)
    }, [])

    // --- RENDER: SETUP VIEW ---
    if (!isSimulated) {
        return (
            <div className="h-full flex flex-col p-6 w-full">
                <div className="flex items-center gap-3 mb-6">
                    <BrainCircuit className="w-8 h-8 text-indigo-400" />
                    <h3 className="text-2xl font-black text-white tracking-tight">Simulation Setup</h3>
                    <div className="text-sm text-slate-500 font-normal ml-auto">
                        Total Strategies: <span className="text-white font-bold">{sortedStrategies.length}</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">2. Select Strategy</label>

                    {sortedStrategies.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500 space-y-4">
                            <AlertTriangle className="w-12 h-12 opacity-50 text-amber-500" />
                            <div className="text-center">
                                <h4 className="text-lg font-bold text-slate-300">No Strategies Found</h4>
                                <p className="text-sm max-w-sm mt-2">
                                    No strategies found specific to this team with &gt;0 matches and &gt;50% Win Rate.
                                    <br />Try adding general strategies or playing more games.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 -mr-4 pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {sortedStrategies.map(wc => {
                                    // 1. Extract IDs first (needed for calculation)
                                    const heroConditions = wc.allyConditions ? wc.allyConditions.filter((c: any) => c.heroId) : []
                                    const totalCore = heroConditions.length

                                    const heroIds: string[] = []
                                    const avoidIds: string[] = []

                                    if (wc.heroes && Array.isArray(wc.heroes)) {
                                        heroIds.push(...wc.heroes)
                                    } else if (wc.allyConditions && Array.isArray(wc.allyConditions)) {
                                        wc.allyConditions.forEach((c: any) => {
                                            if (c.heroId) heroIds.push(c.heroId)
                                        })
                                    } else {
                                        // Dynamic / Other
                                    }

                                    if (wc.avoidHeroes && Array.isArray(wc.avoidHeroes)) {
                                        avoidIds.push(...wc.avoidHeroes)
                                    } else if (wc.enemyConditions) {
                                        wc.enemyConditions.forEach((c: any) => {
                                            if (c.heroId) avoidIds.push(c.heroId)
                                        })
                                    }

                                    // 2. Calculate Feasibility (Deep Analysis)
                                    let feasibilityScore = 0

                                    heroConditions.forEach((c: any) => {
                                        const hid = c.heroId
                                        if (hid) {

                                            const isGlobalBan = globalBanIds?.has(hid)
                                            const pick = (currentPicks || []).find(p => p.heroId === hid)
                                            const isEnemyPick = pick && pick.side !== mySide
                                            const isAnyBan = pick && pick.type === 'BAN'

                                            // 1. HARD DENY: Global Ban OR Enemy Picked OR Banned
                                            if (isGlobalBan || isEnemyPick || isAnyBan) {
                                                feasibilityScore += 0
                                                // 0 points
                                            }
                                            // 2. SAFE: Enemy Global Ban (They used it, can't steal it)
                                            else if (enemyGlobalBanIds?.has(hid)) {
                                                feasibilityScore += 1
                                            }
                                            // 3. RISK: Enemy plays this hero (In Threat List)
                                            // Check if hero is in enemyThreats (prop passed down)
                                            else if (enemyThreats.some(t => t.heroId === hid)) {
                                                feasibilityScore += 0.5 // High risk of being stolen
                                            }
                                            // 4. STANDARD: Available, not a known threat
                                            else {
                                                feasibilityScore += 1
                                            }
                                        }
                                    })

                                    // Calculate % based on Score / Total possible score (which is totalCore * 1)
                                    const feasibility = totalCore > 0 ? Math.round((feasibilityScore / totalCore) * 100) : 100
                                    const feasibilityColor = feasibility === 100 ? 'text-emerald-400' :
                                        feasibility >= 50 ? 'text-yellow-400' : 'text-rose-400'

                                    const isSelected = selectedStrategyId === wc.id

                                    // Split Avoids into: 
                                    // 1. Already Picked by Enemy (Current Game) -> Critical
                                    // 2. Neutralized (Global Ban) -> Safe/Unavailable
                                    // 3. Potential (Active Threat) -> Warning
                                    const enemyPickedAvoids: string[] = []
                                    const neutralizedAvoids: string[] = []
                                    const remainingAvoids: string[] = []

                                    avoidIds.forEach(hid => {
                                        const pick = (currentPicks || []).find(p => p.heroId === hid)
                                        const isPickedByEnemy = pick && pick.type === 'PICK' && pick.side !== mySide

                                        if (isPickedByEnemy) {
                                            enemyPickedAvoids.push(hid)
                                        } else if (enemyGlobalBanIds?.has(hid)) {
                                            neutralizedAvoids.push(hid)
                                        } else {
                                            remainingAvoids.push(hid)
                                        }
                                    })

                                    return (
                                        <button
                                            key={wc.id}
                                            onClick={() => startSimulation(wc.id)}
                                            className={cn(
                                                "w-full text-left p-6 rounded-2xl border transition-all group relative overflow-hidden",
                                                isSelected
                                                    ? "bg-slate-950/80 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50"
                                                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-6 relative z-10">
                                                <div className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">
                                                    {wc.name ? (
                                                        wc.name
                                                    ) : wc.source === 'USER_DEFINED' ? (
                                                        <span className="flex items-center gap-2 text-indigo-300 font-normal italic">
                                                            <Flag className="w-4 h-4 text-indigo-400" />
                                                            Win Condition
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-2 text-indigo-300 font-normal italic">
                                                            <Sparkles className="w-4 h-4 text-indigo-400" />
                                                            Scrim Analysis
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {wc.winRate && (
                                                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", wc.winRate >= 50 ? "text-emerald-400" : "text-rose-400")}>
                                                            {wc.winRate}% WR
                                                        </span>
                                                    )}

                                                    {/* Feasibility Badge */}
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black border",
                                                        feasibility === 100 ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" :
                                                            feasibility >= 50 ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-400" :
                                                                "bg-rose-500/10 border-rose-500/50 text-rose-400"
                                                    )}>
                                                        {feasibility}% VALID
                                                    </div>
                                                </div >
                                            </div >

                                            {/* CORE HEROES */}
                                            < div className="flex flex-wrap gap-3 mb-6 relative z-10" >
                                                {
                                                    heroIds.map(hid => {
                                                        const h = heroMap.get(hid)
                                                        if (!h) return null
                                                        return (
                                                            <div key={hid} className="flex items-center gap-3 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 group-hover:border-indigo-500/30 transition-colors">
                                                                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 shadow-sm">
                                                                    <img src={h.icon_url} className="w-full h-full object-cover" />
                                                                </div>
                                                                <span className="text-sm text-slate-200 font-bold pr-1">{h.name}</span>
                                                            </div>
                                                        )
                                                    })
                                                }
                                                {heroIds.length === 0 && <span className="text-sm text-slate-600 italic px-2">No core heroes defined</span>}
                                            </div >

                                            {/* AVOID HEROES */}
                                            {
                                                avoidIds.length > 0 && (
                                                    <div className="flex items-center gap-4 pt-4 border-t border-slate-800/50 relative z-10 pl-1">
                                                        <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Ban className="w-4 h-4" /> Avoid:
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {/* Enemy Picked Avoids */}
                                                            {enemyPickedAvoids.length > 0 && (
                                                                <div className="flex flex-wrap gap-[-6px]">
                                                                    {enemyPickedAvoids.map((hid, idx) => {
                                                                        const h = heroMap.get(hid)
                                                                        if (!h) return null
                                                                        return (
                                                                            <div
                                                                                key={hid}
                                                                                className="w-8 h-8 rounded-full overflow-hidden border-2 border-rose-600 bg-rose-950/50 hover:z-10 hover:scale-110 transition-all shadow-[0_0_10px_rgba(225,29,72,0.5)] relative"
                                                                                style={{ marginLeft: idx > 0 ? '-10px' : '0' }}
                                                                                title={`Enemy Picked: ${h.name}`}
                                                                            >
                                                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                                                                <div className="absolute inset-0 bg-rose-900/30 ring-1 ring-inset ring-rose-500/50 rounded-full" />
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Neutralized Avoids (Global Ban) */}
                                                            {neutralizedAvoids.length > 0 && (
                                                                <div className="flex flex-wrap gap-[-6px]">
                                                                    {neutralizedAvoids.map((hid, idx) => {
                                                                        const h = heroMap.get(hid)
                                                                        if (!h) return null
                                                                        return (
                                                                            <div
                                                                                key={hid}
                                                                                className="w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-500/50 bg-slate-900 hover:z-10 hover:scale-110 transition-all shadow-sm relative opacity-60 hover:opacity-100"
                                                                                style={{ marginLeft: idx > 0 ? '-10px' : '0' }}
                                                                                title={`Neutralized (Global Ban): ${h.name}`}
                                                                            >
                                                                                <img src={h.icon_url} className="w-full h-full object-cover grayscale-[0.5]" />
                                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                                    <div className="w-[120%] h-0.5 bg-emerald-500/70 rotate-45 transform origin-center shadow-sm" />
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Divider if needed */}
                                                            {(enemyPickedAvoids.length > 0 || neutralizedAvoids.length > 0) && remainingAvoids.length > 0 && (
                                                                <div className="w-px h-4 bg-slate-700/50" />
                                                            )}

                                                            {/* Remaining Potential Avoids */}
                                                            {remainingAvoids.length > 0 && (
                                                                <div className="flex flex-wrap gap-[-6px]">
                                                                    {remainingAvoids.map((hid, idx) => {
                                                                        const h = heroMap.get(hid)
                                                                        if (!h) return null
                                                                        return (
                                                                            <div
                                                                                key={hid}
                                                                                className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-900 bg-slate-800 grayscale opacity-60 hover:opacity-100 hover:grayscale-0 hover:z-10 hover:scale-110 transition-all shadow-sm relative"
                                                                                style={{ marginLeft: idx > 0 ? '-10px' : '0' }}
                                                                                title={h.name}
                                                                            >
                                                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        </button >
                                    )
                                })}
                            </div >
                        </ScrollArea >
                    )}

                </div >
            </div >
        )
    }

    // --- RENDER: SIMULATION PLAYER ---
    return (
        <div className="h-full flex flex-col p-4 w-full animate-in fade-in zoom-in-95 duration-300">

            {/* Step-By-Step Player (Right) */}
            <div className="flex-1 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 p-6 relative overflow-hidden flex flex-col">
                {!isSimulated ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <BrainCircuit className="w-16 h-16 opacity-20 mb-4" />
                        <p>Select a strategy and run simulation.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0">

                        {/* Header */}
                        <div className="flex flex-col gap-4 mb-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-white text-xl flex items-center gap-3">
                                        <BrainCircuit className="w-6 h-6 text-indigo-400" />
                                        Simulation Results
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-950/30">
                                                {simulation.length} STEPS
                                            </Badge>
                                            {selectedStrategy && (
                                                <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                                    {selectedStrategy.name || 'Custom Strategy'}
                                                </Badge>
                                            )}
                                        </div>
                                    </h4>
                                    <div className="text-slate-400 text-sm mt-1">
                                        Top projected candidate per turn based on strategy.
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowAlternatives(!showAlternatives)}
                                        className={cn(
                                            "border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-xs font-bold",
                                            showAlternatives ? "text-indigo-400 border-indigo-500/50" : "text-slate-400"
                                        )}
                                    >
                                        {showAlternatives ? 'Hide Alternatives' : 'Show Alternatives'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setIsSimulated(false); setIsPlaying(false); }} className="text-slate-400 hover:text-white hover:bg-slate-800">
                                        <ChevronLeft className="w-4 h-4 mr-2" />
                                        Back to Setup
                                    </Button>
                                </div>
                            </div>

                            {/* Strategy Details Expansion */}
                            {selectedStrategy && (
                                <div className="bg-slate-900/40 rounded-xl border border-indigo-500/20 p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                                <Trophy className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-indigo-300">Active Strategy</div>
                                                <div className="text-lg font-black text-white leading-none">
                                                    {selectedStrategy.name || 'Custom Strategy'}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedStrategy.winRate && (
                                            <div className={cn("text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-slate-950 border flex items-center gap-2",
                                                selectedStrategy.winRate >= 50 ? "text-emerald-400 border-emerald-900" : "text-rose-400 border-rose-900"
                                            )}>
                                                <span className="text-slate-500">Win Rate:</span>
                                                {selectedStrategy.winRate}%
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full h-px bg-slate-800/50" />

                                    <div className="flex items-start gap-8">
                                        {/* CORE HEROES */}
                                        <div className="flex flex-col gap-2">
                                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                <Sparkles className="w-3 h-3" /> Core Heroes
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {strategyCoreIds.length > 0 ? strategyCoreIds.map(hid => {
                                                    const h = heroMap.get(hid)
                                                    if (!h) return null
                                                    return (
                                                        <div key={hid} className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded border border-slate-800 hover:border-indigo-500/50 transition-colors">
                                                            <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-700">
                                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                                            </div>
                                                            <span className="text-xs text-slate-300 font-bold">{h.name}</span>
                                                        </div>
                                                    )
                                                }) : <span className="text-xs text-slate-600 italic">None defined</span>}
                                            </div>
                                        </div>

                                        {/* AVOID HEROES */}
                                        <div className="flex flex-col gap-2">
                                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                                <Ban className="w-3 h-3" /> Avoid Heroes
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {strategyAvoidIds.length > 0 ? strategyAvoidIds.map(hid => {
                                                    const h = heroMap.get(hid)
                                                    if (!h) return null
                                                    return (
                                                        <div key={hid} className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded border border-slate-800 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all text-slate-500 hover:text-rose-400">
                                                            <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-700">
                                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                                            </div>
                                                            <span className="text-xs font-bold decoration-slice">{h.name}</span>
                                                        </div>
                                                    )
                                                }) : <span className="text-xs text-slate-600 italic">None defined</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TABLE VIEW */}
                        <div className="flex-1 overflow-hidden border border-slate-800 rounded-xl bg-slate-950/50 flex flex-col">
                            {/* Table Header */}
                            <div className={cn(
                                "grid gap-2 p-3 bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider",
                                "grid-cols-[40px_120px_50px_140px_1fr]"
                            )}>
                                <div className="text-center">#</div>
                                <div>Team</div>
                                <div className="text-center">Act</div>
                                <div>Best Choice</div>
                                <div>Analysis</div>
                            </div>

                            {/* Table Body */}
                            <ScrollArea className="flex-1">
                                {simulation.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                        <BrainCircuit className="w-8 h-8 opacity-50 animate-pulse" />
                                        <div className="text-sm font-bold">Initializing Simulation...</div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-800/50">
                                        {simulation.map((step, idx) => {
                                            const isBlue = step.side === 'BLUE'
                                            const sideColor = isBlue ? "text-blue-400" : "text-rose-400"
                                            const teamName = isBlue ? blueTeamName : redTeamName
                                            const isBan = step.type === 'BAN'

                                            return (
                                                <div key={idx} className={cn(
                                                    "grid gap-2 p-2 items-center hover:bg-slate-800/30 transition-colors text-xs",
                                                    "grid-cols-[40px_120px_50px_140px_1fr]"
                                                )}>
                                                    {/* Step Number */}
                                                    <div className="text-center font-mono text-slate-600 font-bold">
                                                        {idx + 1}
                                                    </div>

                                                    {/* Team */}
                                                    <div className={cn("font-bold text-[11px] leading-tight flex items-center gap-1.5", sideColor)} title={teamName}>
                                                        <span className="truncate">{teamName.replace(/\s*\(Bot\)$/i, '')}</span>
                                                        {/bot/i.test(teamName) && (
                                                            <span className="text-[9px] opacity-75 border border-current rounded-[3px] px-1 uppercase leading-none py-0.5 shrink-0">Bot</span>
                                                        )}
                                                    </div>

                                                    {/* Action Type */}
                                                    <div className="flex justify-center">
                                                        <Badge variant="outline" className={cn(
                                                            "h-5 px-1.5 text-[9px] border-0 font-black w-12 justify-center",
                                                            isBan ? "bg-red-950/50 text-red-500" : "bg-emerald-950/50 text-emerald-500"
                                                        )}>
                                                            {step.type}
                                                        </Badge>
                                                    </div>

                                                    {/* Best Choice (Hero Only) */}
                                                    {step.topCandidates?.slice(0, 1).map((cand, cIdx) => {
                                                        const hero = heroMap.get(cand.heroId)
                                                        if (!hero) return <div key={cIdx} />

                                                        return (
                                                            <div key={cand.heroId} className="flex items-center gap-2 overflow-hidden">
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded bg-slate-800 shrink-0 overflow-hidden border",
                                                                    isBan ? "border-red-500/50 grayscale" : "border-emerald-500/50"
                                                                )}>
                                                                    <img src={hero.icon_url} className="w-full h-full object-cover" />
                                                                </div>
                                                                <div className="min-w-0 font-bold text-slate-200">
                                                                    {hero.name}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}

                                                    {/* Detailed Analysis */}
                                                    <div className="text-[11px] text-slate-400 leading-snug">
                                                        {step.details && step.details.length > 0 ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className={cn("font-bold", isBan ? "text-red-400" : "text-indigo-400")}>
                                                                    {step.description}
                                                                </span>
                                                                {step.details.filter(d => d !== step.description).slice(0, 2).map((d, i) => (
                                                                    <span key={i} className="text-slate-500 text-[10px]">• {d}</span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="opacity-50 italic">{step.description}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
