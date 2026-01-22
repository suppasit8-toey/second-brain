'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { History, Users, Trophy, UserRound, ScrollText, Gamepad2, NotebookPen, Brain, BookOpen, ChevronDown, ChevronRight, Swords, Handshake, Flag, Ghost, Shield, LayoutDashboard, Map as MapIcon } from 'lucide-react'

export default function AdminSidebar() {
    const pathname = usePathname()

    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        'Knowledge Base': true,
        'Team & Players': true,
        'Match & Practice': true
    })

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }))
    }

    const links = [
        { href: '/admin/roadmap', label: 'Roadmap', icon: MapIcon },
        { href: '/admin/versions', label: 'Versions', icon: History },
        { href: '/admin/heroes', label: 'Heroes', icon: Ghost },
        {
            label: 'Knowledge Base',
            icon: BookOpen,
            submenu: [
                { href: '/admin/matchups', label: 'Matchups', icon: Swords },
                { href: '/admin/combos', label: 'Combos', icon: Handshake },
                { href: '/admin/win-conditions', label: 'Win Conditions', icon: Flag },
            ]
        },
        {
            label: 'Team & Players',
            icon: Users,
            submenu: [
                { href: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
                { href: '/admin/players', label: 'Players', icon: UserRound },
            ]
        },
        {
            label: 'Match & Practice',
            icon: Gamepad2,
            submenu: [
                { href: '/admin/scrims', label: 'Scrimmage Logs', icon: ScrollText },
                { href: '/admin/simulator', label: 'Draft Simulator', icon: Gamepad2 },
                { href: '/admin/real-matches', label: 'Real Match Recorder', icon: NotebookPen },
            ]
        },
        { href: '/admin/cerebro', label: 'CEREBRO AI', icon: Brain },
        { href: '/admin', label: 'Admin', icon: LayoutDashboard },
    ]

    return (
        <aside className="w-64 bg-[#0B0B15] border-r border-white/5 min-h-screen flex flex-col z-50 sticky top-0 shadow-2xl">
            <div className="p-6 border-b border-white/5">
                <h1 className="text-xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 flex items-center gap-3 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                    <Shield className="text-purple-400 fill-purple-400/20" size={24} />
                    ROV ADMIN
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
                {links.map((link, index) => {
                    const Icon = link.icon

                    // Handle Submenu Items
                    if (link.submenu) {
                        const isExpanded = expandedMenus[link.label]
                        const isChildActive = link.submenu.some(sub => pathname === sub.href)
                        const isActive = isChildActive // Parent active if child active

                        return (
                            <div key={link.label} className="space-y-1">
                                <button
                                    onClick={() => toggleMenu(link.label)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 group ${isActive
                                        ? 'text-white'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={20} className={`transition-transform group-hover:scale-110 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'}`} />
                                        <span className="font-medium tracking-wide text-sm">{link.label}</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                                </button>

                                {isExpanded && (
                                    <div className="ml-4 pl-4 border-l border-white/5 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                        {link.submenu.map(sub => {
                                            const SubIcon = sub.icon
                                            const isSubActive = pathname === sub.href

                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300 group text-sm ${isSubActive
                                                        ? 'bg-purple-500/10 text-white border border-purple-500/30'
                                                        : 'text-slate-500 hover:bg-white/5 hover:text-white border border-transparent'
                                                        }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full transition-all ${isSubActive ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-slate-700 group-hover:bg-slate-500'}`}></span>
                                                    <span className="font-medium tracking-wide">{sub.label}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    // Handle Regular Items
                    const isActive = pathname === link.href
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${isActive
                                ? 'bg-[#1A1A2E] text-white border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] relative overflow-hidden'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                                }`}
                        >
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>}
                            <Icon size={20} className={`transition-transform group-hover:scale-110 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'}`} />
                            <span className="font-medium tracking-wide text-sm">{link.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-6 border-t border-white/5 bg-[#08080c]">
                <div className="text-[10px] text-center text-slate-600 font-mono uppercase tracking-widest">
                    Cerebro System v2.0
                </div>
            </div>
        </aside>
    )
}
