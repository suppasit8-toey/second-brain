'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { POSITIONS } from '@/utils/types'
import { Search, X, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Hero {
    id: string
    name: string
    icon_url: string
    main_position: string[] | string
}

interface HeroComboboxProps {
    value?: string
    heroes: Hero[]
    excludedIds?: Set<string>
    onChange?: (id: string) => void
    disabled?: boolean
}

export function HeroCombobox({ value, heroes, excludedIds, onChange, disabled }: HeroComboboxProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [selectedRole, setSelectedRole] = useState<string | null>(null)

    const selectedHeroId = value
    const selectedHero = heroes.find(h => h.id === selectedHeroId)

    // Filter heroes: Match search AND not excluded AND Match Role
    const filteredHeroes = heroes.filter(h => {
        const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase())

        let matchesRole = !selectedRole

        if (selectedRole && h.main_position) {
            if (Array.isArray(h.main_position)) {
                matchesRole = h.main_position.includes(selectedRole)
            } else if (typeof h.main_position === 'string') {
                // Handle case where it might be a JSON string or just a comma-separated string
                matchesRole = h.main_position.includes(selectedRole)
            }
        }

        const isNotExcluded = !excludedIds || !excludedIds.has(h.id) || h.id === selectedHeroId

        return matchesSearch && matchesRole && isNotExcluded
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div
                    className={cn(
                        "flex items-center justify-between w-full bg-slate-950 border rounded-lg cursor-pointer transition-all min-h-[50px] group",
                        selectedHero ? "border-indigo-500/50 bg-indigo-500/5 p-2" : "border-slate-800 hover:border-slate-700 px-3 py-2",
                        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                    )}
                >
                    {selectedHero ? (
                        <div className="flex items-center gap-3 w-full">
                            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-indigo-500/30 shadow-sm shrink-0">
                                <Image src={selectedHero.icon_url} alt={selectedHero.name} fill className="object-cover" />
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-white text-sm font-bold truncate group-hover:text-indigo-300 transition-colors">{selectedHero.name}</span>
                                <span className="text-[10px] text-indigo-200/50 truncate">
                                    {Array.isArray(selectedHero.main_position)
                                        ? selectedHero.main_position.join(', ')
                                        : selectedHero.main_position || 'Hero'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-slate-500 text-sm">Select Hero...</span>
                    )}
                    <ChevronsUpDown className="w-4 h-4 text-slate-500 opacity-50 ml-2 shrink-0 group-hover:opacity-100" />
                </div>
            </DialogTrigger>

            <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden outline-none">
                <div className="p-4 md:p-6 pb-2 border-b border-slate-800 bg-slate-950/95 backdrop-blur z-10 flex flex-col gap-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-400" />
                        Select Hero
                    </DialogTitle>

                    {/* Search Bar */}
                    <div className="flex items-center px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <Search className="w-5 h-5 text-slate-400 mr-3" />
                        <input
                            className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-slate-500"
                            placeholder="Search hero by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        // autoFocus // Causing focus issues in some browsers inside dialogs?
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')}>
                                <X className="w-5 h-5 text-slate-500 hover:text-white" />
                            </button>
                        )}
                    </div>

                    {/* Role Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar -mx-2 px-2 md:mx-0 md:px-0">
                        <button
                            type="button"
                            onClick={() => setSelectedRole(null)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                                !selectedRole
                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                            )}
                        >
                            All Roles
                        </button>
                        {POSITIONS.map(role => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setSelectedRole(role === selectedRole ? null : role)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                                    selectedRole === role
                                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                )}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 custom-scrollbar bg-slate-950/50">
                    {filteredHeroes.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                            <Search className="w-16 h-16" />
                            <p className="text-lg">No heroes found matching "{search}"</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4 pb-8">
                            {filteredHeroes.map(h => {
                                const isSelected = selectedHeroId === h.id
                                const isExcluded = excludedIds?.has(h.id) && !isSelected

                                return (
                                    <div
                                        key={h.id}
                                        title={h.name}
                                        className={cn(
                                            "group relative aspect-square rounded-md cursor-pointer overflow-hidden transition-all border",
                                            isSelected ? "ring-2 ring-indigo-500 border-indigo-500 shadow-xl shadow-indigo-500/20 scale-105 z-10" : "border-slate-800/50 bg-slate-900 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-105 hover:z-10",
                                            isExcluded && "opacity-30 grayscale pointer-events-none"
                                        )}
                                        onClick={() => {
                                            if (!isExcluded) {
                                                if (onChange) onChange(h.id)
                                                setOpen(false)
                                                setSearch("")
                                            }
                                        }}
                                    >
                                        <Image
                                            src={h.icon_url}
                                            alt={h.name}
                                            fill
                                            className={cn(
                                                "object-cover transition-transform duration-500",
                                                !isSelected && "group-hover:scale-110"
                                            )}
                                        />

                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                        {isExcluded && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                                                <span className="text-[10px] font-bold text-white border border-white/20 px-1.5 py-0.5 rounded bg-black/40 shadow-sm">
                                                    PICKED
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
