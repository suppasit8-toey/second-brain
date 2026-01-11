'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Swords, LayoutDashboard, Shield, History, Handshake, Gamepad2, Trophy, Ghost, UserRound, ScrollText, PlusCircle } from 'lucide-react'

export default function AdminSidebar() {
    const pathname = usePathname()

    const links = [
        { href: '/admin/versions', label: 'Versions', icon: History },
        { href: '/admin/heroes', label: 'Heroes', icon: Ghost },
        { href: '/admin/matchups', label: 'Matchups', icon: Swords },
        { href: '/admin/combos', label: 'Combos', icon: Handshake },
        { href: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
        { href: '/admin/scrims', label: 'Scrim Logs', icon: ScrollText },
        { href: '/admin/players', label: 'Players', icon: UserRound },
        { href: '/admin/simulator', label: 'Draft Simulator', icon: Gamepad2 },
    ]

    return (
        <aside className="w-64 glass-card rounded-none border-y-0 border-l-0 min-h-screen flex flex-col z-50 sticky top-0">
            <div className="p-6 border-b border-white/10">
                <h1 className="text-xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 flex items-center gap-3 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                    <Shield className="text-primary fill-primary/20" size={24} />
                    ROV ADMIN
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2 mt-4">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${isActive
                                ? 'bg-primary/20 text-white border border-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                : 'text-text-muted hover:bg-white/5 hover:text-white border border-transparent'
                                }`}
                        >
                            <Icon size={20} className={`transition-transform group-hover:scale-110 ${isActive ? 'text-primary' : 'text-text-muted group-hover:text-white'}`} />
                            <span className="font-medium tracking-wide">{link.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-6 border-t border-white/10 bg-black/20">
                <div className="text-[10px] text-center text-text-muted/50 font-mono uppercase tracking-widest">
                    System v1.0.0
                </div>
            </div>
        </aside>
    )
}
