import { DraftSide } from '@/utils/types'

export type DraftActionType = 'BAN' | 'PICK';

export interface DraftStep {
    orderIndex: number;
    side: DraftSide;
    type: DraftActionType;
    count: number;
    phase: 'PHASE_1_BAN' | 'PHASE_1_PICK' | 'PHASE_2_BAN' | 'PHASE_2_PICK';
    isContinuation?: boolean;
}

export const DRAFT_SEQUENCE: DraftStep[] = [
    // PHASE 1 BANS (4 Total)
    { orderIndex: 0, side: 'BLUE', type: 'BAN', count: 1, phase: 'PHASE_1_BAN' },
    { orderIndex: 1, side: 'RED', type: 'BAN', count: 1, phase: 'PHASE_1_BAN' },
    { orderIndex: 2, side: 'BLUE', type: 'BAN', count: 1, phase: 'PHASE_1_BAN' },
    { orderIndex: 3, side: 'RED', type: 'BAN', count: 1, phase: 'PHASE_1_BAN' },

    // PHASE 1 PICKS (6 Total)
    { orderIndex: 4, side: 'BLUE', type: 'PICK', count: 1, phase: 'PHASE_1_PICK' }, // B1
    { orderIndex: 5, side: 'RED', type: 'PICK', count: 1, phase: 'PHASE_1_PICK' },  // R1
    { orderIndex: 6, side: 'RED', type: 'PICK', count: 1, phase: 'PHASE_1_PICK', isContinuation: true },  // R2 (Linked to R1)
    { orderIndex: 7, side: 'BLUE', type: 'PICK', count: 1, phase: 'PHASE_1_PICK' }, // B2
    { orderIndex: 8, side: 'BLUE', type: 'PICK', count: 1, phase: 'PHASE_1_PICK', isContinuation: true }, // B3 (Linked to B2)
    { orderIndex: 9, side: 'RED', type: 'PICK', count: 1, phase: 'PHASE_1_PICK' },  // R3

    // PHASE 2 BANS (4 Total)
    { orderIndex: 10, side: 'RED', type: 'BAN', count: 1, phase: 'PHASE_2_BAN' },
    { orderIndex: 11, side: 'BLUE', type: 'BAN', count: 1, phase: 'PHASE_2_BAN' },
    { orderIndex: 12, side: 'RED', type: 'BAN', count: 1, phase: 'PHASE_2_BAN' },
    { orderIndex: 13, side: 'BLUE', type: 'BAN', count: 1, phase: 'PHASE_2_BAN' },

    // PHASE 2 PICKS (4 Total)
    { orderIndex: 14, side: 'RED', type: 'PICK', count: 1, phase: 'PHASE_2_PICK' },  // R4
    { orderIndex: 15, side: 'BLUE', type: 'PICK', count: 1, phase: 'PHASE_2_PICK' }, // B4
    { orderIndex: 16, side: 'BLUE', type: 'PICK', count: 1, phase: 'PHASE_2_PICK', isContinuation: true }, // B5 (Linked to B4)
    { orderIndex: 17, side: 'RED', type: 'PICK', count: 1, phase: 'PHASE_2_PICK' },  // R5
];

export const PHASE_TIMERS = {
    BAN: 40,
    PICK: 60
};
