'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { saveBatchScrimSummary } from '../actions' // One level up
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, ArrowLeft, Loader2, RotateCcw, Check } from 'lucide-react'
import Link from 'next/link'
import { HeroCombobox } from '@/components/admin/scrims/HeroCombobox' // Imported
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog"
import { Plus, Edit2, FileUp, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useRef } from 'react'


const ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

type Hero = {
    id: string
    name: string
    icon_url: string
    main_position: string[] | string
}

type PickData = {
    heroId: string
    role: string
    index: number
}

type GameState = {
    gameNumber: number
    bluePicks: Record<number, string> // index -> heroId
    redPicks: Record<number, string> // index -> heroId
    winner: 'blue' | 'red' | ''
    isTeamABlue: boolean
    blueKeyPlayer?: string
    redKeyPlayer?: string
}

export default function ScrimPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [match, setMatch] = useState<any>(null)
    const [heroes, setHeroes] = useState<Hero[]>([])
    const [loading, setLoading] = useState(true)

    // Multi-Game State
    const [activeTab, setActiveTab] = useState("game-1")
    const [gamesData, setGamesData] = useState<Record<number, GameState>>({})

    const [globalBans, setGlobalBans] = useState<Set<string>>(new Set()) // Tracks ALL picked heroes across ALL games needed? 
    // Wait, the user requirement for unique might be per-game or per-match?
    // "Prevent duplicate heroes across different dropdowns for the same game" -> Same game only?
    // Usually in scrims (Global Ban rules), if it's Global Ban, then heroes used in Game 1 cannot be used in Game 2 by the SAME team.
    // The previous implementation tracked `selections` for the current game only (+ previously finished games from DB).
    // Here we are editing ALL games. So we need to calculate exclusions dynamically based on:
    // 1. Current Game Picks (Unique check)
    // 2. Global Bans (Previous games' picks by same team)

    // Let's implement basic "Unique per Game" first, and "Global Ban" if standard.
    // User asked "Prevent duplicates... for the same game". So let's stick to that strict rule first. 
    // And also standard Global Ban rules usually apply.
    // Let's assume Standard Global Ban:
    // Team A cannot pick Hero X if Team A picked Hero X in previous games.

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()

            // 1. Fetch Match
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            let query = supabase.from('draft_matches').select('*')
            if (isUUID) query = query.eq('id', id)
            else query = query.eq('slug', id)

            const { data: m, error } = await query.single()
            if (error || !m) {
                console.error("Match not found", error)
                setLoading(false)
                return
            }
            setMatch(m)

            // 2. Fetch Heroes
            const { data: h } = await supabase.from('heroes').select('id, name, icon_url, main_position').order('name', { ascending: true })
            setHeroes(h || [])

            // 3. Initialize State based on existing games or default
            const totalGames = parseInt(m.mode.replace('BO', '')) || 1
            const initialData: Record<number, GameState> = {}

            // Pre-fill with existing DB games ?
            // For now, let's assume valid session data is primarily what we build here.
            // If editing an existing match, we should load it.
            // Let's fetch existing games/picks if any.
            const { data: existingGames } = await supabase.from('draft_games')
                .select(`*, picks:draft_picks(hero_id, side, position_index)`)
                .eq('match_id', m.id)
                .order('game_number', { ascending: true })

            for (let i = 1; i <= totalGames; i++) {
                const existing = existingGames?.find((g: any) => g.game_number === i)
                const bluePicks: Record<number, string> = {}
                const redPicks: Record<number, string> = {}

                let isTeamABlue = i % 2 !== 0 // Default: Game 1 = A Blue

                if (existing) {
                    existing.picks.forEach((p: any) => {
                        // Improved Mapping Logic:
                        // 1. Try to map by Role first (most robust for mixed sources)
                        // 2. Fallback to Position Index (handle 1-5 legacy or Simulator specific)

                        let idx = -1
                        if (p.assigned_role && ROLES.includes(p.assigned_role)) {
                            idx = ROLES.indexOf(p.assigned_role)
                        } else {
                            // Fallback: If 1-5, use as is. If > 5, this might be simulator data.
                            // But usually simulator data has roles.
                            // If index is 1-5, map to 0-4.
                            if (p.position_index >= 1 && p.position_index <= 5) {
                                idx = p.position_index - 1
                            }
                            // TODO: If simulator data comes in with indices like 6, 7, etc. and NO role, we can't map easily.
                            // But our Simulator ALWAYS saves roles.
                        }

                        if (idx !== -1) {
                            if (p.side === 'BLUE') bluePicks[idx] = p.hero_id
                            else redPicks[idx] = p.hero_id
                        }
                    })
                    // Determine side from saved names
                    if (existing.blue_team_name === m.team_b_name) {
                        isTeamABlue = false
                    }
                }

                initialData[i] = {
                    gameNumber: i,
                    bluePicks,
                    redPicks,
                    winner: existing ? (existing.winner === 'Blue' ? 'blue' : existing.winner === 'Red' ? 'red' : '') : '',
                    isTeamABlue,
                    blueKeyPlayer: existing?.blue_key_player_id || '',
                    redKeyPlayer: existing?.red_key_player_id || ''
                }
            }
            setGamesData(initialData)
            setLoading(false)
        }
        load()
    }, [id])

    const handlePick = (gameNum: number, side: 'blue' | 'red', roleIndex: number, heroId: string) => {
        setGamesData(prev => {
            const game = prev[gameNum]
            const newPicks = { ...game[side === 'blue' ? 'bluePicks' : 'redPicks'] }
            newPicks[roleIndex] = heroId
            return {
                ...prev,
                [gameNum]: {
                    ...game,
                    [side === 'blue' ? 'bluePicks' : 'redPicks']: newPicks
                }
            }
        })
    }

    const setWinner = (gameNum: number, winner: 'blue' | 'red') => {
        setGamesData(prev => ({
            ...prev,
            [gameNum]: { ...prev[gameNum], winner }
        }))
    }

    const setTeamSide = (gameNum: number, isTeamABlue: boolean) => {
        setGamesData(prev => ({
            ...prev,
            [gameNum]: { ...prev[gameNum], isTeamABlue }
        }))
    }

    const resetGame = (gameNum: number) => {
        setGamesData(prev => ({
            ...prev,
            [gameNum]: {
                ...prev[gameNum],
                bluePicks: {},
                redPicks: {},
                winner: '',
                blueKeyPlayer: '',
                redKeyPlayer: ''
            }
        }))
    }

    const setKeyPlayer = (gameNum: number, side: 'blue' | 'red', heroId: string) => {
        setGamesData(prev => ({
            ...prev,
            [gameNum]: {
                ...prev[gameNum],
                [side === 'blue' ? 'blueKeyPlayer' : 'redKeyPlayer']: heroId
            }
        }))
    }

    const validateAll = () => {
        if (!match) return false
        const totalGames = parseInt(match.mode.replace('BO', '')) || 1
        for (let i = 1; i <= totalGames; i++) {
            const g = gamesData[i]
            if (!g.winner) return false
            if (Object.keys(g.bluePicks).length < 5) return false
            if (Object.keys(g.redPicks).length < 5) return false
        }
        return true
    }

    const handleSaveAll = async () => {
        if (!validateAll()) {
            alert("Please complete all games and select a winner for each.") // Simple alert for now
            return
        }

        const payload = {
            totalGames: Object.keys(gamesData).length,
            games: Object.values(gamesData).map(g => ({
                gameNumber: g.gameNumber,
                blueTeamName: getTeamName(g.gameNumber, 'blue'),
                redTeamName: getTeamName(g.gameNumber, 'red'),
                winner: g.winner,
                blueKeyPlayer: g.blueKeyPlayer,
                redKeyPlayer: g.redKeyPlayer,
                bluePicks: Object.entries(g.bluePicks).map(([idx, hId]) => ({ heroId: hId, role: ROLES[parseInt(idx)], index: parseInt(idx) + 1 })),
                redPicks: Object.entries(g.redPicks).map(([idx, hId]) => ({ heroId: hId, role: ROLES[parseInt(idx)], index: parseInt(idx) + 1 }))
            }))
        }

        await saveBatchScrimSummary(match.id, payload)

        // Redirect to Simulator Summary -> REMOVED per user request
        // router.push(`/admin/simulator/${match.id}`)
        alert("Saved successfully!")
    }

    // Helper to determine Team Names based on Game Number (Side Swap Logic)
    // Now uses per-game state
    const getTeamName = (gameNum: number, side: 'blue' | 'red') => {
        if (!match) return ''
        const teamA = match.team_a_name
        const teamB = match.team_b_name

        const game = gamesData[gameNum]
        // Fallback if game data missing (shouldn't happen usually)
        const isABlue = game ? game.isTeamABlue : (gameNum % 2 !== 0)

        if (isABlue) {
            return side === 'blue' ? teamA : teamB
        } else {
            return side === 'blue' ? teamB : teamA
        }
    }

    // Helper to determine Team Names
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDownloadTemplate = () => {
        const headers = [
            'MATCH ID', 'Date', 'Tournament', 'Patch',
            'Recording Mode (Full,Quick)', 'Number of Games (1Game..... 7 games)', 'GAME(เกมที่ 1,2,3,4....)',
            'TEAM A', 'Team B', 'TEAM A SIDE (BLUE OR RED)', 'MATCH WIN (name TEAM A or name TEAM B)',
            // No Bans
            '5-Blue-Pick1', '6-Red-Pick2', '7-Red-Pick3', '8-Blue-Pick4', '9-Blue-Pick5', '10-Red-Pick6',
            '15-Red-Pick7', '16-Blue-Pick8', '17-Blue-Pick9', '18-Red-Pick10',
            'TEAM A POSITION1', 'TEAM A POSITION2', 'TEAM A POSITION3', 'TEAM A POSITION4', 'TEAM A POSITION5',
            'TEAM B POSITION1', 'TEAM B POSITION2', 'TEAM B POSITION3', 'TEAM B POSITION4', 'TEAM B POSITION5',
            'MVPTEAM A', 'MVPTEAM B', 'WIN % BLUE TEAM'
        ]

        const exampleRow = {
            'MATCH ID': match.slug || match.id,
            'Date': new Date().toISOString().split('T')[0],
            'Tournament': 'Example Tournament',
            'Patch': 'Current Patch',
            'Recording Mode (Full,Quick)': 'Quick Result Entry',
            'Number of Games (1Game..... 7 games)': match.mode || 'BO1',
            'GAME(เกมที่ 1,2,3,4....)': 'Game 1',
            'TEAM A': match.team_a_name,
            'Team B': match.team_b_name,
            'TEAM A SIDE (BLUE OR RED)': 'BLUE',
            'MATCH WIN (name TEAM A or name TEAM B)': match.team_a_name,
            '5-Blue-Pick1': 'Yena',
            '6-Red-Pick2': 'Violet',
            'TEAM A POSITION1': 'Dark Slayer',
            'TEAM B POSITION1': 'Abyssal Dragon',
            'MVPTEAM A': 'Yena',
            'MVPTEAM B': 'Violet',
            'WIN % BLUE TEAM': '50'
        }

        const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Import Template")
        XLSX.writeFile(wb, "Quick_Entry_Import_Template.xlsx")
    }


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const rawData = XLSX.utils.sheet_to_json(ws) as any[]

                // Process Data - Assume Rows correspond to Games 1, 2, 3...
                // Filter matches current match (optional) but user wants bulk upload 
                // We will just iterate the first N rows found and map them to Game 1, 2, 3...

                const supabase = createClient()

                // Group by MATCH ID to find relevant rows if mixed
                // Group by MATCH ID matches current?
                // Or just filter rows that have "MATCH ID" matching current slug?
                // Or just take all rows? 
                // Risk: Importing wrong match. 
                // Check: match.slug or match.id

                let relevantRows = rawData
                if (rawData.length > 0 && rawData[0]['MATCH ID']) {
                    // If existing, match against current
                    const rows = rawData.filter(r => r['MATCH ID'] === match.slug || r['MATCH ID'] === match.id)
                    if (rows.length > 0) relevantRows = rows
                }

                // Sort by Game Number if present?
                // "GAME(เกมที่ 1,2,3,4....)" -> "Game 1"
                relevantRows.sort((a, b) => {
                    const getG = (r: any) => {
                        const val = r['GAME(เกมที่ 1,2,3,4....)'] || r['GAME'] || r['Game']
                        const num = parseInt(String(val).replace(/\D/g, ''))
                        return isNaN(num) ? 0 : num
                    }
                    return getG(a) - getG(b)
                })


                const newGamesData = { ...gamesData } as Record<number, GameState>

                // Limit to Total Games defined in Match
                const totalGamesToProcess = Math.min(relevantRows.length, parseInt(match.mode.replace('BO', '')) || 1)

                for (let i = 0; i < totalGamesToProcess; i++) {
                    const row = relevantRows[i]
                    const gameNum = i + 1

                    // Parse Data
                    const teamASideStr = String(row['TEAM A SIDE (BLUE OR RED)'] || '').toUpperCase()
                    const matchWinName = row['MATCH WIN (name TEAM A or name TEAM B)']
                    const isTeamABlue = teamASideStr.includes('BLUE')

                    // Winner
                    let winner: 'blue' | 'red' | '' = ''
                    // Determine Blue/Red Team Names for logic
                    let blueTeamName = isTeamABlue ? match.team_a_name : match.team_b_name
                    let redTeamName = !isTeamABlue ? match.team_a_name : match.team_b_name

                    if (matchWinName) {
                        if (String(matchWinName).toLowerCase().includes(blueTeamName.trim().toLowerCase())) winner = 'blue'
                        else if (String(matchWinName).toLowerCase().includes(redTeamName.trim().toLowerCase())) winner = 'red'
                        // Fallback check against Team A/B
                        else if (String(matchWinName).toLowerCase().includes(match.team_a_name.trim().toLowerCase())) {
                            // If A won, and A is Blue -> Blue. If A is Red -> Red.
                            winner = isTeamABlue ? 'blue' : 'red'
                        }
                        else if (String(matchWinName).toLowerCase().includes(match.team_b_name.trim().toLowerCase())) {
                            // If B won, and B is Blue -> Blue. If B is Red -> Red.
                            winner = !isTeamABlue ? 'blue' : 'red'
                        }
                    }

                    const findHeroId = (name: string) => {
                        if (!name) return ''
                        const n = String(name).trim().toLowerCase()
                        return heroes.find(h => h.name.toLowerCase() === n || h.id === name)?.id || ''
                    }

                    const bluePicks: Record<number, string> = {}
                    const redPicks: Record<number, string> = {}

                    // FIXED MAPPING: Pick Columns -> Role Indices (0=DS, 1=JG, 2=MID, 3=AD, 4=SP)
                    // Based on specific user request:
                    // 5-Blue-Pick1 = Dark Slayer (0)
                    // 8-Blue-Pick4 = Jungle (1)
                    // 9-Blue-Pick5 = Mid (2)
                    // 16-Blue-Pick8 = Abyssal (3)
                    // 17-Blue-Pick9 = Roam (4)
                    const BLUE_MAPPING: Record<string, number> = {
                        '5-Blue-Pick1': 0,
                        '8-Blue-Pick4': 1,
                        '9-Blue-Pick5': 2,
                        '16-Blue-Pick8': 3,
                        '17-Blue-Pick9': 4
                    }

                    // 6-Red-Pick2 = Dark Slayer (0)
                    // 7-Red-Pick3 = Jungle (1)
                    // 10-Red-Pick6 = Mid (2)
                    // 15-Red-Pick7 = Abyssal (3)
                    // 18-Red-Pick10 = Roam (4)
                    const RED_MAPPING: Record<string, number> = {
                        '6-Red-Pick2': 0,
                        '7-Red-Pick3': 1,
                        '10-Red-Pick6': 2,
                        '15-Red-Pick7': 3,
                        '18-Red-Pick10': 4
                    }

                    // Apply Blue Mappings
                    Object.entries(BLUE_MAPPING).forEach(([col, roleIdx]) => {
                        const hName = row[col]
                        const hId = findHeroId(hName)
                        if (hId) bluePicks[roleIdx] = hId
                    })

                    // Apply Red Mappings
                    Object.entries(RED_MAPPING).forEach(([col, roleIdx]) => {
                        const hName = row[col]
                        const hId = findHeroId(hName)
                        if (hId) redPicks[roleIdx] = hId
                    })

                    // MVP Import
                    const mvpAName = row['MVPTEAM A']
                    const mvpBName = row['MVPTEAM B']
                    const mvpAId = findHeroId(mvpAName)
                    const mvpBId = findHeroId(mvpBName)

                    const blueKeyId = isTeamABlue ? mvpAId : mvpBId
                    const redKeyId = isTeamABlue ? mvpBId : mvpAId

                    newGamesData[gameNum] = {
                        gameNumber: gameNum,
                        bluePicks,
                        redPicks,
                        winner,
                        isTeamABlue,
                        blueKeyPlayer: blueKeyId,
                        redKeyPlayer: redKeyId
                    }
                }

                setGamesData(newGamesData)
                // Trigger save automatically? Or let user review?
                // Let user review.
                alert("Imported " + totalGamesToProcess + " games from Excel. Please review and Save.")

            } catch (err) {
                console.error(err)
                alert("Import failed. Check file format.")
            } finally {
                setLoading(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    // Helper to calculate excluded IDs
    const getExcludedIds = (gameNum: number, currentSide: 'blue' | 'red', roleIndex: number) => {
        const game = gamesData[gameNum]
        if (!game) return new Set<string>()

        // 1. Exclude other picks in THIS game (both sides)
        const exclusions = new Set<string>()
        Object.values(game.bluePicks).forEach(id => exclusions.add(id))
        Object.values(game.redPicks).forEach(id => exclusions.add(id))

        // Remove SELF from exclusion if already picked
        const currentPick = currentSide === 'blue' ? game.bluePicks[roleIndex] : game.redPicks[roleIndex]
        if (currentPick) exclusions.delete(currentPick)

        // 2. Global Ban Logic (Standard: Same team cannot pick same hero twice)
        // Identify Current Team (A or B)
        const currentIsTeamA = (game.isTeamABlue && currentSide === 'blue') || (!game.isTeamABlue && currentSide === 'red')

        for (let i = 1; i < gameNum; i++) {
            const prevGame = gamesData[i]
            if (!prevGame) continue

            // Determine if previous picks belong to the SAME TEAM as current
            // If Current is Team A, we look for Team A's picks in prevGame
            if (currentIsTeamA) {
                // Determine which side was Team A in prevGame
                const prevAIsBlue = prevGame.isTeamABlue
                const picksOfA = prevAIsBlue ? prevGame.bluePicks : prevGame.redPicks
                Object.values(picksOfA).forEach(id => exclusions.add(id))
            } else {
                // Current is Team B -> Look for Team B's picks
                const prevAIsBlue = prevGame.isTeamABlue
                // If A was Blue, B was Red. If A was Red, B was Blue.
                const picksOfB = prevAIsBlue ? prevGame.redPicks : prevGame.bluePicks
                Object.values(picksOfB).forEach(id => exclusions.add(id))
            }
        }

        return exclusions
    }

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
    if (!match) return <div className="h-screen flex items-center justify-center text-red-500">Match not found</div>

    const totalGames = parseInt(match.mode.replace('BO', '')) || 1
    const gameNumbers = Array.from({ length: totalGames }, (_, i) => i + 1)

    // Calculate Series Score
    const blueWins = Object.values(gamesData).filter(g => {
        // We need to know who is 'Blue' in context of Series Score (Team A vs Team B)
        // Usually Score is displayed as Team A vs Team B
        // But here let's count Series Score for Team A and Team B
        return false
    }).length

    let scoreA = 0
    let scoreB = 0
    Object.values(gamesData).forEach(g => {
        // Correctly determine who is Blue based on the per-game setting
        const isABlue = g.isTeamABlue

        if (g.winner === 'blue') {
            // Blue Won
            if (isABlue) scoreA++ // A was Blue -> A Win
            else scoreB++ // B was Blue -> B Win
        } else if (g.winner === 'red') {
            // Red Won
            if (isABlue) scoreB++ // A was Blue -> B (Red) Win
            else scoreA++ // B was Blue -> A (Red) Win
        }
    })

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <Link href="/admin/scrims" className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to Lobby
                        </Link>
                        <div className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-400 font-mono border border-slate-700">
                            QUICK ENTRY
                        </div>
                    </div>
                    {/* Import Section */}
                    <div className="flex justify-end -mt-4 gap-2">
                        <Button
                            variant="outline"
                            className="bg-slate-900 border-slate-700 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 text-xs h-8"
                            onClick={handleDownloadTemplate}
                        >
                            <FileDown className="w-3 h-3 mr-2" />
                            Template
                        </Button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => handleFileUpload(e)}
                            className="hidden"
                            accept=".xlsx, .xls"
                        />
                        <Button
                            variant="outline"
                            className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white text-xs h-8"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileUp className="w-3 h-3 mr-2" />}
                            Import Games (Excel)
                        </Button>
                    </div>

                    {/* Scoreboard Header */}
                    <div className="flex items-center justify-between bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50 relative overflow-hidden">
                        {/* Team A */}
                        <div className="flex flex-col z-10">
                            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{match.team_a_name}</h1>
                            <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase mt-1">TEAM A</span>
                        </div>

                        {/* Score */}
                        <div className="flex flex-col items-center z-10">
                            <h2 className="text-xl font-black italic text-white tracking-tighter uppercase mb-2">QUICK RESULT ENTRY</h2>
                            <div className="bg-slate-800/80 backdrop-blur px-6 py-3 rounded-xl border border-slate-700 flex items-center gap-6">
                                <span className={cn("text-5xl font-black", scoreA > scoreB ? "text-green-400" : "text-white")}>{scoreA}</span>
                                <div className="h-8 w-px bg-slate-600/50" />
                                <span className={cn("text-5xl font-black", scoreB > scoreA ? "text-green-400" : "text-white")}>{scoreB}</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold">{totalGames} Game</span>
                        </div>

                        {/* Team B */}
                        <div className="flex flex-col items-end z-10">
                            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight text-right">{match.team_b_name}</h1>
                            <span className="text-xs font-bold text-red-400 tracking-widest uppercase mt-1">TEAM B</span>
                        </div>

                        {/* Background Decor */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-red-500/5 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Tabs & Content */}
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto rounded-xl inline-flex gap-1">
                        {gameNumbers.map(n => (
                            <TabsTrigger
                                key={n}
                                value={`game-${n}`}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-800 transition-all"
                            >
                                Game {n}
                                {gamesData[n]?.winner && <Check className="w-3 h-3 ml-2 text-green-300 inline-block" />}
                            </TabsTrigger>
                        ))}
                        <TabsTrigger
                            value="summary"
                            disabled={!validateAll()}
                            className="px-6 py-2.5 rounded-lg text-sm font-bold data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Complete
                        </TabsTrigger>
                    </TabsList>

                    {gameNumbers.map(n => {
                        const gameState = gamesData[n] || {
                            gameNumber: n,
                            bluePicks: {},
                            redPicks: {},
                            winner: '',
                            isTeamABlue: n % 2 !== 0
                        }

                        const blueName = gameState.isTeamABlue ? match.team_a_name : match.team_b_name
                        const redName = gameState.isTeamABlue ? match.team_b_name : match.team_a_name

                        return (
                            <TabsContent key={n} value={`game-${n}`} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                {/* Per-Game Side Toggle */}
                                <div className="flex justify-center mb-6">
                                    <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase px-3">Blue Side:</span>
                                        <button
                                            onClick={() => setTeamSide(n, true)}
                                            className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", gameState.isTeamABlue ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                                        >
                                            {match.team_a_name}
                                        </button>
                                        <button
                                            onClick={() => setTeamSide(n, false)}
                                            className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", !gameState.isTeamABlue ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                                        >
                                            {match.team_b_name}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* BLUE SIDE */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-blue-950/30 border border-blue-500/20 p-4 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-blue-400 uppercase">{blueName}</span>
                                                <span className="text-[10px] font-bold text-blue-200/50 uppercase tracking-wider">BLUE SIDE</span>
                                            </div>
                                            {gameState.winner === 'blue' && <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded text-xs font-bold border border-blue-500/50">VICTORY</span>}
                                        </div>

                                        <div className="space-y-3">
                                            {ROLES.map((role, i) => (
                                                <div key={`g${n}-blue-${i}`} className="flex items-center gap-3 p-1 rounded-lg transition-colors hover:bg-white/5">
                                                    <div className="w-24 shrink-0 flex flex-col items-end gap-0.5 pr-2 border-r border-slate-800">
                                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">{role}</span>
                                                        <span className="text-[9px] text-slate-600 font-mono hidden">Slot {i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <HeroCombobox
                                                            value={gameState.bluePicks[i]}
                                                            heroes={heroes}
                                                            excludedIds={getExcludedIds(n, 'blue', i)}
                                                            onChange={(id) => handlePick(n, 'blue', i, id)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* RED SIDE */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-red-950/30 border border-red-500/20 p-4 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-red-400 uppercase">{redName}</span>
                                                <span className="text-[10px] font-bold text-red-200/50 uppercase tracking-wider">RED SIDE</span>
                                            </div>
                                            {gameState.winner === 'red' && <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded text-xs font-bold border border-red-500/50">VICTORY</span>}
                                        </div>

                                        <div className="space-y-3">
                                            {ROLES.map((role, i) => (
                                                <div key={`g${n}-red-${i}`} className="flex items-center gap-3 p-1 rounded-lg transition-colors hover:bg-white/5">
                                                    <div className="w-24 shrink-0 flex flex-col items-end gap-0.5 pr-2 border-r border-slate-800">
                                                        <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">{role}</span>
                                                        <span className="text-[9px] text-slate-600 font-mono hidden">Slot {i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <HeroCombobox
                                                            value={gameState.redPicks[i]}
                                                            heroes={heroes}
                                                            excludedIds={getExcludedIds(n, 'red', i)}
                                                            onChange={(id) => handlePick(n, 'red', i, id)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Game Result Controls */}
                                <div className="border-t border-slate-800 pt-8 mt-8">
                                    <h3 className="text-center text-slate-500 font-bold tracking-widest text-xs uppercase mb-6">Select Game Result</h3>
                                    <div className="flex justify-center gap-8">
                                        <button
                                            onClick={() => setWinner(n, 'blue')}
                                            className={cn(
                                                "w-64 h-20 rounded-xl border-2 font-black italic text-3xl uppercase transition-all duration-300 transform",
                                                gameState.winner === 'blue'
                                                    ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_40px_rgba(37,99,235,0.4)] scale-105"
                                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                                            )}
                                        >
                                            Blue Win
                                        </button>
                                        <button
                                            onClick={() => setWinner(n, 'red')}
                                            className={cn(
                                                "w-64 h-20 rounded-xl border-2 font-black italic text-3xl uppercase transition-all duration-300 transform",
                                                gameState.winner === 'red'
                                                    ? "bg-red-600 border-red-400 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] scale-105"
                                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                                            )}
                                        >
                                            Red Win
                                        </button>
                                    </div>

                                    {/* MVP Selection */}
                                    <div className="flex justify-center gap-12 mt-8">
                                        {/* Blue MVP */}
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="text-xs font-bold text-blue-500 uppercase tracking-widest">Blue MVP</div>
                                            <div className="flex gap-2">
                                                {Object.values(gameState.bluePicks).map((id) => {
                                                    const h = heroes.find(hero => hero.id === id)
                                                    if (!h) return null
                                                    const isSelected = gameState.blueKeyPlayer === id
                                                    return (
                                                        <button
                                                            key={id}
                                                            onClick={() => setKeyPlayer(n, 'blue', id)}
                                                            className={cn(
                                                                "relative w-10 h-10 rounded border-2 overflow-hidden transition-all hover:scale-110",
                                                                isSelected
                                                                    ? "border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)] scale-110 ring-2 ring-blue-500/50"
                                                                    : "border-slate-800 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                                            )}
                                                            title={h.name}
                                                        >
                                                            <img src={h.icon_url} alt={h.name} className="w-full h-full object-cover" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Red MVP */}
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="text-xs font-bold text-red-500 uppercase tracking-widest">Red MVP</div>
                                            <div className="flex gap-2">
                                                {Object.values(gameState.redPicks).map((id) => {
                                                    const h = heroes.find(hero => hero.id === id)
                                                    if (!h) return null
                                                    const isSelected = gameState.redKeyPlayer === id
                                                    return (
                                                        <button
                                                            key={id}
                                                            onClick={() => setKeyPlayer(n, 'red', id)}
                                                            className={cn(
                                                                "relative w-10 h-10 rounded border-2 overflow-hidden transition-all hover:scale-110",
                                                                isSelected
                                                                    ? "border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.6)] scale-110 ring-2 ring-red-500/50"
                                                                    : "border-slate-800 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                                            )}
                                                            title={h.name}
                                                        >
                                                            <img src={h.icon_url} alt={h.name} className="w-full h-full object-cover" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-center gap-4">
                                        <Button
                                            variant="ghost"
                                            className="text-slate-500 hover:text-white"
                                            onClick={() => resetGame(n)}
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" /> Reset Game {n}
                                        </Button>
                                        <Button
                                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-8"
                                            onClick={() => {
                                                if (!gameState.winner) {
                                                    alert("Please select a winner first!")
                                                    return
                                                }
                                                // Basic validation check
                                                if (Object.keys(gameState.bluePicks).length < 5 || Object.keys(gameState.redPicks).length < 5) {
                                                    alert("Please select all heroes!")
                                                    return
                                                }

                                                if (n < totalGames) {
                                                    setActiveTab(`game-${n + 1}`)
                                                } else {
                                                    setActiveTab("summary")
                                                }
                                            }}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {n < totalGames ? "Save & Next Game" : "Save & Finish Draft"}
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        )
                    })}

                    <TabsContent value="summary" className="max-w-4xl mx-auto space-y-8 pb-12">
                        {/* Series Result Header */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                            <div className="relative z-10 flex flex-col items-center justify-center">
                                <span className="text-slate-500 font-bold tracking-[0.2em] text-xs uppercase mb-4">Series Result</span>
                                <div className="flex items-center gap-12">
                                    <div className="text-right">
                                        <h1 className={cn("text-3xl md:text-5xl font-black uppercase tracking-tight", scoreA > scoreB ? "text-white" : "text-slate-500")}>{match.team_a_name}</h1>
                                    </div>
                                    <div className="flex items-center gap-6 bg-slate-950/50 px-8 py-4 rounded-xl border border-slate-800">
                                        <span className={cn("text-5xl md:text-6xl font-black", scoreA > scoreB ? "text-indigo-400" : "text-white")}>{scoreA}</span>
                                        <div className="h-12 w-px bg-slate-700" />
                                        <span className={cn("text-5xl md:text-6xl font-black", scoreB > scoreA ? "text-indigo-400" : "text-white")}>{scoreB}</span>
                                    </div>
                                    <div className="text-left">
                                        <h1 className={cn("text-3xl md:text-5xl font-black uppercase tracking-tight", scoreB > scoreA ? "text-white" : "text-slate-500")}>{match.team_b_name}</h1>
                                    </div>
                                </div>
                            </div>
                            {/* Trophy Background */}
                            {(scoreA > scoreB || scoreB > scoreA) && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-96 h-96">
                                        <path d="M19 5h-2V3a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v2H5c-1.103 0-2 .897-2 2v6c0 3.309 2.691 6 6 6h1c1.103 0 2 .897 2 2v2h-2a1 1 0 0 0-1 1v2h8v-2a1 1 0 0 0-1-1h-2v-2a1 1 0 0 0 2-2h1c3.309 0 6-2.691 6-6V7c0-1.103-.897-2-2-2zm-11 8c-2.206 0-4-1.794-4-4V7h4v6zm10 0c0 2.206-1.794 4-4 4h-1V7h5v6z" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Match History List */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-4 border-l-4 border-indigo-500 pl-4">Match History</h3>
                            {gameNumbers.map(n => {
                                const g = gamesData[n]
                                if (!g || !g.winner) return null

                                const isGameWinnerA = (g.winner === 'blue' && g.isTeamABlue) || (g.winner === 'red' && !g.isTeamABlue)
                                const winnerName = isGameWinnerA ? match.team_a_name : match.team_b_name

                                // Get picks based on Team (not Side) to keep A on Left, B on Right consistently
                                // Team A Picks: If A is Blue -> bluePicks. If A is Red -> redPicks.
                                const teamAPicks = g.isTeamABlue ? g.bluePicks : g.redPicks
                                const teamBPicks = g.isTeamABlue ? g.redPicks : g.bluePicks

                                const winnerColor = g.winner === 'blue' ? "text-blue-400" : "text-red-400"
                                const winningSideText = g.winner === 'blue' ? "BLUE SIDE" : "RED SIDE"
                                const winningSideClass = g.winner === 'blue' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                                const shortRoles = ['DS', 'JG', 'MID', 'AD', 'SP']

                                // MVP Logic
                                const teamAMVPId = g.isTeamABlue ? g.blueKeyPlayer : g.redKeyPlayer
                                const teamBMVPId = g.isTeamABlue ? g.redKeyPlayer : g.blueKeyPlayer
                                const teamAMVP = heroes.find(h => h.id === teamAMVPId)
                                const teamBMVP = heroes.find(h => h.id === teamBMVPId)

                                return (
                                    <div key={n} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 hover:border-slate-700 transition-colors">
                                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                                            <div className="flex items-center gap-4">
                                                <span className="px-3 py-1 rounded-full border border-slate-600 text-[10px] font-bold text-slate-300 uppercase">Game {n}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-xs font-bold uppercase">Winner:</span>
                                                    <span className={cn("text-lg font-black uppercase italic", winnerColor)}>{winnerName}</span>
                                                    <span className={cn("ml-2 text-[10px] font-bold px-2 py-0.5 rounded border uppercase", winningSideClass)}>{winningSideText}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-8">
                                            {/* Team A Picks */}
                                            <div className="flex flex-col gap-2 flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={cn("text-sm font-black uppercase", isGameWinnerA ? winnerColor : "text-slate-500")}>{match.team_a_name}</span>

                                                    {/* MVP Selection Dialog for Team A */}
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <button className="outline-none group/mvp">
                                                                {teamAMVP ? (
                                                                    <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10" title={`MVP: ${teamAMVP.name}`}>
                                                                        <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-wider">MVP</span>
                                                                        <div className="w-5 h-5 rounded-full border border-yellow-500/30 overflow-hidden relative">
                                                                            <img src={teamAMVP.icon_url} alt="MVP" className="w-full h-full object-cover" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-400 transition-all group-hover/mvp:shadow-[0_0_10px_rgba(99,102,241,0.4)] animate-pulse">
                                                                        <Plus className="w-3 h-3 text-indigo-400 group-hover/mvp:text-indigo-300" />
                                                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest group-hover/mvp:text-indigo-300">ADD MVP</span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                                            <DialogHeader>
                                                                <DialogTitle>Select MVP for {match.team_a_name} (Game {n})</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="grid grid-cols-5 gap-2 py-4">
                                                                {ROLES.map((_, i) => {
                                                                    const heroId = teamAPicks[i]
                                                                    const hero = heroes.find(h => h.id === heroId)
                                                                    if (!hero) return null
                                                                    const isSelected = teamAMVPId === heroId
                                                                    return (
                                                                        <button
                                                                            key={heroId}
                                                                            onClick={() => setKeyPlayer(n, g.isTeamABlue ? 'blue' : 'red', heroId)}
                                                                            className={cn(
                                                                                "relative aspect-square rounded-lg border-2 overflow-hidden transition-all",
                                                                                isSelected
                                                                                    ? "border-yellow-500 ring-2 ring-yellow-500/20 scale-95"
                                                                                    : "border-slate-700 hover:border-slate-500 hover:scale-105"
                                                                            )}
                                                                        >
                                                                            <img src={hero.icon_url} alt={hero.name} className="w-full h-full object-cover" />
                                                                            {isSelected && (
                                                                                <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                                                                                    <div className="bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-sm">MVP</div>
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                            <DialogFooter>
                                                                <DialogClose asChild>
                                                                    <Button variant="secondary">Done</Button>
                                                                </DialogClose>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>

                                                </div>
                                                <div className="flex gap-2">
                                                    {ROLES.map((_, i) => {
                                                        const heroId = teamAPicks[i]
                                                        const hero = heroes.find(h => h.id === heroId)
                                                        return (
                                                            <div key={i} className="w-12 h-12 md:w-14 md:h-14 rounded bg-slate-950 border border-slate-800 relative overflow-hidden group">
                                                                {hero ? (
                                                                    <img src={hero.icon_url} alt={hero.name} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px]">{i + 1}</div>
                                                                )}
                                                                <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-[2px] py-[2px] flex items-center justify-center">
                                                                    <span className="text-[8px] font-black text-white/90 uppercase tracking-wider leading-none">{shortRoles[i]}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* VS */}
                                            <div className="font-black text-slate-700 text-2xl italic">VS</div>

                                            {/* Team B Picks */}
                                            <div className="flex flex-col gap-2 flex-1 items-end">
                                                <div className="flex items-center justify-between mb-2 w-full flex-row-reverse">
                                                    <span className={cn("text-sm font-black uppercase text-right", !isGameWinnerA ? winnerColor : "text-slate-500")}>{match.team_b_name}</span>

                                                    {/* MVP Selection Dialog for Team B */}
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <button className="outline-none group/mvp">
                                                                {teamBMVP ? (
                                                                    <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50 flex-row-reverse transition-colors hover:border-red-500/50 hover:bg-red-500/10" title={`MVP: ${teamBMVP.name}`}>
                                                                        <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-wider">MVP</span>
                                                                        <div className="w-5 h-5 rounded-full border border-yellow-500/30 overflow-hidden relative">
                                                                            <img src={teamBMVP.icon_url} alt="MVP" className="w-full h-full object-cover" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-red-500/50 bg-red-500/5 hover:bg-red-500/10 hover:border-red-400 transition-all group-hover/mvp:shadow-[0_0_10px_rgba(248,113,113,0.4)] animate-pulse flex-row-reverse">
                                                                        <Plus className="w-3 h-3 text-red-400 group-hover/mvp:text-red-300" />
                                                                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest group-hover/mvp:text-red-300">ADD MVP</span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                                            <DialogHeader>
                                                                <DialogTitle>Select MVP for {match.team_b_name} (Game {n})</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="grid grid-cols-5 gap-2 py-4">
                                                                {ROLES.map((_, i) => {
                                                                    const heroId = teamBPicks[i]
                                                                    const hero = heroes.find(h => h.id === heroId)
                                                                    if (!hero) return null
                                                                    const isSelected = teamBMVPId === heroId
                                                                    return (
                                                                        <button
                                                                            key={heroId}
                                                                            onClick={() => setKeyPlayer(n, g.isTeamABlue ? 'red' : 'blue', heroId)}
                                                                            className={cn(
                                                                                "relative aspect-square rounded-lg border-2 overflow-hidden transition-all",
                                                                                isSelected
                                                                                    ? "border-yellow-500 ring-2 ring-yellow-500/20 scale-95"
                                                                                    : "border-slate-700 hover:border-slate-500 hover:scale-105"
                                                                            )}
                                                                        >
                                                                            <img src={hero.icon_url} alt={hero.name} className="w-full h-full object-cover" />
                                                                            {isSelected && (
                                                                                <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                                                                                    <div className="bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-sm">MVP</div>
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                            <DialogFooter>
                                                                <DialogClose asChild>
                                                                    <Button variant="secondary">Done</Button>
                                                                </DialogClose>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>

                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    {ROLES.map((_, i) => {
                                                        const heroId = teamBPicks[i]
                                                        const hero = heroes.find(h => h.id === heroId)
                                                        return (
                                                            <div key={i} className="w-12 h-12 md:w-14 md:h-14 rounded bg-slate-950 border border-slate-800 relative overflow-hidden group">
                                                                {hero ? (
                                                                    <img src={hero.icon_url} alt={hero.name} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px]">{i + 1}</div>
                                                                )}
                                                                <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-[2px] py-[2px] flex items-center justify-center">
                                                                    <span className="text-[8px] font-black text-white/90 uppercase tracking-wider leading-none">{shortRoles[i]}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-center pt-8 border-t border-slate-800">
                            <Button size="lg" className="bg-green-600 hover:bg-green-500 text-white font-bold px-12 h-14 text-lg w-full max-w-sm" onClick={handleSaveAll}>
                                <Save className="w-5 h-5 mr-3" /> Save All
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div >
    )
}
