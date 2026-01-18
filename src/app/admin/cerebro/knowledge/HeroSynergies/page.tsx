import { createClient } from '@/utils/supabase/server'
import ComboManager from '@/components/ComboManager'

export default async function HeroSynergiesPage() {
    const supabase = await createClient()

    const { data: versions } = await supabase
        .from('versions')
        .select('*')
        .order('start_date', { ascending: false })

    return (
        <div className="container mx-auto max-w-7xl pt-6">
            {/* Back Link */}
            <div className="mb-6">
                <a href="/admin/cerebro/knowledge" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                    &larr; Back to Knowledge Base
                </a>
            </div>

            <ComboManager initialVersions={versions || []} />
        </div>
    )
}
