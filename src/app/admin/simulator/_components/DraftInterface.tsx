'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { DraftGame, DraftMatch, Hero } from '@/utils/types'
import { useDraftEngine } from './useDraftEngine'
import { DRAFT_SEQUENCE } from '../constants'
import { getRecommendations } from '../recommendations'
import { getHeroesByVersion } from '../../heroes/actions'
import { getCerebroStats } from '../../cerebro/actions'
import { getMatchTeamPools, MatchTeamPoolData } from '../teamPoolActions'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Pause, Play, Check, ShieldBan, Brain, ChevronUp, ChevronDown, RefreshCw, Users, Globe, Swords, Link as LinkIcon, User, Target, Settings2, Home, Eye, Zap, Share2, Shield, Ban } from 'lucide-react'
import Image from 'next/image'
import PostDraftResult from '@/components/draft/PostDraftResult'
import { Input } from '@/components/ui/input'
import { useDraftBot } from './useDraftBot'
import DraftSuggestionPanel from './DraftSuggestionPanel'
import DraftTeamPanel from './DraftTeamPanel'
import AnalysisModeManager from '../../cerebro/_components/AnalysisModeManager'
import { DEFAULT_MODES } from '../../cerebro/constants'

export interface DraftControls {
    togglePause: () => void;
    isPaused: boolean;
}

interface DraftInterfaceProps {
    match: DraftMatch;
    game: DraftGame;
    initialHeroes: Hero[];
    teamAGlobalBans?: string[];
    teamBGlobalBans?: string[];
    onReset?: () => void;
    onPausedChange?: (isPaused: boolean) => void;
}

