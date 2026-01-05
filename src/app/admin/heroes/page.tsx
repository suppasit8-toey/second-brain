import { getVersions } from './actions'
import HeroManagement from '@/components/HeroManagement'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const versions = await getVersions()

    return (
        <div className="p-2 md:p-8 pb-24 w-full">
            <div className="max-w-7xl mx-auto">
                <HeroManagement initialVersions={versions || []} />
            </div>
        </div>
    )
}
