import { createClient } from '@/utils/supabase/server'
import ComboManager from '@/components/ComboManager'

export default async function CombosPage() {
    const supabase = await createClient()

    const { data: versions } = await supabase
        .from('versions')
        .select('*')
        .order('start_date', { ascending: false })

    return (
        <div className="container mx-auto max-w-7xl">
            <ComboManager initialVersions={versions || []} />
        </div>
    )
}
