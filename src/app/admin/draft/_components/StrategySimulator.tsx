import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Hero } from '@/utils/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrainCircuit, Shield, Swords, User, Play, RotateCcw, Ban, Sparkles, AlertTriangle, CheckCircle2, XCircle, Flag, ChevronLeft, Trophy, Target, Zap, TrendingUp, Brain, ChevronUp, ChevronDown } from 'lucide-react'
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

// Enhanced Scoring Detail Structure
interface ScoringDetail {
    reason: string;
    score: number;
    type?: 'base' | 'team_pool' | 'counter' | 'synergy' | 'strategy' | 'ban' | 'first_pick' | 'threat' | 'draft_slot' | 'counter_enemy_pick';
    comparisonNote?: string; // Why this over alternatives
    contextualReason?: string; // Situational explanation
}

interface DraftStep {
    step: number;
    side: 'BLUE' | 'RED';
    slot: number;
    isMe: boolean;
    heroId?: string;
    description: string;
    type: 'BAN' | 'PICK';
    details: ScoringDetail[];
    totalScore: number;
    topCandidates?: {
        heroId: string;
        score: number;
        reason: string;
        details: ScoringDetail[];
    }[];
    // NEW: Enhanced Analysis Fields
    analysisBreakdown?: {
        slotContext: string;  // e.g., "First Pick - Flex/Contested Zone"
        strategyNote: string; // e.g., "Strategy Core available but saving for later"
        whyNotAlternatives: { heroName: string; reason: string }[];
        countersEnemyPicks: { heroName: string; winRate: number }[];
    };
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
    const [isAdvisorOpen, setIsAdvisorOpen] = useState(true)
    const [selectedStepForAdvisor, setSelectedStepForAdvisor] = useState<number | null>(null)

    // Sync Side Prop
    useEffect(() => {
        if (realGameSide) setMySide(realGameSide)
    }, [realGameSide])

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

    // === DRAFT SLOT PRIORITY CONSTANTS ===
    // Defines the strategic context for each pick slot
    const DRAFT_SLOT_PRIORITY: Record<number, {
        priority: 'flex_contested' | 'counter_adaptive' | 'role_fill';
        description: string;
        strategyCoreBonus: number; // Dynamic bonus for Strategy Core heroes
        counterBonus: number; // Bonus for countering enemy picks
    }> = {
        // Blue Pick 1 (slot 5 in sequence)
        1: { priority: 'flex_contested', description: 'First Pick - Flex/Contested Zone', strategyCoreBonus: 500, counterBonus: 100 },
        // Red Pick 1-2 (slots 6,7)
        2: { priority: 'counter_adaptive', description: 'Response Pick - Counter Available', strategyCoreBonus: 1000, counterBonus: 200 },
        // Blue Pick 2-3 (slots 8,9)  
        3: { priority: 'counter_adaptive', description: 'Counter-Adaptive Pick', strategyCoreBonus: 2000, counterBonus: 150 },
        // Red Pick 3 (slot 10)
        4: { priority: 'role_fill', description: 'Role Fill Pick', strategyCoreBonus: 2500, counterBonus: 100 },
        // Final Picks (slots 15-18)
        5: { priority: 'role_fill', description: 'Final Pick - Last Counter Chance', strategyCoreBonus: 3000, counterBonus: 250 },
    }

    // Helper: Get dynamic strategy core bonus based on slot
    const getStrategyCoreBonusForSlot = (pickSlot: number, isFirstPick: boolean): number => {
        // First pick has lower strategy core priority (prefer flex/contested)
        if (isFirstPick) return 500
        // Scale bonus based on pick slot (1-5)
        const slotConfig = DRAFT_SLOT_PRIORITY[pickSlot] || DRAFT_SLOT_PRIORITY[3]
        return slotConfig.strategyCoreBonus
    }

    // Helper: Get slot context description
    const getSlotContextDescription = (pickSlot: number): string => {
        const slotConfig = DRAFT_SLOT_PRIORITY[pickSlot]
        return slotConfig?.description || 'Standard Pick'
    }

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

