'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, History, Construction } from 'lucide-react'
import Link from 'next/link'

export default function RecentTrendPage() {
    return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-200 p-4 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-2">
                            <Link href="/admin/cerebro/knowledge">
                                <span className="flex items-center gap-1 text-sm cursor-pointer">
                                    <ChevronLeft className="w-4 h-4" /> Back to Knowledge Base
                                </span>
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                <History className="w-8 h-8 text-yellow-400" />
                            </div>
                            Recent Trend
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Considers performance in the last 10 matches to catch shifting trends.
                        </p>
                    </div>
                </div>

                {/* Content Placeholder */}
                <Card className="bg-slate-900/50 border-slate-800 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center h-96 gap-4">
                        <Construction className="w-16 h-16 text-slate-700" />
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-slate-400">Module Under Construction</h3>
                            <p className="text-slate-500 max-w-md mt-2">
                                This logic layer is currently being implemented. Please check back later for configuration options.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
