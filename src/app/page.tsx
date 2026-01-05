import { supabase } from '@/utils/supabase/client'
import DraftAnalysis from '@/components/DraftAnalysis'
import Link from 'next/link'
import { LayoutDashboard, Users, Swords, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: heroes } = await supabase.from('heroes').select('*').order('name', { ascending: true })
  const { data: matchups } = await supabase.from('matchups').select('*')

  return (
    <div className="min-h-screen bg-background text-text-main pb-20">
      {/* Navbar (Standalone for Home, or replace with Sidebar layout if we want layout globally? 
          User asked for Admin Sidebar. Home might not be in Admin Layout. 
          I will keep Home separate but styled similarly) */}

      <nav className="glass-card rounded-none border-x-0 border-t-0 sticky top-0 z-50 backdrop-blur-xl bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-4">
              <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <Shield size={28} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter text-white">
                  ROV <span className="text-primary">DRAFT</span>
                </h1>
                <p className="text-[10px] text-text-muted tracking-widest uppercase">Analysis System</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/admin/heroes" className="px-4 py-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-colors text-sm font-medium flex items-center gap-2">
                <Users size={16} /> Admin
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden mb-12">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-6 drop-shadow-2xl tracking-tight">
            DOMINATE THE DRAFT
          </h1>
          <p className="text-xl text-text-muted max-w-2xl mx-auto font-light leading-relaxed">
            Advanced algorithmic analysis for <span className="text-primary font-bold">ROV</span>.
            Input enemy compositions and receive real-time counter-pick suggestions based on historical data.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DraftAnalysis heroes={heroes || []} matchups={matchups || []} />
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-white/5 py-12 text-center text-text-muted/30 text-sm">
        <p>© 2024 ROV Draft Analysis. Designed for pure performance.</p>
      </footer>
    </div>
  )
}
