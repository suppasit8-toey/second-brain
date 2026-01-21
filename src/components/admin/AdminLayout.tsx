'use client'

import { useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { Menu, X } from 'lucide-react'
import { useUI } from '@/context/UIContext'
import { MobileHeaderProvider, MobileHeaderTarget } from './MobileHeaderContext'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { isFullscreen } = useUI()

    return (
        <MobileHeaderProvider>
            <div className="flex min-h-screen bg-[#050b14]">
                {/* Mobile Header - Hide in Fullscreen */}
                {!isFullscreen && (
                    <header className="md:hidden fixed top-0 left-0 w-full bg-gray-900 border-b border-white/10 p-4 flex items-center justify-between z-40 h-16 shadow-lg">
                        <div className="flex items-center">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Menu size={24} />
                            </button>
                            {/* Hide title if actions are present, or make it flexible */}
                            <h1 className="ml-4 font-bold text-lg text-white hidden sm:block">ROV ADMIN</h1>
                        </div>

                        <MobileHeaderTarget className="flex items-center gap-2" />
                    </header>
                )}

                {/* Backdrop Overlay (Mobile) */}
                {isSidebarOpen && !isFullscreen && (
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar - Hide in Fullscreen */}
                {!isFullscreen && (
                    <aside
                        className={`
                        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-white/10 transform transition-transform duration-300 ease-in-out shadow-2xl
                        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                        md:translate-x-0 md:static md:inset-auto md:shadow-none
                        ${isFullscreen ? 'hidden' : ''}
                    `}
                    >
                        {/* Close button inside sidebar for mobile convenience */}
                        <div className="md:hidden absolute top-4 right-4 z-50">
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <AdminSidebar />
                    </aside>
                )}

                {/* Main Content */}
                <main className={`flex-1 overflow-y-auto h-screen ${isFullscreen ? 'pt-0' : 'pt-16 md:pt-0'}`}>
                    {children}
                </main>
            </div>
        </MobileHeaderProvider>
    )
}
