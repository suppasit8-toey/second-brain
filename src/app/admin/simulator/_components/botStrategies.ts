import { Hero } from '@/utils/types'
import { STANDARD_ROLES, normalizeRole, resolveTeamRoles } from '../recommendation-utils'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface DraftPlan {
    side: 'BLUE' | 'RED'
    primaryPlan: {
        targetComposition: CompositionType
        picks: PlannedPick[]
        bans: PlannedBan[]
        keyPickIndex: number // Pick index ที่สำคัญที่สุด (RED=3, BLUE=4)
    }
    backupPlans: BackupPlan[]
    flexPicks: string[] // Hero IDs ที่ Flex ได้หลาย Role
}

export interface PlannedPick {
    priority: number
    targetRole: string
    preferredHeroes: string[] // Hero IDs in priority order
    reasoning: string
}

export interface PlannedBan {
    priority: number
    targetHeroes: string[] // Hero IDs in priority order
    reasoning: string
}

export interface BackupPlan {
    trigger: BackupTrigger
    alternativePicks: string[]
    reasoning: string
}

export type BackupTrigger =
    | 'KEY_HERO_BANNED'
    | 'KEY_HERO_PICKED'
    | 'COUNTER_EXPOSED'
    | 'COMPOSITION_BROKEN'
    | 'FLEX_OPPORTUNITY'

export type CompositionType = 'Dive' | 'Poke' | 'Protect' | 'Split' | 'AOE' | 'Balanced'

export interface HeroPoolAnalysis {
    ourPool: {
        byRole: Record<string, Hero[]>
        flexHeroes: Hero[]
        comfortPicks: Hero[] // ตัวที่ทีมถนัด (based on teamStats)
    }
    enemyPool: {
        byRole: Record<string, Hero[]>
        likelyPicks: Hero[] // ตัวที่น่าจะเลือก
        threats: Hero[] // ตัวที่น่ากลัว
    }
    available: Hero[]
    bannedIds: string[]
    pickedIds: string[]
}

export interface MatchupData {
    heroId: string
    enemyId: string
    winRate: number
    games: number
}

export interface TeamStats {
    heroStats: Record<string, {
        picks: number
        wins: number
        roleStats?: Record<string, { picks: number; wins: number }>
    }>
}

// =============================================================================
// DRAFT PLAN CREATION
// =============================================================================

/**
 * สร้างแผน Draft ตั้งแต่เริ่มเกม
 */
export function createDraftPlan(
    side: 'BLUE' | 'RED',
    ourTeamStats: TeamStats | null,
    enemyTeamStats: TeamStats | null,
    matchups: MatchupData[],
    availableHeroes: Hero[]
): DraftPlan {
    console.log(`🤖 Creating Draft Plan for ${side} side...`)

    // Determine Key Pick Index based on side
    // RED: Counter at Pick 3 (phase 1), BLUE: Counter at Pick 4 (phase 2)
    const keyPickIndex = side === 'RED' ? 3 : 4

    // Analyze optimal composition
    const targetComp = analyzeOptimalComposition(ourTeamStats, enemyTeamStats)

    // Create pick plan for each role
    const picks = createPickPlan(side, ourTeamStats, targetComp, availableHeroes, keyPickIndex)

    // Create ban plan
    const bans = createBanPlan(side, enemyTeamStats, matchups, picks, keyPickIndex)

    // Create backup plans
    const backupPlans = createBackupPlans(side, ourTeamStats, picks, availableHeroes)

    // Identify flex picks
    const flexPicks = identifyFlexPicks(ourTeamStats, availableHeroes)

    const plan: DraftPlan = {
        side,
        primaryPlan: {
            targetComposition: targetComp,
            picks,
            bans,
            keyPickIndex
        },
        backupPlans,
        flexPicks
    }

    console.log(`🤖 Draft Plan created: Target=${targetComp}, KeyPick=${keyPickIndex}`)
    return plan
}

