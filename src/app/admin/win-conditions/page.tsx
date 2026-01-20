'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Flag } from 'lucide-react'

export default function WinConditionPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <Flag className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-white">
                        WIN CONDITIONS
                    </h1>
                    <p className="text-slate-400">Analyze and define team victory conditions</p>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-200">Win Condition Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-slate-400">
                        This section is under construction. Future features will include:
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                        <li>Team composition analysis</li>
                        <li>Power spike timing correlation</li>
                        <li>Objective control priorities</li>
                        <li>Lane pressure distribution</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
