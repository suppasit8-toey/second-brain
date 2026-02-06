import { DraftStep, Hero } from '@/utils/types'
import { Check, User, ShieldBan } from 'lucide-react'
import Image from 'next/image'
import DraftSuggestionPanel from './DraftSuggestionPanel'

interface DraftTeamPanelProps {
    side: 'BLUE' | 'RED'
    teamName: string
    bans: string[]
    picks: Record<number, string>
    currentStep: DraftStep | null
    isFinished: boolean
    selectedHero: Hero | null
    getHero: (id: string) => Hero | undefined
    manualLanes: Record<string, string[]>
    onLaneAssign: (heroId: string, lane: string) => void
    onAnalyzeHero?: (hero: Hero) => void
    suggestionProps: {
        suggestions: any[]
        isLoading: boolean
        onGenerate: (mode: string) => void
        onSelectHero: (hero: Hero) => void
        activeLayers: any[]
        upcomingSlots: { type: 'BAN' | 'PICK', slotNum: number }[]
    }
}

export default function DraftTeamPanel({
    side,
    teamName,
    bans,
    picks,
    currentStep,
    isFinished,
    selectedHero,
    getHero,
    manualLanes,
    onLaneAssign,
    onAnalyzeHero,
    suggestionProps
}: DraftTeamPanelProps) {
    const isBlue = side === 'BLUE'
    // Theme colors
    // Theme colors - Sci-Fi Update
    const bgBase = isBlue ? 'bg-blue-950/40 backdrop-blur-sm' : 'bg-red-950/40 backdrop-blur-sm'
    const borderBase = isBlue ? 'border-blue-500/30' : 'border-red-500/30'
    const borderActive = isBlue ? 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' : 'border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'
    const shadowActive = isBlue ? 'shadow-[0_0_20px_rgba(96,165,250,0.4)]' : 'shadow-[0_0_20px_rgba(248,113,113,0.4)]'
    const textBase = isBlue ? 'text-blue-100' : 'text-red-100'
    const textHeader = isBlue ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'
    const laneActive = isBlue ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]'
    const laneHover = isBlue ? 'hover:bg-blue-500/30 hover:shadow-[0_0_5px_rgba(59,130,246,0.3)]' : 'hover:bg-red-500/30 hover:shadow-[0_0_5px_rgba(239,68,68,0.3)]'

    const lanes = [
        { id: 'Dark Slayer', label: 'DS' },
        { id: 'Jungle', label: 'JG' },
        { id: 'Mid', label: 'MID' },
        { id: 'Abyssal', label: 'AB' },
        { id: 'Roam', label: 'SP' },
    ]

    return (
        <div className="flex flex-col gap-1 w-full h-full overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pr-1">
            <div className={`hidden lg:block p-3 ${isBlue ? 'bg-blue-950/60 border-blue-500/40' : 'bg-red-950/60 border-red-500/40'} border rounded-xl text-center shadow-lg relative overflow-hidden group`}>
                <div className={`absolute inset-0 opacity-20 ${isBlue ? 'bg-gradient-to-r from-transparent via-blue-500/30 to-transparent' : 'bg-gradient-to-r from-transparent via-red-500/30 to-transparent'} translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`} />
                <h3 className={`text-xl font-mono font-black tracking-[0.2em] uppercase ${textHeader} truncate`}>{teamName}</h3>
            </div>

            {/* Bans */}
            <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3].map((i) => {
                    // Map visual index to state index
                    // State bans array is [ban1, ban2, ban3, ban4]
                    const banId = bans[i]
                    const banHero = banId ? getHero(banId) : null

                    // Logic to check if this slot is active
                    // We need to know how many bans have happened for this side
                    // If currentStep.side == side AND currentStep.type == BAN AND bans.length == i
                    // Note: This logic assumes sequential filling.
                    const myBanCount = bans.filter(Boolean).length
                    const isActive = currentStep?.side === side && currentStep?.type === 'BAN' && i === myBanCount
                    const preview = isActive && selectedHero ? selectedHero : null

                    return (
                        <div key={i} className={`w-8 h-8 md:w-10 md:h-10 border bg-slate-900/80 rounded flex items-center justify-center overflow-hidden transition-all duration-300 ${preview ? `${borderActive} ${shadowActive} animate-pulse scale-110` : 'border-slate-800'}`}>
                            {banHero ? (
                                <Image src={banHero.icon_url || ''} alt="ban" width={40} height={40} className="grayscale opacity-60" />
                            ) : preview ? (
                                <Image src={preview.icon_url || ''} alt="preview" width={40} height={40} className="opacity-70 grayscale-[50%]" />
                            ) : (
                                <ShieldBan size={12} className="text-slate-600" />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Picks */}
            <div className="space-y-1">
                {[0, 1, 2, 3, 4].map((i) => {
                    const heroId = picks[i]
                    const hero = heroId ? getHero(heroId) : null

                    const myPickCount = Object.values(picks).filter(Boolean).length
                    const isActive = currentStep?.side === side && currentStep?.type === 'PICK' && i === myPickCount
                    const preview = isActive && selectedHero ? selectedHero : null

                    return (
                        <div
                            key={i}
                            onClick={() => hero && onAnalyzeHero?.(hero)}
                            className={`relative flex flex-col ${bgBase} border rounded-xl overflow-hidden shrink-0 transition-all duration-300 ${preview ? `${borderActive} ${shadowActive} scale-[1.02]` : borderBase} ${hero ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md' : ''}`}
                        >
                            <div className="h-12 md:h-14 flex items-center px-3 relative overflow-hidden flex-row-reverse text-right shrink-0">
                                {hero ? (
                                    <>
                                        <Image src={hero.icon_url || ''} alt={hero.name} fill className="object-cover opacity-20" />
                                        <div className="relative z-10 flex items-center gap-3 flex-row-reverse w-full">
                                            <Image src={hero.icon_url || ''} alt={hero.name} width={40} height={40} className={`rounded-full border-2 ${borderActive}`} />
                                            <span className="font-bold text-sm md:text-base text-white truncate flex-1">{hero.name}</span>
                                        </div>
                                    </>
                                ) : preview ? (
                                    <>
                                        <Image src={preview.icon_url || ''} alt={preview.name} fill className="object-cover opacity-30 animate-pulse" />
                                        <div className="relative z-10 flex items-center gap-3 flex-row-reverse w-full">
                                            <Image src={preview.icon_url || ''} alt={preview.name} width={40} height={40} className={`rounded-full border-2 ${borderActive} animate-pulse`} />
                                            <span className={`font-bold text-sm md:text-base ${textBase} animate-pulse truncate flex-1`}>{preview.name}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full flex items-center justify-between text-slate-600 relative z-10 text-xs md:text-sm">
                                        <span>Pick {i + 1}</span>
                                        <User size={16} className="opacity-20" />
                                    </div>
                                )}
                            </div>

                            {/* Manual Lane Selector */}
                            <div className={`flex bg-slate-900/50 border-t divide-x divide-slate-800 transition-opacity ${hero ? `opacity-100 ${borderBase}` : 'opacity-0 border-transparent pointer-events-none'} h-5 md:h-6`}>
                                {lanes.map(lane => {
                                    const isSelected = hero ? manualLanes[hero.id]?.includes(lane.id) : false
                                    return (
                                        <button
                                            key={lane.id}
                                            onClick={() => hero && onLaneAssign(hero.id, lane.id)}
                                            className={`flex-1 text-[8px] md:text-[10px] font-bold uppercase transition-colors ${laneHover} ${isSelected ? `${laneActive} text-white` : 'text-slate-500'}`}
                                        >
                                            {lane.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Suggestions - Desktop Only or handled via props? 
                For now we render it here, but we might hide it on mobile via CSS 
            */}
            <div className="hidden lg:block">
                <DraftSuggestionPanel
                    side={side}
                    teamName={teamName}
                    isActive={currentStep?.side === side && !isFinished}
                    onGenerate={suggestionProps.onGenerate}
                    suggestions={suggestionProps.suggestions}
                    isLoading={suggestionProps.isLoading}
                    onSelectHero={suggestionProps.onSelectHero}
                    activeLayers={suggestionProps.activeLayers}
                    upcomingSlots={suggestionProps.upcomingSlots}
                />
            </div>
        </div>
    )
}