    // Live Simulation State Ref
    const simulationRef = useRef<{
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

            const side = seq.side as 'BLUE' | 'RED'
            const isBan = seq.type === 'BAN'
            const isMe = side === mySide

            // Determine Needs
            const filledRoles = side === 'BLUE' ? ctx.blueRolesFilled : ctx.redRolesFilled
            const missingRoles = ctx.STANDARD_ROLES.filter(r => !filledRoles.has(r))

            // --- CEREBRO SCORING ENGINE (Enhanced Realistic Logic) ---
            const scoreHero = (hero: Hero): { score: number, reason: string, details: ScoringDetail[], countersEnemyPicks: { heroName: string; winRate: number }[] } => {
                // 0. Hard Bans / Availability
                if (ctx.currentPickedOrBanned.has(String(hero.id))) return { score: -9999, reason: 'Already Picked/Banned', details: [], countersEnemyPicks: [] }
                if (side === mySide && globalBanIds?.has(String(hero.id))) return { score: -9999, reason: 'Global Ban (Us)', details: [], countersEnemyPicks: [] }
                if (side !== mySide && enemyGlobalBanIds?.has(String(hero.id))) return { score: -9999, reason: 'Global Ban (Enemy)', details: [], countersEnemyPicks: [] }

                let score = 0
                let primaryReason = ""
                const details: ScoringDetail[] = []
                const heroRoles = getHeroRoles(hero)
                const countersEnemyPicks: { heroName: string; winRate: number }[] = []

                // --- CONTEXT ---
                const allyIds = side === 'BLUE' ? ctx.blueTeamIds : ctx.redTeamIds
                const enemyIds = side === 'BLUE' ? ctx.redTeamIds : ctx.blueTeamIds
                const currentPickSlot = allyIds.length + 1 // Which pick # for this team (1-5)
                const isFirstPick = currentPickSlot === 1 && allyIds.length === 0

                // --- BAN PHASE (Enhanced with Phase-Specific Logic) ---
                if (isBan) {
                    // Protect Strategy Core heroes from being banned by us
                    if (ctx.myStrategyTargets.has(hero.id)) {
                        return { score: -50000, reason: "Don't Ban (Core)", details: [{ reason: "Strategy Core", score: -50000, type: "strategy" }], countersEnemyPicks: [] }
                    }

                    const currentBanSlot = ctx.currentPickedOrBanned.size + 1
                    const isPhase1Ban = currentBanSlot <= 4
                    const isPhase2Ban = currentBanSlot > 4 // Bans 5-6 (slots 11-14 in sequence)

                    if (isMe) {
                        // === PHASE 1 BANS: Meta/Threat Focus ===
                        if (isPhase1Ban) {
                            // Priority: Strategy Threats > High WR > Meta
                            if (ctx.avoidList.has(hero.id)) {
                                score += 5000
                                details.push({ reason: "🎯 Strategy Threat", score: 5000, type: "strategy", contextualReason: "ตัวนี้ Counter Strategy ของเรา" })
                            }

                            // High Win Rate = General Threat
                            const stats = (hero as any).hero_stats?.[0]
                            if (stats && stats.win_rate > 54) {
                                const threatScore = (stats.win_rate - 50) * 15
                                score += threatScore
                                details.push({ reason: `High WR Threat (${stats.win_rate}%)`, score: Math.round(threatScore), type: "threat" })
                            }

                            // S-Tier Meta = High priority in Phase 1
                            if (stats?.tier === 'S') {
                                score += 100
                                details.push({ reason: "S-Tier Meta Ban", score: 100, type: "ban" })
                            }
                        }

                        // === PHASE 2 BANS: Counter/Protect Focus ===
                        if (isPhase2Ban) {
                            // Priority: Protect our picks > Counter enemy needs

                            // Check if this hero counters ANY of our already-picked heroes
                            let protectScore = 0
                            allyIds.forEach(allyId => {
                                const m = matchups.find(mat => mat.hero_id === hero.id && mat.opponent_id === allyId)
                                if (m && m.win_rate > 52) {
                                    const threat = (m.win_rate - 50) * 10
                                    protectScore += threat
                                    const allyName = heroMap.get(allyId)?.name || 'Ally'
                                    details.push({ reason: `🛡️ Protect ${allyName} (Threat ${m.win_rate}%)`, score: Math.round(threat), type: "ban", contextualReason: `ถ้าฝั่งตรงข้ามหยิบ ${hero.name} จะ counter ${allyName}` })
                                }
                            })
                            score += protectScore

                            // Enemy missing role analysis - ban high-impact heroes for roles they need
                            const enemyFilledRoles = side === 'BLUE' ? ctx.redRolesFilled : ctx.blueRolesFilled
                            const enemyMissingRoles = ctx.STANDARD_ROLES.filter(r => !enemyFilledRoles.has(r))
                            if (heroRoles.some(r => enemyMissingRoles.includes(r))) {
                                const stats = (hero as any).hero_stats?.[0]
                                if (stats && stats.win_rate > 52) {
                                    score += 80
                                    details.push({ reason: `Deny ${heroRoles[0]} (Enemy Needs)`, score: 80, type: "ban" })
                                }
                            }
                        }

                    } else {
                        // ENEMY BANNING - Predict what they would ban
                        if (ctx.firstPickSet.has(hero.id)) {
                            score += 100
                            details.push({ reason: "Meta Ban", score: 100, type: "ban" })
                        }
                        // Enemy might protect their strategy
                        if (ctx.enemyThreatSet.has(hero.id)) {
                            score += 50
                            details.push({ reason: "Enemy Threat Protect", score: 50, type: "ban" })
                        }
                    }
                    return { score, reason: details[0]?.reason || "Ban", details, countersEnemyPicks }
                }

                // --- PICK PHASE (Enhanced with Slot-Based Logic) ---

                // 1. Role Check (Hard Constraint)
                const fillsMissingRole = heroRoles.some(r => missingRoles.includes(r))
                if (fillsMissingRole) {
                    score += 1000 // Base pick value
                } else {
                    return { score: -5000, reason: "Role Taken", details: [], countersEnemyPicks: [] }
                }

                // 2. Base Stats (History)
                const stats = (hero as any).hero_stats?.[0]
                if (stats) {
                    let baseScore = stats.win_rate
                    if (stats.tier === 'S') baseScore += 15
                    if (stats.tier === 'A') baseScore += 8

                    score += baseScore
                    details.push({ reason: `Base Power (${stats.tier || '-'}, ${stats.win_rate}%)`, score: Math.round(baseScore), type: "base" })
                } else {
                    score += 50
                }

                // 3. Synergy (Combos)
                if (combos.length > 0) {
                    let synScoreTotal = 0
                    allyIds.forEach(allyId => {
                        const cb = combos.find(c => (c.hero_a_id === hero.id && c.hero_b_id === allyId) || (c.hero_a_id === allyId && c.hero_b_id === hero.id))
                        if (cb && cb.synergy_score > 0) {
                            const val = cb.synergy_score / 5 // Increased from /10
                            synScoreTotal += val
                            const allyName = heroMap.get(allyId)?.name || 'Ally'
                            if (cb.synergy_score > 3) {
                                details.push({ reason: `⚡ Synergy w/ ${allyName}`, score: parseFloat(val.toFixed(1)), type: "synergy" })
                            }
                        }
                    })
                    score += synScoreTotal
                }

                // 4. Counters (Matchups) - Enhanced with tracking
                if (matchups.length > 0) {
                    let counterScoreTotal = 0
                    enemyIds.forEach(enemyId => {
                        const m = matchups.find(mat => mat.hero_id === hero.id && mat.opponent_id === enemyId)
                        if (m && m.win_rate > 50) {
                            const slotConfig = DRAFT_SLOT_PRIORITY[currentPickSlot] || DRAFT_SLOT_PRIORITY[3]
                            const val = ((m.win_rate - 50) / 2) * (slotConfig.counterBonus / 100) // Slot-adjusted counter bonus
                            counterScoreTotal += val
                            const enemyName = heroMap.get(enemyId)?.name || 'Enemy'

                            // Track for analysis breakdown
                            countersEnemyPicks.push({ heroName: enemyName, winRate: m.win_rate })

                            if (m.win_rate > 52) {
                                details.push({
                                    reason: `⚔️ Counters ${enemyName} (${m.win_rate}%)`,
                                    score: parseFloat(val.toFixed(1)),
                                    type: "counter_enemy_pick",
                                    contextualReason: `ตัวนี้ชนะ ${enemyName} ที่ฝั่งตรงข้ามหยิบไปแล้ว ${m.win_rate}%`
                                })
                            }
                        }
                    })
                    score += counterScoreTotal
                }

                // 5. Team Pool / Comfort
                if (isMe) {
                    const comfort = myTeamStats.find((s: any) => s.hero_id === hero.id)
                    if (comfort) {
                        const comfortScore = Math.min((comfort.matches_played * 3), 30) // Capped at 30
                        score += comfortScore
                        details.push({ reason: `👤 Team Pool (${comfort.matches_played}g)`, score: comfortScore, type: "team_pool" })
                    }
                }

                // 6. === FIRST PICK SPECIAL LOGIC (Historical Preference + Counter) ===
                if (isMe && isFirstPick) {
                    // First Pick Preference from historical data
                    const firstPickData = firstPickStats.picks.find(p => p.heroId === hero.id)
                    if (firstPickData) {
                        const prefScore = 50 + (firstPickData.winRate * 0.3) // Base 50 + win rate bonus
                        score += prefScore
                        details.push({
                            reason: `📊 First Pick Preference (${Math.round(firstPickData.winRate)}% WR)`,
                            score: Math.round(prefScore),
                            type: "first_pick",
                            contextualReason: `ทีมเคยใช้ตัวนี้เป็น First Pick ${firstPickData.games || 'หลาย'}ครั้ง`
                        })
                    }

                    // Counter enemy's likely picks (from their pool)
                    enemyThreats.forEach(threat => {
                        const m = matchups.find(mat => mat.hero_id === hero.id && mat.opponent_id === threat.heroId)
                        if (m && m.win_rate > 52) {
                            const threatHeroName = heroMap.get(threat.heroId)?.name || 'Enemy Hero'
                            const counterBonus = (m.win_rate - 50) * 2
                            score += counterBonus
                            details.push({
                                reason: `🎯 Counter Enemy Pool (${threatHeroName})`,
                                score: Math.round(counterBonus),
                                type: "counter_enemy_pick",
                                contextualReason: `Counter ${threatHeroName} ที่ฝั่งตรงข้ามใช้บ่อย`
                            })
                        }
                    })
                }

                // 7. === DYNAMIC STRATEGY CORE BONUS (Variable based on slot) ===
                if (isMe && ctx.myStrategyTargets.has(hero.id)) {
                    const dynamicBonus = getStrategyCoreBonusForSlot(currentPickSlot, isFirstPick)
                    score += dynamicBonus

                    let strategyNote = "Strategy Core Hero"
                    if (isFirstPick) {
                        strategyNote = "Strategy Core (Lower priority for First Pick - prefer Flex)"
                    } else if (currentPickSlot >= 4) {
                        strategyNote = "Strategy Core (High priority - later picks)"
                    }

                    details.push({
                        reason: `🎯 ${strategyNote}`,
                        score: dynamicBonus,
                        type: "strategy",
                        contextualReason: `Slot ${currentPickSlot}: Strategy bonus = ${dynamicBonus} (${isFirstPick ? 'First Pick ลด priority' : 'Standard'})`
                    })

                    // Only set as primary reason if bonus is high enough
                    if (dynamicBonus >= 2000) {
                        primaryReason = "Strategy Core"
                    }
                }

                // 8. Draft Slot Context Bonus
                const slotContext = getSlotContextDescription(currentPickSlot)
                if (currentPickSlot <= 2) {
                    // Early picks favor flex heroes
                    if (heroRoles.length >= 2) {
                        score += 20
                        details.push({ reason: `Flex Pick Bonus`, score: 20, type: "draft_slot" })
                    }
                }

                if (!primaryReason) {
                    // Pick the highest impact reason
                    const sortedDetails = [...details].sort((a, b) => b.score - a.score)
                    primaryReason = sortedDetails[0]?.reason || "Best Available"
                }

                return { score, reason: primaryReason, details, countersEnemyPicks }
            }

            // --- EXECUTE SCORING ---
            const candidates = ctx.allHeroes.map(hero => {
                const res = scoreHero(hero)
                return { hero, ...res }
            })
                .filter(c => c.score > -1000) // Filter invalid
                .sort((a, b) => b.score - a.score)

            let best = candidates[0]

            // Fallback for empty roles (shouldn't happen with full roster)
            if (!best) {
                best = { hero: ctx.allHeroes[0], score: 0, reason: "Fallback", details: [], countersEnemyPicks: [] }
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
                        // If generic reason, add role context
                        if (!desc.includes("Strategy")) desc = `${role} • ${desc}`
                    }
                    (seq.side === 'BLUE' ? ctx.blueTeamIds : ctx.redTeamIds).push(String(best.hero.id))
                }

