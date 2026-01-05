import MatchupManager from '@/components/MatchupManager'
import { getVersions } from '@/app/admin/heroes/actions'

export const dynamic = 'force-dynamic'

export default async function MatchupsPage() {
    const versions = await getVersions()

    return (
        <div className="p-2 md:p-8 pb-24 w-full">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">
                        Matchup Data
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Log battle results to refine the algorithm.
                    </p>
                </div>

                <MatchupManager initialVersions={versions} />
            </div>
        </div>
    )
}
