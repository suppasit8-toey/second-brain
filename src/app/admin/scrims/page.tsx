'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, RotateCw, Trash, Search, X, Calendar as CalendarIcon, Check, FileDown, FileUp, Loader2, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import DeleteMatchButton from '../draft/_components/DeleteMatchButton'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useRef } from 'react'


export default function ScrimManagerPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [scrims, setScrims] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [heroes, setHeroes] = useState<any[]>([]) // Store heroes for mapping
    const [pageLimit, setPageLimit] = useState(20)
    const [hasMore, setHasMore] = useState(false)

    // Filter States
    const [versions, setVersions] = useState<any[]>([])
    const [selectedYear, setSelectedYear] = useState<string>('All')
    const [selectedMonth, setSelectedMonth] = useState<string>('All')
    const [selectedDay, setSelectedDay] = useState<string>('All')
    const [selectedPatch, setSelectedPatch] = useState<string>('All')
    const [selectedMode, setSelectedMode] = useState<string>('All')
    const [selectedRecordingMode, setSelectedRecordingMode] = useState<string>('All')
    const [selectedTeam, setSelectedTeam] = useState<string>('All')

    const [tournaments, setTournaments] = useState<any[]>([])
    const [uniqueTeams, setUniqueTeams] = useState<string[]>([])
    const [teamsSearch, setTeamsSearch] = useState('')
    const [isTeamFilterOpen, setIsTeamFilterOpen] = useState(false)

    // Data Loading
    const loadGlobalOptions = async () => {
        const supabase = createClient()
        const [vRes, hRes, tRes, mRes] = await Promise.all([
            supabase.from('versions').select('*').order('created_at', { ascending: false }),
            supabase.from('heroes').select('id, name').order('name', { ascending: true }),
            supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
            supabase.from('draft_matches').select('team_a_name, team_b_name').limit(200).order('created_at', { ascending: false })
        ])

        if (vRes.data) setVersions(vRes.data)
        if (hRes.data) setHeroes(hRes.data)
        if (tRes.data) setTournaments(tRes.data)

        if (mRes.data) {
            const teams = new Set<string>()
            mRes.data.forEach(m => {
                if (m.team_a_name) teams.add(m.team_a_name)
                if (m.team_b_name) teams.add(m.team_b_name)
            })
            setUniqueTeams(Array.from(teams).sort())
        }
    }

    const loadScrims = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()

        let query = supabase
            .from('draft_matches')
            .select(`
                    *,
                    tournament:tournaments(name),
                    version:versions(name),
                    games:draft_games(
                        *,
                        picks:draft_picks(*)
                    )
                `)
            .in('match_type', ['scrim', 'scrim_summary', 'scrim_simulator'])
            .order('match_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(pageLimit)

        // Apply Filters
        if (searchQuery) {
            query = query.or(`team_a_name.ilike.%${searchQuery}%,team_b_name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`)
        }

        if (selectedYear !== 'All') {
            const start = `${selectedYear}-01-01`
            const end = `${selectedYear}-12-31`
            query = query.gte('match_date', start).lte('match_date', end)
        }

        if (selectedPatch !== 'All') {
            query = query.eq('version_id', selectedPatch)
        }

        if (selectedMode !== 'All') {
            query = query.eq('mode', selectedMode)
        }

        if (selectedRecordingMode !== 'All') {
            if (selectedRecordingMode === 'Simulator') query = query.eq('match_type', 'scrim_simulator')
            else if (selectedRecordingMode === 'Quick') query = query.eq('match_type', 'scrim_summary')
        }

        if (selectedTeam !== 'All') {
            query = query.or(`team_a_name.eq.${selectedTeam},team_b_name.eq.${selectedTeam}`)
        }

        const { data } = await query

        let filteredData = data || []

        // Determine if there are more records (if we got exactly the limit, assume yes)
        setHasMore(filteredData.length === pageLimit)

        // Client-side date filtering (Month/Day) because SQL date_part is annoying via JS client without RPC
        if (selectedYear !== 'All' && selectedMonth !== 'All') {
            filteredData = filteredData.filter(s => {
                if (!s.match_date) return false
                const d = new Date(s.match_date)
                // Month is 0-indexed in JS
                // selectedMonth is '1'..'12'
                return (d.getMonth() + 1).toString() === selectedMonth
            })
        }

        if (selectedYear !== 'All' && selectedMonth !== 'All' && selectedDay !== 'All') {
            filteredData = filteredData.filter(s => {
                if (!s.match_date) return false
                const d = new Date(s.match_date)
                return d.getDate().toString() === selectedDay
            })
        }

        setScrims(filteredData)
        setLoading(false)
    }, [searchQuery, selectedYear, selectedMonth, selectedDay, selectedPatch, selectedMode, selectedRecordingMode, selectedTeam, pageLimit])

    useEffect(() => {
        loadGlobalOptions()
    }, [])

    useEffect(() => {
        loadScrims()
    }, [loadScrims])

    // Generate Options
    const years = ['2023', '2024', '2025', '2026']
    const months = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: new Date(0, i).toLocaleString('en-US', { month: 'short' }) }))
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString())
    const modes = [
        { value: 'BO1', label: '1 Game (BO1)' },
        { value: 'BO2', label: '2 Games' },
        { value: 'BO3', label: '3 Games' },
        { value: 'BO4', label: '4 Games' },
        { value: 'BO5', label: '5 Games' },
        { value: 'BO7', label: '7 Games (BO7)' },
    ]

    const clearFilters = () => {
        setSelectedYear('All')
        setSelectedMonth('All')
        setSelectedDay('All')
        setSelectedPatch('All')
        setSelectedMode('All')
        setSelectedRecordingMode('All')
        setSelectedTeam('All')
        setSearchQuery('')
        setPageLimit(20)
    }

    // Export Logic
    const handleExport = () => {
        const rows: any[] = []

        scrims.forEach(s => {
            const isSimulator = s.match_type === 'scrim_simulator'
            const recMode = isSimulator ? 'Full Draft Simulator' : 'Quick Result Entry'
            const numGames = s.mode ? `${s.mode.replace('BO', '')} Games` : '1 Game'

            const baseRow = {
                'MATCH ID': s.slug || s.id,
                'Date': s.match_date ? new Date(s.match_date).toLocaleDateString() : '-',
                'Tournament': s.tournament?.name || '-',
                'Patch': s.version?.name || '-',
                'Recording Mode (Full,Quick)': recMode,
                'Number of Games (1Game..... 7 games)': numGames,
                'TEAM A': s.team_a_name,
                'Team B': s.team_b_name,
            }

            const hasGames = s.games && s.games.length > 0

            if (!hasGames) {
                rows.push({ ...baseRow })
                return
            }

            // Iterate Games
            s.games.forEach((g: any, index: number) => {
                // Determine Sides relative to Team A/B
                // If Blue Team == Team A, then Team A Side = BLUE
                const teamASide = g.blue_team_name === s.team_a_name ? 'BLUE' : 'RED'

                const row: any = {
                    ...baseRow,
                    'GAME(เกมที่ 1,2,3,4....)': `Game ${g.game_number}`,
                    'TEAM A SIDE (BLUE OR RED)': teamASide,
                    'MATCH WIN (name TEAM A or name TEAM B)': g.winner === 'Blue' ? g.blue_team_name : g.red_team_name,
                }

                const picks = g.picks || []

                // TEAM A Columns
                // Team A Positions (Match Team A Pick 1..5)
                // We need to know which slots belong to Team A to get the right role
                // If Team A is Blue: Slots 5, 8, 9, 16, 17
                // If Team A is Red:  Slots 6, 7, 10, 15, 18
                const getTeamPickSlot = (isTeamBlue: boolean, pickNum: number) => {
                    const bluePicks = [5, 8, 9, 16, 17]
                    const redPicks = [6, 7, 10, 15, 18]
                    return isTeamBlue ? bluePicks[pickNum - 1] : redPicks[pickNum - 1]
                }


                const SLOT_CONFIG: any = {
                    1: { side: 'BLUE', type: 'BAN', idx: 1, label: '1-Blue-BAN1' },
                    2: { side: 'RED', type: 'BAN', idx: 1, label: '2-Red-BAN2' },
                    3: { side: 'BLUE', type: 'BAN', idx: 2, label: '3-Blue-BAN3' },
                    4: { side: 'RED', type: 'BAN', idx: 2, label: '4-Red-BAN4' },
                    5: { side: 'BLUE', type: 'PICK', idx: 1, label: '5-Blue-Pick1' },
                    6: { side: 'RED', type: 'PICK', idx: 1, label: '6-Red-Pick2' },
                    7: { side: 'RED', type: 'PICK', idx: 2, label: '7-Red-Pick3' },
                    8: { side: 'BLUE', type: 'PICK', idx: 2, label: '8-Blue-Pick4' },
                    9: { side: 'BLUE', type: 'PICK', idx: 3, label: '9-Blue-Pick5' },
                    10: { side: 'RED', type: 'PICK', idx: 3, label: '10-Red-Pick6' },
                    11: { side: 'RED', type: 'BAN', idx: 3, label: '11-Red-BAN5' },
                    12: { side: 'BLUE', type: 'BAN', idx: 3, label: '12-Blue-BAN6' },
                    13: { side: 'RED', type: 'BAN', idx: 4, label: '13-Red-BAN7' },
                    14: { side: 'BLUE', type: 'BAN', idx: 4, label: '14-Blue-BAN8' },
                    15: { side: 'RED', type: 'PICK', idx: 4, label: '15-Red-Pick7' },
                    16: { side: 'BLUE', type: 'PICK', idx: 4, label: '16-Blue-Pick8' },
                    17: { side: 'BLUE', type: 'PICK', idx: 5, label: '17-Blue-Pick9' },
                    18: { side: 'RED', type: 'PICK', idx: 5, label: '18-Red-Pick10' },
                }

                // Populate Chronological Columns
                if (isSimulator) {
                    // Standard Simulator Logic (Strict 1-18 Slots)
                    for (let i = 1; i <= 18; i++) {
                        const cfg = SLOT_CONFIG[i]
                        let p = picks.find((p: any) => p.position_index === i)
                        // Verify Side matches Config (Consistency check)
                        if (p && p.side !== cfg.side) {
                            // Mismatch found (e.g. legacy data collision). Try finding by strict Side+Idx if strictly needed?
                            // But usually Simulator data is correct. 
                        }
                        const hName = p ? (heroes.find(h => h.id === p.hero_id)?.name || p.hero_id) : ''
                        row[cfg.label] = hName
                    }
                } else {
                    // Quick Result Entry Logic (Legacy Support + No Bans)
                    // We need to map Blue Picks 1-5 and Red Picks 1-5 to the correct columns
                    // Blue Picks: [5, 8, 9, 16, 17]
                    // Red Picks:  [6, 7, 10, 15, 18]

                    const bluePicks = picks.filter((p: any) => p.side === 'BLUE' && p.type === 'PICK').sort((a: any, b: any) => a.position_index - b.position_index)
                    const redPicks = picks.filter((p: any) => p.side === 'RED' && p.type === 'PICK').sort((a: any, b: any) => a.position_index - b.position_index)

                    // Map Ordered Picks to Columns
                    // Blue
                    if (bluePicks[0]) row['5-Blue-Pick1'] = heroes.find(h => h.id === bluePicks[0].hero_id)?.name
                    if (bluePicks[1]) row['8-Blue-Pick4'] = heroes.find(h => h.id === bluePicks[1].hero_id)?.name
                    if (bluePicks[2]) row['9-Blue-Pick5'] = heroes.find(h => h.id === bluePicks[2].hero_id)?.name
                    if (bluePicks[3]) row['16-Blue-Pick8'] = heroes.find(h => h.id === bluePicks[3].hero_id)?.name
                    if (bluePicks[4]) row['17-Blue-Pick9'] = heroes.find(h => h.id === bluePicks[4].hero_id)?.name

                    // Red
                    if (redPicks[0]) row['6-Red-Pick2'] = heroes.find(h => h.id === redPicks[0].hero_id)?.name
                    if (redPicks[1]) row['7-Red-Pick3'] = heroes.find(h => h.id === redPicks[1].hero_id)?.name
                    if (redPicks[2]) row['10-Red-Pick6'] = heroes.find(h => h.id === redPicks[2].hero_id)?.name
                    if (redPicks[3]) row['15-Red-Pick7'] = heroes.find(h => h.id === redPicks[3].hero_id)?.name
                    if (redPicks[4]) row['18-Red-Pick10'] = heroes.find(h => h.id === redPicks[4].hero_id)?.name
                }

                // Populate Team Positions
                const isTeamABlue = teamASide === 'BLUE'
                const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

                if (!isSimulator) {
                    // Quick Result Entry: Enforce Standard Roles
                    for (let k = 1; k <= 5; k++) {
                        row[`TEAM A POSITION${k}`] = STANDARD_ROLES[k - 1]
                        row[`TEAM B POSITION${k}`] = STANDARD_ROLES[k - 1]
                    }
                } else {
                    // Simulator: Use Assgined Roles from DB
                    // TEAM A POSITIONS (1-5)
                    for (let k = 1; k <= 5; k++) {
                        const slot = getTeamPickSlot(isTeamABlue, k)
                        let p = picks.find((p: any) => p.position_index === slot)
                        if (!p) {
                            const side = isTeamABlue ? 'BLUE' : 'RED'
                            p = picks.find((p: any) => p.side === side && p.type === 'PICK' && p.position_index === k)
                        }
                        row[`TEAM A POSITION${k}`] = p?.assigned_role || ''
                    }

                    // TEAM B POSITIONS (1-5)
                    for (let k = 1; k <= 5; k++) {
                        const slot = getTeamPickSlot(!isTeamABlue, k)
                        let p = picks.find((p: any) => p.position_index === slot)
                        if (!p) {
                            const side = !isTeamABlue ? 'BLUE' : 'RED'
                            p = picks.find((p: any) => p.side === side && p.type === 'PICK' && p.position_index === k)
                        }
                        row[`TEAM B POSITION${k}`] = p?.assigned_role || ''
                    }
                }

                // Extras
                const getHeroName = (id: string) => heroes.find(h => h.id === id)?.name || ''
                // Determine MVP for Team A
                // If Team A is Blue, use blue_key_player_id. Else red.
                const mvpAId = isTeamABlue ? g.blue_key_player_id : g.red_key_player_id
                const mvpBId = isTeamABlue ? g.red_key_player_id : g.blue_key_player_id

                row['MVPTEAM A'] = getHeroName(mvpAId)
                row['MVPTEAM B'] = getHeroName(mvpBId)

                // Winrate Team A (1 if A won, 0 if lost) for this game
                const winnerName = g.winner === 'Blue' ? g.blue_team_name : (g.winner === 'Red' ? g.red_team_name : '')
                const teamAWon = winnerName === s.team_a_name

                // WINRATE TEAM A: User requested this to be "Blue Team Win %"
                // So we always output Blue's status
                // const blueWon = g.winner === 'Blue'
                // let winRateA = blueWon ? 1 : 0

                // UPDATE: If no prediction, show 50
                let winRateA = 50

                if (g.analysis_data?.winPrediction?.blue !== undefined) {
                    winRateA = Number(g.analysis_data.winPrediction.blue)
                }

                row['WIN % BLUE TEAM'] = winRateA

                rows.push(row)
            })
        })

        // Enforce Strict Headers to ensure Ban columns appear even if empty (Quick Entry)
        const headers = [
            'MATCH ID', 'Date', 'Tournament', 'Patch',
            'Recording Mode (Full,Quick)', 'Number of Games (1Game..... 7 games)', 'GAME(เกมที่ 1,2,3,4....)',
            'TEAM A', 'Team B', 'TEAM A SIDE (BLUE OR RED)', 'MATCH WIN (name TEAM A or name TEAM B)',
            '1-Blue-BAN1', '2-Red-BAN2', '3-Blue-BAN3', '4-Red-BAN4',
            '5-Blue-Pick1', '6-Red-Pick2', '7-Red-Pick3', '8-Blue-Pick4', '9-Blue-Pick5', '10-Red-Pick6',
            '11-Red-BAN5', '12-Blue-BAN6', '13-Red-BAN7', '14-Blue-BAN8',
            '15-Red-Pick7', '16-Blue-Pick8', '17-Blue-Pick9', '18-Red-Pick10',
            'TEAM A POSITION1', 'TEAM A POSITION2', 'TEAM A POSITION3', 'TEAM A POSITION4', 'TEAM A POSITION5',
            'TEAM B POSITION1', 'TEAM B POSITION2', 'TEAM B POSITION3', 'TEAM B POSITION4', 'TEAM B POSITION5',
            'MVPTEAM A', 'MVPTEAM B', 'WIN % BLUE TEAM'
        ]

        const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Draft Logs")
        XLSX.writeFile(wb, `Draft_Logs_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    const handleDownloadTemplate = (mode: 'FULL' | 'QUICK') => {
        let headers: string[] = []
        let exampleRow: any = {}

        if (mode === 'FULL') {
            headers = [
                'MATCH ID', 'Date', 'Tournament', 'Patch',
                'Recording Mode (Full,Quick)', 'Number of Games (1Game..... 7 games)', 'GAME(เกมที่ 1,2,3,4....)',
                'TEAM A', 'Team B', 'TEAM A SIDE (BLUE OR RED)', 'MATCH WIN (name TEAM A or name TEAM B)',
                '1-Blue-BAN1', '2-Red-BAN2', '3-Blue-BAN3', '4-Red-BAN4',
                '5-Blue-Pick1', '6-Red-Pick2', '7-Red-Pick3', '8-Blue-Pick4', '9-Blue-Pick5', '10-Red-Pick6',
                '11-Red-BAN5', '12-Blue-BAN6', '13-Red-BAN7', '14-Blue-BAN8',
                '15-Red-Pick7', '16-Blue-Pick8', '17-Blue-Pick9', '18-Red-Pick10',
                'TEAM A POSITION1', 'TEAM A POSITION2', 'TEAM A POSITION3', 'TEAM A POSITION4', 'TEAM A POSITION5',
                'TEAM B POSITION1', 'TEAM B POSITION2', 'TEAM B POSITION3', 'TEAM B POSITION4', 'TEAM B POSITION5',
                'MVPTEAM A', 'MVPTEAM B', 'WIN % BLUE TEAM'
            ]
            exampleRow = {
                'MATCH ID': 'SCRIM-EXAMPLE-FULL-01',
                'Date': '2024-01-01',
                'Tournament': 'RPL 2024',
                'Patch': 'S1 2024',
                'Recording Mode (Full,Quick)': 'Full Draft Simulator',
                'Number of Games (1Game..... 7 games)': '3 Games',
                'GAME(เกมที่ 1,2,3,4....)': 'Game 1',
                'TEAM A': 'BAC',
                'Team B': 'TALON',
                'TEAM A SIDE (BLUE OR RED)': 'BLUE',
                'MATCH WIN (name TEAM A or name TEAM B)': 'BAC',
                '1-Blue-BAN1': 'Krizzix',
                '5-Blue-Pick1': 'Yena',
                'TEAM A POSITION1': 'Dark Slayer',
                '2-Red-BAN2': 'Nakroth',
                '6-Red-Pick2': 'Violet',
                'TEAM B POSITION1': 'Abyssal Dragon',
                'MVPTEAM A': 'Yena',
                'MVPTEAM B': 'Violet',
                'WIN % BLUE TEAM': '50'
            }
        } else {
            // Quick Entry (No Bans)
            headers = [
                'MATCH ID', 'Date', 'Tournament', 'Patch',
                'Recording Mode (Full,Quick)', 'Number of Games (1Game..... 7 games)', 'GAME(เกมที่ 1,2,3,4....)',
                'TEAM A', 'Team B', 'TEAM A SIDE (BLUE OR RED)', 'MATCH WIN (name TEAM A or name TEAM B)',
                '5-Blue-Pick1', '6-Red-Pick2', '7-Red-Pick3', '8-Blue-Pick4', '9-Blue-Pick5', '10-Red-Pick6',
                '15-Red-Pick7', '16-Blue-Pick8', '17-Blue-Pick9', '18-Red-Pick10',
                'TEAM A POSITION1', 'TEAM A POSITION2', 'TEAM A POSITION3', 'TEAM A POSITION4', 'TEAM A POSITION5',
                'TEAM B POSITION1', 'TEAM B POSITION2', 'TEAM B POSITION3', 'TEAM B POSITION4', 'TEAM B POSITION5',
                'MVPTEAM A', 'MVPTEAM B', 'WIN % BLUE TEAM'
            ]
            exampleRow = {
                'MATCH ID': 'SCRIM-EXAMPLE-QUICK-01',
                'Date': '2024-01-01',
                'Tournament': 'RPL 2024',
                'Patch': 'S1 2024',
                'Recording Mode (Full,Quick)': 'Quick Result Entry',
                'Number of Games (1Game..... 7 games)': '3 Games',
                'GAME(เกมที่ 1,2,3,4....)': 'Game 1',
                'TEAM A': 'BAC',
                'Team B': 'TALON',
                'TEAM A SIDE (BLUE OR RED)': 'BLUE',
                'MATCH WIN (name TEAM A or name TEAM B)': 'BAC',
                '5-Blue-Pick1': 'Yena',
                '6-Red-Pick2': 'Violet',
                'TEAM A POSITION1': 'Dark Slayer',
                'TEAM B POSITION1': 'Abyssal Dragon',
                'MVPTEAM A': 'Yena',
                'MVPTEAM B': 'Violet',
                'WIN % BLUE TEAM': '50'
            }
        }

        const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template")
        XLSX.writeFile(wb, mode === 'FULL' ? "Full_Draft_Template.xlsx" : "Quick_Entry_Template.xlsx")
    }

    // Import Logic
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImporting(true)
        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true }) // Enable Date parsing
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const rawData = XLSX.utils.sheet_to_json(ws) as any[]
                const supabase = createClient()
                let successCount = 0
                let errorCount = 0

                const findHeroId = (name: string) => {
                    if (!name) return null
                    const n = String(name).trim().toLowerCase()
                    return heroes.find(h => h.name.toLowerCase() === n || h.id === name)?.id
                }

                const findTournamentId = (name: string) => {
                    if (!name) return null
                    return tournaments.find(t => t.name.toLowerCase() === String(name).toLowerCase())?.id
                }

                const findVersionId = (name: string) => {
                    if (!name) return null
                    // Exact match or contains? Let's try flexible
                    return versions.find(v => v.name.toLowerCase() === String(name).toLowerCase())?.id
                }

                const parseDate = (val: any) => {
                    if (!val) return new Date().toISOString()
                    if (val instanceof Date) return val.toISOString()

                    // Handle Excel Serial Number (if cellDates failed or mixed)
                    if (typeof val === 'number') {
                        // Excel base date roughly 1900. JS is 1970.
                        // Safe validation: is it year 1970? 
                        // If number is small (< 50000), likely Excel days. 
                        // If number is huge (> 999999999), likely Timestamp.
                        if (val > 1000000000) return new Date(val).toISOString() // Timestamp
                        return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString()
                    }

                    // Handle String "DD/MM/YYYY" (Team Thailand format)
                    const str = String(val).trim()
                    // Regex for DD/MM/YYYY
                    const parts = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/)
                    if (parts) {
                        const d = parseInt(parts[1])
                        const m = parseInt(parts[2]) - 1 // JS Month is 0-indexed
                        const y = parseInt(parts[3])
                        return new Date(y, m, d).toISOString()
                    }

                    // Fallback to standard parse
                    return new Date(str).toISOString()
                }

                // Group by MATCH ID
                const matchMap = new Map<string, any[]>()
                rawData.forEach(row => {
                    const mid = row['MATCH ID']
                    // If no MATCH ID, maybe skip or generate? User request implies MATCH ID exists.
                    if (mid) {
                        if (!matchMap.has(mid)) matchMap.set(mid, [])
                        matchMap.get(mid)?.push(row)
                    }
                })

                for (const [matchId, rows] of matchMap) {
                    // Assume first row has the summary info
                    const first = rows[0]
                    const teamA = first['TEAM A']
                    const teamB = first['Team B']
                    const dateVal = first['Date']
                    const tourName = first['Tournament']
                    const patchName = first['Patch']

                    // Parse Recording Mode: "Recording Mode (Full,Quick)"
                    const recModeCol = first['Recording Mode (Full,Quick)'] || first['Recording Mode']
                    const rawRecMode = String(recModeCol || '').toLowerCase()
                    let matchType = 'scrim_summary' // Default
                    if (rawRecMode.includes('full') || rawRecMode.includes('simulator')) matchType = 'scrim_simulator'
                    else if (rawRecMode.includes('quick')) matchType = 'scrim_summary'

                    // Parse Number of Games: "Number of Games (1Game..... 7 games)" -> BOx
                    const numGamesCol = first['Number of Games (1Game..... 7 games)'] || first['Number of Games']
                    let bestOf = 'BO1' // Default
                    if (numGamesCol) {
                        const parsedNum = parseInt(String(numGamesCol).replace(/\D/g, '')) // Extract number
                        if (!isNaN(parsedNum) && parsedNum > 0) {
                            bestOf = 'BO' + parsedNum
                        }
                    }

                    if (!teamA || !teamB) {
                        console.warn(`Skipping ${matchId}: Missing Team Names`)
                        errorCount++
                        continue
                    }

                    const tournamentId = findTournamentId(tourName)
                    const versionId = findVersionId(patchName)
                    const finalTourId = tournamentId || tournaments[0]?.id
                    const finalVerId = versionId || versions[0]?.id

                    // 1. Create MATCH
                    let { data: existingMatch } = await supabase.from('draft_matches').select('id').eq('slug', matchId).single()
                    let matchDbId = existingMatch?.id

                    if (!matchDbId) {
                        const { data: newMatch, error: matchError } = await supabase.from('draft_matches').insert({
                            slug: matchId, // Use provided ID as slug
                            team_a_name: teamA,
                            team_b_name: teamB,
                            match_date: parseDate(dateVal),
                            mode: bestOf,
                            match_type: matchType,
                            status: 'finished',
                            tournament_id: finalTourId,
                            version_id: finalVerId
                        }).select('id').single()

                        if (matchError) {
                            console.error(`Error creating match ${matchId}:`, matchError)
                            errorCount++
                            continue
                        }
                        matchDbId = newMatch.id
                    }

                    // 2. Process Games (Rows)
                    let gameIndexCounter = 0
                    for (const row of rows) {
                        gameIndexCounter++
                        // Parse Game Index: "GAME(เกมที่ 1,2,3,4....)"
                        const gameCol = row['GAME(เกมที่ 1,2,3,4....)'] || row['GAME'] || row['Game']
                        let gameIndex = gameIndexCounter
                        if (gameCol) {
                            const parsedG = parseInt(String(gameCol).replace(/\D/g, ''))
                            if (!isNaN(parsedG) && parsedG > 0) gameIndex = parsedG
                        }

                        const teamASideStr = String(row['TEAM A SIDE (BLUE OR RED)'] || '').toUpperCase()
                        const matchWinName = row['MATCH WIN (name TEAM A or name TEAM B)']

                        // Determine Blue/Red Team Names
                        let blueTeamName = '', redTeamName = ''
                        if (teamASideStr.includes('BLUE')) {
                            blueTeamName = teamA
                            redTeamName = teamB
                        } else {
                            blueTeamName = teamB
                            redTeamName = teamA
                        }

                        // Determine Winner Side
                        let winnerSide = 'Blue' // Default
                        if (matchWinName) {
                            // If winner name is Blue Team Name, then Blue Wins
                            if (matchWinName === blueTeamName) winnerSide = 'Blue'
                            else if (matchWinName === redTeamName) winnerSide = 'Red'
                            // Fallback: simple string match (case insensitive?)
                            else if (String(matchWinName).toLowerCase().includes(blueTeamName.toLowerCase())) winnerSide = 'Blue'
                            else if (String(matchWinName).toLowerCase().includes(redTeamName.toLowerCase())) winnerSide = 'Red'
                        }

                        // Upsert Game logic (Manual to avoid missing unique constraint issues)
                        let gameData
                        const { data: existingGame } = await supabase
                            .from('draft_games')
                            .select('id')
                            .eq('match_id', matchDbId)
                            .eq('game_number', gameIndex)
                            .single()

                        // Prepare Game Data
                        const mvpAName = row['MVPTEAM A']
                        const mvpBName = row['MVPTEAM B']

                        const isTeamABlue = teamASideStr.includes('BLUE')

                        // We need to resolve Name -> ID
                        const mvpAId = findHeroId(mvpAName)
                        const mvpBId = findHeroId(mvpBName)

                        // Map to Blue/Red Key Player
                        const blueKeyId = isTeamABlue ? mvpAId : mvpBId
                        const redKeyId = isTeamABlue ? mvpBId : mvpAId

                        const gamePayload = {
                            match_id: matchDbId,
                            game_number: gameIndex,
                            blue_team_name: blueTeamName,
                            red_team_name: redTeamName,
                            winner: winnerSide,
                            blue_key_player_id: blueKeyId,
                            red_key_player_id: redKeyId,
                            status: 'finished'
                        }

                        let gameError
                        if (existingGame) {
                            const { data, error } = await supabase
                                .from('draft_games')
                                .update(gamePayload)
                                .eq('id', existingGame.id)
                                .select('id')
                                .single()
                            gameData = data
                            gameError = error
                        } else {
                            const { data, error } = await supabase
                                .from('draft_games')
                                .insert(gamePayload)
                                .select('id')
                                .single()
                            gameData = data
                            gameError = error
                        }

                        if (gameError || !gameData) {
                            console.error(`Error saving game ${gameIndex} for ${matchId}`, gameError)
                            continue
                        }

                        // 3. Process Picks (Chronological Schema) 
                        const picksToInsert: any[] = []

                        const SLOT_CONFIG: any = {
                            1: { side: 'BLUE', type: 'BAN', idx: 1, label: '1-Blue-BAN1' },
                            2: { side: 'RED', type: 'BAN', idx: 1, label: '2-Red-BAN2' },
                            3: { side: 'BLUE', type: 'BAN', idx: 2, label: '3-Blue-BAN3' },
                            4: { side: 'RED', type: 'BAN', idx: 2, label: '4-Red-BAN4' },
                            5: { side: 'BLUE', type: 'PICK', idx: 1, label: '5-Blue-Pick1' },
                            6: { side: 'RED', type: 'PICK', idx: 1, label: '6-Red-Pick2' },
                            7: { side: 'RED', type: 'PICK', idx: 2, label: '7-Red-Pick3' },
                            8: { side: 'BLUE', type: 'PICK', idx: 2, label: '8-Blue-Pick4' },
                            9: { side: 'BLUE', type: 'PICK', idx: 3, label: '9-Blue-Pick5' },
                            10: { side: 'RED', type: 'PICK', idx: 3, label: '10-Red-Pick6' },
                            11: { side: 'RED', type: 'BAN', idx: 3, label: '11-Red-BAN5' },
                            12: { side: 'BLUE', type: 'BAN', idx: 3, label: '12.Blue-BAN6' },
                            13: { side: 'RED', type: 'BAN', idx: 4, label: '13-Red-BAN7' },
                            14: { side: 'BLUE', type: 'BAN', idx: 4, label: '14-Blue-BAN8' },
                            15: { side: 'RED', type: 'PICK', idx: 4, label: '15-Red-Pick7' },
                            16: { side: 'BLUE', type: 'PICK', idx: 4, label: '16-Blue-Pick8' },
                            17: { side: 'BLUE', type: 'PICK', idx: 5, label: '17-Blue-Pick9' },
                            18: { side: 'RED', type: 'PICK', idx: 5, label: '18-Red-Pick10' },
                        }

                        // Parse Draft Slots (1-18)
                        for (let i = 1; i <= 18; i++) {
                            const cfg = SLOT_CONFIG[i]
                            // Try finding the label. Handle potential user typos in label if needed.
                            // Config is dot (12.Blue-BAN6), check for hyphen (12-Blue-BAN6) as fallback.
                            let hName = row[cfg.label]
                            if (!hName && i === 12) hName = row['12-Blue-BAN6']


                            const hid = findHeroId(hName)
                            if (hid) {
                                // For Quick Result Entry, we must remap 1-18 slots to 1-5 role indices
                                // so that [id]/page.tsx can load them correctly without 'assigned_role' reliance.
                                let finalPosIndex = i

                                if (matchType === 'scrim_summary') {
                                    // Skip Bans for Quick Entry
                                    if (cfg.type === 'BAN') continue

                                    // Map Blue: 5,8,9,16,17 -> 1,2,3,4,5
                                    if (cfg.side === 'BLUE') {
                                        const bMap = [5, 8, 9, 16, 17]
                                        const idx = bMap.indexOf(i)
                                        if (idx !== -1) finalPosIndex = idx + 1
                                        else continue // Invalid slot for Blue Pick
                                    }
                                    // Map Red: 6,7,10,15,18 -> 1,2,3,4,5
                                    else if (cfg.side === 'RED') {
                                        const rMap = [6, 7, 10, 15, 18]
                                        const idx = rMap.indexOf(i)
                                        if (idx !== -1) finalPosIndex = idx + 1
                                        else continue // Invalid slot for Red Pick
                                    }
                                }

                                picksToInsert.push({
                                    game_id: gameData.id,
                                    hero_id: hid,
                                    side: cfg.side,
                                    type: cfg.type,
                                    position_index: finalPosIndex, // 1-5 for Quick, 1-18 for Sim
                                    assigned_role: null // assigned later
                                })
                            }
                        }

                        // Apply Positions (Role Assignment)
                        // Need to verify if Team A is Blue or Red
                        // isTeamABlue already defined above

                        const applyRoles = (prefix: string, isBlue: boolean) => {
                            const mySide = isBlue ? 'BLUE' : 'RED'

                            if (matchType === 'scrim_summary') {
                                // Logic for Quick Result Entry (1-5 Indices per side)
                                for (let k = 1; k <= 5; k++) {
                                    const roleName = row[`${prefix} POSITION${k}`]
                                    if (roleName) {
                                        // Find pick by relative index (k) and side
                                        const pickObj = picksToInsert.find(p => p.position_index === k && p.side === mySide && p.type === 'PICK')
                                        if (pickObj) {
                                            pickObj.assigned_role = roleName
                                        }
                                    }
                                }
                            } else {
                                // Logic for Full Simulator (1-18 Standard Slots)
                                const teamBluePicks = [5, 8, 9, 16, 17] // Slot IDs
                                const teamRedPicks = [6, 7, 10, 15, 18] // Slot IDs
                                const mySlots = isBlue ? teamBluePicks : teamRedPicks

                                for (let k = 1; k <= 5; k++) {
                                    const roleName = row[`${prefix} POSITION${k}`]
                                    if (roleName) {
                                        const slotId = mySlots[k - 1]
                                        // Find pick by absolute slot index
                                        const pickObj = picksToInsert.find(p => p.position_index === slotId)
                                        if (pickObj) {
                                            pickObj.assigned_role = roleName
                                        }
                                    }
                                }
                            }
                        }

                        applyRoles('TEAM A', isTeamABlue)
                        applyRoles('TEAM B', !isTeamABlue)

                        await supabase.from('draft_picks').delete().eq('game_id', gameData.id)
                        if (picksToInsert.length > 0) {
                            await supabase.from('draft_picks').insert(picksToInsert)
                        }
                    }
                    successCount++
                }

                alert(`Import Complete. Success: ${successCount}, Errors: ${errorCount}`)
                loadScrims()
            } catch (err) {
                console.error(err)
                alert("Failed to import. Please check file format.")
            } finally {
                setImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    const hasActiveFilters = selectedYear !== 'All' || selectedMonth !== 'All' || selectedDay !== 'All' || selectedPatch !== 'All' || selectedMode !== 'All'

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black italic text-white tracking-tighter uppercase">Scrimmage Logs</h1>
                    <p className="text-slate-400 mt-1">Record and analyze practice sessions</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button variant="outline" className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white" onClick={handleImportClick} disabled={importing}>
                        {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                        Import
                    </Button>
                    <Button variant="outline" className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white" onClick={handleExport}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="bg-slate-900 border-slate-700 text-indigo-300 hover:text-white">
                                <FileDown className="w-4 h-4 mr-2" />
                                Template
                                <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-slate-800 hover:text-white"
                                onClick={() => handleDownloadTemplate('QUICK')}
                            >
                                Quick Result Entry (No Bans)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-slate-800 hover:text-white"
                                onClick={() => handleDownloadTemplate('FULL')}
                            >
                                Full Draft Simulator (Wtih Bans)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Link href="/admin/scrims/new">
                        <Button className="bg-indigo-600 hover:bg-indigo-500 font-medium">
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Match
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col xl:flex-row gap-4 justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Search by Team or Match ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-slate-950 border-slate-800 text-white"
                            />
                        </div>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                <X className="w-4 h-4 mr-2" />
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Filter Unified */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal bg-slate-950 border-slate-800",
                                        selectedYear === 'All' && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedYear === 'All' ? (
                                        <span>Pick a date</span>
                                    ) : (
                                        <span>
                                            {selectedYear}
                                            {selectedMonth !== 'All' && ` / ${months.find(m => m.value === selectedMonth)?.label}`}
                                            {selectedDay !== 'All' && ` / ${selectedDay}`}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-slate-950 border-slate-800" align="start">
                                <div className="flex h-[300px] divide-x divide-slate-800">
                                    {/* Year Column */}
                                    <div className="flex flex-col w-[80px]">
                                        <div className="p-2 text-xs font-bold text-slate-400 text-center border-b border-slate-800 bg-slate-900/50">Year</div>
                                        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn("w-full justify-start text-xs", selectedYear === 'All' && "bg-indigo-600/20 text-indigo-300")}
                                                onClick={() => { setSelectedYear('All'); setSelectedMonth('All'); setSelectedDay('All'); }}
                                            >
                                                {selectedYear === 'All' && <Check className="w-3 h-3 mr-1" />}
                                                All
                                            </Button>
                                            {years.map(y => (
                                                <Button
                                                    key={y}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn("w-full justify-start text-xs", selectedYear === y && "bg-indigo-600/20 text-indigo-300")}
                                                    onClick={() => setSelectedYear(y)}
                                                >
                                                    {selectedYear === y && <Check className="w-3 h-3 mr-1" />}
                                                    {y}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Month Column */}
                                    <div className={cn("flex flex-col w-[100px]", selectedYear === 'All' && "opacity-50 pointer-events-none")}>
                                        <div className="p-2 text-xs font-bold text-slate-400 text-center border-b border-slate-800 bg-slate-900/50">Month</div>
                                        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn("w-full justify-start text-xs", selectedMonth === 'All' && "bg-indigo-600/20 text-indigo-300")}
                                                onClick={() => { setSelectedMonth('All'); setSelectedDay('All'); }}
                                            >
                                                {selectedMonth === 'All' && <Check className="w-3 h-3 mr-1" />}
                                                All
                                            </Button>
                                            {months.map(m => (
                                                <Button
                                                    key={m.value}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn("w-full justify-start text-xs", selectedMonth === m.value && "bg-indigo-600/20 text-indigo-300")}
                                                    onClick={() => setSelectedMonth(m.value)}
                                                >
                                                    {selectedMonth === m.value && <Check className="w-3 h-3 mr-1" />}
                                                    {m.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Day Column */}
                                    <div className={cn("flex flex-col w-[80px]", selectedMonth === 'All' && "opacity-50 pointer-events-none")}>
                                        <div className="p-2 text-xs font-bold text-slate-400 text-center border-b border-slate-800 bg-slate-900/50">Day</div>
                                        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn("w-full justify-start text-xs", selectedDay === 'All' && "bg-indigo-600/20 text-indigo-300")}
                                                onClick={() => setSelectedDay('All')}
                                            >
                                                {selectedDay === 'All' && <Check className="w-3 h-3 mr-1" />}
                                                All
                                            </Button>
                                            {days.map(d => (
                                                <Button
                                                    key={d}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn("w-full justify-start text-xs", selectedDay === d && "bg-indigo-600/20 text-indigo-300")}
                                                    onClick={() => setSelectedDay(d)}
                                                >
                                                    {selectedDay === d && <Check className="w-3 h-3 mr-1" />}
                                                    {d}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="h-6 w-px bg-slate-700 mx-1" />

                        {/* Patch */}
                        <Select value={selectedPatch} onValueChange={setSelectedPatch}>
                            <SelectTrigger className="w-[160px] bg-slate-950 border-slate-800 text-left">
                                <span>
                                    {selectedPatch === 'All'
                                        ? 'Patch'
                                        : versions.find(v => String(v.id) === String(selectedPatch))?.name || selectedPatch}
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Patches</SelectItem>
                                {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Mode */}
                        <Select value={selectedMode} onValueChange={setSelectedMode}>
                            <SelectTrigger className="w-[150px] bg-slate-950 border-slate-800">
                                <span className="truncate">{selectedMode === 'All' ? 'All Modes' : modes.find(m => m.value === selectedMode)?.label || selectedMode}</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Modes</SelectItem>
                                {modes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Recording Mode */}
                        <Select value={selectedRecordingMode} onValueChange={setSelectedRecordingMode}>
                            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800">
                                <SelectValue placeholder="Recording Mode">
                                    {selectedRecordingMode === 'All' ? 'All Recording Modes' : selectedRecordingMode === 'Simulator' ? 'Full Draft Simulator' : 'Quick Result Entry'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                <SelectItem value="All">All Recording Modes</SelectItem>
                                <SelectItem value="Simulator">Full Draft Simulator</SelectItem>
                                <SelectItem value="Quick">Quick Result Entry</SelectItem>
                            </SelectContent>
                        </Select>



                        {/* Team Filter (Modal) */}
                        <Dialog open={isTeamFilterOpen} onOpenChange={setIsTeamFilterOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="bg-slate-950 border-slate-800 text-slate-300 hover:text-white w-[180px] justify-between">
                                    <span className="truncate">{selectedTeam === 'All' ? 'Filter Team' : selectedTeam}</span>
                                    <Search className="w-3 h-3 ml-2 opacity-50" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[80vh] flex flex-col">
                                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-1">Select Team</h3>
                                        <p className="text-slate-400 text-sm">Filter matches by a specific team.</p>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <Input
                                            placeholder="Search teams..."
                                            value={teamsSearch}
                                            onChange={(e) => setTeamsSearch(e.target.value)}
                                            className="pl-9 bg-slate-950 border-slate-800"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto p-1 custom-scrollbar">
                                        <Button
                                            variant={selectedTeam === 'All' ? "default" : "outline"}
                                            className={cn("justify-start", selectedTeam === 'All' ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-950 border-slate-800 hover:bg-slate-800")}
                                            onClick={() => { setSelectedTeam('All'); setIsTeamFilterOpen(false); }}
                                        >
                                            All Teams
                                        </Button>
                                        {uniqueTeams
                                            .filter(t => t.toLowerCase().includes(teamsSearch.toLowerCase()))
                                            .map((team, idx) => (
                                                <Button
                                                    key={idx}
                                                    variant={selectedTeam === team ? "default" : "outline"}
                                                    className={cn("justify-start truncate", selectedTeam === team ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-950 border-slate-800 hover:bg-slate-800")}
                                                    onClick={() => { setSelectedTeam(team); setIsTeamFilterOpen(false); }}
                                                >
                                                    {team}
                                                </Button>
                                            ))
                                        }
                                        {uniqueTeams.filter(t => t.toLowerCase().includes(teamsSearch.toLowerCase())).length === 0 && (
                                            <div className="col-span-full py-8 text-center text-slate-500 text-sm">
                                                No teams found matching "{teamsSearch}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        Recent Matches
                        <span className="text-sm font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                            {scrims.length} found
                        </span>
                    </h2>

                    {loading ? (
                        <div className="text-center py-20 text-slate-500">Loading matches...</div>
                    ) : scrims.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 bg-slate-900/20 border border-slate-800/50 rounded-xl border-dashed">
                            No matches found matching your filters.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {scrims.map(scrim => {
                                const isSimulator = scrim.match_type === 'scrim_simulator'
                                const modeLabel = isSimulator ? 'Full Draft Simulator' : 'Quick Result Entry'
                                const targetLink = isSimulator ? `/admin/simulator/${scrim.slug || scrim.id}` : `/admin/scrims/${scrim.slug || scrim.id}`

                                return (
                                    <div
                                        key={scrim.id}
                                        className="group relative flex items-center justify-between bg-[#0B1120] border border-slate-800/50 rounded-lg p-4 hover:border-slate-700 transition-all"
                                    >
                                        {/* Left Section: Status & Meta */}
                                        <div className="flex items-center gap-6 w-[30%]">
                                            <div className="shrink-0">
                                                {scrim.status === 'ongoing' ? (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white border border-slate-700">
                                                        LIVE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500 border border-slate-800">
                                                        DONE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 text-xs font-bold truncate max-w-[200px]">
                                                    {scrim.tournament?.name || 'Unknown Event'}
                                                </span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                                        {scrim.slug}
                                                    </span>
                                                    <span className="text-slate-700 text-[10px]">•</span>
                                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                                        Patch {scrim.version?.name || 'Unknown'}
                                                    </span>
                                                    <span className="text-slate-700 text-[10px]">•</span>
                                                    <span className={cn("text-[10px] uppercase font-bold tracking-wider", isSimulator ? "text-indigo-400" : "text-emerald-400")}>
                                                        {modeLabel}
                                                    </span>
                                                    <span className="text-slate-700 text-[10px]">•</span>
                                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                                        {scrim.mode ? `${scrim.mode.replace('BO', '')} Game` : '1 Game'}
                                                    </span>

                                                    {/* Missing MVP Indicator */}
                                                    {isSimulator && scrim.games?.some((g: any) => !g.blue_key_player_id || !g.red_key_player_id) && (
                                                        <>
                                                            <span className="text-slate-700 text-[10px]">•</span>
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-amber-500 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                Missing MVP
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center Section: Teams */}
                                        <div className="flex items-center justify-center gap-8 flex-1">
                                            <span className="text-white font-bold text-sm text-right w-32 truncate">
                                                {scrim.team_a_name}
                                            </span>
                                            <span className="text-slate-700 text-xs font-mono">VS</span>
                                            <span className="text-white font-bold text-sm text-left w-32 truncate">
                                                {scrim.team_b_name}
                                            </span>
                                        </div>

                                        {/* Right Section: Actions & Date */}
                                        <div className="flex items-center justify-end gap-4 w-[25%]">
                                            <span className="text-slate-600 text-xs">
                                                {scrim.match_date ? new Date(scrim.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Date'}
                                            </span>

                                            <Link href={targetLink}>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
                                                >
                                                    Enter Room
                                                </Button>
                                            </Link>

                                            <div className="relative w-8 h-8">
                                                <DeleteMatchButton
                                                    matchId={scrim.id}
                                                    matchTitle={`${scrim.team_a_name} vs ${scrim.team_b_name}`}
                                                    onDelete={() => setScrims(prev => prev.filter(s => s.id !== scrim.id))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Load More Button */}
                    {!loading && hasMore && (
                        <div className="flex justify-center pt-4 pb-8">
                            <Button
                                variant="outline"
                                className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 min-w-[200px]"
                                onClick={() => setPageLimit(prev => prev + 20)}
                            >
                                Load More Matches
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