                const topCandidates = candidates.slice(0, 5).map(c => ({
                    heroId: c.hero.id,
                    score: parseFloat(c.score.toFixed(1)),
                    reason: c.reason,
                    details: c.details
                }))

                // === Build Analysis Breakdown for detailed display ===
                const allyIds = seq.side === 'BLUE' ? ctx.blueTeamIds : ctx.redTeamIds
                const currentPickSlot = seq.type === 'PICK' ? allyIds.length : 0
                const slotContext = seq.type === 'PICK'
                    ? getSlotContextDescription(currentPickSlot)
                    : (stepIndex <= 4 ? 'Phase 1 Ban - Meta/Threat Focus' : 'Phase 2 Ban - Counter/Protect Focus')

                // Generate "Why not alternatives" from top candidates
                const whyNotAlternatives = topCandidates.slice(1, 4).map(alt => {
                    const altHero = heroMap.get(alt.heroId)
                    const scoreDiff = best.score - alt.score
                    let reasonText = `คะแนนน้อยกว่า ${Math.round(scoreDiff)} pts`

                    // Check specific reasons
                    const bestIsStrategy = best.details.some(d => d.type === 'strategy')
                    const altIsStrategy = alt.details.some(d => d.type === 'strategy')

                    if (bestIsStrategy && !altIsStrategy) {
                        reasonText = 'ไม่ใช่ Strategy Core'
                    } else if (!bestIsStrategy && altIsStrategy) {
                        reasonText = 'Strategy Core แต่ slot นี้ควรเลือก Counter/Flex'
                    }

                    // Check counter advantage
                    const bestCounters = best.countersEnemyPicks?.length || 0
                    const altCounters = (candidates.find(c => c.hero.id === alt.heroId)?.countersEnemyPicks?.length || 0)
                    if (bestCounters > altCounters) {
                        reasonText = `Counter ศัตรูได้น้อยกว่า (${altCounters} vs ${bestCounters})`
                    }

                    return {
                        heroName: altHero?.name || 'Unknown',
                        reason: reasonText
                    }
                })

