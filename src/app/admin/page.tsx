import { LayoutDashboard } from 'lucide-react'

export default function AdminDashboard() {
    return (
        <div className="p-8 space-y-8">
            <div className="bg-[#0B0B15] border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)] rounded-2xl p-6 flex items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                    <div className="w-32 h-32 bg-purple-500 rounded-full blur-[80px]"></div>
                </div>

                <div className="bg-purple-500/20 p-4 rounded-xl border border-purple-500/50">
                    <LayoutDashboard className="w-10 h-10 text-purple-400" />
                </div>

                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Admin Dashboard</h1>
                    <p className="text-slate-400">Welcome to the central command center.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#12121e]">
                    <h3 className="text-lg font-bold text-white mb-2">Quick Stats</h3>
                    <p className="text-slate-400 text-sm">System Overview coming soon...</p>
                </div>
            </div>
        </div>
    )
}
