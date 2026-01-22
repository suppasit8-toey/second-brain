export interface Hero {
    id: string;
    name: string;
    image_url: string;
    roles?: string[];
}

export interface ConditionItem {
    id: string;
    heroId: string;
    role: string; // 'ANY' | 'Roam' | 'Mid' | ...
}

export interface WinCondition {
    id: string;
    name: string; // Optional: user could name it, or auto-generate
    version: string;
    tournamentId?: string;
    allyConditions: ConditionItem[];
    enemyConditions: ConditionItem[];
    createdAt: number;
    result?: {
        winRate: number;
        totalMatches: number;
        winCount: number;
        lossCount: number;
        teamStats?: {
            name: string;
            matches: number;
            wins: number;
            winRate: number;
        }[];
        matches?: {
            gameId: string;
            matchId: string; // Added for linking
            date: string;
            team: string;
            enemy: string;
            result: 'WIN' | 'LOSS';
            side: 'BLUE' | 'RED';
        }[];
    };
}
