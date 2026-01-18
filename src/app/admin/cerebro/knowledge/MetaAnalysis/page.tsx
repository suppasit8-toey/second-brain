import { getTournaments } from '@/app/admin/tournaments/actions'
import MetaAnalysisView from './MetaAnalysisView'

export default async function MetaAnalysisPage() {
    const tournaments = await getTournaments()

    return (
        <div className="p-8">
            <MetaAnalysisView tournaments={tournaments} />
        </div>
    )
}