/**
 * วิเคราะห์ว่าควรเล่น Composition แบบไหน
 */
function analyzeOptimalComposition(
    ourStats: TeamStats | null,
    enemyStats: TeamStats | null
): CompositionType {
    // Default to Balanced if no data
    if (!ourStats) return 'Balanced'

    // Analyze our team's strongest composition based on past games
    // This is a simplified version - in production would analyze win rates per comp
    const heroCount = Object.keys(ourStats.heroStats || {}).length
    if (heroCount < 5) return 'Balanced'

    // Check for composition tendencies based on hero types
    // For now return Balanced; in full implementation would analyze damage types, mobility, etc.
    return 'Balanced'
}

/**
 * สร้างแผน Pick สำหรับแต่ละ Role
 */
function createPickPlan(
    side: 'BLUE' | 'RED',
    teamStats: TeamStats | null,
    targetComp: CompositionType,
    heroes: Hero[],
    keyPickIndex: number
): PlannedPick[] {
    const picks: PlannedPick[] = []

    // Priority order based on side
    // RED side picks: R1, R2, R3, R4, R5 (indices 1,2,3,4,5 for RED)
    // BLUE side picks: B1, B2, B3, B4, B5 (indices 1,2,3,4,5 for BLUE)

    STANDARD_ROLES.forEach((role, idx) => {
        const roleHeroes = heroes.filter(h =>
            h.main_position?.some(pos => normalizeRole(pos) === role)
        )

        // Sort by team comfort (games played in that role)
        const sorted = roleHeroes.sort((a, b) => {
            const aStats = teamStats?.heroStats?.[a.id]?.roleStats?.[role]
            const bStats = teamStats?.heroStats?.[b.id]?.roleStats?.[role]
            const aScore = aStats ? aStats.picks * (aStats.wins / aStats.picks || 0.5) : 0
            const bScore = bStats ? bStats.picks * (bStats.wins / bStats.picks || 0.5) : 0
            return bScore - aScore
        })

        picks.push({
            priority: idx + 1,
            targetRole: role,
            preferredHeroes: sorted.slice(0, 5).map(h => h.id),
            reasoning: `Fill ${role} role for ${targetComp} composition`
        })
    })

    // Mark counter-pick slot
    if (picks[keyPickIndex - 1]) {
        picks[keyPickIndex - 1].reasoning = `COUNTER PICK SLOT - Pick best counter for enemy composition`
    }

    return picks
}

/**
 * สร้างแผน Ban
 */
function createBanPlan(
    side: 'BLUE' | 'RED',
    enemyStats: TeamStats | null,
    matchups: MatchupData[],
    picks: PlannedPick[],
    keyPickIndex: number
): PlannedBan[] {
    const bans: PlannedBan[] = []

    // Ban 1-2: Target enemy's comfort picks
    if (enemyStats?.heroStats) {
        const enemyComfortPicks = Object.entries(enemyStats.heroStats)
            .sort((a, b) => b[1].picks - a[1].picks)
            .slice(0, 4)
            .map(([id]) => id)

        bans.push({
            priority: 1,
            targetHeroes: enemyComfortPicks.slice(0, 2),
            reasoning: 'Ban enemy comfort picks (Phase 1)'
        })
        bans.push({
            priority: 2,
            targetHeroes: enemyComfortPicks.slice(2, 4),
            reasoning: 'Ban enemy comfort picks (Phase 1)'
        })
    }

    // Ban 3-4: Protection bans for our key pick
    // Find heroes that counter our planned key pick
    const keyPickHeroIds = picks[keyPickIndex - 1]?.preferredHeroes || []
    const countersToKeyPick = findCountersToHeroes(keyPickHeroIds, matchups)

    bans.push({
        priority: 3,
        targetHeroes: countersToKeyPick.slice(0, 2),
        reasoning: `Protect our Pick ${keyPickIndex} from counters (Phase 2 Ban)`
    })
    bans.push({
        priority: 4,
        targetHeroes: countersToKeyPick.slice(2, 4),
        reasoning: `Protect our Pick ${keyPickIndex} from counters (Phase 2 Ban)`
    })

    return bans
}

