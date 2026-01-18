
import { AnalysisLayerConfig, AnalysisMode } from '@/utils/types'

// Central Definition of Available Layers (Metadata)
export const ANALYSIS_LAYER_METADATA: Record<string, {
    name: string;
    description: string;
    iconName: string; // We store the identifier, and map it to Lucide icon in component
    color: string;
    path: string;
}> = {
    'meta': {
        name: 'Meta Analysis',
        description: 'Evaluates global and tournament-specific pick/ban rates to prioritize high-value meta heroes.',
        iconName: 'Globe',
        color: 'text-purple-400',
        path: '/admin/cerebro/knowledge/MetaAnalysis'
    },
    'counter': {
        name: 'Counter Matchups',
        description: 'Identifies heroes with >50% win rate against the enemy composition (Lane & Global).',
        iconName: 'Swords',
        color: 'text-red-400',
        path: '/admin/cerebro/knowledge/CounterMatchups'
    },
    'comfort': {
        name: 'Team Hero Pool',
        description: 'Analyzes historical pick rates and win rates for the specific team to identify comfort picks.',
        iconName: 'Users',
        color: 'text-blue-400',
        path: '/admin/cerebro/knowledge/TeamHeroPool'
    },
    'roster': {
        name: 'Roster Dominance',
        description: 'Prioritizes heroes that specific players on the roster are famous for (Signature Picks).',
        iconName: 'Target',
        color: 'text-cyan-400',
        path: '/admin/cerebro/knowledge/RosterDominance'
    },
    'ban': {
        name: 'Ban Strategy',
        description: 'Detects enemy key players and One-Trick-Ponies to suggest targeted bans.',
        iconName: 'ShieldBan',
        color: 'text-orange-400',
        path: '/admin/cerebro/knowledge/BanStrategy'
    },
    'composition': {
        name: 'Draft Composition',
        description: 'Ensures a balanced team with all 5 roles (DS, JG, Mid, Abyssal, roam) filled.',
        iconName: 'Brain',
        color: 'text-pink-400',
        path: '/admin/cerebro/knowledge/DraftComposition'
    },
    'synergy': {
        name: 'Hero Synergies',
        description: 'Suggests heroes that form strong registered combos with current ally picks.',
        iconName: 'Link',
        color: 'text-emerald-400',
        path: '/admin/cerebro/knowledge/HeroSynergies'
    },
    'recent': {
        name: 'Recent Trend',
        description: 'Considers performance in the last 10 matches to catch shifting trends.',
        iconName: 'History',
        color: 'text-yellow-400',
        path: '/admin/cerebro/knowledge/RecentTrend'
    }
}

// Default Weight Configuration
export const DEFAULT_LAYERS: AnalysisLayerConfig[] = [
    { id: 'meta', name: 'Meta Analysis (Tournament)', isActive: true, weight: 1.5, order: 0 },
    { id: 'counter', name: 'Counter Matchups (Lane)', isActive: true, weight: 1.2, order: 1 },
    { id: 'comfort', name: 'Team Hero Pool', isActive: true, weight: 1.0, order: 2 },
    { id: 'roster', name: 'Roster Dominance (Specialist)', isActive: true, weight: 1.0, order: 3 },
    { id: 'ban', name: 'Ban Strategy (Target)', isActive: true, weight: 1.0, order: 4 },
    { id: 'composition', name: 'Draft Composition (Balance)', isActive: true, weight: 1.0, order: 5 },
    { id: 'synergy', name: 'Synergies (Combo)', isActive: true, weight: 1.0, order: 6 },
]

export const DEFAULT_MODES: AnalysisMode[] = [
    {
        id: 'pro_standard',
        name: 'Pro Competitive Standard',
        description: 'โหมดมาตรฐานที่จำลองวิธีคิดของโค้ชระดับโปรลีก เน้น Meta และ Counter เป็นหลัก',
        layers: [...DEFAULT_LAYERS]
    },
    {
        id: 'meta_mode',
        name: 'Meta',
        description: 'เน้นข้อมูล Meta และสถิติการแข่งขันเป็นหลัก (Pure Meta)',
        layers: DEFAULT_LAYERS.map(l => ({ ...l, weight: l.id === 'meta' ? 3.0 : 0.5 }))
    },
    {
        id: 'comfort_mode',
        name: 'Comfort',
        description: 'เน้นความชำนาญของผู้เล่นและ Team Pool',
        layers: DEFAULT_LAYERS.map(l => ({ ...l, weight: (l.id === 'comfort' || l.id === 'roster') ? 2.5 : 0.5 }))
    },
    {
        id: 'aggressive_counter',
        name: 'Hard Counter',
        description: 'เน้นการแก้ทางและกดดันเลนเป็นหลัก (Aggressive Lane Phase)',
        // Clone and modify weights
        layers: DEFAULT_LAYERS.map(l => ({ ...l, weight: l.id === 'counter' ? 3.0 : 0.8 }))
    },
    {
        id: 'custom_mode',
        name: 'Customs',
        description: 'ปรับแต่งค่าความสำคัญได้เองตามต้องการ',
        layers: [...DEFAULT_LAYERS]
    }
]
