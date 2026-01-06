export interface Version {
    id: number;
    name: string;
    start_date?: string;
    is_active: boolean;
    created_at?: string;
}

export interface HeroStats {
    id: number;
    hero_id: string;
    version_id: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    power_spike: 'Early' | 'Mid' | 'Late' | 'Balanced';
    win_rate: number;
    created_at?: string;
}

export interface Hero {
    id: string; // uuid
    name: string;
    icon_url: string;
    main_position: string[]; // Array of strings e.g. ['Jungle', 'Roam']
    damage_type: 'Physical' | 'Magic' | 'True' | 'Mixed';
    // Power Spike moved to HeroStats, but we keep it optional here if needed for flattened structure
    // power_spike: 'Early' | 'Late' | 'Balanced' | null; 
    created_at?: string;

    // Joins
    hero_stats?: HeroStats[];
}

export interface Matchup {
    id: string; // uuid
    hero_id: string; // FK to heroes.id
    opponent_id: string; // FK to heroes.id
    version_id?: number; // FK to versions.id
    lane: string; // e.g. 'Dark Slayer', 'Mid', 'Roam'
    win_rate: number; // 0-100
    note?: string;
    created_at?: string;

    // Joins
    hero?: Hero;
    opponent?: Hero;
    version?: Version;
}

export interface HeroCombo {
    id: string; // uuid
    hero_a_id: string;
    hero_a_position: string;
    hero_b_id: string;
    hero_b_position: string;
    synergy_score: number; // 1-100
    description?: string;
    version_id: number;
    created_at?: string;

    // Joins
    hero_a?: Hero;
    hero_b?: Hero;
    version?: Version;
}

export const DAMAGE_TYPES = ['Physical', 'Magic', 'True', 'Mixed'] as const;
export const POWER_SPIKES = ['Early', 'Mid', 'Late', 'Balanced'] as const; // Re-add Mid as it is in DB check
export const POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam'] as const;
export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
