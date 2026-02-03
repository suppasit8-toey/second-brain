import { Hero } from '@/utils/types'

// --- SHARED: Role Logic (Exported for use in Bots) ---
export const STANDARD_ROLES = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam']

export const normalizeRole = (r: string) => {
    if (['Abyssal', 'Abyssal Dragon', 'ADL', 'Archer', 'Carry', 'Marksman'].includes(r)) return 'Abyssal Dragon'
    if (['Support', 'Roam', 'SUP'].includes(r)) return 'Roam'
    if (['Mid', 'Middle', 'Mage'].includes(r)) return 'Mid'
    if (['Jungle', 'JUG', 'Assassin'].includes(r)) return 'Jungle'
    if (['Dark Slayer', 'DSL', 'Warrior', 'Tank'].includes(r)) return 'Dark Slayer'
    return r
}

export const resolveTeamRoles = (heroIds: string[], heroes: Hero[]) => {
    const teamHeroes = heroIds.map(id => heroes.find(h => String(h.id) === String(id))).filter(Boolean) as Hero[]

    const candidates = teamHeroes.map(h => {
        const rawRoles = h.main_position || []
        const uniqueRoles = Array.from(new Set(rawRoles.map(normalizeRole).filter(r => STANDARD_ROLES.includes(r))))
        if (uniqueRoles.length === 0) uniqueRoles.push('Dark Slayer')
        return { id: h.id, roles: uniqueRoles }
    })

    candidates.sort((a, b) => a.roles.length - b.roles.length)

    const bestAssignment = new Set<string>()
    let maxFilled = 0

    const solve = (index: number, currentFilled: Set<string>) => {
        if (index === candidates.length) {
            if (currentFilled.size > maxFilled) {
                maxFilled = currentFilled.size
                bestAssignment.clear()
                currentFilled.forEach(r => bestAssignment.add(r))
            }
            return
        }

        const candidate = candidates[index]
        let assigned = false

        for (const role of candidate.roles) {
            if (!currentFilled.has(role)) {
                currentFilled.add(role)
                solve(index + 1, currentFilled)
                currentFilled.delete(role)
                assigned = true
            }
        }

        if (!assigned) {
            solve(index + 1, currentFilled)
        }
    }

    solve(0, new Set())
    return bestAssignment
}

export function calculateComposition(heroIds: string[], heroes: any[]) {
    const composition = {
        damage: { Physical: 0, Magic: 0, True: 0, Mixed: 0 },
        powerSpike: { Early: 0, Mid: 0, Late: 0, Balanced: 0 },
        attributes: {
            control: 0,
            durability: 0,
            mobility: 0,
            offense: 0
        },
        roles: [] as string[]
    }

    if (!heroIds || heroIds.length === 0) return composition

    const selectedHeroes = heroes.filter(h => heroIds.includes(h.id))

    selectedHeroes.forEach(h => {
        // Damage Type
        if (h.damage_type) composition.damage[h.damage_type as keyof typeof composition.damage]++

        // Power Spike (from Stats)
        const spike = h.hero_stats?.[0]?.power_spike || 'Balanced'
        composition.powerSpike[spike as keyof typeof composition.powerSpike]++

        // Attributes (Mocking simple attribute logic based on Role/Key Stats if available, or just generic)
        // Since we don't have explicit attribute stats in the type definition provided earlier, we will infer generic values or skip.
        // Let's infer from Role for now to populate the UI.
        const roles = h.main_position || []
        if (roles.includes('Tank') || roles.includes('Roam')) composition.attributes.durability += 2
        if (roles.includes('Warrior') || roles.includes('Dark Slayer')) { composition.attributes.durability += 1; composition.attributes.offense += 1 }
        if (roles.includes('Mage') || roles.includes('Mid')) { composition.attributes.offense += 2; composition.attributes.control += 1 }
        if (roles.includes('Marksman') || roles.includes('Abyssal')) { composition.attributes.offense += 3; }
        if (roles.includes('Assassin') || roles.includes('Jungle')) { composition.attributes.mobility += 3; composition.attributes.offense += 2 }

        // Count distinct roles
        composition.roles.push(...roles)
    })

    return composition
}