/**
 * สร้าง Backup Plans
 */
function createBackupPlans(
    side: 'BLUE' | 'RED',
    teamStats: TeamStats | null,
    picks: PlannedPick[],
    heroes: Hero[]
): BackupPlan[] {
    const backups: BackupPlan[] = []

    // Backup 1: Key hero banned
    backups.push({
        trigger: 'KEY_HERO_BANNED',
        alternativePicks: findAlternativesForRole(picks[0]?.targetRole || 'Jungle', heroes, teamStats),
        reasoning: 'Primary hero for key role was banned'
    })

    // Backup 2: Key hero picked by enemy
    backups.push({
        trigger: 'KEY_HERO_PICKED',
        alternativePicks: findAlternativesForRole(picks[0]?.targetRole || 'Jungle', heroes, teamStats),
        reasoning: 'Enemy took our preferred hero'
    })

    // Backup 3: Flex opportunity
    backups.push({
        trigger: 'FLEX_OPPORTUNITY',
        alternativePicks: heroes.filter(h => (h.main_position?.length || 0) >= 2).map(h => h.id).slice(0, 5),
        reasoning: 'Opportunity to pick flex hero that hides information'
    })

    return backups
}

/**
 * หาตัว Flex ที่เล่นได้หลาย Role
 */
function identifyFlexPicks(teamStats: TeamStats | null, heroes: Hero[]): string[] {
    return heroes
        .filter(h => (h.main_position?.length || 0) >= 2)
        .sort((a, b) => {
            const aStats = teamStats?.heroStats?.[a.id]
            const bStats = teamStats?.heroStats?.[b.id]
            return (bStats?.picks || 0) - (aStats?.picks || 0)
        })
        .slice(0, 10)
        .map(h => h.id)
}

// =============================================================================
// HERO POOL ANALYSIS
// =============================================================================

/**
 * วิเคราะห์ Hero Pool ทั้ง 2 ฝั่ง
 */
export function analyzeHeroPools(
    allHeroes: Hero[],
    ourPicks: string[],
    enemyPicks: string[],
    bans: string[],
    ourTeamStats: TeamStats | null,
    enemyTeamStats: TeamStats | null
): HeroPoolAnalysis {
    const pickedIds = [...ourPicks, ...enemyPicks]
    const bannedIds = bans
    const unavailableIds = [...pickedIds, ...bannedIds]

    // Available heroes
    const available = allHeroes.filter(h => !unavailableIds.includes(h.id))

    // Our pool by role
    const ourPool: HeroPoolAnalysis['ourPool'] = {
        byRole: {},
        flexHeroes: [],
        comfortPicks: []
    }

    STANDARD_ROLES.forEach(role => {
        ourPool.byRole[role] = available.filter(h =>
            h.main_position?.some(pos => normalizeRole(pos) === role)
        )
    })

    ourPool.flexHeroes = available.filter(h => (h.main_position?.length || 0) >= 2)

    if (ourTeamStats?.heroStats) {
        ourPool.comfortPicks = available
            .filter(h => ourTeamStats.heroStats[h.id]?.picks > 0)
            .sort((a, b) =>
                (ourTeamStats.heroStats[b.id]?.picks || 0) -
                (ourTeamStats.heroStats[a.id]?.picks || 0)
            )
            .slice(0, 10)
    }

    // Enemy pool analysis
    const enemyPool: HeroPoolAnalysis['enemyPool'] = {
        byRole: {},
        likelyPicks: [],
        threats: []
    }

    STANDARD_ROLES.forEach(role => {
        enemyPool.byRole[role] = available.filter(h =>
            h.main_position?.some(pos => normalizeRole(pos) === role)
        )
    })

    if (enemyTeamStats?.heroStats) {
        enemyPool.likelyPicks = available
            .filter(h => enemyTeamStats.heroStats[h.id]?.picks > 0)
            .sort((a, b) =>
                (enemyTeamStats.heroStats[b.id]?.picks || 0) -
                (enemyTeamStats.heroStats[a.id]?.picks || 0)
            )
            .slice(0, 10)

        // Threats = high win rate heroes that enemy plays
        enemyPool.threats = available
            .filter(h => {
                const stats = enemyTeamStats.heroStats[h.id]
                return stats && stats.picks >= 2 && (stats.wins / stats.picks) > 0.6
            })
            .slice(0, 5)
    }

    return {
        ourPool,
        enemyPool,
        available,
        bannedIds,
        pickedIds
    }
}