                // Build strategy note
                let strategyNote = ''
                const hasStrategyCoreInCandidates = candidates.some(c =>
                    ctx.myStrategyTargets.has(c.hero.id) && c.score > 0
                )
                const chosenIsStrategyCore = ctx.myStrategyTargets.has(best.hero.id)

                if (seq.type === 'PICK' && isMe) {
                    if (chosenIsStrategyCore) {
                        strategyNote = 'เลือก Strategy Core Hero ตามแผน'
                    } else if (hasStrategyCoreInCandidates) {
                        strategyNote = 'Strategy Core ยังว่าง แต่มีตัวเลือกที่ดีกว่าสำหรับ slot นี้'
                    } else {
                        strategyNote = 'เลือกตามสถานการณ์ (No Strategy Core available)'
                    }
                } else if (seq.type === 'BAN') {
                    strategyNote = stepIndex <= 4 ? 'Ban Phase 1: เน้น Meta/Threat' : 'Ban Phase 2: เน้น Counter/Protect'
                }

                const newStep: DraftStep = {
                    step: stepIndex + 1,
                    side: seq.side as 'BLUE' | 'RED',
                    slot: seq.slot,
                    isMe,
                    type: seq.type as 'BAN' | 'PICK',
                    heroId: best.hero.id,
                    description: desc,
                    details: best.details,
                    totalScore: parseFloat(best.score.toFixed(1)),
                    topCandidates,
                    // NEW: Enhanced Analysis Breakdown
                    analysisBreakdown: {
                        slotContext,
                        strategyNote,
                        whyNotAlternatives,
                        countersEnemyPicks: best.countersEnemyPicks || []
                    }
                }