const DraftInterface = forwardRef<DraftControls, DraftInterfaceProps>(({ match, game, initialHeroes, teamAGlobalBans = [], teamBGlobalBans = [], onReset, onPausedChange }, ref) => {
    const { state, currentStep, lockIn, togglePause } = useDraftEngine()

    const [recommendations, setRecommendations] = useState<any>({ analyst: [], history: [], hybrid: [], smartBan: [] })
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
    const [currentTab, setCurrentTab] = useState('hero')
    const [aiTab, setAiTab] = useState('suggestions')

    // Default to 'board' on mobile
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setCurrentTab('board')
        }
    }, [])

    // Suggestion Panels State
    const [blueSuggestions, setBlueSuggestions] = useState<any[]>([])
    const [redSuggestions, setRedSuggestions] = useState<any[]>([])
    const [isBlueSuggestLoading, setIsBlueSuggestLoading] = useState(false)
    const [isRedSuggestLoading, setIsRedSuggestLoading] = useState(false)

    useImperativeHandle(ref, () => ({
        togglePause,
        isPaused: state.isPaused
    }), [togglePause, state.isPaused])

    useEffect(() => {
        if (onPausedChange) {
            onPausedChange(state.isPaused)
        }
    }, [state.isPaused, onPausedChange])

    // Initialize Bot
    // Analysis Mode State
    const [currentMode, setCurrentMode] = useState(DEFAULT_MODES[0])

    // Calculate global bans for bot (heroes played in previous games by opponent Team A)
    const botOpponentGlobalBans = useMemo(() => {
        const previousGames = match.games?.filter(g => g.winner) || []
        const playedHeroesTeamA = new Set<string>()

        previousGames.forEach(prevGame => {
            const pGame = match.games?.find(g => g.id === prevGame.id)
            if (!pGame?.picks) return
            const sideOfA = pGame.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'
            pGame.picks.forEach(p => {
                if (p.type === 'PICK' && p.side === sideOfA) {
                    playedHeroesTeamA.add(p.hero_id)
                }
            })
        })

        return Array.from(playedHeroesTeamA)
    }, [match.games, match.team_a_name])

    const isBotBlue = game.blue_team_name === match.team_b_name
    const botSide = isBotBlue ? 'BLUE' : 'RED'
    const isBotLoading = botSide === 'BLUE' ? isBlueSuggestLoading : isRedSuggestLoading

    useDraftBot({
        game,
        match,
        draftState: { ...state, currentStep, stepIndex: state.stepIndex },
        onLockIn: lockIn,
        isPaused: state.isPaused,
        initialHeroes,
        analysisConfig: currentMode,
        blueSuggestions,
        redSuggestions,
        opponentGlobalBans: botOpponentGlobalBans,
        suggestionLoading: isBotLoading
    })

    const [selectedHero, setSelectedHero] = useState<Hero | null>(null)
    const [metaFilter, setMetaFilter] = useState('ALL')
    const [counterFilter, setCounterFilter] = useState('ALL')
    const [counterTeamFilter, setCounterTeamFilter] = useState<'ALL' | 'TEAM_A' | 'TEAM_B'>('ALL')
    const [showSummary, setShowSummary] = useState(false)
    const [manualLanes, setManualLanes] = useState<Record<string, string[]>>({})
    const [teamStats, setTeamStats] = useState<Record<string, any>>({})
    const [heroMap, setHeroMap] = useState<any>(null)
    const [teamPoolFilter, setTeamPoolFilter] = useState<'ALL' | 'TEAM_A' | 'TEAM_B'>('ALL')
    const [matchTeamPools, setMatchTeamPools] = useState<{ teamA: MatchTeamPoolData, teamB: MatchTeamPoolData } | null>(null)
    const [isLoadingTeamPools, setIsLoadingTeamPools] = useState(false)
    const [teamPoolRoleFilter, setTeamPoolRoleFilter] = useState('ALL')
    const [opponentPoolTeamFilter, setOpponentPoolTeamFilter] = useState<'OPPONENT' | 'TEAM_A' | 'TEAM_B'>('OPPONENT')
    const [opponentPoolRoleFilter, setOpponentPoolRoleFilter] = useState('ALL')
    const [recRoleFilter, setRecRoleFilter] = useState('ALL')
    const [recTypeFilter, setRecTypeFilter] = useState<'PICKS' | 'BANS'>('PICKS')
    const [banPhase, setBanPhase] = useState<'PHASE_1' | 'PHASE_2'>('PHASE_1')
    const [banSide, setBanSide] = useState<'BLUE' | 'RED' | 'ALL'>('ALL')
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(false)

    // Auto-switch to Strategic Bans when in BAN slot, Strategic Picks when in PICK slot
    useEffect(() => {
        if (currentStep?.type === 'BAN') {
            setRecTypeFilter('BANS')
        } else if (currentStep?.type === 'PICK') {
            setRecTypeFilter('PICKS')
        }
    }, [currentStep?.type])

    useEffect(() => {
        const fetchTeamStats = async () => {
            if (!match.version_id || !match.team_a_name || !match.team_b_name) return

            const tId = match.tournament_id || 'ALL'

            // Strip "(Bot)" suffix for fetching stats from scrimmage logs
            const cleanTeamA = match.team_a_name?.replace(/\s*\(Bot\)\s*$/i, '') || match.team_a_name
            const cleanTeamB = match.team_b_name?.replace(/\s*\(Bot\)\s*$/i, '') || match.team_b_name

            try {
                const [statsA, statsB] = await Promise.all([
                    getCerebroStats(match.version_id, 'FULL_SIMULATOR', tId, cleanTeamA),
                    getCerebroStats(match.version_id, 'FULL_SIMULATOR', tId, cleanTeamB)
                ])

                const newStats: Record<string, any> = {}
                // Store with clean team names
                if (statsA) newStats[cleanTeamA] = statsA.stats
                if (statsB) newStats[cleanTeamB] = statsB.stats

                setTeamStats(newStats)
                if (statsA?.heroMap) setHeroMap(statsA.heroMap)
                else if (statsB?.heroMap) setHeroMap(statsB.heroMap)
            } catch (err) {
                console.error("Failed to fetch team stats", err)
            }
        }
        fetchTeamStats()
    }, [match.version_id, match.team_a_name, match.team_b_name, match.tournament_id])

    // Fetch Team Hero Pools from Scrim Logs
    useEffect(() => {
        const fetchTeamPools = async () => {
            if (!match.team_a_name || !match.team_b_name) return

            setIsLoadingTeamPools(true)
            try {
                const result = await getMatchTeamPools(match.team_a_name, match.team_b_name)
                if (result.data) {
                    setMatchTeamPools(result.data)
                }
            } catch (err) {
                console.error("Failed to fetch team pools", err)
            }
            setIsLoadingTeamPools(false)
        }
        fetchTeamPools()
    }, [match.team_a_name, match.team_b_name])

    const handleLaneAssign = (heroId: string, lane: string) => {
        setManualLanes(prev => {
            const current = prev[heroId] || []
            if (current.includes(lane)) {
                return { ...prev, [heroId]: current.filter(l => l !== lane) }
            } else {
                return { ...prev, [heroId]: [...current, lane] }
            }
        })
    }

    // Auto-fill defaults from Roster (Multi-role support)
    useEffect(() => {
        const allPicks = [...Object.values(state.bluePicks), ...Object.values(state.redPicks)].filter(Boolean) as string[]

        setManualLanes(prev => {
            const next = { ...prev }
            let hasChanges = false

            allPicks.forEach(id => {
                if (!next[id]) {
                    const hero = getHero(id)
                    // If hero has main_position stats, use them. Otherwise default empty or 'Mid' etc.
                    // Assuming hero.main_position is string[] from DB/Types
                    if (hero && hero.main_position && hero.main_position.length > 0) {
                        next[id] = hero.main_position
                        hasChanges = true
                    }
                }
            })

            return hasChanges ? next : prev
        })
    }, [state.bluePicks, state.redPicks, initialHeroes])

    const [rosterTeamFilter, setRosterTeamFilter] = useState<'blue' | 'red'>('blue')
    const [rosterRoleFilter, setRosterRoleFilter] = useState<string>('All')

    // Auto-detect which side the selected team is on for Ban Strategy (based on rosterTeamFilter)
    const banStrategySide = useMemo(() => {
        if (rosterTeamFilter === 'blue') {
            return game.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'
        } else {
            return game.blue_team_name === match.team_b_name ? 'BLUE' : 'RED'
        }
    }, [rosterTeamFilter, game.blue_team_name, match.team_a_name, match.team_b_name])

    // Compute Roster Dominance from teamStats - Full Analysis per Role
    // Matches RosterDominanceBoard logic: Signatures, Attack Weakness, Caution/Ban
    const rosterDominanceData = useMemo(() => {
        // Strip "(Bot)" suffix as teamStats is keyed by clean team names
        const rawTeamName = rosterTeamFilter === 'blue' ? match.team_a_name : match.team_b_name
        const currentTeamName = rawTeamName?.replace(/\s*\(Bot\)\s*$/i, '') || rawTeamName
        const stats = teamStats[currentTeamName]

        if (!stats || !heroMap) return { teamName: currentTeamName, roles: [] }

        const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
        const results: any[] = []

        // Helper to get hero info
        const getHeroInfo = (heroId: string) => {
            const h = heroMap[heroId]
            return {
                id: heroId,
                name: h?.name || 'Unknown',
                icon_url: h?.icon_url || ''
            }
        }

        roles.forEach(role => {
            // 1. Signature Picks - Best heroes for this role
            const signatures = Object.entries(stats.heroStats || {})
                .map(([heroId, heroData]: [string, any]) => {
                    const rStats = heroData.roleStats?.[role]
                    if (!rStats || rStats.picks < 1) return null
                    const winRate = (rStats.wins / rStats.picks) * 100
                    return {
                        ...getHeroInfo(heroId),
                        rolePicks: rStats.picks,
                        roleWinRate: winRate
                    }
                })
                .filter(Boolean)
                .sort((a: any, b: any) => b.rolePicks - a.rolePicks || b.roleWinRate - a.roleWinRate)
                .slice(0, 3) // Top 3

            // 2. Lane Matchups - enemies & performance
            const roleMatchups = stats.laneMatchups?.[role] || {}
            const enemyPerformance: any[] = []

            Object.entries(roleMatchups).forEach(([enemyId, myHeroes]: [string, any]) => {
                let totalGames = 0
                let totalWins = 0
                Object.values(myHeroes).forEach((s: any) => {
                    totalGames += s.games
                    totalWins += s.wins
                })

                if (totalGames > 0) {
                    enemyPerformance.push({
                        ...getHeroInfo(enemyId),
                        enemyId,
                        games: totalGames,
                        wins: totalWins,
                        winRate: (totalWins / totalGames) * 100
                    })
                }
            })

            // Attack Weakness = Enemies we dominate (WR >= 50%)
            const targetWeakness = enemyPerformance
                .filter(e => e.games >= 1 && e.winRate >= 50)
                .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
                .slice(0, 3)

            // Caution/Ban = Enemies we struggle against (WR < 50%)
            const avoid = enemyPerformance
                .filter(e => e.games >= 1 && e.winRate < 50)
                .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
                .slice(0, 3)

            results.push({
                role,
                signatures,
                targetWeakness,
                avoid
            })
        })

        return { teamName: currentTeamName, roles: results }
    }, [teamStats, rosterTeamFilter, match.team_a_name, match.team_b_name, heroMap])

    // Filter roster roles based on selected filter
    const filteredRosterRoles = useMemo(() => {
        if (rosterRoleFilter === 'All') return rosterDominanceData.roles
        return rosterDominanceData.roles?.filter((r: any) => r.role === rosterRoleFilter) || []
    }, [rosterDominanceData.roles, rosterRoleFilter])

    // === DRAFT COMPOSITION ANALYSIS (Real-time for both teams) ===
    const [compositionTeamFilter, setCompositionTeamFilter] = useState<'BLUE' | 'RED'>('BLUE')

    const compositionAnalysis = useMemo(() => {
        // Helper function to calculate composition for a list of hero IDs
        const calculateTeamComposition = (heroIds: (string | undefined)[]) => {
            const composition = {
                damage: { Physical: 0, Magic: 0, True: 0, Mixed: 0 },
                powerSpike: { Early: 0, Mid: 0, Late: 0, Balanced: 0 },
                attributes: { control: 0, durability: 0, mobility: 0, offense: 0 }
            }

            const validIds = heroIds.filter(Boolean) as string[]
            if (validIds.length === 0) return composition

            validIds.forEach(heroId => {
                const hero = initialHeroes.find(h => h.id === heroId)
                if (!hero) return

                // Damage Type (from hero.damage_type field)
                const damageType = (hero as any).damage_type as 'Physical' | 'Magic' | 'True' | 'Mixed' | undefined
                if (damageType && composition.damage[damageType] !== undefined) {
                    composition.damage[damageType]++
                }

                // Power Spike (from hero_stats)
                const heroStats = (hero as any).hero_stats?.[0]
                const spike = heroStats?.power_spike || 'Balanced'
                if (composition.powerSpike[spike as keyof typeof composition.powerSpike] !== undefined) {
                    composition.powerSpike[spike as keyof typeof composition.powerSpike]++
                }

                // Attributes (inferred from roles)
                const roles = hero.main_position || []
                roles.forEach((role: string) => {
                    // Tank/Roam = High Durability, Some Control
                    if (['Tank', 'Roam', 'Support'].includes(role)) {
                        composition.attributes.durability += 2
                        composition.attributes.control += 1
                    }
                    // Warrior/Dark Slayer = Balanced
                    if (['Warrior', 'Dark Slayer'].includes(role)) {
                        composition.attributes.durability += 1
                        composition.attributes.offense += 1
                    }
                    // Mage/Mid = Offense + Control
                    if (['Mage', 'Mid'].includes(role)) {
                        composition.attributes.offense += 2
                        composition.attributes.control += 2
                    }
                    // Marksman/Abyssal = High Offense
                    if (['Marksman', 'Abyssal'].includes(role)) {
                        composition.attributes.offense += 3
                    }
                    // Assassin/Jungle = Mobility + Offense
                    if (['Assassin', 'Jungle'].includes(role)) {
                        composition.attributes.mobility += 3
                        composition.attributes.offense += 2
                    }
                })
            })

            return composition
        }

        // Get current picks for both teams
        const blueHeroIds = Object.values(state.bluePicks)
        const redHeroIds = Object.values(state.redPicks)

        return {
            blue: calculateTeamComposition(blueHeroIds),
            red: calculateTeamComposition(redHeroIds)
        }
    }, [state.bluePicks, state.redPicks, initialHeroes])

    // === DRAFT STRATEGY ANALYSIS (From teamStats - Full Simulator data) ===
    const [draftStrategyTeamFilter, setDraftStrategyTeamFilter] = useState<'BLUE' | 'RED'>('BLUE')
    const [draftStrategyTab, setDraftStrategyTab] = useState<'priorities' | 'flex' | 'conditions' | 'counters'>('priorities')

    // Auto-detect which side the selected team is on in the current game
    const draftStrategySide = useMemo(() => {
        // If BLUE team filter is selected, check which side team_a is on
        // If RED team filter is selected, check which side team_b is on
        if (draftStrategyTeamFilter === 'BLUE') {
            // Team A - check if they are on Blue or Red side in this game
            return game.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'
        } else {
            // Team B - check if they are on Blue or Red side in this game
            return game.blue_team_name === match.team_b_name ? 'BLUE' : 'RED'
        }
    }, [draftStrategyTeamFilter, game.blue_team_name, match.team_a_name, match.team_b_name])

    // Helper to get hero info from heroMap
    const getHeroInfoFromMap = (id: string) => {
        const h = heroMap?.[id]
        return h ? { name: h.name, icon: h.icon_url || h.icon } : { name: 'Unknown', icon: '' }
    }

    // Get current team's stats for Draft Strategy
    const draftStrategyStats = useMemo(() => {
        const cleanTeamName = (name: string) => name?.replace(/\s*\(Bot\)\s*$/i, '') || name
        const selectedTeamName = draftStrategyTeamFilter === 'BLUE' ? cleanTeamName(match.team_a_name) : cleanTeamName(match.team_b_name)
        return teamStats[selectedTeamName] || null
    }, [teamStats, draftStrategyTeamFilter, match.team_a_name, match.team_b_name])

    // 1. Pick Order Priority (Most frequent roles per slot)
    const roleTimeline = useMemo(() => {
        if (!draftStrategyStats) return []
        const timeline: any[] = []

        // Get pickOrderStats based on current game side (auto-detected)
        let targetStats = draftStrategyStats.pickOrderStats
        if (draftStrategySide === 'BLUE' && draftStrategyStats.sideStats?.BLUE?.pickOrderStats) {
            targetStats = draftStrategyStats.sideStats.BLUE.pickOrderStats
        } else if (draftStrategySide === 'RED' && draftStrategyStats.sideStats?.RED?.pickOrderStats) {
            targetStats = draftStrategyStats.sideStats.RED.pickOrderStats
        }

        // Iterate potential slots (1-20 for all picks)
        for (let i = 1; i <= 20; i++) {
            const roleData = targetStats?.[i] || {}
            const total = Object.values(roleData).reduce((a: any, b: any) => a + b, 0) as number

            if (total > 0) {
                const topRoles = Object.entries(roleData)
                    .map(([role, count]: [string, any]) => ({ role, count, pct: total > 0 ? (count / total) * 100 : 0 }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 2)

                timeline.push({ slot: i, topRoles, total })
            }
        }
        return timeline
    }, [draftStrategyStats, draftStrategySide])

    // 2. Phase 1 Flex Picks (Heroes played in >= 2 roles)
    const flexPicks = useMemo(() => {
        if (!draftStrategyStats?.heroStats) return []

        const enemyFrequency: Record<string, number> = {}
        const matchupData = draftStrategyStats.matchupStats || {}
        Object.values(matchupData).forEach((enemies: any) => {
            Object.entries(enemies).forEach(([enemyId, data]: [string, any]) => {
                enemyFrequency[enemyId] = (enemyFrequency[enemyId] || 0) + data.games
            })
        })
        const topEnemies = Object.entries(enemyFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id)

        return Object.values(draftStrategyStats.heroStats || {})
            .map((h: any) => {
                const rolesPlayed = Object.keys(h.roleStats || {}).length

                // Calculate Matchup Score
                const strongAgainst: Array<{ id: string; name: string; winRate: number }> = []
                let matchupBonus = 0

                topEnemies.forEach(enemyId => {
                    const mStats = matchupData[h.id]?.[enemyId]
                    if (mStats && mStats.games > 0) {
                        const mWr = (mStats.wins / mStats.games) * 100
                        if (mWr > 50) {
                            strongAgainst.push({
                                id: enemyId,
                                name: getHeroInfoFromMap(enemyId).name,
                                winRate: mWr
                            })
                            matchupBonus += (mWr - 50)
                        }
                    }
                })

                const pickRateScore = Math.min(h.picks, 50)
                const score = (rolesPlayed * 50) + matchupBonus + pickRateScore

                return { ...h, rolesPlayed, strongAgainst, score }
            })
            .filter((h: any) => h.rolesPlayed >= 2 && h.picks > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 8)
    }, [draftStrategyStats, heroMap])

    // 3. Phase 2 Win Conditions (High win-rate late picks)
    const phase2Closers = useMemo(() => {
        if (!draftStrategyStats) return []

        const enemyFrequency: Record<string, number> = {}
        const matchupData = draftStrategyStats.matchupStats || {}
        Object.values(matchupData).forEach((enemies: any) => {
            Object.entries(enemies).forEach(([enemyId, data]: [string, any]) => {
                enemyFrequency[enemyId] = (enemyFrequency[enemyId] || 0) + data.games
            })
        })
        const topEnemies = Object.entries(enemyFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id)

        // Aggregate Phase 2 Candidate Picks (Slots 7-10, 15-18)
        const targetSlots = [7, 8, 9, 10, 15, 16, 17, 18]
        const aggregated: Record<string, number> = {}

        let targetHeroPickStats = draftStrategyStats.heroPickOrderStats
        if (draftStrategySide === 'BLUE' && draftStrategyStats.sideStats?.BLUE?.heroPickOrderStats) {
            targetHeroPickStats = draftStrategyStats.sideStats.BLUE.heroPickOrderStats
        } else if (draftStrategySide === 'RED' && draftStrategyStats.sideStats?.RED?.heroPickOrderStats) {
            targetHeroPickStats = draftStrategyStats.sideStats.RED.heroPickOrderStats
        }

        targetSlots.forEach(slot => {
            const slotData = targetHeroPickStats?.[slot] || {}
            Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                aggregated[heroId] = (aggregated[heroId] || 0) + count
            })
        })

        return Object.entries(aggregated)
            .map(([heroId, count]) => {
                const heroInfo = getHeroInfoFromMap(heroId)
                const hero = draftStrategyStats.heroStats?.[heroId]

                const picks = hero ? hero.picks : count
                const wins = hero ? hero.wins : 0
                const winRate = picks > 0 ? (wins / picks) * 100 : 0

                const strongAgainst: Array<{ id: string; name: string; winRate: number }> = []
                let matchupBonus = 0

                topEnemies.forEach(enemyId => {
                    const mStats = matchupData[heroId]?.[enemyId]
                    if (mStats && mStats.games > 0) {
                        const mWr = (mStats.wins / mStats.games) * 100
                        if (mWr > 50) {
                            strongAgainst.push({
                                id: enemyId,
                                name: getHeroInfoFromMap(enemyId).name,
                                winRate: mWr
                            })
                            matchupBonus += (mWr - 50)
                        }
                    }
                })

                const score = winRate + (matchupBonus / (topEnemies.length || 1))

                return {
                    id: heroId,
                    name: heroInfo.name,
                    icon: heroInfo.icon,
                    count,
                    totalPicks: picks,
                    winRate,
                    score,
                    strongAgainst
                }
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
    }, [draftStrategyStats, draftStrategySide, heroMap])

    // 4. Lane Counters (Position vs Position)
    const laneCounters = useMemo(() => {
        if (!draftStrategyStats?.laneMatchups) return []

        const results: any[] = []
        const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

        roles.forEach(role => {
            const roleMatchups = draftStrategyStats.laneMatchups?.[role] || {}

            // Find Top 3 Enemy Heroes for this Role
            const enemyCounts: Record<string, number> = {}
            Object.keys(roleMatchups).forEach(enemyId => {
                const totalGamesAgainst = Object.values(roleMatchups[enemyId])
                    .reduce((sum: number, s: any) => sum + s.games, 0)
                enemyCounts[enemyId] = totalGamesAgainst
            })

            const topEnemies = Object.entries(enemyCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([id]) => id)

            const enemyAnalysis: any[] = []

            topEnemies.forEach(enemyId => {
                const myPerformance = roleMatchups[enemyId] || {}
                const enemyInfo = getHeroInfoFromMap(enemyId)

                const counters = Object.entries(myPerformance)
                    .map(([myId, s]: [string, any]) => {
                        const myInfo = getHeroInfoFromMap(myId)
                        return {
                            id: myId,
                            name: myInfo.name,
                            icon: myInfo.icon,
                            games: s.games,
                            wins: s.wins,
                            winRate: (s.wins / s.games) * 100
                        }
                    })
                    .filter(c => c.games >= 1 && c.winRate >= 50)
                    .sort((a, b) => b.winRate - a.winRate)
                    .slice(0, 3)

                if (counters.length > 0) {
                    enemyAnalysis.push({
                        enemy: {
                            id: enemyId,
                            name: enemyInfo.name,
                            icon: enemyInfo.icon,
                            games: enemyCounts[enemyId]
                        },
                        counters
                    })
                }
            })

            results.push({ role, matches: enemyAnalysis })
        })

        return results
    }, [draftStrategyStats, heroMap])

    // UI Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRole, setSelectedRole] = useState('All')

    // 1. Calculate Played Heroes for each Team (Global Bans)
    // Find every hero picked by Team A and Team B in previous games of this match
    const previousGames = match.games?.filter(g => g.winner) || [] // Only count completed games

    const playedHeroesTeamA = new Set<string>()
    const playedHeroesTeamB = new Set<string>()

    previousGames.forEach(prevGame => {
        const pGame = match.games?.find(g => g.id === prevGame.id)
        if (!pGame?.picks) return

        // We need to know which side Team A was on in that specific game
        // In our current system, game.blue_team_name / red_team_name stores the names
        const sideOfA = pGame.blue_team_name === match.team_a_name ? 'BLUE' : 'RED'

        pGame.picks.forEach(p => {
            if (p.type === 'PICK') {
                if (p.side === sideOfA) playedHeroesTeamA.add(p.hero_id)
                else playedHeroesTeamB.add(p.hero_id)
            }
        })
    })

    // 2. Map current side (BLUE/RED) to Team A/B
    const currentSide = currentStep?.side
    const blueTeamIsMatchA = game.blue_team_name === match.team_a_name

    // If it's BLUE's turn, who is BLUE?
    const teamOnCurrentSide = currentSide === 'BLUE'
        ? (blueTeamIsMatchA ? 'A' : 'B')
        : (blueTeamIsMatchA ? 'B' : 'A')

    const currentTeamPlayed = Array.from(teamOnCurrentSide === 'A' ? playedHeroesTeamA : playedHeroesTeamB)
    const opponentTeamPlayed = Array.from(teamOnCurrentSide === 'A' ? playedHeroesTeamB : playedHeroesTeamA)

    // SUGGESTED (Green) = My team's global bans (I can't pick them, enemy can, so I should ban them)
    // ENEMY USED (Unobtrusive) = Enemy's global bans (They can't pick them, so I don't need to ban them)
    // Actually the user said: "ตัวที่แนะนำให้แบนจะเป็นตัวที่ สีเเดงเล่นไปแล้ว และ ตัวที่Enemy USED จะเป็นตัวที่ฝั่ง Blue Side เล่นไปแล้ว" (Wait, translating...)
    // "When RED SIDE BAN, suggested bans are heroes RED played, and ENEMY USED are heroes BLUE played."
    // Yes, essentially: Suggested = Current Turn Side's Played Heroes. Opponent = Other Side's Played Heroes.

    const currentGlobalBans = currentTeamPlayed
    const opponentGlobalBans = opponentTeamPlayed

    // Derived Lists for filtering
    const bannedIds = [...state.blueBans, ...state.redBans]
    const pickedIds = [...Object.values(state.bluePicks), ...Object.values(state.redPicks)]

    const isBanPhase = currentStep?.type.includes('BAN')
    const unavailableIds = isBanPhase
        ? [...bannedIds, ...pickedIds, ...opponentGlobalBans] // Can ban global bans, but NOT opponent's global bans (waste)
        : [...bannedIds, ...pickedIds, ...currentGlobalBans] // Cannot pick global bans

    // === STRATEGIC BANS JOINT LOGIC (Shared between Advisor & Right Panel) ===
    // Calculate Strategic Bans for the ACTIVE team
    const calculatedStrategicBans = useMemo(() => {
        if (!currentStep?.side || !match.team_a_name || !match.team_b_name) return []

        // Determine names
        const currentTeamName = currentStep.side === 'BLUE'
            ? game.red_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
            : game.blue_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
        const opponentTeamName = currentStep.side === 'BLUE'
            ? game.blue_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
            : game.red_team_name?.replace(/\s*\(Bot\)\s*$/i, '')

        // Get Opponent Stats
        const opponentStats = teamStats[opponentTeamName || '']
        const autoDetectedSide = currentStep.side
        const opponentPlaysSide = autoDetectedSide === 'BLUE' ? 'BLUE' : 'RED'

        // Helper: Get top heroes
        const getTopHeroesForSlots = (slots: number[]) => {
            const aggregated: Record<string, number> = {}
            const getBanSource = () => {
                if (opponentStats?.sideStats?.[opponentPlaysSide]?.banOrderStats) {
                    return opponentStats.sideStats[opponentPlaysSide].banOrderStats
                }
                return opponentStats?.banOrderStats
            }

            const banSource = getBanSource()
            if (!banSource) return []

            slots.forEach(slot => {
                const slotData = banSource?.[slot] || {}
                Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                    aggregated[heroId] = (aggregated[heroId] || 0) + count
                })
            })

            return Object.entries(aggregated)
                .map(([heroId, count]) => {
                    // Inline hero lookup - use String() to ensure type consistency
                    const heroFromInitial = initialHeroes?.find(h => String(h.id) === String(heroId))
                    const heroFromMap = heroMap?.[heroId]
                    const heroFromStats = opponentStats?.heroStats?.[heroId]

                    const hero = heroFromInitial || {
                        id: heroId,
                        name: heroFromMap?.name || heroFromStats?.name || 'Unknown',
                        icon_url: heroFromMap?.icon_url || heroFromMap?.icon || heroFromStats?.icon || '',
                        main_position: []
                    }

                    return {
                        heroId,
                        count,
                        hero,
                        hasIcon: Boolean(hero.icon_url)
                    }
                })
                .filter(item => item.hero && item.hero.name !== 'Unknown')
                .sort((a, b) => b.count - a.count)
        }

        const rawPhase1Bans = getTopHeroesForSlots([1, 2, 3, 4])
        const rawPhase2Bans = getTopHeroesForSlots([11, 12, 13, 14])

        // Phase 1: Simple historical ban scoring (reduced weight)
        const transformPhase1Bans = (bans: any[]) => bans.map(b => ({
            hero: b.hero,
            score: b.count * 5, // Reduced from ×10 to ×5
            reason: `${b.count} bans`,
            type: 'ban'
        }))

        // Phase 2: Enhanced with matchup analysis
        const transformPhase2Bans = (bans: any[]) => {
            // Get our current picks
            const ourPicks = currentStep?.side === 'BLUE'
                ? Object.values(state.bluePicks).filter(Boolean) as string[]
                : Object.values(state.redPicks).filter(Boolean) as string[]

            // Get opponent's current picks to determine remaining positions
            const opponentPicks = currentStep?.side === 'BLUE'
                ? Object.values(state.redPicks).filter(Boolean) as string[]
                : Object.values(state.bluePicks).filter(Boolean) as string[]

            // Determine positions opponent has already taken
            const takenPositions = new Set<string>()
            opponentPicks.forEach(pickId => {
                const pickHero = initialHeroes?.find(h => String(h.id) === String(pickId))
                pickHero?.main_position?.forEach((pos: string) => takenPositions.add(pos))
            })

            // All possible positions
            const allPositions = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
            const remainingPositions = allPositions.filter(p => !takenPositions.has(p))

            // Get OPPONENT team's stats for matchup scoring
            // We want to find heroes that opponent plays that BEAT our heroes
            const opponentTeamName = currentStep?.side === 'BLUE'
                ? game.red_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
                : game.blue_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
            const opponentStats = teamStats[opponentTeamName || '']
            const opponentLaneMatchups = opponentStats?.laneMatchups || {}

            // Also get opponent's hero pool for predicting Pick 4-5
            const opponentHeroStats = opponentStats?.heroStats || {}

            return bans.map(b => {
                const banHeroId = String(b.heroId)
                const banHero = b.hero
                let matchupBonus = 0
                const matchupReasons: string[] = []

                // === MATCHUP SCORING: Check opponent's hero vs our picks ===
                // Structure: opponentLaneMatchups[role][enemyId][opponentHeroId] = { games, wins }
                // We need to check: when opponent played banHeroId, how did they do vs our heroes?

                Object.entries(opponentLaneMatchups).forEach(([role, roleMatchups]: [string, any]) => {
                    // For each of our picked heroes, check if opponent's banHero beat them
                    ourPicks.forEach(ourHeroId => {
                        const matchupData = roleMatchups?.[String(ourHeroId)]?.[banHeroId]
                        if (matchupData && matchupData.games > 0) {
                            // This is opponent's win rate when playing banHeroId vs ourHeroId
                            const opponentWinRate = (matchupData.wins / matchupData.games) * 100
                            // If opponent wins often with this hero vs ours, prioritize banning
                            if (opponentWinRate > 50) {
                                const bonus = Math.round(opponentWinRate - 50)
                                matchupBonus += bonus
                                const ourHeroName = initialHeroes?.find(h => String(h.id) === String(ourHeroId))?.name || 'Hero'
                                matchupReasons.push(`Beat ${ourHeroName} ${opponentWinRate.toFixed(0)}%`)
                            }
                        }
                    })
                })

                // === PREDICT PICK 4-5: Check if banHero is likely to be picked for remaining positions ===
                if (remainingPositions.length > 0 && banHero.main_position) {
                    const heroPositions = banHero.main_position || []
                    const matchesNeededPosition = heroPositions.some((pos: string) => remainingPositions.includes(pos))

                    if (matchesNeededPosition) {
                        // Check opponent's pick frequency for this hero
                        const heroStats = opponentHeroStats[banHeroId]
                        if (heroStats && heroStats.picks >= 3) {
                            // Bonus based on how often opponent picks this hero
                            const pickBonus = Math.min(heroStats.picks * 2, 20) // Max 20 bonus
                            matchupBonus += pickBonus

                            const position = heroPositions.find((pos: string) => remainingPositions.includes(pos))
                            matchupReasons.push(`Likely ${position} (${heroStats.picks}x picks)`)
                        }
                    }
                }

                // Build reason string
                const baseReason = `${b.count} bans`
                const fullReason = matchupReasons.length > 0
                    ? `${baseReason} • ${matchupReasons.slice(0, 2).join(', ')}`
                    : baseReason

                return {
                    hero: b.hero,
                    score: (b.count * 5) + matchupBonus, // Reduced Ban weight + Matchup bonus
                    reason: fullReason,
                    type: 'ban',
                    matchupBonus,
                    remainingPositions // For filtering
                }
            })
                // Filter by opponent's remaining positions (only in Phase 2)
                .filter(b => {
                    if (remainingPositions.length === 0 || remainingPositions.length === 5) return true
                    const heroPositions = b.hero.main_position || []
                    // Keep if hero has at least one position in opponent's remaining slots
                    return heroPositions.some((pos: string) => remainingPositions.includes(pos))
                })
                // Re-sort by new score (matchup bonus included)
                .sort((a, b) => b.score - a.score)
        }

        const phase1Bans = transformPhase1Bans(rawPhase1Bans)
        const phase2Bans = transformPhase2Bans(rawPhase2Bans)
        const autoDetectedPhase = state.stepIndex < 4 ? 'PHASE_1' : 'PHASE_2'
        const currentPhaseBans = autoDetectedPhase === 'PHASE_1' ? phase1Bans : phase2Bans

        // Filter unavailable
        const unavailableIdsSet = new Set(unavailableIds.map(String))
        return currentPhaseBans.filter((r: any) => !unavailableIdsSet.has(String(r.hero.id)))
    }, [currentStep?.side, teamStats, game.blue_team_name, game.red_team_name, initialHeroes, heroMap, state.stepIndex, unavailableIds, state.bluePicks, state.redPicks])

    // Calculate Strategic Bans for BLUE team (uses Blue team's own ban history)
    const blueStrategicBans = useMemo(() => {
        if (!match.team_a_name || !match.team_b_name) return []

        // Blue team - use Blue team's ban history (what Blue typically bans when playing Blue side)
        const blueTeamName = game.blue_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
        const blueStats = teamStats[blueTeamName || '']

        if (!blueStats?.banOrderStats) return []

        // Get bans for Phase 1 or Phase 2
        const autoDetectedPhase = state.stepIndex < 4 ? 'PHASE_1' : 'PHASE_2'
        const slots = autoDetectedPhase === 'PHASE_1' ? [1, 2, 3, 4] : [11, 12, 13, 14]

        const aggregated: Record<string, number> = {}
        const banSource = blueStats.sideStats?.['BLUE']?.banOrderStats || blueStats.banOrderStats

        slots.forEach(slot => {
            const slotData = banSource?.[slot] || {}
            Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                aggregated[heroId] = (aggregated[heroId] || 0) + count
            })
        })

        // Calculate positions already filled by opponent (Red team)
        const opponentPicks = Object.values(state.redPicks).filter(Boolean) as string[]
        const opponentFilledPositions = new Set<string>()
        opponentPicks.forEach(pickId => {
            const pickHero = initialHeroes?.find(h => String(h.id) === String(pickId))
            pickHero?.main_position?.forEach((pos: string) => opponentFilledPositions.add(pos))
        })
        const ALL_POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
        const opponentRemainingPositions = ALL_POSITIONS.filter(p => !opponentFilledPositions.has(p))

        // Identify Core Heroes (Top 10 most picked by this team)
        const coreHeroes = Object.values(blueStats.heroStats || {})
            .sort((a: any, b: any) => b.picks - a.picks)
            .slice(0, 10);

        const laneMatchups = blueStats.laneMatchups || {};

        const result = Object.entries(aggregated)
            .map(([heroId, count]) => {
                const heroFromInitial = initialHeroes?.find(h => String(h.id) === String(heroId))
                const heroFromMap = heroMap?.[heroId]
                const hero = heroFromInitial || {
                    id: heroId,
                    name: heroFromMap?.name || 'Unknown',
                    icon_url: heroFromMap?.icon_url || '',
                    main_position: []
                }

                // PROTECT SCORE CALCULATION
                let protectBonus = 0;
                const protectReasons: string[] = [];

                coreHeroes.forEach((coreHero: any) => {
                    Object.entries(laneMatchups).forEach(([role, roleData]: [string, any]) => {
                        const matchup = roleData?.[coreHero.id]?.[heroId];
                        if (matchup && matchup.games >= 3) {
                            const ourWinRate = (matchup.wins / matchup.games);
                            const enemyWinRate = 1 - ourWinRate;
                            if (enemyWinRate > 0.55) {
                                const threatLevel = Math.round((enemyWinRate - 0.5) * 100 * 2);
                                protectBonus += threatLevel;
                                if (protectReasons.length < 2) {
                                    protectReasons.push(`Protect ${coreHero.name}`);
                                }
                            }
                        }
                    });
                });
                protectBonus = Math.min(protectBonus, 150);

                const baseReason = `${count} bans`;
                const reason = protectReasons.length > 0
                    ? `${baseReason} • ${protectReasons.join(', ')} (+${protectBonus})`
                    : baseReason;

                return { hero, score: (count * 5) + protectBonus, reason, type: 'ban', heroId, count, protectBonus }
            })
            .filter(item => item.hero.name !== 'Unknown')
            // Filter: Only keep heroes that can fill opponent's remaining positions (don't ban positions they already have)
            .filter(item => {
                // If opponent has 0 or 5 picks, don't filter by position (Phase 1 or all positions filled)
                if (opponentRemainingPositions.length === 0 || opponentRemainingPositions.length === 5) return true
                const heroPositions = item.hero.main_position || []
                // Keep if hero has at least one position that opponent still needs
                return heroPositions.some((pos: string) => opponentRemainingPositions.includes(pos))
            })
            .sort((a, b) => b.score - a.score)

        // Filter unavailable
        const unavailableIdsSet = new Set(unavailableIds.map(String))
        return result.filter((r: any) => !unavailableIdsSet.has(String(r.hero.id)))
    }, [teamStats, game.blue_team_name, initialHeroes, heroMap, state.stepIndex, unavailableIds, match.team_a_name, match.team_b_name, state.redPicks])

    // Calculate Strategic Bans for RED team (uses Red team's own ban history)
    const redStrategicBans = useMemo(() => {
        if (!match.team_a_name || !match.team_b_name) return []

        // Red team - use Red team's ban history (what Red typically bans when playing Red side)
        const redTeamName = game.red_team_name?.replace(/\s*\(Bot\)\s*$/i, '')
        const redStats = teamStats[redTeamName || '']

        if (!redStats?.banOrderStats) return []

        // Get bans for Phase 1 or Phase 2
        const autoDetectedPhase = state.stepIndex < 4 ? 'PHASE_1' : 'PHASE_2'
        const slots = autoDetectedPhase === 'PHASE_1' ? [1, 2, 3, 4] : [11, 12, 13, 14]

        const aggregated: Record<string, number> = {}
        const banSource = redStats.sideStats?.['RED']?.banOrderStats || redStats.banOrderStats

        slots.forEach(slot => {
            const slotData = banSource?.[slot] || {}
            Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                aggregated[heroId] = (aggregated[heroId] || 0) + count
            })
        })

        // Calculate positions already filled by opponent (Blue team)
        const opponentPicks = Object.values(state.bluePicks).filter(Boolean) as string[]
        const opponentFilledPositions = new Set<string>()
        opponentPicks.forEach(pickId => {
            const pickHero = initialHeroes?.find(h => String(h.id) === String(pickId))
            pickHero?.main_position?.forEach((pos: string) => opponentFilledPositions.add(pos))
        })
        const ALL_POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
        const opponentRemainingPositions = ALL_POSITIONS.filter(p => !opponentFilledPositions.has(p))

        // Identify Core Heroes (Top 10 most picked by this team)
        const coreHeroes = Object.values(redStats.heroStats || {})
            .sort((a: any, b: any) => b.picks - a.picks)
            .slice(0, 10);

        const laneMatchups = redStats.laneMatchups || {};

        const result = Object.entries(aggregated)
            .map(([heroId, count]) => {
                const heroFromInitial = initialHeroes?.find(h => String(h.id) === String(heroId))
                const heroFromMap = heroMap?.[heroId]
                const hero = heroFromInitial || {
                    id: heroId,
                    name: heroFromMap?.name || 'Unknown',
                    icon_url: heroFromMap?.icon_url || '',
                    main_position: []
                }

                // PROTECT SCORE CALCULATION
                let protectBonus = 0;
                const protectReasons: string[] = [];

                coreHeroes.forEach((coreHero: any) => {
                    Object.entries(laneMatchups).forEach(([role, roleData]: [string, any]) => {
                        const matchup = roleData?.[coreHero.id]?.[heroId];
                        if (matchup && matchup.games >= 3) {
                            const ourWinRate = (matchup.wins / matchup.games);
                            const enemyWinRate = 1 - ourWinRate;
                            if (enemyWinRate > 0.55) {
                                const threatLevel = Math.round((enemyWinRate - 0.5) * 100 * 2);
                                protectBonus += threatLevel;
                                if (protectReasons.length < 2) {
                                    protectReasons.push(`Protect ${coreHero.name}`);
                                }
                            }
                        }
                    });
                });
                protectBonus = Math.min(protectBonus, 150);

                const baseReason = `${count} bans`;
                const reason = protectReasons.length > 0
                    ? `${baseReason} • ${protectReasons.join(', ')} (+${protectBonus})`
                    : baseReason;

                return { hero, score: (count * 5) + protectBonus, reason, type: 'ban', heroId, count, protectBonus }
            })
            .filter(item => item.hero.name !== 'Unknown')
            // Filter: Only keep heroes that can fill opponent's remaining positions (don't ban positions they already have)
            .filter(item => {
                // If opponent has 0 or 5 picks, don't filter by position (Phase 1 or all positions filled)
                if (opponentRemainingPositions.length === 0 || opponentRemainingPositions.length === 5) return true
                const heroPositions = item.hero.main_position || []
                // Keep if hero has at least one position that opponent still needs
                return heroPositions.some((pos: string) => opponentRemainingPositions.includes(pos))
            })
            .sort((a, b) => b.score - a.score)

        // Filter unavailable
        const unavailableIdsSet = new Set(unavailableIds.map(String))
        return result.filter((r: any) => !unavailableIdsSet.has(String(r.hero.id)))
    }, [teamStats, game.red_team_name, initialHeroes, heroMap, state.stepIndex, unavailableIds, match.team_a_name, match.team_b_name, state.bluePicks])

    // Refs to track latest strategic bans for async callbacks
    const blueStrategicBansRef = useRef(blueStrategicBans)
    const redStrategicBansRef = useRef(redStrategicBans)

    useEffect(() => {
        blueStrategicBansRef.current = blueStrategicBans
        redStrategicBansRef.current = redStrategicBans
    }, [blueStrategicBans, redStrategicBans])

    // Fetch Recommendations for BOTH teams when step changes
    useEffect(() => {
        if (!currentStep || state.isFinished) return;

        // Auto-switch tab based on phase
        const isBan = currentStep.type.includes('BAN')
        setRecTypeFilter(isBan ? 'BANS' : 'PICKS')

        const currentPhase = (currentStep?.type === 'BAN' ? 'BAN' : 'PICK') as 'BAN' | 'PICK'
        const tournamentId = match.ai_metadata?.settings?.tournamentId

        // Blue Team Context
        const blueContext = {
            phase: currentPhase,
            side: 'BLUE' as const,
            tournamentId,
            targetTeamName: game.blue_team_name,
            enemyTeamName: game.red_team_name
        }

        // Red Team Context
        const redContext = {
            phase: currentPhase,
            side: 'RED' as const,
            tournamentId,
            targetTeamName: game.red_team_name,
            enemyTeamName: game.blue_team_name
        }

        const currentBluePicks = Object.values(state.bluePicks) as string[]
        const currentRedPicks = Object.values(state.redPicks) as string[]

        const bluePicksCount = currentBluePicks.filter(Boolean).length
        const redPicksCount = currentRedPicks.filter(Boolean).length
        const blueBansCount = state.blueBans.filter(Boolean).length
        const redBansCount = state.redBans.filter(Boolean).length

        setIsLoadingRecommendations(true)
        setIsBlueSuggestLoading(true)
        setIsRedSuggestLoading(true)

        // Blue Team Context Update
        const blueCtx = {
            ...blueContext,
            pickOrder: currentPhase === 'BAN' ? blueBansCount + 1 : bluePicksCount + 1
        }

        // Red Team Context Update
        const redCtx = {
            ...redContext,
            pickOrder: currentPhase === 'BAN' ? redBansCount + 1 : redPicksCount + 1
        }

        // Fetch for BOTH teams in parallel
        Promise.all([
            getRecommendations(match.version_id, currentBluePicks, currentRedPicks, bannedIds, [], blueCtx),
            getRecommendations(match.version_id, currentRedPicks, currentBluePicks, bannedIds, [], redCtx)
        ]).then(([blueData, redData]) => {
            if (currentStep.side === 'BLUE') setRecommendations(blueData)
            else setRecommendations(redData)

            // Include global bans (heroes already played in previous games) for PICK phase
            const allUnavailable = new Set([
                ...bannedIds,
                ...Object.values(state.bluePicks),
                ...Object.values(state.redPicks),
                ...currentGlobalBans,
                ...opponentGlobalBans
            ].map(String))

            // BLUE SUGGESTIONS - Use Blue's Strategic Bans for BAN phase
            let blueFinal: any[] = []
            if (currentPhase === 'BAN') {
                if (blueStrategicBansRef.current.length > 0) {
                    // Use Blue's Strategic Bans (targets Red team)
                    blueFinal = blueStrategicBansRef.current.slice(0, 8)
                } else {
                    // Fallback to smartBan only if no strategic data
                    blueFinal = (blueData?.smartBan || []).map((r: any) => ({ ...r, phase: 'BAN', type: 'ban' }))
                        .filter((r: any) => !allUnavailable.has(String(r.hero?.id)))
                        .slice(0, 8)
                }
            } else {
                // PICK phase
                blueFinal = (blueData?.hybrid || []).map((r: any) => ({ ...r, phase: 'PICK', type: 'hybrid' }))
                    .filter((r: any) => !allUnavailable.has(String(r.hero?.id)))
                    .slice(0, 8)
            }
            setBlueSuggestions(blueFinal)

            // RED SUGGESTIONS - Use Red's Strategic Bans for BAN phase
            let redFinal: any[] = []
            if (currentPhase === 'BAN') {
                if (redStrategicBansRef.current.length > 0) {
                    // Use Red's Strategic Bans (targets Blue team)
                    redFinal = redStrategicBansRef.current.slice(0, 8)
                } else {
                    redFinal = (redData?.smartBan || []).map((r: any) => ({ ...r, phase: 'BAN', type: 'ban' }))
                        .filter((r: any) => !allUnavailable.has(String(r.hero?.id)))
                        .slice(0, 8)
                }
            } else {
                redFinal = (redData?.hybrid || []).map((r: any) => ({ ...r, phase: 'PICK', type: 'hybrid' }))
                    .filter((r: any) => !allUnavailable.has(String(r.hero?.id)))
                    .slice(0, 8)
            }
            setRedSuggestions(redFinal)

            setIsLoadingRecommendations(false)
            setIsBlueSuggestLoading(false)
            setIsRedSuggestLoading(false)
        }).catch(err => {
            console.error("Cerebro failed:", err)
            setRecommendations({ analyst: [], history: [], hybrid: [], smartBan: [] })
            setBlueSuggestions([])
            setRedSuggestions([])
            setIsLoadingRecommendations(false)
            setIsBlueSuggestLoading(false)
            setIsRedSuggestLoading(false)
        })

    }, [state.stepIndex, state.bluePicks, state.redPicks])

    // Immediately set Advisor suggestions from Strategic Bans when available (BAN phase)
    // Shows loading until Strategic Bans data is ready
    useEffect(() => {
        if (!currentStep) return
        const isBanPhase = currentStep.type === 'BAN'

        if (isBanPhase) {
            // Set loading if no data yet
            if (blueStrategicBans.length === 0 && blueSuggestions.length === 0) {
                setIsBlueSuggestLoading(true)
            }
            if (redStrategicBans.length === 0 && redSuggestions.length === 0) {
                setIsRedSuggestLoading(true)
            }

            // Blue Advisor - set data when Strategic Bans is ready
            if (blueStrategicBans.length > 0 && blueSuggestions.length === 0) {
                const formatted = blueStrategicBans.slice(0, 8).map((r: any) => ({
                    hero: r.hero,
                    score: r.score,
                    reason: r.reason,
                    type: 'ban',
                    stepIndex: state.stepIndex
                }))
                setBlueSuggestions(formatted)
                setIsBlueSuggestLoading(false)
            }

            // Red Advisor - set data when Strategic Bans is ready
            if (redStrategicBans.length > 0 && redSuggestions.length === 0) {
                const formatted = redStrategicBans.slice(0, 8).map((r: any) => ({
                    hero: r.hero,
                    score: r.score,
                    reason: r.reason,
                    type: 'ban',
                    stepIndex: state.stepIndex
                }))
                setRedSuggestions(formatted)
                setIsRedSuggestLoading(false)
            }
        }
    }, [currentStep?.type, blueStrategicBans.length, redStrategicBans.length, blueSuggestions.length, redSuggestions.length])

    const handleGenerateSuggestion = async (side: 'BLUE' | 'RED', mode: string) => {
        const isBlue = side === 'BLUE'
        const setLoading = isBlue ? setIsBlueSuggestLoading : setIsRedSuggestLoading
        const setRecs = isBlue ? setBlueSuggestions : setRedSuggestions
        const currentPhase = (currentStep?.type === 'BAN' ? 'BAN' : 'PICK') as 'BAN' | 'PICK'
        const isBanMode = mode === 'ban' || currentPhase === 'BAN'

        setLoading(true)
        try {
            // For BAN phase or ban mode, use team-specific Strategic Bans
            const teamStrategicBans = isBlue ? blueStrategicBans : redStrategicBans
            if (isBanMode && teamStrategicBans.length > 0) {
                const formatted = teamStrategicBans.slice(0, 8).map((r: any) => ({
                    hero: r.hero,
                    score: r.score,
                    reason: r.reason,
                    type: 'ban'
                }))
                setRecs(formatted)
                setLoading(false)
                return
            }

            // For PICK phase or when no strategic data, use getRecommendations
            const allyPicks = isBlue ? Object.values(state.bluePicks) : Object.values(state.redPicks)
            const enemyPicks = isBlue ? Object.values(state.redPicks) : Object.values(state.bluePicks)

            // Calculate Pick Order for this side
            const pCount = isBlue ? Object.values(state.bluePicks).filter(Boolean).length : Object.values(state.redPicks).filter(Boolean).length
            const bCount = isBlue ? state.blueBans.filter(Boolean).length : state.redBans.filter(Boolean).length
            const teamPickOrder = currentPhase === 'BAN' ? bCount + 1 : pCount + 1

            // Fetch recommendations for THIS side specifically
            const targetTeamName = (isBlue ? game.blue_team_name : game.red_team_name)?.replace(/\s*\(Bot\)\s*$/i, '') || ''
            const targetTeamStats = teamStats[targetTeamName] || null

            const data = await getRecommendations(
                match.version_id,
                allyPicks as string[],
                enemyPicks as string[],
                bannedIds,
                [],
                {
                    matchId: match.id,
                    phase: currentPhase,
                    side: side,
                    pickOrder: teamPickOrder,
                    draftSlot: currentStep ? currentStep.orderIndex + 1 : undefined, // Actual draft sequence position (1-18)
                    tournamentId: match.ai_metadata?.settings?.tournamentId,
                    targetTeamName: isBlue ? game.blue_team_name : game.red_team_name
                },
                currentMode ? { layers: currentMode.layers.map((w: any) => ({ id: w.id, weight: w.weight, isActive: w.weight > 0 })) } : undefined,
                targetTeamStats // Pass CEREBRO Draft Strategy data
            )

            // Select array based on mode
            let results: any[] = data.hybrid || []
            if (mode === 'analyst') results = data.analyst
            else if (mode === 'history') results = data.history
            else if (mode === 'counter') results = data.hybrid
            else if (mode === 'smartBan') results = data.smartBan

            // Map to Suggestion Format
            const formatted = results.map((r: any) => ({
                hero: r.hero,
                score: r.score,
                reason: r.reason,
                type: mode === 'history' ? 'comfort' : (mode === 'counter' ? 'counter' : 'hybrid'),
                stepIndex: state.stepIndex
            })).slice(0, 8) // Top 8

            setRecs(formatted)

        } catch (err) {
            console.error("Manual Suggestion Failed:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleHeroClick = (hero: Hero) => {
        if (unavailableIds.includes(hero.id)) return
        // Look up full hero from initialHeroes using String comparison for type consistency
        const fullHero = initialHeroes.find(h => String(h.id) === String(hero.id)) || hero
        setSelectedHero(fullHero)
    }

    const handleLockIn = () => {
        if (selectedHero) {
            lockIn(selectedHero.id)
            setSelectedHero(null)
        }
    }

    // Helper to get hero object - checks initialHeroes first, then heroMap as fallback
    const getHero = (id: string) => {
        const fromInitial = initialHeroes.find(h => h.id === id)
        if (fromInitial) return fromInitial

        // Fallback to heroMap if not found in initialHeroes
        const fromMap = heroMap?.[id]
        if (fromMap) {
            return {
                id,
                name: fromMap.name || 'Unknown',
                icon_url: fromMap.icon_url || fromMap.icon || '',
                main_position: [],
                damage_type: 'Physical'
            } as Hero
        }

        return undefined
    }

    // Filtering Logic
    const filteredHeroes = initialHeroes.filter(hero => {
        const matchesSearch = hero.name.toLowerCase().includes(searchQuery.toLowerCase())

        // Exact match for the new specific roles which match DB values
        // hero.main_position is string[]
        const matchesRole = selectedRole === 'All' || hero.main_position.includes(selectedRole)

        // Hide Picked Heroes entirely ("Cut out the ones opponent picked")
        // But keep Banned/Global Restricted visible (as disabled/grayscale)
        const isPicked = pickedIds.includes(hero.id)

        // Show everything during BAN phase (disabled/badged) so user sees context
        // PICK phase, hide Picked heroes to clean up the list
        // ALSO hide our own Global Bans (heroes we played previously) because we can't pick them again
        const isCurrentGlobalBan = currentGlobalBans.includes(hero.id)
        const shouldHide = !isBanPhase && (isPicked || isCurrentGlobalBan)

        return matchesSearch && matchesRole && !shouldHide
    })

    // Helper: Predict Lanes
    const predictLanes = (picks: Record<number, string>) => {
        const pickValues = Object.values(picks)
        const heroes = pickValues.map(id => getHero(id)).filter(Boolean) as Hero[]

        const predicted: Record<string, string> = {}
        const lanes = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
        const availableHeroes = [...heroes]

        // Optimizations with main_position

        // Jungle
        const junglers = availableHeroes.filter(h => h.main_position.includes('Jungle') || h.main_position.includes('Assassin'))
        if (junglers.length > 0) {
            predicted['Jungle'] = junglers[0].id
            availableHeroes.splice(availableHeroes.indexOf(junglers[0]), 1)
        }

        // Abyssal
        const adcs = availableHeroes.filter(h => h.main_position.includes('Abyssal') || h.main_position.includes('Marksman'))
        if (adcs.length > 0) {
            predicted['Abyssal'] = adcs[0].id
            availableHeroes.splice(availableHeroes.indexOf(adcs[0]), 1)
        }

        // Mid
        const mages = availableHeroes.filter(h => h.main_position.includes('Mid') || h.main_position.includes('Mage'))
        if (mages.length > 0) {
            predicted['Mid'] = mages[0].id
            availableHeroes.splice(availableHeroes.indexOf(mages[0]), 1)
        }

        // Roam
        const supports = availableHeroes.filter(h => h.main_position.includes('Roam') || h.main_position.includes('Support') || h.main_position.includes('Tank'))
        if (supports.length > 0) {
            predicted['Roam'] = supports[0].id
            availableHeroes.splice(availableHeroes.indexOf(supports[0]), 1)
        }

        // Dark Slayer (Warrior/Tank)
        const ds = availableHeroes.filter(h => h.main_position.includes('Dark Slayer') || h.main_position.includes('Warrior') || h.main_position.includes('Tank'))
        if (ds.length > 0) {
            predicted['Dark Slayer'] = ds[0].id
            availableHeroes.splice(availableHeroes.indexOf(ds[0]), 1)
        }

        // Fill remaining
        lanes.forEach(lane => {
            if (!predicted[lane] && availableHeroes.length > 0) {
                predicted[lane] = availableHeroes[0].id
                availableHeroes.shift()
            }
        })

        return predicted
    }

    // Check if game is already finished (from DB)
    const isGameFinished = !!game.winner

    if (isGameFinished && game.picks) {
        const manualLanes: Record<string, string> = {}
        const bluePicks: Record<number, string> = {}
        const redPicks: Record<number, string> = {}
        const blueBans: string[] = []
        const redBans: string[] = []

        // Helper to find index in slot array
        const getRelativeIndex = (pos: number, slots: number[]) => {
            return slots.indexOf(pos)
        }

        const BLUE_PICK_SLOTS = [5, 8, 9, 16, 17]
        const RED_PICK_SLOTS = [6, 7, 10, 15, 18]

        game.picks.forEach(p => {
            if (p.type === 'PICK') {
                let idx = -1
                if (p.side === 'BLUE') {
                    idx = getRelativeIndex(p.position_index, BLUE_PICK_SLOTS)
                    if (idx !== -1) bluePicks[idx] = p.hero_id
                } else {
                    idx = getRelativeIndex(p.position_index, RED_PICK_SLOTS)
                    if (idx !== -1) redPicks[idx] = p.hero_id
                }

                // Fallback for legacy data (if pos index is 1-5)
                if (idx === -1 && p.position_index <= 5) {
                    const legacyIdx = p.position_index - 1
                    if (p.side === 'BLUE') bluePicks[legacyIdx] = p.hero_id
                    else redPicks[legacyIdx] = p.hero_id
                }

                if (p.assigned_role) {
                    manualLanes[p.hero_id] = p.assigned_role
                }
            } else {
                // Safely map Bans using Position Index
                const BLUE_BAN_SLOTS = [1, 3, 12, 14]
                const RED_BAN_SLOTS = [2, 4, 11, 13]

                let idx = -1
                if (p.side === 'BLUE') {
                    idx = getRelativeIndex(p.position_index, BLUE_BAN_SLOTS)
                    // Ensure array is large enough or just assign
                    if (idx !== -1) blueBans[idx] = p.hero_id
                } else {
                    idx = getRelativeIndex(p.position_index, RED_BAN_SLOTS)
                    if (idx !== -1) redBans[idx] = p.hero_id
                }

                // Fallback for Legacy Bans (if simple push needed or unknown slot)
                if (idx === -1) {
                    if (p.side === 'BLUE') blueBans.push(p.hero_id)
                    else redBans.push(p.hero_id)
                }
            }
        })

        const initialData = {
            winner: game.winner,
            blueKeyPlayer: game.blue_key_player_id,
            redKeyPlayer: game.red_key_player_id,
            winPrediction: game.analysis_data?.winPrediction?.blue,
            notes: game.analysis_data?.notes
        }

        const nextGameNum = game.game_number + 1
        const nextExistingGame = match.games?.find(g => g.game_number === nextGameNum)
        const nextGameTab = nextExistingGame ? nextExistingGame.id : `new-${nextGameNum}`

        const currentBlueWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_a_name) || (g.winner === 'Red' && g.red_team_name === match.team_a_name)).length || 0
        const currentRedWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_b_name) || (g.winner === 'Red' && g.red_team_name === match.team_b_name)).length || 0

        // IMPORTANT: The above counts Team A vs Team B wins, but PostDraftResult needs "Blue" vs "Red" context relative to the SERIES? 
        // No, PostDraftResult seriesScore should probably be Team A vs Team B.
        // Or better: Let's pass the raw numbers.
        // Wait, the logic in PostDraftResult assumes seriesScore.blue and seriesScore.red. 
        // But "Blue" in PostDraftResult refers to `blueTeamName`. 
        // If `blueTeamName` is Team A, we should pass Team A's score as blue. 
        // If `blueTeamName` is Team B, we should pass Team B's score as blue.

        const isBlueTeamA = game.blue_team_name === match.team_a_name
        const blueScore = isBlueTeamA ? currentBlueWins : currentRedWins
        const redScore = isBlueTeamA ? currentRedWins : currentBlueWins

        return (
            <PostDraftResult
                gameId={game.id}
                blueTeamName={game.blue_team_name}
                redTeamName={game.red_team_name}
                bluePicks={bluePicks}
                redPicks={redPicks}
                blueBans={blueBans}
                redBans={redBans}
                heroes={initialHeroes}
                matchId={match.id}
                manualLanes={manualLanes}
                initialData={initialData}
                nextGameId={nextGameTab}
                matchMode={match.mode || 'BO1'}
                seriesScore={{ blue: blueScore, red: redScore }}
            />
        )
    }

    // Render POST-DRAFT Screen if finished AND user clicked the button
    // Helper: Get Layer Icon
    const getLayerIcon = (id: string) => {
        switch (id) {
            case 'meta': return { icon: Globe, color: 'text-purple-400' }
            case 'counter': return { icon: Swords, color: 'text-red-400' }
            case 'comfort': return { icon: Users, color: 'text-blue-400' }
            case 'synergy': return { icon: LinkIcon, color: 'text-emerald-400' }
            case 'roster': return { icon: Target, color: 'text-cyan-400' }
            case 'ban': return { icon: ShieldBan, color: 'text-orange-400' }
            case 'composition': return { icon: Brain, color: 'text-pink-400' }
            default: return { icon: Brain, color: 'text-slate-400' }
        }
    }

    if (state.isFinished && showSummary) {
        const nextGameNum = game.game_number + 1
        const nextExistingGame = match.games?.find(g => g.game_number === nextGameNum)
        const nextGameTab = nextExistingGame ? nextExistingGame.id : `new-${nextGameNum}`

        const currentBlueWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_a_name) || (g.winner === 'Red' && g.red_team_name === match.team_a_name)).length || 0
        const currentRedWins = match.games?.filter(g => (g.winner === 'Blue' && g.blue_team_name === match.team_b_name) || (g.winner === 'Red' && g.red_team_name === match.team_b_name)).length || 0

        const isBlueTeamA = game.blue_team_name === match.team_a_name
        const blueScore = isBlueTeamA ? currentBlueWins : currentRedWins
        const redScore = isBlueTeamA ? currentRedWins : currentBlueWins

        // Convert multi-lanes to single lane for PostDraftResult
        const primaryLanes: Record<string, string> = {}
        Object.entries(manualLanes).forEach(([k, v]) => {
            if (v && v.length > 0) primaryLanes[k] = v[0]
        })

        // --- BOT AUTO-ANALYSIS ---
        let botMVP = null
        // If PVE, we want to auto-fill the Bot's Lanes & MVP
        const isPVE = match.ai_metadata?.mode === 'PVE'
        if (isPVE) {
            // Assume Bot is TEAM B.
            // Check if Team B is Blue or Red in this game
            const isBotBlue = game.blue_team_name === match.team_b_name
            const botSide = isBotBlue ? 'BLUE' : 'RED'

            // Get Bot Picks
            const botPicks = botSide === 'BLUE' ? state.bluePicks : state.redPicks

            // Predict Bot Lanes
            const predictedBotLanes = predictLanes(botPicks) // Returns { Jungle: HeroID, ... }

            // Invert to HeroID -> Role and merge into primaryLanes
            Object.entries(predictedBotLanes).forEach(([role, heroId]) => {
                if (!primaryLanes[heroId]) {
                    primaryLanes[heroId] = role
                }
            })

            // Select Bot MVP (Prefer Jungle > Abyssal > Mid)
            botMVP = predictedBotLanes['Jungle'] || predictedBotLanes['Abyssal'] || predictedBotLanes['Mid'] || Object.values(botPicks)[0]
        }

        // Prepare Initial Data
        // If game is already saved (has winner), use that.
        // If not, use Bot Auto-Analysis for the Bot side key player.
        const existingData = {
            winner: game.winner,
            blueKeyPlayer: game.blue_key_player_id,
            redKeyPlayer: game.red_key_player_id,
            winPrediction: game.analysis_data?.winPrediction?.blue,
            notes: game.analysis_data?.notes
        }

        const isBotBlue = game.blue_team_name === match.team_b_name

        const initialData = {
            ...existingData,
            // Only auto-fill if not already saved
            blueKeyPlayer: existingData.blueKeyPlayer || (isPVE && isBotBlue ? botMVP : "") || undefined,
            redKeyPlayer: existingData.redKeyPlayer || (isPVE && !isBotBlue ? botMVP : "") || undefined,
            // Auto Set Win Prediction to 50 if new
            winPrediction: existingData.winPrediction ?? 50,
            winner: existingData.winner || undefined
        }


        return (
            <PostDraftResult
                gameId={game.id}
                blueTeamName={game.blue_team_name}
                redTeamName={game.red_team_name}
                bluePicks={state.bluePicks}
                redPicks={state.redPicks}
                blueBans={state.blueBans}
                redBans={state.redBans}
                heroes={initialHeroes}
                matchId={match.id}
                manualLanes={primaryLanes}
                initialData={initialData}
                nextGameId={nextGameTab}
                seriesScore={{ blue: blueScore, red: redScore }}
                matchMode={match.mode || 'BO1'}
            />
        )
    }

    return (
        <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden gap-1 p-0 lg:p-1 text-white bg-slate-950">
            {/* MOBILE SECTION 1: Locked Header (Score & Game Info) */}
            <div className="lg:hidden shrink-0 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 relative z-40 shadow-md">
                {/* Phase Indicator */}
                <div className="flex items-center justify-center py-1 bg-slate-950/50 border-b border-white/5">
                    <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${currentStep?.side === 'BLUE' ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'}`}>
                        {currentStep?.side} {currentStep?.type}
                    </span>
                </div>

                {/* Team Names Row - Always Visible */}
                <div className="flex items-center justify-between px-3 h-10 relative">
                    {/* Blue Team (Left) */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] shrink-0" />
                        <span className="text-xs font-bold text-blue-100 truncate w-full drop-shadow-md">
                            {game.blue_team_name}
                        </span>
                    </div>

                    {/* Center VS Badge */}
                    <div className="shrink-0 px-3 flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-500 font-mono italic">VS</span>
                    </div>

                    {/* Red Team (Right) */}
                    <div className="flex items-center justify-end gap-2 flex-1 min-w-0 text-right">
                        <span className="text-xs font-bold text-red-100 truncate w-full drop-shadow-md">
                            {game.red_team_name}
                        </span>
                        <div className="w-1 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] shrink-0" />
                    </div>
                </div>
            </div>

            {/* MOBILE SECTION 2: Draft Controls (Timer & Lock In) */}
            <div className="lg:hidden shrink-0 bg-slate-950 p-2 flex items-center gap-3 border-b border-slate-800 shadow-lg z-30">
                <div className={`text-4xl font-mono font-black tracking-tighter w-20 text-center ${state.timer <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {state.timer}
                </div>
                <Button
                    size="default"
                    className={`flex-1 h-12 text-lg font-black tracking-widest bg-slate-100 text-slate-900 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all
                        ${state.isFinished
                            ? 'bg-green-500 hover:bg-green-400 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                            : state.isPaused
                                ? 'bg-indigo-500 hover:bg-indigo-400 text-white animate-pulse'
                                : (!selectedHero ? 'opacity-50 grayscale' : 'shadow-[0_0_15px_rgba(255,255,255,0.3)]')
                        }`}
                    disabled={!state.isFinished && !state.isPaused && !selectedHero}
                    onClick={state.isFinished ? () => setShowSummary(true) : state.isPaused ? togglePause : handleLockIn}
                >
                    {state.isFinished
                        ? 'SUMMARY'
                        : selectedHero
                            ? (
                                <div className="flex items-center gap-3">
                                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-slate-900 shrink-0">
                                        {selectedHero.icon_url ? (
                                            <Image src={selectedHero.icon_url} alt={selectedHero.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-800" />
                                        )}
                                    </div>
                                    <div className="flex flex-col items-start leading-none min-w-0">
                                        <span className="text-[10px] opacity-70 font-medium">
                                            {state.isPaused ? (state.timer === 0 ? 'READY TO START' : 'PAUSED • TAP TO RESUME') : 'CONFIRM SELECTION'}
                                        </span>
                                        <span className="truncate max-w-[150px]">
                                            {state.isPaused ? 'RESUME' : 'LOCK IN'} {selectedHero.name.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            )
                            : state.isPaused
                                ? (state.timer === 0 ? 'START DRAFT' : 'RESUME DRAFT')
                                : 'PICK HERO'
                    }
                </Button>
            </div>


            {/* LEFT: BLUE TEAM (Desktop Only) */}
            <div className="hidden lg:flex w-[22%] flex-col gap-1 shrink-0 bg-slate-950/50">
                <DraftTeamPanel
                    side="BLUE"
                    teamName={game.blue_team_name}
                    bans={state.blueBans}
                    picks={state.bluePicks}
                    currentStep={currentStep}
                    isFinished={state.isFinished}
                    selectedHero={selectedHero}
                    getHero={getHero}
                    manualLanes={manualLanes}
                    onLaneAssign={handleLaneAssign}
                    suggestionProps={{
                        suggestions: blueSuggestions,
                        isLoading: isBlueSuggestLoading,
                        onGenerate: (mode) => handleGenerateSuggestion('BLUE', mode),
                        onSelectHero: handleHeroClick,
                        activeLayers: currentMode.layers.filter(l => l.isActive),
                        upcomingSlots: (() => {
                            const slots: { type: 'BAN' | 'PICK', slotNum: number }[] = []
                            const past = DRAFT_SEQUENCE.slice(0, state.stepIndex).filter(s => s.side === 'BLUE')
                            let banCount = past.filter(s => s.type === 'BAN').length
                            let pickCount = past.filter(s => s.type === 'PICK').length
                            DRAFT_SEQUENCE.slice(state.stepIndex).forEach(step => {
                                if (step.side === 'BLUE') {
                                    if (step.type === 'BAN') { banCount++; slots.push({ type: 'BAN', slotNum: banCount }) }
                                    else { pickCount++; slots.push({ type: 'PICK', slotNum: pickCount }) }
                                }
                            })
                            return slots
                        })()
                    }}
                />
            </div>

            {/* CENTER: BOARD & CONTROLS */}
            <div className="w-full lg:flex-1 flex flex-col gap-0.5 min-h-0 shrink-0">
                {/* Desktop Header / Timer (Hidden on Mobile) */}
                <div className="hidden lg:flex h-20 bg-slate-900 border border-slate-700 rounded-xl items-center justify-between px-4 relative shrink-0 z-30">
                    <div className="z-10 flex flex-col items-center w-full">
                        {state.isFinished ? (
                            <h2 className="text-4xl font-black text-green-400">DRAFT COMPLETE</h2>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-[-2px]">
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {match.team_a_name} vs {match.team_b_name}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold tracking-wider uppercase mb-[-4px] ${currentStep?.side === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                                    {currentStep?.side} SIDE {currentStep?.type}
                                </span>
                                <div className="text-5xl font-mono font-black tracking-tighter shadow-black drop-shadow-lg">{state.timer}</div>
                            </>
                        )}
                    </div>
                    {/* Analysis Mode Selector */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
                        <AnalysisModeManager
                            currentMode={currentMode}
                            onModeChange={setCurrentMode}
                        />
                    </div>

                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const url = `${window.location.origin}/share/draft/${match.id}/${game.id}`
                                navigator.clipboard.writeText(url)
                                const btn = document.getElementById('share-btn-text')
                                if (btn) btn.innerText = 'Copied!'
                                setTimeout(() => {
                                    if (btn) btn.innerText = 'Share'
                                }, 2000)
                            }}
                            className="bg-slate-900/80 border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors h-8 text-xs font-bold"
                        >
                            <Share2 className="w-3 h-3 mr-2" />
                            <span id="share-btn-text">Share</span>
                        </Button>

                        {currentGlobalBans.length > 0 && (
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 flex items-center gap-1 bg-slate-950/80">
                                <ShieldBan className="w-3 h-3" />
                                Global Bans Active: {currentGlobalBans.length}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Desktop Lock In Button (Hidden on Mobile) */}
                <div className="hidden lg:flex justify-center shrink-0 bg-slate-900/50 p-0.5">
                    <Button
                        size="sm"
                        className={`w-full h-8 font-bold ${state.isFinished
                            ? 'bg-green-600 hover:bg-green-700 animate-pulse text-white'
                            : state.isPaused
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                                : (!selectedHero ? 'opacity-50' : 'animate-pulse')
                            }`}
                        disabled={!state.isFinished && !state.isPaused && !selectedHero}
                        onClick={state.isFinished ? () => setShowSummary(true) : state.isPaused ? togglePause : handleLockIn}
                    >
                        {state.isFinished
                            ? 'GO TO SUMMARY'
                            : (state.isPaused ? (state.timer === 0 ? 'START DRAFT' : 'RESUME DRAFT') : selectedHero ? 'LOCK IN' : 'Select Hero')
                        }
                    </Button>
                </div>

                {/* Tabs for Hero Selection / Global Bans / Cerebro AI */}
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-4 lg:grid-cols-3 bg-slate-900 h-9 lg:h-7 p-0.5 mb-0 shrink-0 border-b border-slate-800">
                        {/* Mobile: Board Tab Trigger */}
                        <TabsTrigger value="board" className="lg:hidden text-[10px] font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            BOARD
                        </TabsTrigger>

                        <TabsTrigger value="hero" className="text-[10px] lg:text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            HEROES
                        </TabsTrigger>
                        <TabsTrigger value="global-bans" className="text-[10px] lg:text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white flex items-center gap-1 justify-center">
                            <ShieldBan className="w-3 h-3 hidden md:block" />
                            <span className="md:hidden">BANS</span>
                            <span className="hidden md:inline">GLOBAL BANS</span>
                        </TabsTrigger>
                        <TabsTrigger value="cerebro-ai" className="text-[10px] lg:text-xs font-bold data-[state=active]:bg-slate-800 data-[state=active]:text-white flex items-center gap-1 justify-center">
                            <Brain className="w-3 h-3 text-indigo-400 hidden md:block" />
                            CEREBRO
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 0: BOARD (Mobile Only) - Red Left, Blue Right */}
                    <TabsContent value="board" className="flex-1 flex flex-col min-h-0 m-0 overflow-hidden lg:hidden">
                        <div className="flex-1 overflow-y-auto min-h-0 p-1">
                            <div className="grid grid-cols-2 gap-1 pb-16">
                                {/* BLUE Side (Left) */}
                                <DraftTeamPanel
                                    side="BLUE"
                                    teamName={game.blue_team_name}
                                    bans={state.blueBans}
                                    picks={state.bluePicks}
                                    currentStep={currentStep}
                                    isFinished={state.isFinished}
                                    selectedHero={selectedHero}
                                    getHero={getHero}
                                    manualLanes={manualLanes}
                                    onLaneAssign={handleLaneAssign}
                                    suggestionProps={{
                                        suggestions: blueSuggestions,
                                        isLoading: isBlueSuggestLoading,
                                        onGenerate: (mode) => handleGenerateSuggestion('BLUE', mode),
                                        onSelectHero: handleHeroClick,
                                        activeLayers: currentMode.layers.filter(l => l.isActive),
                                        upcomingSlots: (() => {
                                            const slots: { type: 'BAN' | 'PICK', slotNum: number }[] = []
                                            const past = DRAFT_SEQUENCE.slice(0, state.stepIndex).filter(s => s.side === 'BLUE')
                                            let banCount = past.filter(s => s.type === 'BAN').length
                                            let pickCount = past.filter(s => s.type === 'PICK').length
                                            DRAFT_SEQUENCE.slice(state.stepIndex).forEach(step => {
                                                if (step.side === 'BLUE') {
                                                    if (step.type === 'BAN') { banCount++; slots.push({ type: 'BAN', slotNum: banCount }) }
                                                    else { pickCount++; slots.push({ type: 'PICK', slotNum: pickCount }) }
                                                }
                                            })
                                            return slots
                                        })()
                                    }}
                                />
                                {/* RED Side (Right) */}
                                <DraftTeamPanel
                                    side="RED"
                                    teamName={game.red_team_name}
                                    bans={state.redBans}
                                    picks={state.redPicks}
                                    currentStep={currentStep}
                                    isFinished={state.isFinished}
                                    selectedHero={selectedHero}
                                    getHero={getHero}
                                    manualLanes={manualLanes}
                                    onLaneAssign={handleLaneAssign}
                                    suggestionProps={{
                                        suggestions: redSuggestions,
                                        isLoading: isRedSuggestLoading,
                                        onGenerate: (mode) => handleGenerateSuggestion('RED', mode),
                                        onSelectHero: handleHeroClick,
                                        activeLayers: currentMode.layers.filter(l => l.isActive),
                                        upcomingSlots: (() => {
                                            const slots: { type: 'BAN' | 'PICK', slotNum: number }[] = []
                                            const past = DRAFT_SEQUENCE.slice(0, state.stepIndex).filter(s => s.side === 'RED')
                                            let banCount = past.filter(s => s.type === 'BAN').length
                                            let pickCount = past.filter(s => s.type === 'PICK').length
                                            DRAFT_SEQUENCE.slice(state.stepIndex).forEach(step => {
                                                if (step.side === 'RED') {
                                                    if (step.type === 'BAN') { banCount++; slots.push({ type: 'BAN', slotNum: banCount }) }
                                                    else { pickCount++; slots.push({ type: 'PICK', slotNum: pickCount }) }
                                                }
                                            })
                                            return slots
                                        })()
                                    }}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 1: HERO SELECTOR */}
                    <TabsContent value="hero" className="flex-1 flex flex-col min-h-0 gap-0.5 data-[state=active]:flex m-0 overflow-hidden mb-24 lg:mb-0">
                        {/* Filters */}
                        <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                            <div className="flex gap-2 shrink-0">
                                <div className="relative flex-1">
                                    <Input
                                        placeholder="Search heroes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 h-7 text-xs"
                                    />
                                </div>
                                <div className="flex gap-1 flex-wrap justify-center">
                                    {['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(role => (
                                        <Button
                                            key={role}
                                            size="sm"
                                            variant={selectedRole === role ? 'default' : 'outline'}
                                            onClick={() => setSelectedRole(role)}
                                            className={`h-7 px-2 text-[10px] lg:text-xs ${selectedRole === role ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-transparent border-slate-700 hover:bg-slate-800 text-slate-400'}`}
                                        >
                                            {role}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-950/30 rounded-lg p-2 h-full">
                                {filteredHeroes.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        No heroes found.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] md:grid-cols-8 lg:grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                                        {filteredHeroes.map(hero => {
                                            const isUnavailable = unavailableIds.includes(hero.id)
                                            const isSelected = selectedHero?.id === hero.id

                                            // Determine status for label
                                            let statusLabel = ''
                                            let statusColor = 'bg-red-600/80' // default

                                            if (pickedIds.includes(hero.id)) statusLabel = 'PICKED'
                                            else if (bannedIds.includes(hero.id)) statusLabel = 'BANNED'
                                            else if (currentGlobalBans.includes(hero.id) && !isBanPhase) statusLabel = 'GLOBAL'
                                            else if (opponentGlobalBans.includes(hero.id) && isBanPhase) {
                                                statusLabel = 'ENEMY USED'
                                                statusColor = 'bg-slate-600/90'
                                            }
                                            else if (currentGlobalBans.includes(hero.id) && isBanPhase) {
                                                // "Denial" suggestion - No Text Label, just Green Border
                                                statusLabel = ''
                                                statusColor = 'bg-green-600/90'
                                            }

                                            // Selection Logic with priority for Suggestions
                                            let borderColorClass = 'border-transparent'
                                            let ringClass = ''
                                            let scaleClass = ''
                                            let contentZ = 'z-0 hover:z-10'

                                            const isSuggested = currentGlobalBans.includes(hero.id) && isBanPhase

                                            if (isSelected) {
                                                scaleClass = 'scale-110'
                                                contentZ = 'z-20'
                                                if (isSuggested) {
                                                    borderColorClass = 'border-green-500'
                                                    ringClass = 'ring-4 ring-green-500/50'
                                                } else {
                                                    borderColorClass = 'border-yellow-400'
                                                    ringClass = 'ring-1 ring-yellow-400/50'
                                                }
                                            } else if (isSuggested && !isUnavailable) {
                                                // Suggested but not selected
                                                borderColorClass = 'border-green-500'
                                                ringClass = 'ring-2 ring-green-500/50'
                                                contentZ = 'z-10'
                                                scaleClass = 'scale-105'
                                            }

                                            const isEnemyUsed = statusLabel === 'ENEMY USED'

                                            return (
                                                <button
                                                    key={hero.id}
                                                    disabled={isUnavailable}
                                                    onClick={() => handleHeroClick(hero)}
                                                    className={`
                                                relative aspect-square rounded overflow-hidden border transition-all group
                                                ${isUnavailable
                                                            ? (isEnemyUsed ? 'opacity-90 cursor-not-allowed border-slate-700' : 'grayscale opacity-50 border-slate-800 cursor-not-allowed')
                                                            : `hover:scale-110 cursor-pointer ${contentZ}`
                                                        }
                                                ${borderColorClass} ${ringClass} ${scaleClass}
                                            `}
                                                >
                                                    <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" sizes="5vw" />
                                                    {statusLabel && (
                                                        <div className={`absolute inset-0 flex items-center justify-center z-10 ${isEnemyUsed ? '' : 'bg-black/60'}`}>
                                                            <span className={`
                                                        font-black text-white uppercase tracking-tighter 
                                                        ${isEnemyUsed
                                                                    ? 'text-[8px] bg-slate-800/90 py-0.5 w-full text-center bottom-0 absolute tracking-normal'
                                                                    : `text-[8px] sm:text-[10px] -rotate-12 border-2 border-white/50 px-1 rounded transform ${statusColor}`
                                                                }
                                                    `}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>


                        </div>
                    </TabsContent>

                    {/* Tab 2: GLOBAL BANS */}
                    <TabsContent value="global-bans" className="flex-1 flex flex-col min-h-0 bg-slate-900/50 border border-slate-800 rounded-xl p-4 data-[state=active]:flex m-0 overflow-y-auto">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center mb-4">Historical Bans (Previous Games)</h4>

                        <div className="space-y-3">
                            {/* Header */}
                            <div className="flex justify-between px-4 py-2 bg-slate-950/50 rounded-lg text-xs font-bold uppercase border border-slate-800">
                                <span className="text-blue-400 w-1/2 text-center border-r border-slate-800">{match.team_a_name}</span>
                                <span className="text-red-400 w-1/2 text-center">{match.team_b_name}</span>
                            </div>

                            {/* Game Rows */}
                            {match.games?.filter(g => g.game_number < game.game_number).map((g) => {
                                // Extract picks for this specific game
                                const picks = g.picks || []
                                const bluePicks = picks.filter(p => p.side === 'BLUE' && p.type === 'PICK').map(p => p.hero_id)
                                const redPicks = picks.filter(p => p.side === 'RED' && p.type === 'PICK').map(p => p.hero_id)

                                // Determine which picks belong to Team A (Left Column) and Team B (Right Column)
                                const teamAIsBlue = g.blue_team_name === match.team_a_name
                                const teamAPicks = teamAIsBlue ? bluePicks : redPicks
                                const teamBPicks = teamAIsBlue ? redPicks : bluePicks

                                return (
                                    <div key={g.id} className="flex flex-col gap-1 bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-mono text-slate-500">GAME {g.game_number}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 ${teamAIsBlue ? 'text-blue-400' : 'text-red-400'}`}>
                                                {teamAIsBlue ? 'BLUE SIDE' : 'RED SIDE'} (A)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 md:gap-8 divide-x divide-slate-800/50">
                                            {/* Left Column: Team A Picks */}
                                            <div className="flex flex-wrap gap-2 justify-center content-start">
                                                {teamAPicks.map(id => {
                                                    const h = getHero(id)
                                                    return h ? (
                                                        <div key={id} className="relative group">
                                                            <Image src={h.icon_url} alt={h.name} width={32} height={32} className="rounded border border-slate-700 grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all" title={h.name} />
                                                        </div>
                                                    ) : null
                                                })}
                                                {teamAPicks.length === 0 && <span className="text-xs text-slate-600">-</span>}
                                            </div>
                                            {/* Right Column: Team B Picks */}
                                            <div className="flex flex-wrap gap-2 justify-center content-start">
                                                {teamBPicks.map(id => {
                                                    const h = getHero(id)
                                                    return h ? (
                                                        <div key={id} className="relative group">
                                                            <Image src={h.icon_url} alt={h.name} width={32} height={32} className="rounded border border-slate-700 grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all" title={h.name} />
                                                        </div>
                                                    ) : null
                                                })}
                                                {teamBPicks.length === 0 && <span className="text-xs text-slate-600">-</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {(match.games?.filter(g => g.game_number < game.game_number).length === 0) && (
                                <div className="text-center text-slate-500 py-8 italic flex flex-col items-center gap-2">
                                    <ShieldBan className="w-8 h-8 opacity-20" />
                                    <span>No global bans active (First Game)</span>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab 3: CEREBRO AI */}
                    <TabsContent value="cerebro-ai" className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-2 data-[state=active]:flex m-0 overflow-hidden">
                        <Tabs value={aiTab} onValueChange={setAiTab} className="flex-1 flex flex-col min-h-0">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 shrink-0 gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                                        onClick={() => setCurrentTab('hero')}
                                        title="Back to Heroes"
                                    >
                                        <ChevronDown className="w-4 h-4 rotate-90" />
                                    </Button>
                                    <h3 className="font-bold text-indigo-400 flex items-center gap-2 text-xs md:text-sm truncate min-w-0">
                                        <Brain className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                                        <span className="shrink-0">CEREBRO AI •</span>
                                        <span className="truncate">{currentMode.name.split('(')[0]}</span>
                                    </h3>
                                </div>

                                <TabsList className="bg-slate-950/50 border border-slate-800 p-0.5 h-auto min-h-[36px] md:h-10 w-full md:w-auto overflow-x-auto justify-start gap-0.5 scrollbar-none">
                                    <TabsTrigger value="suggestions" title="Suggestion" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400 data-[state=active]:border-indigo-500/50 border border-transparent text-slate-500 hover:text-indigo-300 transition-all shrink-0"><Home className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="meta" title="Meta Analysis" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/50 border border-transparent text-slate-500 hover:text-purple-300 transition-all shrink-0"><Globe className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="counter" title="Counter Matchups" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 data-[state=active]:border-red-500/50 border border-transparent text-slate-500 hover:text-red-300 transition-all shrink-0"><Swords className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="comfort" title="Team Hero Pool" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/50 border border-transparent text-slate-500 hover:text-blue-300 transition-all shrink-0"><Users className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="opponent-pool" title="Opponent Pool" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400 data-[state=active]:border-yellow-500/50 border border-transparent text-slate-500 hover:text-yellow-300 transition-all shrink-0"><Eye className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="roster" title="Roster Dominance" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500/50 border border-transparent text-slate-500 hover:text-cyan-300 transition-all shrink-0"><Target className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="ban" title="Ban Strategy" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 data-[state=active]:border-orange-500/50 border border-transparent text-slate-500 hover:text-orange-300 transition-all shrink-0"><ShieldBan className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="composition" title="Draft Composition" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400 data-[state=active]:border-pink-500/50 border border-transparent text-slate-500 hover:text-pink-300 transition-all shrink-0"><Brain className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="synergy" title="Synergies" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/50 border border-transparent text-slate-500 hover:text-emerald-300 transition-all shrink-0"><LinkIcon className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                    <TabsTrigger value="analysis" title="Analysis Config" className="w-9 h-9 md:w-10 md:h-9 px-0 data-[state=active]:bg-slate-700 data-[state=active]:text-white border border-transparent text-slate-500 hover:text-slate-300 transition-all shrink-0"><Settings2 className="w-5 h-5 md:w-5 md:h-5" /></TabsTrigger>
                                </TabsList>
                            </div>



                            <TabsContent value="suggestions" className="flex-1 min-h-0 mt-0 flex flex-col">
                                {/* Role Filter */}
                                <div className="flex gap-1 mb-2 px-1">
                                    {['ALL', 'DSL', 'JUG', 'MID', 'ADL', 'SUP'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setRecRoleFilter(role)}
                                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${recRoleFilter === role
                                                ? 'bg-indigo-600 text-white border-indigo-500'
                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                }`}
                                        >
                                            {role === 'ALL' ? 'ALL' : role}
                                        </button>
                                    ))}
                                </div>

                                {/* Picks / Bans Toggle */}
                                <div className="flex gap-2 mb-2 px-1 shrink-0">
                                    <button
                                        onClick={() => setRecTypeFilter('PICKS')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded flex items-center justify-center gap-2 border transition-all ${recTypeFilter === 'PICKS'
                                            ? 'bg-indigo-900/50 text-indigo-300 border-indigo-500/50'
                                            : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:bg-slate-800'
                                            }`}
                                    >
                                        <Brain className="w-3 h-3" />
                                        STRATEGIC PICKS
                                    </button>
                                    <button
                                        onClick={() => setRecTypeFilter('BANS')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded flex items-center justify-center gap-2 border transition-all ${recTypeFilter === 'BANS'
                                            ? 'bg-red-900/50 text-red-300 border-red-500/50'
                                            : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:bg-slate-800'
                                            }`}
                                    >
                                        <ShieldBan className="w-3 h-3" />
                                        STRATEGIC BANS
                                    </button>
                                </div>

                                {/* Auto-detect Phase and Side Info - Only show when BANS mode is active */}
                                {recTypeFilter === 'BANS' && (
                                    <div className="mb-2 px-1 shrink-0">
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-center">
                                            <div className="flex items-center justify-center gap-2 text-xs">
                                                <span className={`px-2 py-0.5 rounded ${state.stepIndex < 4 ? 'bg-orange-900/50 text-orange-300' : 'bg-red-900/50 text-red-300'}`}>
                                                    {state.stepIndex < 4 ? '🎯 Phase 1 (Opening)' : '⚔️ Phase 2 (Closing)'}
                                                </span>
                                                <span className="text-slate-500">•</span>
                                                <span className={`px-2 py-0.5 rounded ${currentStep?.side === 'BLUE' ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>
                                                    {currentStep?.side === 'BLUE' ? '🔵 Blue Side' : '🔴 Red Side'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <ScrollArea className="flex-1 -mr-2 pr-2 pb-24">
                                    {(() => {
                                        if (isLoadingRecommendations) {
                                            return (
                                                <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3 opacity-60">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                                    <span className="text-xs font-mono">Processing Matchup Data...</span>
                                                </div>
                                            )
                                        }



                                        // ... (rest of component) ...

                                        const filterByRole = (recs: any[]) => {
                                            if (recRoleFilter === 'ALL') return recs
                                            const roleMap: Record<string, string> = {
                                                'DSL': 'Dark Slayer',
                                                'JUG': 'Jungle',
                                                'MID': 'Mid',
                                                'ADL': 'Abyssal Dragon',
                                                'SUP': 'Roam'
                                            }
                                            const targetRole = roleMap[recRoleFilter]
                                            return recs.filter(r => r.hero.main_position?.includes(targetRole) || r.hero.main_position?.includes(targetRole === 'Abyssal Dragon' ? 'Abyssal' : targetRole))
                                        }

                                        const limit = recRoleFilter === 'ALL' ? 12 : 6

                                        // Use calculatedStrategicBans for the Right Panel
                                        const banRecs = (calculatedStrategicBans.length > 0
                                            ? filterByRole(calculatedStrategicBans)
                                            : filterByRole(recommendations.smartBan || [])).slice(0, limit)

                                        const pickRecs = filterByRole(recommendations.hybrid || []).slice(0, limit)

                                        // Debug info for variables we removed from scope but might want to log
                                        const currentTeamName = currentStep?.side === 'BLUE' ? game.red_team_name : game.blue_team_name
                                        const opponentTeamName = currentStep?.side === 'BLUE' ? game.blue_team_name : game.red_team_name
                                        const autoDetectedSide = currentStep?.side
                                        const autoDetectedPhase = state.stepIndex < 4 ? 'PHASE_1' : 'PHASE_2'

                                        console.log('[DEBUG] Ban Recs:', {
                                            count: banRecs.length,
                                            source: calculatedStrategicBans.length > 0 ? 'Strategic' : 'Fallback'
                                        })

                                        if ((!banRecs || banRecs.length === 0) && (!pickRecs || pickRecs.length === 0)) {
                                            return (
                                                <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3 opacity-60">
                                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                                        <Brain className="w-6 h-6 text-slate-600" />
                                                    </div>
                                                    <span className="text-xs">ไม่พบข้อมูล Scrim สำหรับ {opponentTeamName}</span>
                                                    <span className="text-[10px] text-slate-600">ต้องมี Full Draft Simulator logs ของ {opponentTeamName}</span>
                                                </div>
                                            )
                                        }

                                        const renderList = (recs: any[], title: string, icon: any, color: string) => {
                                            if (!recs || recs.length === 0) return null
                                            const TitleIcon = icon
                                            return (
                                                <div className="mb-6 last:mb-0">
                                                    <h4 className={`text-[10px] font-bold ${color} uppercase tracking-widest mb-3 flex items-center gap-2`}>
                                                        <TitleIcon className="w-3 h-3" /> {title}
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {recs.map((rec: any, idx: number) => (
                                                            <div key={rec.hero.id}
                                                                onClick={() => handleHeroClick(rec.hero)}
                                                                className="bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-all group flex items-start gap-3 relative overflow-hidden"
                                                            >
                                                                {/* Rank Badge */}
                                                                <div className="text-xs font-black text-slate-600 group-hover:text-indigo-500/50 font-mono mt-1">
                                                                    #{idx + 1}
                                                                </div>

                                                                <div className="relative w-10 h-10 rounded overflow-hidden border border-slate-600 group-hover:border-indigo-400 transition-colors shrink-0 bg-slate-800">
                                                                    {rec.hero.icon_url ? (
                                                                        <Image src={rec.hero.icon_url} alt={rec.hero.name || 'Hero'} fill className="object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                                                                            {(rec.hero.name || '?').charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-bold text-sm text-slate-200 group-hover:text-white truncate">{rec.hero.name}</span>
                                                                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${rec.score > 30 ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                                                                            {rec.score.toFixed(0)} PTS
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {rec.reason.split(' • ').map((r: string, i: number) => {
                                                                            let Icon = Brain
                                                                            let colorClass = "text-slate-400 bg-slate-800 border-slate-700"

                                                                            // Positive bonuses
                                                                            if (r.includes('Base Score')) { Icon = Globe; colorClass = "text-indigo-400 bg-indigo-900/30 border-indigo-800" }
                                                                            else if (r.includes('Team Pool') || r.includes('Comfort')) { Icon = Users; colorClass = "text-blue-400 bg-blue-900/30 border-blue-800" }
                                                                            else if (r.includes('Meta')) { Icon = Globe; colorClass = "text-purple-400 bg-purple-900/30 border-purple-800" }
                                                                            else if (r.includes('Hard Counter') || r.includes('Counters ')) { Icon = Swords; colorClass = "text-red-400 bg-red-900/30 border-red-800" }
                                                                            else if (r.includes('Synergy')) { Icon = LinkIcon; colorClass = "text-emerald-400 bg-emerald-900/30 border-emerald-800" }
                                                                            else if (r.includes('Fills ')) { Icon = Target; colorClass = "text-green-400 bg-green-900/30 border-green-800" }
                                                                            else if (r.includes('Main') && !r.includes('Deny')) { Icon = User; colorClass = "text-cyan-400 bg-cyan-900/30 border-cyan-800" }
                                                                            else if (r.includes('First Pick')) { Icon = Zap; colorClass = "text-amber-400 bg-amber-900/30 border-amber-800" }
                                                                            else if (r.includes('Draft Order')) { Icon = Brain; colorClass = "text-pink-400 bg-pink-900/30 border-pink-800" }
                                                                            else if (r.includes('Slot') || r.includes('Pattern')) { Icon = Target; colorClass = "text-yellow-400 bg-yellow-900/30 border-yellow-800" }
                                                                            else if (r.includes('Deny') || r.includes('Ban')) { Icon = ShieldBan; colorClass = "text-orange-400 bg-orange-900/30 border-orange-800" }
                                                                            else if (r.includes('Protect')) { Icon = Shield; colorClass = "text-teal-400 bg-teal-900/30 border-teal-800" }
                                                                            else if (r.includes('Pool')) { Icon = User; colorClass = "text-cyan-400 bg-cyan-900/30 border-cyan-800" }
                                                                            // Negative penalties
                                                                            else if (r.includes('Countered by') || r.includes('Weak vs')) { Icon = Swords; colorClass = "text-rose-400 bg-rose-900/30 border-rose-800" }
                                                                            else if (r.includes('Role Filled') || r.includes('Needs ')) { Icon = Ban; colorClass = "text-rose-400 bg-rose-900/30 border-rose-800" }

                                                                            return (
                                                                                <div key={i} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${colorClass}`}>
                                                                                    <Icon className="w-2.5 h-2.5" />
                                                                                    <span>{r}</span>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div className="pb-4">
                                                <div className="pb-4">
                                                    {recTypeFilter === 'BANS' && renderList(banRecs, autoDetectedPhase === 'PHASE_1' ? "Phase 1 Bans (Opening)" : "Phase 2 Bans (Closing)", ShieldBan, "text-red-400")}
                                                    {recTypeFilter === 'PICKS' && renderList(pickRecs, "Strategic Picks", Brain, "text-indigo-400")}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="comfort" className="flex-1 min-h-0 mt-0 flex flex-col">
                                <div className="flex items-center justify-between mb-2 border-b border-blue-900/30 pb-1 px-1 pt-1 shrink-0">
                                    <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Team Hero Pool</h4>
                                    {/* Team Filter Buttons */}
                                    <div className="flex gap-0.5">
                                        <button
                                            onClick={() => setTeamPoolFilter('ALL')}
                                            className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${teamPoolFilter === 'ALL' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                        >
                                            ALL
                                        </button>
                                        <button
                                            onClick={() => setTeamPoolFilter('TEAM_A')}
                                            className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors truncate max-w-[60px] ${teamPoolFilter === 'TEAM_A' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300'}`}
                                            title={match.team_a_name}
                                        >
                                            {match.team_a_name.length > 8 ? match.team_a_name.substring(0, 6) + '...' : match.team_a_name}
                                        </button>
                                        <button
                                            onClick={() => setTeamPoolFilter('TEAM_B')}
                                            className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors truncate max-w-[60px] ${teamPoolFilter === 'TEAM_B' ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-slate-800 text-red-400 hover:bg-red-900/50 hover:text-red-300'}`}
                                            title={match.team_b_name}
                                        >
                                            {match.team_b_name.length > 8 ? match.team_b_name.substring(0, 6) + '...' : match.team_b_name}
                                        </button>
                                    </div>
                                </div>
                                {/* Role Filter Buttons */}
                                <div className="flex gap-0.5 px-1 pb-2 shrink-0">
                                    {['ALL', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setTeamPoolRoleFilter(role)}
                                            className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${teamPoolRoleFilter === role ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                        >
                                            {role === 'ALL' ? 'ALL' : role === 'Dark Slayer' ? 'DS' : role === 'Jungle' ? 'JG' : role === 'Abyssal' ? 'AD' : role === 'Roam' ? 'SP' : role}
                                        </button>
                                    ))}
                                </div>
                                {isLoadingTeamPools ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : (() => {
                                    // Use direct team pool data from Scrim Logs
                                    // Filter by role if selected
                                    const filterByRole = (pool: any[]) => {
                                        if (teamPoolRoleFilter === 'ALL') return pool
                                        return pool.filter((item: any) =>
                                            item.roles?.includes(teamPoolRoleFilter) ||
                                            item.hero?.main_position?.includes(teamPoolRoleFilter)
                                        )
                                    }

                                    const teamAPool = filterByRole(matchTeamPools?.teamA?.pool || [])
                                    const teamBPool = filterByRole(matchTeamPools?.teamB?.pool || [])
                                    const teamAGames = matchTeamPools?.teamA?.totalGames || 0
                                    const teamBGames = matchTeamPools?.teamB?.totalGames || 0

                                    const renderPoolTable = (pool: any[], teamName: string, totalGames: number, accentColor: string) => (
                                        <div className="flex flex-col h-full">
                                            <div className={`text-[9px] font-bold uppercase tracking-widest text-center py-1 border-b border-${accentColor}-900/30 text-${accentColor}-400`}>
                                                {teamName} ({totalGames} games)
                                            </div>
                                            {/* Table Header */}
                                            <div className={`grid grid-cols-[1fr_50px_50px] gap-1 px-2 py-1 bg-slate-900/50 border-b border-slate-800 text-[8px] font-bold uppercase text-slate-500`}>
                                                <span>Hero</span>
                                                <span className="text-center">Picks</span>
                                                <span className="text-center">WR</span>
                                            </div>
                                            <ScrollArea className="flex-1">
                                                {pool.length > 0 ? pool.map((item: any) => {
                                                    return (
                                                        <div
                                                            key={item.hero.id}
                                                            className="grid grid-cols-[1fr_50px_50px] gap-1 px-2 py-1.5 hover:bg-slate-800/50 border-b border-slate-800/50 cursor-pointer transition-colors"
                                                            onClick={() => handleHeroClick(item.hero)}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="relative w-6 h-6 rounded overflow-hidden border border-slate-700 shrink-0">
                                                                    <Image src={item.hero.icon_url} alt={item.hero.name} fill className="object-cover" />
                                                                </div>
                                                                <span className="text-xs text-slate-200 truncate">{item.hero.name}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="text-blue-400 font-bold text-[10px]">{item.picks}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className={`font-bold text-[10px] ${item.winRate >= 50 ? 'text-green-400' : 'text-orange-400'}`}>
                                                                    {item.winRate.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                }) : (
                                                    <div className="text-center text-xs text-slate-600 py-8 italic">No scrim data available</div>
                                                )}
                                            </ScrollArea>
                                        </div>
                                    )

                                    return (
                                        <div className={`grid gap-2 flex-1 min-h-0 pb-24 ${teamPoolFilter === 'ALL' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                            {(teamPoolFilter === 'ALL' || teamPoolFilter === 'TEAM_A') && (
                                                <div className="bg-slate-950/30 rounded-lg border border-slate-800 overflow-hidden flex flex-col">
                                                    {renderPoolTable(teamAPool, match.team_a_name, teamAGames, 'blue')}
                                                </div>
                                            )}
                                            {(teamPoolFilter === 'ALL' || teamPoolFilter === 'TEAM_B') && (
                                                <div className="bg-slate-950/30 rounded-lg border border-slate-800 overflow-hidden flex flex-col">
                                                    {renderPoolTable(teamBPool, match.team_b_name, teamBGames, 'red')}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </TabsContent>

                            {/* Opponent Pool Tab - Shows enemy's hero pool with status */}
                            <TabsContent value="opponent-pool" className="flex-1 min-h-0 mt-0">
                                <div className="h-full flex flex-col">
                                    {/* Header with Filters */}
                                    <div className="flex items-center justify-between mb-2 border-b border-yellow-900/30 pb-1 px-2 pt-2 shrink-0">
                                        <h4 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
                                            Opponent Pool Status
                                        </h4>
                                        {/* Team Filter */}
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => setOpponentPoolTeamFilter('OPPONENT')}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${opponentPoolTeamFilter === 'OPPONENT' ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                            >
                                                Opponent
                                            </button>
                                            <button
                                                onClick={() => setOpponentPoolTeamFilter('TEAM_A')}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors truncate max-w-[55px] ${opponentPoolTeamFilter === 'TEAM_A' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400 hover:bg-blue-900/50'}`}
                                                title={match.team_a_name}
                                            >
                                                {match.team_a_name?.split(' ')[0] || 'A'}
                                            </button>
                                            <button
                                                onClick={() => setOpponentPoolTeamFilter('TEAM_B')}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors truncate max-w-[55px] ${opponentPoolTeamFilter === 'TEAM_B' ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-400 hover:bg-red-900/50'}`}
                                                title={match.team_b_name}
                                            >
                                                {match.team_b_name?.split(' ')[0] || 'B'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Role Filter */}
                                    <div className="flex gap-0.5 px-2 mb-2 shrink-0">
                                        {['ALL', 'DS', 'JG', 'MID', 'AB', 'SP'].map(roleKey => {
                                            const roleLabel = roleKey === 'ALL' ? 'ALL' : roleKey
                                            const roleValue = roleKey === 'DS' ? 'Dark Slayer' : roleKey === 'JG' ? 'Jungle' : roleKey === 'MID' ? 'Mid' : roleKey === 'AB' ? 'Abyssal' : roleKey === 'SP' ? 'Roam' : 'ALL'
                                            return (
                                                <button
                                                    key={roleKey}
                                                    onClick={() => setOpponentPoolRoleFilter(roleValue)}
                                                    className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${opponentPoolRoleFilter === roleValue ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                >
                                                    {roleLabel}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {(() => {
                                        // Determine which team to show based on filter
                                        const isBlueTurn = currentStep?.side === 'BLUE'

                                        let selectedTeamData: any = null
                                        let selectedTeamName = ''
                                        let opponentPicks: string[] = []

                                        if (opponentPoolTeamFilter === 'OPPONENT') {
                                            // Default: Show opponent based on current turn
                                            selectedTeamName = isBlueTurn ? game.red_team_name : game.blue_team_name
                                            opponentPicks = isBlueTurn
                                                ? Object.values(state.redPicks) as string[]
                                                : Object.values(state.bluePicks) as string[]
                                            selectedTeamData = isBlueTurn
                                                ? (game.red_team_name === match.team_a_name ? matchTeamPools?.teamA : matchTeamPools?.teamB)
                                                : (game.blue_team_name === match.team_a_name ? matchTeamPools?.teamA : matchTeamPools?.teamB)
                                        } else if (opponentPoolTeamFilter === 'TEAM_A') {
                                            selectedTeamName = match.team_a_name
                                            selectedTeamData = matchTeamPools?.teamA
                                            // If viewing Team A, opponent picks = what Team A has picked if they are blue/red
                                            opponentPicks = game.blue_team_name === match.team_a_name
                                                ? Object.values(state.bluePicks) as string[]
                                                : Object.values(state.redPicks) as string[]
                                        } else {
                                            selectedTeamName = match.team_b_name
                                            selectedTeamData = matchTeamPools?.teamB
                                            opponentPicks = game.blue_team_name === match.team_b_name
                                                ? Object.values(state.bluePicks) as string[]
                                                : Object.values(state.redPicks) as string[]
                                        }

                                        let opponentPool = selectedTeamData?.pool || []

                                        // Apply role filter
                                        if (opponentPoolRoleFilter !== 'ALL') {
                                            opponentPool = opponentPool.filter((item: any) =>
                                                item.roles?.includes(opponentPoolRoleFilter) ||
                                                item.hero?.main_position?.includes(opponentPoolRoleFilter)
                                            )
                                        }

                                        // Categorize heroes
                                        const bannedSet = new Set([...state.blueBans, ...state.redBans])
                                        const pickedSet = new Set(opponentPicks)

                                        // Get opponent's global bans (heroes they played in previous games)
                                        const blueIsTeamA = game.blue_team_name === match.team_a_name
                                        const opponentGlobalBansSet = new Set(
                                            opponentPoolTeamFilter === 'TEAM_A'
                                                ? Array.from(playedHeroesTeamA)
                                                : opponentPoolTeamFilter === 'TEAM_B'
                                                    ? Array.from(playedHeroesTeamB)
                                                    : (isBlueTurn
                                                        ? Array.from(blueIsTeamA ? playedHeroesTeamB : playedHeroesTeamA)
                                                        : Array.from(blueIsTeamA ? playedHeroesTeamA : playedHeroesTeamB))
                                        )

                                        const getStatus = (heroId: string) => {
                                            if (pickedSet.has(heroId)) return 'PICKED'
                                            if (bannedSet.has(heroId)) return 'BANNED'
                                            if (opponentGlobalBansSet.has(heroId)) return 'GLOBAL_BAN'
                                            return 'AVAILABLE'
                                        }

                                        const statusColors: Record<string, string> = {
                                            'PICKED': 'bg-green-500/20 text-green-400 border-green-500/50',
                                            'BANNED': 'bg-red-500/20 text-red-400 border-red-500/50',
                                            'GLOBAL_BAN': 'bg-slate-500/20 text-slate-400 border-slate-500/50',
                                            'AVAILABLE': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                        }

                                        const statusLabels: Record<string, string> = {
                                            'PICKED': 'USED',
                                            'BANNED': 'BANNED',
                                            'GLOBAL_BAN': 'PREV GAME',
                                            'AVAILABLE': 'AVAILABLE'
                                        }

                                        return (
                                            <ScrollArea className="flex-1">
                                                <div className="px-2 pb-2 space-y-1">
                                                    <div className="text-[10px] text-slate-500 mb-2">
                                                        <span className="font-bold">{selectedTeamName}</span> pool ({selectedTeamData?.totalGames || 0} games)
                                                    </div>
                                                    {isLoadingTeamPools ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
                                                        </div>
                                                    ) : opponentPool.length > 0 ? (
                                                        opponentPool.map((item: any) => {
                                                            const status = getStatus(item.hero?.id)
                                                            const isClickable = status === 'AVAILABLE'
                                                            return (
                                                                <div
                                                                    key={item.hero?.id}
                                                                    onClick={() => isClickable && item.hero && handleHeroClick(item.hero)}
                                                                    className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${status === 'AVAILABLE' ? 'bg-slate-900/50 border-yellow-900/30 hover:bg-yellow-900/20 hover:border-yellow-500/50 cursor-pointer' : 'bg-slate-950/50 border-slate-800 opacity-60'}`}
                                                                >
                                                                    <Image
                                                                        src={item.hero?.icon_url}
                                                                        alt={item.hero?.name}
                                                                        width={28}
                                                                        height={28}
                                                                        className={`rounded ${status !== 'AVAILABLE' ? 'grayscale' : ''}`}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-xs font-bold text-slate-300 truncate">{item.hero?.name}</div>
                                                                        <div className="text-[9px] text-slate-500">
                                                                            {item.picks} picks • {item.winRate?.toFixed(0)}% WR
                                                                        </div>
                                                                    </div>
                                                                    <Badge className={`text-[8px] px-1.5 py-0 h-4 ${statusColors[status]} border`}>
                                                                        {statusLabels[status]}
                                                                    </Badge>
                                                                </div>
                                                            )
                                                        })
                                                    ) : (
                                                        <div className="text-center text-xs text-slate-600 py-8">
                                                            No pool data available
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        )
                                    })()}
                                </div>
                            </TabsContent>

                            <TabsContent value="meta" className="flex-1 min-h-0 mt-0 flex flex-col overflow-hidden h-full">
                                <div className="flex items-center justify-between mb-2 border-b border-purple-900/30 pb-1 px-1 pt-1 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Meta Stats</h4>
                                        {/* ... (Badge logic unchanged) ... */}
                                        {match.ai_metadata?.settings?.tournamentId ? (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-400">
                                                {match.tournament?.name || 'Tournament'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-slate-600 text-slate-400">
                                                Global
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-0.5">
                                        {['ALL', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => setMetaFilter(role)}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${metaFilter === role ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                            >
                                                {role === 'ALL' ? 'ALL' : role === 'Dark Slayer' ? 'DS' : role === 'Jungle' ? 'JG' : role === 'Abyssal' ? 'AB' : role === 'Roam' ? 'SP' : role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 bg-slate-950/30 rounded-lg border border-slate-800 h-full">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 pb-24">
                                        {recommendations.meta?.filter((item: any) => metaFilter === 'ALL' || item.hero.main_position?.includes(metaFilter)).map((item: any) => (
                                            <div key={item.hero.id} className="bg-purple-950/10 border border-purple-900/20 p-2 rounded flex items-center gap-2 hover:bg-purple-900/20 transition-colors cursor-pointer" onClick={() => handleHeroClick(item.hero)}>
                                                <Image src={item.hero.icon_url} alt={item.hero.name} width={32} height={32} className="rounded" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-purple-200 truncate">{item.hero.name}</div>
                                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                                        <div className="text-[9px] text-slate-400">WR: <span className="text-white">{Number(item.stats.winRate).toFixed(1)}%</span></div>
                                                        <div className="text-[9px] text-slate-400">PR: <span className="text-white">{Number(item.stats.pickRate).toFixed(1)}%</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {!recommendations.meta?.length && <div className="col-span-1 md:col-span-2 text-center text-xs text-slate-500 italic py-4">No Meta data available</div>}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* 4. COUNTER MATCHUPS */}
                            <TabsContent value="counter" className="flex-1 min-h-0 mt-0 flex flex-col">
                                <div className="flex flex-col gap-1.5 mb-2 border-b border-red-900/30 pb-2 px-1 pt-1 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Counter Matchups (Lane)</h4>
                                        {/* Team Filter */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setCounterTeamFilter('ALL')}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition-colors ${counterTeamFilter === 'ALL' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                            >
                                                ALL
                                            </button>
                                            <button
                                                onClick={() => setCounterTeamFilter('TEAM_A')}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors truncate max-w-[65px] ${counterTeamFilter === 'TEAM_A' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300'}`}
                                                title={match.team_a_name}
                                            >
                                                {match.team_a_name.length > 8 ? match.team_a_name.substring(0, 6) + '...' : match.team_a_name}
                                            </button>
                                            <button
                                                onClick={() => setCounterTeamFilter('TEAM_B')}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors truncate max-w-[65px] ${counterTeamFilter === 'TEAM_B' ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-slate-800 text-red-400 hover:bg-red-900/50 hover:text-red-300'}`}
                                                title={match.team_b_name}
                                            >
                                                {match.team_b_name.length > 8 ? match.team_b_name.substring(0, 6) + '...' : match.team_b_name}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Role Filter */}
                                    <div className="flex gap-0.5">
                                        {['ALL', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => setCounterFilter(role)}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${counterFilter === role ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                            >
                                                {role === 'ALL' ? 'ALL' : role === 'Dark Slayer' ? 'DS' : role === 'Jungle' ? 'JG' : role === 'Abyssal' ? 'AB' : role === 'Roam' ? 'SP' : role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 bg-slate-950/30 rounded-lg p-2 border border-slate-800 pb-24">
                                    {counterTeamFilter !== 'ALL' ? (
                                        // Team-specific Lane Matchups View
                                        <div className="flex flex-col gap-3">
                                            {(() => {
                                                const selectedTeamName = counterTeamFilter === 'TEAM_A' ? match.team_a_name : match.team_b_name;
                                                const stats = teamStats[selectedTeamName];
                                                const laneMatchups = stats?.laneMatchups || {};
                                                const roles = counterFilter === 'ALL'
                                                    ? ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
                                                    : [counterFilter];

                                                const getHeroInfo = (id: string) => {
                                                    const fromStats = stats?.heroStats?.[id];
                                                    if (fromStats) return { name: fromStats.name, icon: fromStats.icon };
                                                    const fromMap = heroMap?.[id];
                                                    if (fromMap) return { name: fromMap.name, icon: fromMap.icon_url };
                                                    const fromInitial = initialHeroes.find(h => h.id === id);
                                                    if (fromInitial) return { name: fromInitial.name, icon: fromInitial.icon_url };
                                                    return { name: 'Unknown', icon: '' };
                                                };

                                                // Get currently picked and banned heroes in this game
                                                const currentBluePicks = Object.values(state.bluePicks).filter(Boolean) as string[];
                                                const currentRedPicks = Object.values(state.redPicks).filter(Boolean) as string[];
                                                const currentBans = [...state.blueBans, ...state.redBans];
                                                const allUnavailable = [...currentBluePicks, ...currentRedPicks, ...currentBans];

                                                // Determine which picks belong to enemy team
                                                const isTeamABlue = game?.blue_team_name === match.team_a_name;
                                                const enemyTeamPicks = counterTeamFilter === 'TEAM_A'
                                                    ? (isTeamABlue ? currentRedPicks : currentBluePicks)
                                                    : (isTeamABlue ? currentBluePicks : currentRedPicks);

                                                // Get team's hero pool (heroes they've played historically)
                                                const teamHeroPool = Object.keys(stats?.heroStats || {});

                                                // Filter to available heroes in team pool (not picked, not banned)
                                                const availablePoolHeroes = teamHeroPool.filter(id => !allUnavailable.includes(id));

                                                if (enemyTeamPicks.length === 0) {
                                                    return <div className="text-center text-xs text-slate-500 italic py-4">Enemy team has not picked any heroes yet</div>;
                                                }

                                                const allMatchups: any[] = [];

                                                // For each role, find matchups between available pool heroes and enemy picks
                                                roles.forEach(role => {
                                                    const roleMatchups = laneMatchups[role] || {};

                                                    // For each enemy hero picked in this game
                                                    enemyTeamPicks.forEach(enemyId => {
                                                        const enemyInfo = getHeroInfo(enemyId);
                                                        const matchupsVsEnemy = roleMatchups[enemyId] || {};

                                                        // For each hero in our available pool that has matchup data vs this enemy
                                                        Object.entries(matchupsVsEnemy).forEach(([myId, s]: [string, any]) => {
                                                            // Only include if hero is in our available pool
                                                            if (!availablePoolHeroes.includes(myId)) return;

                                                            const myInfo = getHeroInfo(myId);
                                                            const winRate = s.games > 0 ? (s.wins / s.games) * 100 : 0;
                                                            allMatchups.push({
                                                                role,
                                                                myHero: { id: myId, ...myInfo },
                                                                enemyHero: { id: enemyId, ...enemyInfo },
                                                                games: s.games,
                                                                wins: s.wins,
                                                                winRate,
                                                                isWinning: winRate >= 50
                                                            });
                                                        });
                                                    });
                                                });

                                                // Sort: Winners first, then by win rate descending
                                                allMatchups.sort((a, b) => {
                                                    if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1;
                                                    return b.winRate - a.winRate;
                                                });

                                                if (allMatchups.length === 0) {
                                                    return <div className="text-center text-xs text-slate-500 italic py-4">No lane matchup data for {selectedTeamName} vs enemy picks</div>;
                                                }

                                                return allMatchups.map((m, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`p-2 rounded flex items-center justify-between transition-colors cursor-pointer ${m.isWinning ? 'bg-green-950/20 border border-green-900/30 hover:bg-green-900/30' : 'bg-red-950/20 border border-red-900/30 hover:bg-red-900/30'}`}
                                                        onClick={() => {
                                                            const hero = initialHeroes.find(h => h.id === m.myHero.id);
                                                            if (hero) handleHeroClick(hero);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {m.myHero.icon && <Image src={m.myHero.icon} alt={m.myHero.name} width={28} height={28} className={`rounded border ${m.isWinning ? 'border-green-500/30' : 'border-red-500/30'}`} />}
                                                            <div>
                                                                <div className={`text-xs font-bold ${m.isWinning ? 'text-green-200' : 'text-red-200'}`}>{m.myHero.name}</div>
                                                                <div className="text-[9px] text-slate-500">{m.role}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-500">vs</span>
                                                            {m.enemyHero.icon && <Image src={m.enemyHero.icon} alt={m.enemyHero.name} width={20} height={20} className="rounded grayscale opacity-70" />}
                                                            <div className="text-right">
                                                                <div className="text-[9px] text-slate-400">{m.enemyHero.name}</div>
                                                                <div className="text-[8px] text-slate-600">@ {m.role}</div>
                                                            </div>
                                                            <div className="text-right border-l border-slate-700 pl-2">
                                                                <span className={`text-[10px] font-bold ${m.isWinning ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {m.winRate.toFixed(0)}% WR
                                                                </span>
                                                                <div className="text-[8px] text-slate-600">{m.wins}W/{m.games - m.wins}L</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    ) : (
                                        // Original Global Counters View
                                        <div className="flex flex-col gap-2">
                                            {recommendations.counters?.filter((item: any) => counterFilter === 'ALL' || item.lane === counterFilter).map((item: any, idx: number) => (
                                                <div key={idx} className="bg-red-950/10 border border-red-900/20 p-2 rounded flex items-center justify-between hover:bg-red-900/20 transition-colors cursor-pointer" onClick={() => handleHeroClick(item.hero)}>
                                                    <div className="flex items-center gap-2">
                                                        <Image src={item.hero.icon_url} alt={item.hero.name} width={28} height={28} className="rounded border border-red-500/30" />
                                                        <div>
                                                            <div className="text-xs font-bold text-red-200">{item.hero.name}</div>
                                                            {item.lane && (
                                                                <div className="text-[9px] text-slate-500">{item.lane}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                                        <span>vs</span>
                                                        <div className="flex items-center gap-1">
                                                            <Image src={item.target.icon_url} alt={item.target.name} width={20} height={20} className="rounded grayscale opacity-70" />
                                                            <div className="text-right">
                                                                <div className="text-[9px] text-slate-400">{item.target.name}</div>
                                                                {item.lane && <div className="text-[8px] text-slate-600">@ {item.lane}</div>}
                                                            </div>
                                                        </div>
                                                        <span className="text-red-400 font-bold border-l border-slate-700 pl-2">{(item.winRate - 50).toFixed(1)}% Adv</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {!recommendations.counters?.filter((item: any) => counterFilter === 'ALL' || item.lane === counterFilter).length && <div className="text-center text-xs text-slate-500 italic py-4">No significant counter matchups found</div>}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>



                            {/* DRAFT STRATEGY ANALYSIS (4 Sections) */}
                            <TabsContent value="composition" className="flex-1 min-h-0 mt-0">
                                <ScrollArea className="h-full bg-slate-950/30 rounded-lg p-2 border border-slate-800">
                                    <div className="space-y-3">
                                        {/* Header with Team & Side Filters */}
                                        <div className="flex items-center justify-between mb-2 border-b border-pink-900/30 pb-2">
                                            <h4 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Draft Strategy Analysis</h4>
                                            <div className="flex items-center gap-2">
                                                {/* Team Filter */}
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setDraftStrategyTeamFilter('BLUE')}
                                                        className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${draftStrategyTeamFilter === 'BLUE'
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-slate-800 text-blue-400 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {match.team_a_name?.slice(0, 10) || 'Blue'}
                                                    </button>
                                                    <button
                                                        onClick={() => setDraftStrategyTeamFilter('RED')}
                                                        className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${draftStrategyTeamFilter === 'RED'
                                                            ? 'bg-red-600 text-white'
                                                            : 'bg-slate-800 text-red-400 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {match.team_b_name?.slice(0, 10) || 'Red'}
                                                    </button>
                                                </div>
                                                {/* Side Indicator (auto-detected) */}
                                                <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${draftStrategySide === 'BLUE' ? 'bg-blue-600/30 text-blue-300' : 'bg-red-600/30 text-red-300'}`}>
                                                    {draftStrategySide} Side
                                                </span>
                                            </div>
                                        </div>

                                        {/* Inner Tabs for 4 Sections */}
                                        <div className="flex gap-1 mb-2">
                                            {[
                                                { id: 'priorities', label: 'Pick Order' },
                                                { id: 'flex', label: 'Flex Picks' },
                                                { id: 'conditions', label: 'Win Cond.' },
                                                { id: 'counters', label: 'Counters' }
                                            ].map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setDraftStrategyTab(tab.id as any)}
                                                    className={`flex-1 px-2 py-1 text-[8px] rounded font-bold transition-all ${draftStrategyTab === tab.id
                                                        ? 'bg-pink-600 text-white'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* No Data State */}
                                        {!draftStrategyStats && (
                                            <div className="text-center text-xs text-slate-500 italic py-8">
                                                No data available for {draftStrategyTeamFilter === 'BLUE' ? match.team_a_name : match.team_b_name}
                                            </div>
                                        )}

                                        {/* 1. Pick Order Priority */}
                                        {draftStrategyTab === 'priorities' && draftStrategyStats && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] text-slate-500">Most frequent roles picked per slot</p>
                                                {roleTimeline.length > 0 ? (
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {roleTimeline.slice(0, 10).map((slotData) => (
                                                            <div key={slotData.slot} className="bg-slate-900/50 p-2 rounded border border-slate-800">
                                                                <div className="text-[9px] text-slate-600 font-mono mb-1">Pick #{slotData.slot}</div>
                                                                {slotData.topRoles.map((r: any, idx: number) => (
                                                                    <div key={r.role} className="flex items-center justify-between text-[8px]">
                                                                        <span className={idx === 0 ? 'text-pink-300 font-bold' : 'text-slate-500'}>{r.role}</span>
                                                                        <span className="text-slate-600 font-mono">{r.pct.toFixed(0)}%</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-500 italic py-4">No pick order data available</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 2. Phase 1 Flex Picks */}
                                        {draftStrategyTab === 'flex' && draftStrategyStats && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] text-slate-500">Heroes played in 2+ roles - good for hiding strategy</p>
                                                {flexPicks.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {flexPicks.map((hero: any) => (
                                                            <div key={hero.id} className="bg-purple-900/10 p-2 rounded border border-purple-500/20 flex items-center gap-2">
                                                                {hero.icon && <img src={hero.icon} className="w-8 h-8 rounded border border-purple-500/30" />}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs font-bold text-purple-200 truncate">{hero.name}</div>
                                                                    <div className="flex gap-1 mt-0.5 flex-wrap">
                                                                        {Object.keys(hero.roleStats || {}).slice(0, 3).map((r: string) => (
                                                                            <span key={r} className="text-[7px] bg-slate-900 px-1 py-0.5 rounded text-slate-400 border border-slate-800">{r}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-[10px] font-bold text-purple-500/60">{hero.rolesPlayed} Roles</div>
                                                                    <div className="text-[9px] text-slate-500">{hero.picks} picks</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-500 italic py-4">No flex pick data available</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 3. Phase 2 Win Conditions */}
                                        {draftStrategyTab === 'conditions' && draftStrategyStats && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] text-slate-500">High win-rate heroes picked in Phase 2 (late picks)</p>
                                                {phase2Closers.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {phase2Closers.map((hero: any) => (
                                                            <div key={hero.id} className="bg-orange-900/10 p-2 rounded border border-orange-500/20 flex items-center gap-2">
                                                                {hero.icon && <img src={hero.icon} className="w-8 h-8 rounded border border-orange-500/30" />}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs font-bold text-orange-200 truncate">{hero.name}</div>
                                                                    <div className="text-[9px] text-slate-500">Late picked {hero.count}x</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className={`text-sm font-bold ${hero.winRate >= 60 ? 'text-green-400' : hero.winRate >= 50 ? 'text-slate-300' : 'text-red-400'}`}>
                                                                        {hero.winRate.toFixed(0)}%
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-600">WR</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-500 italic py-4">No win condition data available</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 4. Lane Counters */}
                                        {draftStrategyTab === 'counters' && draftStrategyStats && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] text-slate-500">Counter picks by lane position</p>
                                                {laneCounters.some((r: any) => r.matches.length > 0) ? (
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {laneCounters.map((roleBlock: any) => (
                                                            <div key={roleBlock.role} className="bg-slate-900/50 rounded border border-slate-800 overflow-hidden">
                                                                <div className="bg-slate-800 p-1 text-center text-[8px] font-bold text-slate-400 uppercase">{roleBlock.role}</div>
                                                                <div className="p-1 space-y-1">
                                                                    {roleBlock.matches.length > 0 ? roleBlock.matches.slice(0, 2).map((match: any, idx: number) => (
                                                                        <div key={idx} className="bg-slate-900/50 p-1 rounded">
                                                                            <div className="flex items-center gap-1 mb-1">
                                                                                {match.enemy?.icon && <img src={match.enemy.icon} className="w-4 h-4 rounded opacity-60" />}
                                                                                <span className="text-[7px] text-red-400 truncate">{match.enemy?.name}</span>
                                                                            </div>
                                                                            {match.counters.slice(0, 2).map((c: any) => (
                                                                                <div key={c.id} className="flex items-center justify-between text-[7px] bg-emerald-900/10 px-1 py-0.5 rounded mb-0.5">
                                                                                    <span className="text-emerald-300 truncate">{c.name}</span>
                                                                                    <span className="text-emerald-500 font-bold">{c.winRate.toFixed(0)}%</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )) : (
                                                                        <div className="text-[7px] text-slate-600 text-center py-2">No data</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-500 italic py-4">No lane counter data available</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* 5. SYNERGIES */}
                            <TabsContent value="synergy" className="flex-1 min-h-0 mt-0">
                                <ScrollArea className="h-full bg-slate-950/30 rounded-lg p-2 border border-slate-800">
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 border-b border-emerald-900/30 pb-1">Synergies (Combo)</h4>
                                    <div className="flex flex-col gap-2">
                                        {recommendations.synergies?.map((item: any, idx: number) => (
                                            <div key={idx} className="bg-emerald-950/10 border border-emerald-900/20 p-2 rounded flex items-center justify-between hover:bg-emerald-900/20 transition-colors cursor-pointer" onClick={() => handleHeroClick(item.hero)}>
                                                <div className="flex items-center gap-2">
                                                    <Image src={item.hero.icon_url} alt={item.hero.name} width={28} height={28} className="rounded border border-emerald-500/30" />
                                                    <div className="text-xs font-bold text-emerald-200">{item.hero.name}</div>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                                    <span>with</span>
                                                    <div className="flex items-center gap-1">
                                                        <Image src={item.partner.icon_url} alt={item.partner.name} width={20} height={20} className="rounded grayscale opacity-70" />
                                                        <span className="text-emerald-400 font-bold">+{item.score.toFixed(1)} Syn</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {!recommendations.synergies?.length && <div className="text-center text-xs text-slate-500 italic py-4">No strong synergies found with current picks</div>}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* 6. ROSTER DOMINANCE */}
                            <TabsContent value="roster" className="flex-1 min-h-0 mt-0">
                                <ScrollArea className="h-full bg-slate-950/30 rounded-lg p-2 border border-slate-800">
                                    <div className="flex items-center justify-between mb-2 border-b border-cyan-900/30 pb-2">
                                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                                            Roster Dominance (Specialist)
                                        </h4>
                                    </div>

                                    {/* Filters: Team & Role */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {/* Team Filter */}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-slate-500 uppercase">Team:</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setRosterTeamFilter('blue')}
                                                    className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${rosterTeamFilter === 'blue'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {match.team_a_name?.slice(0, 10) || 'Blue'}
                                                </button>
                                                <button
                                                    onClick={() => setRosterTeamFilter('red')}
                                                    className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${rosterTeamFilter === 'red'
                                                        ? 'bg-red-600 text-white'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {match.team_b_name?.slice(0, 10) || 'Red'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Role Filter */}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-slate-500 uppercase">Role:</span>
                                            <select
                                                value={rosterRoleFilter}
                                                onChange={(e) => setRosterRoleFilter(e.target.value)}
                                                className="bg-slate-800 text-[8px] text-white px-2 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                                            >
                                                <option value="All">All Roles</option>
                                                <option value="Dark Slayer">Dark Slayer</option>
                                                <option value="Jungle">Jungle</option>
                                                <option value="Mid">Mid</option>
                                                <option value="Abyssal">Abyssal</option>
                                                <option value="Roam">Roam</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Team Name Display */}
                                    <p className="text-[9px] text-slate-400 mb-2">Analyzing: <span className={`font-bold ${rosterTeamFilter === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{rosterDominanceData.teamName}</span></p>

                                    {/* Horizontal scroll for role columns */}
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {filteredRosterRoles?.map((roleBlock: any) => (
                                            <div key={roleBlock.role} className="flex flex-col gap-2 min-w-[140px] bg-slate-900/30 p-2 rounded-lg border border-white/5">
                                                {/* Role Header */}
                                                <div className="bg-slate-950/80 p-1.5 rounded text-center font-bold text-amber-500/80 text-[9px] uppercase border border-amber-900/20">
                                                    {roleBlock.role}
                                                </div>

                                                {/* 1. Our Signatures (Cyan) */}
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-slate-500 uppercase">⚔️ Signatures</div>
                                                    {roleBlock.signatures?.length > 0 ? roleBlock.signatures.map((h: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between text-[9px] bg-cyan-950/20 p-1 rounded border border-cyan-500/10"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <Image src={h.icon_url || ''} alt={h.name} width={20} height={20} className="rounded border border-cyan-500/30" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-cyan-200 truncate max-w-[60px]">{h.name}</span>
                                                                    <span className="text-[7px] text-slate-500">{h.rolePicks} Picks</span>
                                                                </div>
                                                            </div>
                                                            <span className={`font-mono font-bold text-[8px] ${h.roleWinRate >= 60 ? 'text-green-400' : 'text-slate-400'}`}>
                                                                {h.roleWinRate?.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    )) : <div className="text-[8px] text-slate-600 italic">No data</div>}
                                                </div>

                                                <div className="h-px bg-white/5" />

                                                {/* 2. Attack Weakness (Green) */}
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-slate-500 uppercase">🎯 Attack</div>
                                                    {roleBlock.targetWeakness?.length > 0 ? roleBlock.targetWeakness.map((e: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between text-[9px] bg-green-950/20 p-1 rounded border border-green-500/10">
                                                            <div className="flex items-center gap-1.5">
                                                                <Image src={e.icon_url || ''} alt={e.name} width={18} height={18} className="rounded opacity-80 grayscale hover:grayscale-0 transition-all" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-green-100 truncate max-w-[55px]">{e.name}</span>
                                                                    <span className="text-[6px] text-green-500/50">We Dominate</span>
                                                                </div>
                                                            </div>
                                                            <span className="font-bold text-green-400 text-[8px]">{e.winRate?.toFixed(0)}%</span>
                                                        </div>
                                                    )) : <div className="text-[8px] text-slate-600 italic">No exploited</div>}
                                                </div>

                                                {/* 3. Caution / Ban (Red) */}
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-slate-500 uppercase">⚠️ Caution</div>
                                                    {roleBlock.avoid?.length > 0 ? roleBlock.avoid.map((e: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between text-[9px] bg-red-950/20 p-1 rounded border border-red-500/10">
                                                            <div className="flex items-center gap-1.5">
                                                                <Image src={e.icon_url || ''} alt={e.name} width={18} height={18} className="rounded opacity-80 grayscale hover:grayscale-0 transition-all" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-red-100 truncate max-w-[55px]">{e.name}</span>
                                                                    <span className="text-[6px] text-red-500/50">We Struggle</span>
                                                                </div>
                                                            </div>
                                                            <span className="font-bold text-red-400 text-[8px]">{e.winRate?.toFixed(0)}%</span>
                                                        </div>
                                                    )) : <div className="text-[8px] text-slate-600 italic">No major threats</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!filteredRosterRoles?.length && <div className="text-center text-xs text-slate-500 italic py-4">No signature picks found for this team</div>}
                                </ScrollArea>
                            </TabsContent>

                            {/* 7. BAN STRATEGY */}
                            <TabsContent value="ban" className="flex-1 min-h-0 mt-0">
                                <ScrollArea className="h-full bg-slate-950/30 rounded-lg p-2 border border-slate-800">
                                    <div className="flex items-center justify-between mb-2 border-b border-orange-900/30 pb-2">
                                        <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                                            Ban Strategy Analysis
                                        </h4>
                                    </div>

                                    {/* Team Filter */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[8px] text-slate-500 uppercase">Team:</span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setRosterTeamFilter('blue')}
                                                className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${rosterTeamFilter === 'blue'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {match.team_a_name?.slice(0, 10) || 'Blue'}
                                            </button>
                                            <button
                                                onClick={() => setRosterTeamFilter('red')}
                                                className={`px-2 py-0.5 text-[8px] rounded font-bold transition-all ${rosterTeamFilter === 'red'
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {match.team_b_name?.slice(0, 10) || 'Red'}
                                            </button>
                                        </div>
                                        {/* Side Indicator (auto-detected) */}
                                        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${banStrategySide === 'BLUE' ? 'bg-blue-600/30 text-blue-300' : 'bg-red-600/30 text-red-300'}`}>
                                            {banStrategySide} Side
                                        </span>
                                    </div>

                                    {/* Get ban data from teamStats */}
                                    {(() => {
                                        const cleanTeamName = (name: string) => name?.replace(/\s*\(Bot\)\s*$/i, '') || name
                                        const selectedTeamName = rosterTeamFilter === 'blue' ? cleanTeamName(match.team_a_name) : cleanTeamName(match.team_b_name)
                                        const stats = teamStats[selectedTeamName]

                                        if (!stats || !heroMap) {
                                            return <div className="text-center text-xs text-slate-500 italic py-4">No ban data found for {selectedTeamName}</div>
                                        }

                                        // Get top heroes for specified slots (using auto-detected side)
                                        const getTopHeroesForSlots = (slots: number[], type: 'PICK' | 'BAN') => {
                                            const aggregated: Record<string, number> = {}
                                            slots.forEach(slot => {
                                                let source
                                                if (type === 'BAN') {
                                                    // Use side-specific stats based on auto-detected side
                                                    if (banStrategySide === 'BLUE') {
                                                        source = stats.sideStats?.BLUE?.banOrderStats
                                                    } else {
                                                        source = stats.sideStats?.RED?.banOrderStats
                                                    }
                                                    // Fallback to general stats if side-specific not available
                                                    if (!source) source = stats.banOrderStats
                                                } else {
                                                    // heroPickOrderStats for PICK type
                                                    if (banStrategySide === 'BLUE') {
                                                        source = stats.sideStats?.BLUE?.heroPickOrderStats || {}
                                                    } else {
                                                        source = stats.sideStats?.RED?.heroPickOrderStats || {}
                                                    }
                                                    // Fallback to general stats if side-specific not available
                                                    if (!source || Object.keys(source).length === 0) source = stats.heroPickOrderStats || {}
                                                }
                                                const slotData = source?.[slot] || {}
                                                Object.entries(slotData).forEach(([heroId, count]: [string, any]) => {
                                                    aggregated[heroId] = (aggregated[heroId] || 0) + count
                                                })
                                            })
                                            return Object.entries(aggregated)
                                                .map(([heroId, count]) => ({
                                                    heroId,
                                                    count,
                                                    hero: stats.heroStats?.[heroId] || heroMap?.[heroId]
                                                }))
                                                .filter(item => item.hero)
                                                .sort((a, b) => b.count - a.count)
                                        }

                                        // Phase 1 Bans: Slots 1, 2, 3, 4
                                        const phase1Bans = getTopHeroesForSlots([1, 2, 3, 4], 'BAN')
                                        // Phase 2 Bans: Slots 11, 12, 13, 14
                                        const phase2Bans = getTopHeroesForSlots([11, 12, 13, 14], 'BAN')
                                        // Phase 2 Picks (High Impact Targets): Slots 15, 16, 17, 18
                                        const phase2Picks = getTopHeroesForSlots([15, 16, 17, 18], 'PICK').map(p => ({
                                            ...p,
                                            winRate: p.hero?.picks > 0 ? (p.hero.wins / p.hero.picks) * 100 : 0
                                        })).sort((a, b) => b.winRate - a.winRate)

                                        return (
                                            <div className="space-y-4">
                                                {/* Phase 1 Bans */}
                                                <div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                                        <ShieldBan className="w-3 h-3 text-red-400" />
                                                        Phase 1 Opening Bans
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {phase1Bans.slice(0, 4).map((item: any, idx: number) => (
                                                            <div key={item.heroId} className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                                                                <div className="relative">
                                                                    <Image src={item.hero?.icon || item.hero?.icon_url || ''} alt={item.hero?.name} width={24} height={24} className="rounded" />
                                                                    <div className="absolute -top-1 -left-1 bg-slate-900 text-slate-400 text-[7px] w-4 h-4 flex items-center justify-center rounded-full border border-slate-700">
                                                                        #{idx + 1}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[9px] font-bold text-slate-200 truncate">{item.hero?.name}</div>
                                                                    <div className="text-[7px] text-slate-500">{item.count} bans</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {phase1Bans.length === 0 && <div className="col-span-2 text-[8px] text-slate-600 italic">No Phase 1 ban data</div>}
                                                    </div>
                                                </div>

                                                {/* Phase 2 Bans */}
                                                <div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                                        <ShieldBan className="w-3 h-3 text-orange-400" />
                                                        Phase 2 Closing Bans
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {phase2Bans.slice(0, 4).map((item: any, idx: number) => (
                                                            <div key={item.heroId} className="bg-red-950/20 p-2 rounded-lg border border-red-500/10 flex items-center gap-2">
                                                                <Image src={item.hero?.icon || item.hero?.icon_url || ''} alt={item.hero?.name} width={24} height={24} className="rounded grayscale opacity-80" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[9px] font-bold text-red-200 truncate">{item.hero?.name}</div>
                                                                    <div className="text-[7px] text-red-400/70">{item.count} bans</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {phase2Bans.length === 0 && <div className="col-span-2 text-[8px] text-slate-600 italic">No Phase 2 ban data</div>}
                                                    </div>
                                                </div>

                                                {/* Recommended Ban Targets */}
                                                <div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                                        <Zap className="w-3 h-3 text-yellow-400" />
                                                        Recommended Ban Targets
                                                    </div>
                                                    <p className="text-[7px] text-slate-500 mb-2">Heroes {selectedTeamName} frequently picks late. Banning disrupts their strategy.</p>
                                                    <div className="space-y-1">
                                                        {phase2Picks.slice(0, 4).map((item: any, idx: number) => (
                                                            <div key={item.heroId} className="bg-gradient-to-r from-yellow-500/10 to-transparent p-2 rounded-lg border border-yellow-500/20 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="relative">
                                                                        <Image src={item.hero?.icon || item.hero?.icon_url || ''} alt={item.hero?.name} width={28} height={28} className="rounded-lg" />
                                                                        {item.winRate > 60 && (
                                                                            <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[6px] font-bold px-1 rounded-full">
                                                                                HI
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[9px] font-bold text-yellow-100">{item.hero?.name}</div>
                                                                        <div className="flex gap-1 text-[7px] text-slate-400">
                                                                            <span>WR: <span className={item.winRate > 50 ? 'text-green-400' : 'text-red-400'}>{item.winRate.toFixed(0)}%</span></span>
                                                                            <span>•</span>
                                                                            <span>Picked: {item.count}x</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-[8px] font-mono text-white/20">#{idx + 1}</div>
                                                            </div>
                                                        ))}
                                                        {phase2Picks.length === 0 && <div className="text-[8px] text-slate-600 italic">No recommended ban targets</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="analysis" className="flex-1 min-h-0 mt-0">
                                <ScrollArea className="h-full bg-slate-950/30 rounded-lg p-2 border border-slate-800">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Configuration</h4>
                                            <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300">{currentMode.name}</Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 italic">{currentMode.description}</p>

                                        <div className="grid grid-cols-1 gap-2">
                                            {currentMode.layers.sort((a, b) => b.weight - a.weight).map((layer) => {
                                                const { icon: Icon, color } = getLayerIcon(layer.id)
                                                return (
                                                    <div key={layer.id} className={`p-3 rounded-lg border flex items-center justify-between ${layer.isActive ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-950/30 border-slate-800 opacity-50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded bg-slate-950 border border-slate-800 ${layer.isActive ? '' : 'grayscale'}`}>
                                                                <Icon className={`w-4 h-4 ${color}`} />
                                                            </div>
                                                            <div>
                                                                <div className={`text-sm font-bold ${layer.isActive ? 'text-slate-200' : 'text-slate-500'}`}>{layer.name}</div>
                                                                <div className="text-[10px] text-slate-500">{layer.isActive ? 'Active Layer' : 'Disabled'}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${layer.weight >= 1.5 ? 'bg-green-900/30 text-green-400 border border-green-900/50' : layer.weight >= 1.0 ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                                                {layer.weight}x
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                </Tabs>


                {/* MOBILE ADVISOR (Fixed Bottom Slide-in) */}
                <div className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden pointer-events-none">
                    <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md shadow-[0_-5px_20px_rgba(0,0,0,0.8)] border-t border-slate-800 rounded-t-xl overflow-hidden">
                        <DraftSuggestionPanel
                            side={currentStep?.side || 'BLUE'}
                            teamName={currentStep?.side === 'BLUE' ? game.blue_team_name : (currentStep?.side === 'RED' ? game.red_team_name : 'Draft Advisor')}
                            isActive={!state.isFinished}
                            onGenerate={(mode) => handleGenerateSuggestion(currentStep?.side || 'BLUE', mode)}
                            suggestions={currentStep?.side === 'BLUE' ? blueSuggestions : (currentStep?.side === 'RED' ? redSuggestions : [])}
                            isLoading={currentStep?.side === 'BLUE' ? isBlueSuggestLoading : isRedSuggestLoading}
                            onSelectHero={handleHeroClick}
                            activeLayers={currentMode.layers.filter(l => l.isActive)}
                            upcomingSlots={(() => {
                                const side = currentStep?.side || 'BLUE'
                                const slots: { type: 'BAN' | 'PICK', slotNum: number }[] = []
                                const past = DRAFT_SEQUENCE.slice(0, state.stepIndex).filter(s => s.side === side)
                                let banCount = past.filter(s => s.type === 'BAN').length
                                let pickCount = past.filter(s => s.type === 'PICK').length
                                DRAFT_SEQUENCE.slice(state.stepIndex).forEach(step => {
                                    if (step.side === side) {
                                        if (step.type === 'BAN') { banCount++; slots.push({ type: 'BAN', slotNum: banCount }) }
                                        else { pickCount++; slots.push({ type: 'PICK', slotNum: pickCount }) }
                                    }
                                })
                                return slots
                            })()}
                        />
                    </div>
                </div>


            </div >





            {/* RIGHT: RED TEAM (Hidden on mobile, shown on desktop) */}
            < div className="hidden lg:flex w-[22%] flex-col gap-1 shrink-0" >
                <DraftTeamPanel
                    side="RED"
                    teamName={game.red_team_name}
                    bans={state.redBans}
                    picks={state.redPicks}
                    currentStep={currentStep}
                    isFinished={state.isFinished}
                    selectedHero={selectedHero}
                    getHero={getHero}
                    manualLanes={manualLanes}
                    onLaneAssign={handleLaneAssign}
                    suggestionProps={{
                        suggestions: redSuggestions,
                        isLoading: isRedSuggestLoading,
                        onGenerate: (mode) => handleGenerateSuggestion('RED', mode),
                        onSelectHero: handleHeroClick,
                        activeLayers: currentMode.layers.filter(l => l.isActive),
                        upcomingSlots: (() => {
                            const slots: { type: 'BAN' | 'PICK', slotNum: number }[] = []
                            const past = DRAFT_SEQUENCE.slice(0, state.stepIndex).filter(s => s.side === 'RED')
                            let banCount = past.filter(s => s.type === 'BAN').length
                            let pickCount = past.filter(s => s.type === 'PICK').length
                            DRAFT_SEQUENCE.slice(state.stepIndex).forEach(step => {
                                if (step.side === 'RED') {
                                    if (step.type === 'BAN') { banCount++; slots.push({ type: 'BAN', slotNum: banCount }) }
                                    else { pickCount++; slots.push({ type: 'PICK', slotNum: pickCount }) }
                                }
                            })
                            return slots
                        })()
                    }}
                />
            </div >

        </div >


    )
})

export default DraftInterface