// =============================================================================
// BACKUP TRIGGER DETECTION
// =============================================================================

/**
 * ตรวจสอบว่าต้องใช้ Backup Plan หรือไม่
 */
export function checkBackupTrigger(
    plan: DraftPlan,
    currentBans: string[],
    enemyPicks: string[],
    ourPicks: string[]
): BackupTrigger | null {
    if (!plan.primaryPlan.picks.length) return null

    // Check if key heroes were banned
    const keyPickHeroes = plan.primaryPlan.picks[plan.primaryPlan.keyPickIndex - 1]?.preferredHeroes || []
    const keyHeroesBanned = keyPickHeroes.filter(id => currentBans.includes(id))
    if (keyHeroesBanned.length >= 2) {
        return 'KEY_HERO_BANNED'
    }

    // Check if key heroes were picked by enemy
    const keyHeroesPicked = keyPickHeroes.filter(id => enemyPicks.includes(id))
    if (keyHeroesPicked.length >= 2) {
        return 'KEY_HERO_PICKED'
    }

    // Check if our composition is broken (missing too many roles)
    const filledRoles = resolveTeamRoles(ourPicks, [])
    const expectedRolesAtThisPoint = Math.min(ourPicks.length, 5)
    if (filledRoles.size < expectedRolesAtThisPoint - 1 && ourPicks.length >= 3) {
        return 'COMPOSITION_BROKEN'
    }

    return null
}

/**
 * Adapt แผนตามสถานการณ์
 */
export function adaptPlan(
    trigger: BackupTrigger,
    currentPlan: DraftPlan,
    analysis: HeroPoolAnalysis
): DraftPlan {
    console.log(`🤖 Adapting plan due to: ${trigger}`)

    const backup = currentPlan.backupPlans.find(b => b.trigger === trigger)
    if (!backup) return currentPlan

    // Create new plan with backup picks integrated
    const newPlan = { ...currentPlan }

    // Update the key pick slot with backup alternatives
    if (newPlan.primaryPlan.picks[currentPlan.primaryPlan.keyPickIndex - 1]) {
        newPlan.primaryPlan.picks[currentPlan.primaryPlan.keyPickIndex - 1].preferredHeroes = backup.alternativePicks
    }

    console.log(`🤖 Plan adapted: Using ${backup.alternativePicks.length} alternative picks`)
    return newPlan
}

// =============================================================================
// COUNTER-PICK LOGIC
// =============================================================================

/**
 * หา Counter ที่ดีที่สุดสำหรับ enemy team
 */
export function findBestCounter(
    enemyPicks: string[],
    matchups: MatchupData[],
    availableHeroes: Hero[]
): Hero | null {
    if (enemyPicks.length === 0) return null

    const counterScores: Record<string, number> = {}

    // Calculate counter score for each available hero
    availableHeroes.forEach(hero => {
        let score = 0
        enemyPicks.forEach(enemyId => {
            // Find matchup data
            const matchup = matchups.find(m =>
                m.heroId === hero.id && m.enemyId === enemyId
            )
            if (matchup && matchup.games >= 3) {
                // Score = win rate above 50%
                score += (matchup.winRate - 50) * (matchup.games / 10)
            }
        })
        counterScores[hero.id] = score
    })

    // Find best counter (highest score)
    const bestHeroId = Object.entries(counterScores)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0]

    return availableHeroes.find(h => h.id === bestHeroId) || null
}

