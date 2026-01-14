import { CerebroMode, getCerebroStats, getVersions } from '../../../actions';
import HeroPoolView from './_components/HeroPoolView';

export default async function TeamHeroPoolPage({ params }: { params: Promise<{ teamName: string }> }) {
    const { teamName: rawTeamName } = await params;
    const teamName = decodeURIComponent(rawTeamName);

    const rawVersions = await getVersions();
    const cleanVersions = rawVersions.map((v: any) => ({
        id: v.id,
        name: v.name,
        patch: v.patch
    }));

    // Default to latest version
    const defaultVersionId = cleanVersions.length > 0 ? cleanVersions[0].id : 0;

    // Fetch Initial Stats
    const initialStats = await getCerebroStats(
        defaultVersionId,
        'ALL', // Mode
        undefined, // Tournament ID
        teamName // Team Name
    );

    return (
        <HeroPoolView
            teamName={teamName}
            initialStats={initialStats}
            versions={cleanVersions}
            defaultVersionId={defaultVersionId}
        />
    );
}
