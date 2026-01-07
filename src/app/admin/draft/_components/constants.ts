export type DraftSide = 'BLUE' | 'RED';
export type DraftPhaseType = 'BAN' | 'PICK';

export interface DraftStep {
    order: number;
    side: DraftSide;
    type: DraftPhaseType;
    label: string;
}

export const PHASE_TIMERS = {
    BAN: 30, // seconds
    PICK: 30, // seconds
    BONUS: 0
};

// Standard Tournament Draft (Global Ban Pick)
// Phase 1 Bans: B-R-B-R
// Phase 1 Picks: B1 - R1,R2 - B2,B3 - R3
// Phase 2 Bans: R-B-R-B
// Phase 2 Picks: R4 - B4 - B5 - R5

export const DRAFT_SEQUENCE: DraftStep[] = [
    // Phase 1 Bans (0-3)
    { order: 1, side: 'BLUE', type: 'BAN', label: 'Blue Ban 1' },   // 0
    { order: 2, side: 'RED', type: 'BAN', label: 'Red Ban 1' },     // 1
    { order: 3, side: 'BLUE', type: 'BAN', label: 'Blue Ban 2' },   // 2
    { order: 4, side: 'RED', type: 'BAN', label: 'Red Ban 2' },     // 3

    // Phase 1 Picks (4-9)
    { order: 5, side: 'BLUE', type: 'PICK', label: 'Blue Pick 1' }, // 4
    { order: 6, side: 'RED', type: 'PICK', label: 'Red Pick 1' },   // 5
    { order: 7, side: 'RED', type: 'PICK', label: 'Red Pick 2' },   // 6
    { order: 8, side: 'BLUE', type: 'PICK', label: 'Blue Pick 2' }, // 7
    { order: 9, side: 'BLUE', type: 'PICK', label: 'Blue Pick 3' }, // 8
    { order: 10, side: 'RED', type: 'PICK', label: 'Red Pick 3' },  // 9

    // Phase 2 Bans (10-13)
    { order: 11, side: 'RED', type: 'BAN', label: 'Red Ban 3' },    // 10
    { order: 12, side: 'BLUE', type: 'BAN', label: 'Blue Ban 3' },  // 11
    { order: 13, side: 'RED', type: 'BAN', label: 'Red Ban 4' },    // 12
    { order: 14, side: 'BLUE', type: 'BAN', label: 'Blue Ban 4' },  // 13

    // Phase 2 Picks (14-17)
    { order: 15, side: 'RED', type: 'PICK', label: 'Red Pick 4' },  // 14
    { order: 16, side: 'BLUE', type: 'PICK', label: 'Blue Pick 4' },// 15
    { order: 17, side: 'BLUE', type: 'PICK', label: 'Blue Pick 5' },// 16
    { order: 18, side: 'RED', type: 'PICK', label: 'Red Pick 5' },  // 17
];