/**
 * หา Heroes ที่ Counter ตัวที่กำหนด
 */
function findCountersToHeroes(heroIds: string[], matchups: MatchupData[]): string[] {
    const counterScores: Record<string, number> = {}

    heroIds.forEach(heroId => {
        matchups
            .filter(m => m.enemyId === heroId && m.winRate > 55 && m.games >= 3)
            .forEach(m => {
                counterScores[m.heroId] = (counterScores[m.heroId] || 0) + (m.winRate - 50)
            })
    })

    return Object.entries(counterScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id)
}

/**
 * หา Alternatives สำหรับ Role
 */
function findAlternativesForRole(
    role: string,
    heroes: Hero[],
    teamStats: TeamStats | null
): string[] {
    return heroes
        .filter(h => h.main_position?.some(pos => normalizeRole(pos) === role))
        .sort((a, b) => {
            const aStats = teamStats?.heroStats?.[a.id]
            const bStats = teamStats?.heroStats?.[b.id]
            return (bStats?.picks || 0) - (aStats?.picks || 0)
        })
        .slice(0, 5)
        .map(h => h.id)
}

/**
 * หา "Denial Pick" (แย่งตัวเก่งฝ่ายตรงข้าม)
 * เงื่อนไข:
 * 1. ศัตรูเล่นเก่งมาก (Games > 10, WR > 55%)
 * 2. ทีมเราก็เล่นได้ (Games > 0)
 * 3. ยังไม่ถูกแบน/เลือก
 */
export function findDenialPick(
    enemyStats: TeamStats | null,
    ourStats: TeamStats | null,
    availableHeroes: Hero[]
): Hero | null {
    if (!enemyStats?.heroStats) return null

    // 1. Identify Enemy's Best Heroes
    const enemyGodHeroes = Object.entries(enemyStats.heroStats)
        .filter(([_, stats]) => stats.picks >= 5 && (stats.wins / stats.picks) >= 0.55)
        .sort((a, b) => (b[1].wins / b[1].picks) - (a[1].wins / a[1].picks))

    for (const [enemyHeroId, enemyStat] of enemyGodHeroes) {
        // 2. Check if available (using the filtered list passed in)
        const hero = availableHeroes.find(h => h.id === enemyHeroId)
        if (!hero) continue

        // 3. Check if WE can play it
        const ourStat = ourStats?.heroStats?.[enemyHeroId]

        if (ourStats && (!ourStat || ourStat.picks < 1)) {
            continue
        }

        console.log(`🤖 [STRATEGY] Denial Pick Found! Stealing ${hero.name} (Enemy: ${enemyStat.picks}g ${Math.round((enemyStat.wins / enemyStat.picks) * 100)}% WR)`)
        return hero
    }

    return null
}

// =============================================================================
// DECISION HELPERS
// =============================================================================

/**
 * ดึง Pick/Ban ที่วางแผนไว้สำหรับ Step ปัจจุบัน
 */
export function getPlannedAction(
    plan: DraftPlan,
    stepIndex: number,
    phase: 'BAN' | 'PICK',
    myPickCount: number,
    myBanCount: number
): string[] {
    if (phase === 'BAN') {
        const banPlan = plan.primaryPlan.bans[myBanCount]
        return banPlan?.targetHeroes || []
    } else {
        const pickPlan = plan.primaryPlan.picks[myPickCount]
        return pickPlan?.preferredHeroes || []
    }
}

/**
 * ตรวจสอบว่า Action ยังทำได้หรือไม่
 */
export function isActionValid(
    heroIds: string[],
    analysis: HeroPoolAnalysis
): string | null {
    // Return first available hero from the list
    for (const id of heroIds) {
        if (!analysis.bannedIds.includes(id) && !analysis.pickedIds.includes(id)) {
            return id
        }
    }
    return null
}