                setSimulation(prev => [...prev, newStep])
            }
        }

        const timer = setTimeout(() => {
            runStep()
            setCurrentStepIndex(prev => prev + 1)
        }, 600)

        return () => clearTimeout(timer)

    }, [isPlaying, currentStepIndex, mySide, winConditions, selectedStrategyId])


    const sortedStrategies = useMemo(() => {
        // (Previous strategy sorting logic retained)
        return [...winConditions].sort((a, b) => {
            return (b.winRate || 0) - (a.winRate || 0)
        })
    }, [winConditions])

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

    // Force Reset on Mount
    useEffect(() => {
        setIsSimulated(false)
        setIsPlaying(false)
        setSimulation([])
        setCurrentStepIndex(0)
    }, [])

    // --- HELPER: RENDER BADGE FOR SCORE DETAIL ---
    const renderDetailBadge = (detail: ScoringDetail, idx: number) => {
        let style = "bg-slate-800 text-slate-300 border-slate-700"
        let icon = null

        switch (detail.type) {
            case 'strategy':
                style = "bg-amber-950/40 text-amber-400 border-amber-500/30"
                icon = <Target className="w-3 h-3 mr-1" />
                break;
            case 'counter':
            case 'counter_enemy_pick':
                style = "bg-rose-950/40 text-rose-400 border-rose-500/30"
                icon = <Swords className="w-3 h-3 mr-1" />
                break;
            case 'synergy':
                style = "bg-blue-950/40 text-blue-400 border-blue-500/30"
                icon = <Zap className="w-3 h-3 mr-1" />
                break;
            case 'team_pool':
                style = "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                icon = <User className="w-3 h-3 mr-1" />
                break;
            case 'base':
                style = "bg-slate-800 text-indigo-300 border-slate-700"
                icon = <TrendingUp className="w-3 h-3 mr-1" />
                break;
            case 'ban':
                style = "bg-red-950 text-red-400 border-red-800"
                icon = <Ban className="w-3 h-3 mr-1" />
                break;
            case 'first_pick':
                style = "bg-cyan-950/40 text-cyan-400 border-cyan-500/30"
                icon = <TrendingUp className="w-3 h-3 mr-1" />
                break;
            case 'threat':
                style = "bg-orange-950/40 text-orange-400 border-orange-500/30"
                icon = <Swords className="w-3 h-3 mr-1" />
                break;
            case 'draft_slot':
                style = "bg-violet-950/40 text-violet-400 border-violet-500/30"
                icon = <Sparkles className="w-3 h-3 mr-1" />
                break;
        }

        return (
            <Badge key={idx} variant="outline" className={cn("px-2 py-0.5 text-[10px] items-center border font-normal", style)}>
                {icon}
                {detail.reason}
                <span className="ml-1 font-bold opacity-75">{detail.score > 0 ? '+' : ''}{detail.score}</span>
            </Badge>
        )
    }

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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Select Strategy to Simulate</label>

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
                                    }

                                    if (wc.avoidHeroes && Array.isArray(wc.avoidHeroes)) {
                                        avoidIds.push(...wc.avoidHeroes)
                                    } else if (wc.enemyConditions) {
                                        wc.enemyConditions.forEach((c: any) => {
                                            if (c.heroId) avoidIds.push(c.heroId)
                                        })
                                    }

                                    let feasibilityScore = 0
                                    heroConditions.forEach((c: any) => {
                                        const hid = c.heroId
                                        if (hid) {
                                            const isGlobalBan = globalBanIds?.has(hid)
                                            const pick = (currentPicks || []).find(p => p.heroId === hid)
                                            const isEnemyPick = pick && pick.side !== mySide
                                            const isAnyBan = pick && pick.type === 'BAN'

                                            if (isGlobalBan || isEnemyPick || isAnyBan) feasibilityScore += 0
                                            else if (enemyGlobalBanIds?.has(hid)) feasibilityScore += 1
                                            else if (enemyThreats.some(t => t.heroId === hid)) feasibilityScore += 0.5
                                            else feasibilityScore += 1
                                        }
                                    })
                                    const feasibility = totalCore > 0 ? Math.round((feasibilityScore / totalCore) * 100) : 100

                                    return (
                                        <button
                                            key={wc.id}
                                            onClick={() => startSimulation(wc.id)}
                                            className={cn(
                                                "w-full text-left p-6 rounded-2xl border transition-all group relative overflow-hidden",
                                                selectedStrategyId === wc.id
                                                    ? "bg-slate-950/80 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50"
                                                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-6 relative z-10">
                                                <div className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">
                                                    {wc.name || 'Strategy'}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black border",
                                                        feasibility === 100 ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" :
                                                            feasibility >= 50 ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-400" :
                                                                "bg-rose-500/10 border-rose-500/50 text-rose-400"
                                                    )}>
                                                        {feasibility}% VALID
                                                    </div>
                                                </div>
                                            </div>
                                            {/* CORE HEROES */}
                                            <div className="flex flex-wrap gap-3 mb-6 relative z-10">
                                                {heroIds.map(hid => {
                                                    const h = heroMap.get(hid); if (!h) return null;
                                                    return (
                                                        <div key={hid} className="flex items-center gap-3 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700">
                                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                                            </div>
                                                            <span className="text-sm text-slate-200 font-bold pr-1">{h.name}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </div>
        )
    }

    // --- RENDER: SIMULATION BOARD ---
    // Helper to group steps into board state
    const boardState = (() => {
        const bluePicks = Array(5).fill(null)
        const redPicks = Array(5).fill(null)
        const blueBans = Array(4).fill(null)
        const redBans = Array(4).fill(null)

        simulation.forEach(step => {
            if (step.side === 'BLUE') {
                if (step.type === 'BAN') blueBans[step.slot - 1] = step
                else bluePicks[step.slot - 1] = step
            } else {
                if (step.type === 'BAN') redBans[step.slot - 1] = step
                else redPicks[step.slot - 1] = step
            }
        })
        return { bluePicks, redPicks, blueBans, redBans }
    })()

    // Helper to render a Hero Slot (Pick)
    const renderPickSlot = (step: DraftStep | null, index: number, isRight: boolean) => {
        const hero = step?.heroId ? heroMap.get(step.heroId) : null
        const analysis = step?.analysisBreakdown

        return (
            <div key={index} className={cn(
                "relative min-h-[5rem] rounded-lg border flex flex-col justify-center transition-all overflow-hidden mb-2 group",
                isRight
                    ? "bg-red-950/20 border-red-500/20 text-right items-end"
                    : "bg-blue-950/20 border-blue-500/20 text-left items-start",
                step ? "opacity-100" : "opacity-40"
            )}>
                {step && hero ? (
                    <>
                        {/* Background Image */}
                        <div className="absolute inset-0 pointer-events-none">
                            <img src={hero.icon_url} className={cn("w-full h-full object-cover opacity-20 transition-transform duration-700 group-hover:scale-110", isRight ? "-scale-x-100" : "")} />
                            <div className={cn("absolute inset-0 bg-gradient-to-r", isRight ? "from-transparent via-red-950/80 to-red-950/90" : "from-blue-950/90 via-blue-950/80 to-transparent")} />
                        </div>

                        {/* Content */}
                        <div className={cn("relative z-10 p-3 w-full flex items-center gap-4", isRight ? "flex-row-reverse" : "flex-row")}>
                            {/* Hero Icon with Tooltip */}
                            <div className="relative group/tooltip">
                                <div className={cn(
                                    "w-14 h-14 rounded-full border-2 shadow-lg shrink-0 overflow-hidden cursor-help",
                                    isRight ? "border-red-400" : "border-blue-400"
                                )}>
                                    <img src={hero.icon_url} className="w-full h-full object-cover" />
                                </div>

                                {/* Tooltip with Detailed Analysis */}
                                {analysis && (
                                    <div className={cn(
                                        "absolute z-50 w-72 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200",
                                        isRight ? "right-16 top-0" : "left-16 top-0"
                                    )}>
                                        <div className="text-xs font-bold text-white mb-2">\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e01\u0e32\u0e23\u0e15\u0e31\u0e14\u0e2a\u0e34\u0e19\u0e43\u0e08</div>

                                        {/* Slot Context */}
                                        <div className="text-[10px] text-indigo-400 mb-2 flex items-center gap-1">
                                            <span>\ud83c\udfaf</span>
                                            <span>{analysis.slotContext}</span>
                                        </div>

                                        {/* Strategy Note */}
                                        {analysis.strategyNote && (
                                            <div className="text-[10px] text-amber-400 mb-2 flex items-center gap-1">
                                                <span>\ud83d\udcdd</span>
                                                <span>{analysis.strategyNote}</span>
                                            </div>
                                        )}

                                        {/* Counters Enemy Picks */}
                                        {analysis.countersEnemyPicks && analysis.countersEnemyPicks.length > 0 && (
                                            <div className="mb-2">
                                                <div className="text-[9px] text-rose-400 font-bold mb-1">\u2694\ufe0f Counter \u0e28\u0e31\u0e15\u0e23\u0e39:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {analysis.countersEnemyPicks.map((c, i) => (
                                                        <span key={i} className="text-[9px] bg-rose-900/50 text-rose-300 px-1.5 py-0.5 rounded">
                                                            {c.heroName} ({c.winRate}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Why Not Alternatives */}
                                        {analysis.whyNotAlternatives && analysis.whyNotAlternatives.length > 0 && (
                                            <div>
                                                <div className="text-[9px] text-slate-400 font-bold mb-1">\u274c \u0e17\u0e33\u0e44\u0e21\u0e44\u0e21\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e15\u0e31\u0e27\u0e2d\u0e37\u0e48\u0e19:</div>
                                                {analysis.whyNotAlternatives.map((alt, i) => (
                                                    <div key={i} className="text-[9px] text-slate-500 flex items-center gap-1 mb-0.5">
                                                        <span className="text-slate-600">\u2022</span>
                                                        <span className="font-medium text-slate-400">{alt.heroName}:</span>
                                                        <span>{alt.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info & Badges */}
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn("font-black text-lg text-white leading-none truncate", isRight ? "order-1" : "order-none")}>{hero.name}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-800 text-slate-300">
                                        {step.totalScore} pts
                                    </Badge>
                                </div>

                                {/* Detail Badges */}
                                <div className={cn("flex flex-wrap gap-1 mt-1", isRight ? "justify-end" : "justify-start")}>
                                    {step.details && step.details.length > 0 ? (
                                        step.details.slice(0, 3).map((detail, i) => renderDetailBadge(detail, i))
                                    ) : (
                                        <span className="text-[10px] text-slate-500 italic">No specific analysis</span>
                                    )}
                                </div>

                                {/* Enhanced Analysis Column - Show slot context and strategy note inline */}
                                {analysis && (step.isMe || showAlternatives) && (
                                    <div className={cn("mt-2 pt-2 border-t border-slate-800/50", isRight ? "text-right" : "text-left")}>
                                        <div className="text-[10px] text-indigo-400/80 flex items-center gap-1 mb-1" style={{ justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
                                            <span>\ud83d\udcca</span>
                                            <span>{analysis.slotContext}</span>
                                        </div>
                                        {analysis.strategyNote && (
                                            <div className="text-[10px] text-amber-400/70 italic" style={{ textAlign: isRight ? 'right' : 'left' }}>
                                                {analysis.strategyNote}
                                            </div>
                                        )}
                                        {/* Why Not Alternatives - inline summary */}
                                        {analysis.whyNotAlternatives && analysis.whyNotAlternatives.length > 0 && (
                                            <div className={cn("text-[9px] text-slate-500 mt-1 flex flex-wrap gap-1", isRight ? "justify-end" : "justify-start")}>
                                                {analysis.whyNotAlternatives.slice(0, 2).map((alt, i) => (
                                                    <span key={i} className="bg-slate-800/50 px-1 py-0.5 rounded">
                                                        \u2717 {alt.heroName}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full h-full text-slate-600 font-bold uppercase tracking-widest text-xs p-4">
                        Pick {index + 1}
                    </div>
                )}
            </div>
        )
    }

    // Helper to render Ban Slot
    const renderBanSlot = (step: DraftStep | null, index: number) => {
        const hero = step?.heroId ? heroMap.get(step.heroId) : null
        return (
            <div key={index} className="w-12 h-12 bg-slate-900 border border-slate-700 rounded overflow-hidden flex items-center justify-center relative group">
                {step && hero ? (
                    <>
                        <img src={hero.icon_url} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                        <div className="absolute inset-0 bg-red-500/10 border border-red-500/30" />
                        {step.details[0] && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/80 transition-opacity">
                                <span className="text-[8px] text-center text-white px-1 leading-tight">{step.details[0].reason}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <Ban className="w-4 h-4 text-slate-700" />
                )}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col p-4 w-full animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex flex-col gap-3 mb-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button size="icon" variant="outline" onClick={() => { setIsSimulated(false); setIsPlaying(false); }}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h4 className="font-bold text-white text-lg flex items-center gap-2">
                                Draft Simulation
                                <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">{selectedStrategy?.name}</Badge>
                            </h4>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                {isPlaying ? <span className="text-emerald-400 flex items-center gap-1"><Play className="w-3 h-3" /> Simulating...</span> : "Comparison Mode"}
                                <span>•</span>
                                {simulation.length} Steps Calculated
                            </div>
                        </div>
                    </div>

                    {/* Re-Run Controls */}
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => startSimulation()}>
                            <RotateCcw className="w-3 h-3 mr-2" />
                            Re-Run
                        </Button>
                    </div>
                </div>

                {/* Strategy Details Expansion */}
                {selectedStrategy && (
                    <div className="flex items-start gap-12 pt-4 border-t border-slate-800/50">
                        {/* CORE HEROES */}
                        <div className="flex flex-col gap-3">
                            <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> Core Heroes
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {strategyCoreIds.length > 0 ? strategyCoreIds.map(hid => {
                                    const h = heroMap.get(hid)
                                    if (!h) return null
                                    return (
                                        <div key={hid} className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-indigo-500/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 shadow-sm">
                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-sm text-slate-200 font-bold">{h.name}</span>
                                        </div>
                                    )
                                }) : <span className="text-xs text-slate-600 italic">None defined</span>}
                            </div>
                        </div>

                        {/* AVOID HEROES */}
                        <div className="flex flex-col gap-3">
                            <div className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                <Ban className="w-4 h-4" /> Avoid Heroes
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {strategyAvoidIds.length > 0 ? strategyAvoidIds.map(hid => {
                                    const h = heroMap.get(hid)
                                    if (!h) return null
                                    return (
                                        <div key={hid} className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all text-slate-400 hover:text-red-400">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 shadow-sm">
                                                <img src={h.icon_url} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-sm font-bold decoration-slice">{h.name}</span>
                                        </div>
                                    )
                                }) : <span className="text-xs text-slate-600 italic">None defined</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN BOARD */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* BLUE TEAM COLUMN */}
                <div className="w-1/2 flex flex-col gap-2">
                    {/* Header */}
                    <div className="p-3 bg-blue-950/40 border border-blue-500/20 rounded-lg flex items-center justify-between">
                        <span className="font-bold text-blue-400 text-lg">{blueTeamName}</span>
                        <Badge className="bg-blue-600 text-white hover:bg-blue-600">BLUE</Badge>
                    </div>

                    {/* Bans Row */}
                    <div className="flex gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800/50 justify-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase self-center mr-2">Bans</span>
                        {boardState.blueBans.map((step, i) => renderBanSlot(step, i))}
                    </div>

                    {/* Picks Stack */}
                    <ScrollArea className="flex-1 pr-2">
                        <div className="pb-4">
                            {boardState.bluePicks.map((step, i) => renderPickSlot(step, i, false))}
                        </div>
                    </ScrollArea>
                </div>

                {/* RED TEAM COLUMN */}
                <div className="w-1/2 flex flex-col gap-2">
                    {/* Header */}
                    <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-lg flex items-center justify-between flex-row-reverse">
                        <span className="font-bold text-red-400 text-lg">{redTeamName}</span>
                        <Badge className="bg-red-600 text-white hover:bg-red-600">RED</Badge>
                    </div>

                    {/* Bans Row */}
                    <div className="flex gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800/50 justify-end">
                        {boardState.redBans.map((step, i) => renderBanSlot(step, i))}
                        <span className="text-[10px] font-bold text-slate-500 uppercase self-center ml-2">Bans</span>
                    </div>

                    {/* Picks Stack */}
                    <ScrollArea className="flex-1 pl-2" dir="rtl">
                        <div className="pb-4" dir="ltr">
                            {boardState.redPicks.map((step, i) => renderPickSlot(step, i, true))}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* CEREBRO AI ADVISOR PANEL */}
            <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${isAdvisorOpen ? 'h-72' : 'h-12'}`}>
                <div
                    className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors"
                    onClick={() => setIsAdvisorOpen(!isAdvisorOpen)}
                >
                    <div className="flex items-center gap-2">
                        <Brain className={`w-5 h-5 text-indigo-400 ${isAdvisorOpen ? 'animate-pulse' : ''}`} />
                        <h3 className="font-bold text-indigo-100 tracking-wider">CEREBRO AI</h3>
                        <span className="text-xs text-slate-500 ml-2 font-mono">[SIMULATION ANALYSIS]</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-400">
                            {simulation.length} Steps • {simulation.filter(s => s.isMe).length} My Picks
                        </Badge>
                        {isAdvisorOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Step List (Left) */}
                    <div className="w-1/3 border-r border-slate-800 overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {simulation.map((step, idx) => {
                                const hero = step.heroId ? heroMap.get(step.heroId) : null
                                const isSelected = selectedStepForAdvisor === idx
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedStepForAdvisor(isSelected ? null : idx)}
                                        className={cn(
                                            "w-full p-2 rounded-lg flex items-center gap-2 text-left transition-all",
                                            isSelected
                                                ? "bg-indigo-950/50 border border-indigo-500/50"
                                                : "bg-slate-800/50 border border-transparent hover:bg-slate-800 hover:border-slate-700",
                                            step.isMe ? "ring-1 ring-blue-500/20" : ""
                                        )}
                                    >
                                        <div className={cn(
                                            "text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0",
                                            step.type === 'BAN' ? "bg-red-900/50 text-red-400" : "bg-emerald-900/50 text-emerald-400"
                                        )}>
                                            {step.step}
                                        </div>
                                        {hero && (
                                            <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-600 shrink-0">
                                                <img src={hero.icon_url} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className={cn(
                                                    "text-xs font-bold truncate",
                                                    step.side === 'BLUE' ? "text-blue-400" : "text-red-400"
                                                )}>
                                                    {step.side}
                                                </span>
                                                <span className="text-[10px] text-slate-500">{step.type}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate">
                                                {hero?.name || 'Pending'}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-slate-700">
                                            {step.totalScore}
                                        </Badge>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Detail View (Right) */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        {selectedStepForAdvisor !== null && simulation[selectedStepForAdvisor] ? (() => {
                            const step = simulation[selectedStepForAdvisor]
                            const hero = step.heroId ? heroMap.get(step.heroId) : null
                            const analysis = step.analysisBreakdown

                            return (
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="flex items-center gap-4">
                                        {hero && (
                                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500">
                                                <img src={hero.icon_url} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-bold text-white text-lg">{hero?.name || 'Unknown'}</div>
                                            <div className="text-sm text-slate-400">
                                                Step {step.step} • {step.side} {step.type} • Score: {step.totalScore}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Analysis Breakdown */}
                                    {analysis && (
                                        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                                            <div className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                                                <Target className="w-3 h-3" />
                                                {analysis.slotContext}
                                            </div>
                                            {analysis.strategyNote && (
                                                <div className="text-xs text-amber-400/80 italic">
                                                    📝 {analysis.strategyNote}
                                                </div>
                                            )}
                                            {analysis.countersEnemyPicks && analysis.countersEnemyPicks.length > 0 && (
                                                <div className="text-xs text-rose-400">
                                                    ⚔️ Counter: {analysis.countersEnemyPicks.map(c => `${c.heroName} (${c.winRate}%)`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Scoring Details */}
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-2">Scoring Breakdown:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {step.details.map((detail, i) => renderDetailBadge(detail, i))}
                                        </div>
                                    </div>

                                    {/* Top Alternatives */}
                                    {step.topCandidates && step.topCandidates.length > 1 && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 mb-2">Alternatives Considered:</div>
                                            <div className="space-y-1">
                                                {step.topCandidates.slice(1, 4).map((alt, i) => {
                                                    const altHero = heroMap.get(alt.heroId)
                                                    const whyNot = analysis?.whyNotAlternatives?.find(w => w.heroName === altHero?.name)
                                                    return (
                                                        <div key={i} className="flex items-center gap-2 bg-slate-800/30 rounded px-2 py-1">
                                                            {altHero && (
                                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-700">
                                                                    <img src={altHero.icon_url} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <span className="text-xs text-slate-300">{altHero?.name || 'Unknown'}</span>
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-700 text-slate-500">
                                                                {alt.score}
                                                            </Badge>
                                                            {whyNot && (
                                                                <span className="text-[10px] text-slate-500 italic ml-auto">
                                                                    ✗ {whyNot.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })() : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                <Brain className="w-8 h-8 opacity-30" />
                                <span className="text-sm">คลิกที่ Step ด้านซ้ายเพื่อดูรายละเอียด</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
