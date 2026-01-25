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
    const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)

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

        // Base Query Builder Helper
        const buildBaseQuery = (q: any) => {
            if (searchQuery) {
                q = q.or(`team_a_name.ilike.%${searchQuery}%,team_b_name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`)
            }
            if (selectedYear !== 'All') {
                const start = `${selectedYear}-01-01`
                const end = `${selectedYear}-12-31`
                q = q.gte('match_date', start).lte('match_date', end)
            }
            if (selectedPatch !== 'All') q = q.eq('version_id', selectedPatch)
            if (selectedMode !== 'All') q = q.eq('mode', selectedMode)
            if (selectedRecordingMode !== 'All') {
                if (selectedRecordingMode === 'Simulator') q = q.eq('match_type', 'scrim_simulator')
                else if (selectedRecordingMode === 'Quick') q = q.eq('match_type', 'scrim_summary')
            }
            if (selectedTeam !== 'All') {
                q = q.or(`team_a_name.eq.${selectedTeam},team_b_name.eq.${selectedTeam}`)
            }
            return q
        }

        let finalData = []

        if (showIncompleteOnly) {
            // STEP 1: Find IDs of matches with incomplete games
            // We need to fetch enough data to check picks count.
            // fetching just IDs and joins is efficient enough for moderate datasets.
            let idQuery = supabase
                .from('draft_matches')
                .select(`
                    id, 
                    match_type,
                    games:draft_games(
                        id,
                        picks:draft_picks(vote_count:count)
                    )
                `) // note: using count might be cleaner if possible, or just select id
                .in('match_type', ['scrim', 'scrim_summary', 'scrim_simulator'])

            // Apply base filters to reduce scan
            idQuery = buildBaseQuery(idQuery)

            // We might need to fetch ALL matching these filters to ensure we find all incomplete ones, 
            // then paginate the RESULT. This is heavy but necessary for this specific unlikely filter.
            // For now let's limit to 100 recent matches to check for incompletion to avoid massive reads?
            // Or just fetch ids.

            // Limitation: If we want accurate pagination on "Incomplete", we technically validly need to scan everything match the base filters.
            idQuery = idQuery.order('match_date', { ascending: false }).limit(100)

            // Actually, let's use a simpler select for check
            let scanQuery = supabase
                .from('draft_matches')
                .select(`
                    id,
                    games:draft_games(
                        id,
                        picks:draft_picks(id, type)
                    )
                `)
                .in('match_type', ['scrim', 'scrim_summary', 'scrim_simulator'])
                .order('created_at', { ascending: false })
                .limit(200) // Scan last 200 matches for incomplete ones

            scanQuery = buildBaseQuery(scanQuery)

            const { data: scanData } = await scanQuery

            if (scanData) {
                const incompleteIds = scanData.filter(m => {
                    // Check if ANY game has < 10 picks (filtering only type 'PICK')
                    // existing logic: picks can include bans. 
                    // We assume 'draft_picks' includes bans if type='BAN'. 
                    // We want 10 HEROES picked. So type='PICK'.
                    const hasIncompleteGame = m.games.some((g: any) => {
                        const pickCount = g.picks?.filter((p: any) => p.type === 'PICK').length || 0
                        return pickCount < 10
                    })
                    return hasIncompleteGame
                }).map(m => m.id)

                if (incompleteIds.length > 0) {
                    // STEP 2: Fetch full data for these IDs
                    let fullQuery = supabase
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
                        .in('id', incompleteIds)
                        .order('match_date', { ascending: false })
                        .order('created_at', { ascending: false })

                    const { data } = await fullQuery
                    finalData = data || []
                }
            }

        } else {
            // Standard Query
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

            query = buildBaseQuery(query)
            const { data } = await query
            finalData = data || []
        }

        let filteredData = finalData

        // Determine if there are more records (Approximate usage)
        if (!showIncompleteOnly) {
            setHasMore(filteredData.length === pageLimit)
        } else {
            setHasMore(false) // Disable "load more" for this special filter for now
        }

        // Client-side date filtering (Month/Day) because SQL date_part is annoying via JS client without RPC
        if (selectedYear !== 'All' && selectedMonth !== 'All') {
            filteredData = filteredData.filter(s => {
                if (!s.match_date) return false
                const d = new Date(s.match_date)
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
    }, [searchQuery, selectedYear, selectedMonth, selectedDay, selectedPatch, selectedMode, selectedRecordingMode, selectedTeam, pageLimit, showIncompleteOnly])

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

        const rows: any[] = []

        scrims.forEach(s => {
            const isSimulator = s.match_type === 'scrim_simulator'
            const recMode = isSimulator ? 'Full Draft Simulator' : 'Quick Result Entry'
            const numGames = s.mode ? `${s.mode.replace('BO', '')} Games` : '1 Game'
            const hasGames = s.games && s.games.length > 0

            const baseRow = {
                'MATCH ID': s.slug || s.id,
                'Date': s.match_date ? new Date(s.match_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                'Tournament': s.tournament?.name || 'Unknown',
                'Patch': s.version?.name || 'Current',
                'Recording Mode (Full,Quick)': recMode,
                'Number of Games (1Game..... 7 games)': numGames,
                'TEAM A': s.team_a_name,
                'Team B': s.team_b_name,
            }

            if (!hasGames) {
                // Should we export empty row? Or skip? 
                // Currently returning basic row with empty fields
                rows.push({ ...baseRow })
                return
            }

            // Iterate Games
            s.games.forEach((g: any) => {
                const isABlue = g.blue_team_name === s.team_a_name
                const teamASide = isABlue ? 'BLUE' : 'RED'

                // Winner Logic
                let winnerName = ''
                if (g.winner === 'Blue') winnerName = g.blue_team_name
                else if (g.winner === 'Red') winnerName = g.red_team_name

                const row: any = {
                    ...baseRow,
                    'GAME(เกมที่ 1,2,3,4....)': `Game ${g.game_number}`,
                    'TEAM A SIDE (BLUE OR RED)': teamASide,
                    'MATCH WIN (name TEAM A or name TEAM B)': winnerName,
                    'WIN % BLUE TEAM': g.analysis_data?.winPrediction?.blue || 50
                }

                const picks = g.picks || []

                // Helper to find hero name
                const getHeroName = (id: string) => heroes.find(h => h.id === id)?.name || ''

                if (isSimulator) {
                    // Simulator Logic (Identical to MatchRoom.tsx)
                    const SLOT_CONFIG: any = {
                        1: { side: 'BLUE', type: 'BAN', col: '1-Blue-BAN1' },
                        2: { side: 'RED', type: 'BAN', col: '2-Red-BAN2' },
                        3: { side: 'BLUE', type: 'BAN', col: '3-Blue-BAN3' },
                        4: { side: 'RED', type: 'BAN', col: '4-Red-BAN4' },
                        5: { side: 'BLUE', type: 'PICK', col: '5-Blue-Pick1' },
                        6: { side: 'RED', type: 'PICK', col: '6-Red-Pick2' },
                        7: { side: 'RED', type: 'PICK', col: '7-Red-Pick3' },
                        8: { side: 'BLUE', type: 'PICK', col: '8-Blue-Pick4' },
                        9: { side: 'BLUE', type: 'PICK', col: '9-Blue-Pick5' },
                        10: { side: 'RED', type: 'PICK', col: '10-Red-Pick6' },
                        11: { side: 'RED', type: 'BAN', col: '11-Red-BAN5' },
                        12: { side: 'BLUE', type: 'BAN', col: '12-Blue-BAN6' },
                        13: { side: 'RED', type: 'BAN', col: '13-Red-BAN7' },
                        14: { side: 'BLUE', type: 'BAN', col: '14-Blue-BAN8' },
                        15: { side: 'RED', type: 'PICK', col: '15-Red-Pick7' },
                        16: { side: 'BLUE', type: 'PICK', col: '16-Blue-Pick8' },
                        17: { side: 'BLUE', type: 'PICK', col: '17-Blue-Pick9' },
                        18: { side: 'RED', type: 'PICK', col: '18-Red-Pick10' },
                    }

                    // Fill Slots
                    for (let i = 1; i <= 18; i++) {
                        const config = SLOT_CONFIG[i]
                        const p = picks.find((p: any) => p.position_index === i)
                        if (p) {
                            row[config.col] = getHeroName(p.hero_id)
                        } else {
                            row[config.col] = ''
                        }
                    }

                    // Positions
                    const getTeamPickSlot = (isTeamBlue: boolean, pickNum: number) => {
                        const bluePicks = [5, 8, 9, 16, 17]
                        const redPicks = [6, 7, 10, 15, 18]
                        return isTeamBlue ? bluePicks[pickNum - 1] : redPicks[pickNum - 1]
                    }

                    // TEAM A POSITIONS (1-5)
                    for (let k = 1; k <= 5; k++) {
                        const slot = getTeamPickSlot(isABlue, k)
                        const p = picks.find((p: any) => p.position_index === slot)
                        row[`TEAM A POSITION${k}`] = p?.assigned_role || ''
                    }

                    // TEAM B POSITIONS (1-5)
                    for (let k = 1; k <= 5; k++) {
                        const slot = getTeamPickSlot(!isABlue, k)
                        const p = picks.find((p: any) => p.position_index === slot)
                        row[`TEAM B POSITION${k}`] = p?.assigned_role || ''
                    }

                } else {
                    // Quick Result Entry (Legacy)
                    // No Bans, Fixed Positions
                    // Blue Picks: [5, 8, 9, 16, 17] -> mapped from picks with side=BLUE, type=PICK sorted by index
                    // Red Picks:  [6, 7, 10, 15, 18]

                    const bluePicks = picks.filter((p: any) => p.side === 'BLUE' && p.type === 'PICK').sort((a: any, b: any) => a.position_index - b.position_index)
                    const redPicks = picks.filter((p: any) => p.side === 'RED' && p.type === 'PICK').sort((a: any, b: any) => a.position_index - b.position_index)

                    if (bluePicks[0]) row['5-Blue-Pick1'] = getHeroName(bluePicks[0].hero_id)
                    if (bluePicks[1]) row['8-Blue-Pick4'] = getHeroName(bluePicks[1].hero_id)
                    if (bluePicks[2]) row['9-Blue-Pick5'] = getHeroName(bluePicks[2].hero_id)
                    if (bluePicks[3]) row['16-Blue-Pick8'] = getHeroName(bluePicks[3].hero_id)
                    if (bluePicks[4]) row['17-Blue-Pick9'] = getHeroName(bluePicks[4].hero_id)

                    if (redPicks[0]) row['6-Red-Pick2'] = getHeroName(redPicks[0].hero_id)
                    if (redPicks[1]) row['7-Red-Pick3'] = getHeroName(redPicks[1].hero_id)
                    if (redPicks[2]) row['10-Red-Pick6'] = getHeroName(redPicks[2].hero_id)
                    if (redPicks[3]) row['15-Red-Pick7'] = getHeroName(redPicks[3].hero_id)
                    if (redPicks[4]) row['18-Red-Pick10'] = getHeroName(redPicks[4].hero_id)

                    // Quick Entry Positions are Standard
                    const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
                    for (let k = 1; k <= 5; k++) {
                        row[`TEAM A POSITION${k}`] = STANDARD_ROLES[k - 1]
                        row[`TEAM B POSITION${k}`] = STANDARD_ROLES[k - 1]
                    }
                }

                // MVPs
                const mvpAId = isABlue ? g.blue_key_player_id : g.red_key_player_id
                const mvpBId = isABlue ? g.red_key_player_id : g.blue_key_player_id
                row['MVPTEAM A'] = getHeroName(mvpAId || '')
                row['MVPTEAM B'] = getHeroName(mvpBId || '')

                rows.push(row)
            })
        })

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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                <div>
                    <h1 className="text-3xl font-black italic text-white tracking-tighter uppercase">Scrimmage Logs</h1>
                    <p className="text-slate-400 mt-1">Record and analyze practice sessions</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button variant="outline" size="sm" className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white" onClick={handleImportClick} disabled={importing}>
                        {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 md:mr-2" />}
                        <span className="hidden md:inline">Import</span>
                    </Button>
                    <Button variant="outline" size="sm" className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white" onClick={handleExport}>
                        <FileDown className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Export</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-slate-900 border-slate-700 text-indigo-300 hover:text-white"
                        onClick={() => handleDownloadTemplate('FULL')}
                    >
                        <FileDown className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Template</span>
                    </Button>
                    <Link href="/admin/scrims/new">
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 font-medium">
                            <Plus className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Create New Match</span>
                            <span className="md:hidden">New</span>
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

                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-10 border-dashed text-xs cursor-pointer select-none",
                                showIncompleteOnly ? "bg-red-900/20 border-red-800 text-red-500" : "bg-slate-950 border-slate-800 text-muted-foreground hover:text-white"
                            )}
                            onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                        >
                            <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                            Incomplete
                        </Button>



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
                                        className="group relative flex flex-col md:flex-row items-center justify-between bg-[#0B1120] border border-slate-800/50 rounded-lg p-4 hover:border-slate-700 transition-all gap-4 md:gap-0"
                                    >
                                        {/* Mobile Header (Date & Status) - Visible only on mobile */}
                                        <div className="flex md:hidden w-full items-center justify-between border-b border-slate-800/50 pb-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                {scrim.status === 'ongoing' ? (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white border border-slate-700">
                                                        LIVE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500 border border-slate-800">
                                                        DONE
                                                    </span>
                                                )}
                                                <span className="text-slate-500 text-[10px]">
                                                    {scrim.match_date ? new Date(scrim.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                                                </span>
                                            </div>
                                            <div className="relative w-8 h-8 flex justify-end">
                                                <DeleteMatchButton
                                                    matchId={scrim.id}
                                                    matchTitle={`${scrim.team_a_name} vs ${scrim.team_b_name}`}
                                                    onDelete={() => setScrims(prev => prev.filter(s => s.id !== scrim.id))}
                                                />
                                            </div>
                                        </div>

                                        {/* Left Section: Meta (Desktop: 30%, Mobile: Full/Hidden parts) */}
                                        <div className="flex flex-col gap-1 w-full md:w-[30%]">
                                            <div className="hidden md:block shrink-0 mb-1">
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
                                            <span className="text-slate-300 text-xs font-bold truncate max-w-[200px] hidden md:block">
                                                {scrim.tournament?.name || 'Unknown Event'}
                                            </span>

                                            {/* Meta Tags - Wrap on mobile */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider hidden md:inline">
                                                    {scrim.slug}
                                                </span>
                                                <span className="text-slate-700 text-[10px] hidden md:inline">•</span>
                                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-slate-900/50 md:bg-transparent px-1.5 py-0.5 md:p-0 rounded md:rounded-none border md:border-none border-slate-800">
                                                    Patch {scrim.version?.name || 'Unknown'}
                                                </span>
                                                <span className="text-slate-700 text-[10px] hidden md:inline">•</span>
                                                <span className={cn("text-[10px] uppercase font-bold tracking-wider bg-slate-900/50 md:bg-transparent px-1.5 py-0.5 md:p-0 rounded md:rounded-none border md:border-none border-slate-800", isSimulator ? "text-indigo-400" : "text-emerald-400")}>
                                                    {modeLabel}
                                                </span>
                                                <span className="text-slate-700 text-[10px] hidden md:inline">•</span>
                                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-slate-900/50 md:bg-transparent px-1.5 py-0.5 md:p-0 rounded md:rounded-none border md:border-none border-slate-800">
                                                    {scrim.mode ? `${scrim.mode.replace('BO', '')} Game` : '1 Game'}
                                                </span>

                                                {/* Missing MVP Indicator */}
                                                {isSimulator && scrim.games?.some((g: any) => !g.blue_key_player_id || !g.red_key_player_id) && (
                                                    <>
                                                        <span className="text-slate-700 text-[10px] hidden md:inline">•</span>
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-amber-500 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                                            <AlertTriangle className="w-2.5 h-2.5" />
                                                            Missing MVP
                                                        </div>
                                                    </>
                                                )}

                                                {/* Missing Picks Indicator */}
                                                {(() => {
                                                    const badGames = scrim.games?.filter((g: any) => {
                                                        const pickCount = g.picks?.filter((p: any) => p.type === 'PICK').length || 0
                                                        return pickCount < 10
                                                    }).length || 0

                                                    if (badGames > 0) {
                                                        return (
                                                            <>
                                                                <span className="text-slate-700 text-[10px] hidden md:inline">•</span>
                                                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/60 border border-red-800/80 text-red-500 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                                    Incomplete Draft
                                                                </div>
                                                            </>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                            </div>
                                        </div>

                                        {/* Center Section: Teams */}
                                        <div className="flex items-center justify-between md:justify-center gap-4 w-full md:flex-1 py-2 md:py-0 bg-slate-900/30 md:bg-transparent p-3 md:p-0 rounded-lg md:rounded-none border md:border-none border-slate-800/50">
                                            <span className="text-white font-bold text-lg md:text-sm text-right flex-1 truncate">
                                                {scrim.team_a_name}
                                            </span>
                                            <div className="flex flex-col items-center">
                                                <span className="text-slate-600 text-[10px] font-mono font-bold bg-slate-950 px-1.5 rounded border border-slate-800">VS</span>
                                            </div>
                                            <span className="text-white font-bold text-lg md:text-sm text-left flex-1 truncate">
                                                {scrim.team_b_name}
                                            </span>
                                        </div>

                                        {/* Right Section: Actions & Date */}
                                        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-[25%] mt-2 md:mt-0">
                                            <span className="text-slate-600 text-xs hidden md:block">
                                                {scrim.match_date ? new Date(scrim.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Date'}
                                            </span>

                                            <Link href={targetLink} className="w-full md:w-auto">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full md:w-auto h-9 md:h-8 bg-indigo-600/10 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 font-bold"
                                                >
                                                    Enter Room
                                                </Button>
                                            </Link>

                                            <div className="relative w-8 h-8 hidden md:block">
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
