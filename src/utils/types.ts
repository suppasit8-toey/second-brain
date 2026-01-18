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

export interface Tournament {
    id: string; // uuid
    name: string;
    slug?: string;
    start_date?: string;
    end_date?: string;
    status: 'upcoming' | 'ongoing' | 'completed';
    created_at?: string;
}

export interface Team {
    id: string; // uuid
    tournament_id: string;
    name: string;
    slug?: string;
    short_name?: string;
    logo_url?: string;
    role?: 'participant' | 'scrim_partner';
    created_at?: string;

    // Joins
    players?: Player[];
}

export interface Player {
    id: string;
    team_id: string;
    name: string;
    slug?: string;
    positions: string[]; // e.g. ["Jungle", "Coach"]
    roster_role?: string; // Current active role in team roster
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
export const POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'] as const;
export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export type DraftMode = 'BO1' | 'BO2' | 'BO3' | 'BO4' | 'BO5' | 'BO7';
export type DraftPhase = 'BAN_1' | 'PICK_1' | 'BAN_2' | 'PICK_2' | 'FINISHED';
export type DraftSide = 'BLUE' | 'RED';

export interface DraftMatch {
    id: string; // uuid
    version_id: number;
    team_a_name: string;
    team_b_name: string;
    mode: DraftMode;
    status: 'ongoing' | 'finished';
    winner?: 'Team A' | 'Team B';
    slug?: string;
    created_at?: string;
    tournament_id?: string;
    match_date?: string; // ISO date string
    ai_metadata?: {
        mode: 'PVP' | 'PVE';
        settings: {
            dataSource: 'GLOBAL' | 'TOURNAMENT';
            tournamentId?: string;
        };
    };

    // Joins
    version?: Version;
    tournament?: Tournament;
    games?: DraftGame[];
}

export interface DraftGame {
    id: string; // uuid
    match_id: string;
    game_number: number;
    blue_team_name: string;
    red_team_name: string;
    winner?: 'Blue' | 'Red';
    mvp_hero_id?: string;
    blue_key_player_id?: string;
    red_key_player_id?: string;
    analysis_data?: any;
    created_at?: string;

    // Joins
    picks?: DraftPick[];
    mvp_hero?: Hero;
}

export interface DraftPick {
    id: string;
    game_id: string;
    hero_id: string;
    type: 'BAN' | 'PICK';
    side: DraftSide;
    position_index: number;
    assigned_role?: string;
    created_at?: string;

    // Joins
    hero?: Hero;
}

export interface AnalysisLayerConfig {
    id: 'meta' | 'counter' | 'synergy' | 'comfort' | 'roster' | 'ban' | 'recent' | 'composition';
    name: string;
    isActive: boolean;
    weight: number; // 0.0 - 2.0
    order: number;
}

export interface AnalysisMode {
    id: string;
    name: string;
    description: string; // Can support markdown/multi-line
    layers: AnalysisLayerConfig[];
}

