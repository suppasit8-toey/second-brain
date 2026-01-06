import { getVersions } from '../heroes/actions'
import { getMatches } from './actions'
import CreateMatchModal from './_components/CreateMatchModal'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DraftDashboard() {
    const versions = await getVersions()
    const matches = await getMatches()

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Draft Simulator & Analysis</h1>
                    <p className="text-slate-400 mt-1">Simulate tournament drafts and analyze team strategies.</p>
                </div>
                <CreateMatchModal versions={versions} />
            </div>

            <div className="grid gap-4">
                <h2 className="text-xl font-semibold text-white">Recent Matches</h2>

                {matches.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                        <p className="text-slate-400">No matches found. Start a new one!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matches.map((match: any) => (
                            <Link href={`/admin/simulator/${match.id}`} key={match.id} className="block group">
                                <Card className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                                                    {match.mode}
                                                </Badge>
                                                <span className="text-xs text-slate-500 ml-2">
                                                    Patch {match.version?.name}
                                                </span>
                                            </div>
                                            {match.status === 'ongoing' ? (
                                                <Badge className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20">
                                                    LIVE
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Finished</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between py-4">
                                            <div className="text-center flex-1">
                                                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                    {match.team_a_name}
                                                </h3>
                                            </div>
                                            <div className="px-4 text-slate-500 font-mono text-sm">VS</div>
                                            <div className="text-center flex-1">
                                                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                    {match.team_b_name}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                                            <span>{new Date(match.created_at).toLocaleDateString()}</span>
                                            <span>Click to Enter Room →</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
