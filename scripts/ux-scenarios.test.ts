import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { seedFixtures, type Fixture } from 'data-platform/local'
import { DEFAULT_SCENARIO, SCENARIO_NAMES, scenarioName, uxScenario } from './ux-scenarios.ts'

const NOW = new Date(2026, 10, 27, 18, 0)

/** The fixtures a scenario writes, after `seedFixtures` has checked each against the platform's schemas. */
async function seeded(name: (typeof SCENARIO_NAMES)[number]): Promise<Fixture[]> {
  const written: Fixture[] = []
  const { fixtures } = uxScenario(scenarioName(name), NOW)
  await seedFixtures({ set: async (path, data) => void written.push(fixtures.find((f) => `${f.collection}/${f.id}` === path && f.data === data)!) }, fixtures)
  return written
}

const inCollection = (fixtures: readonly Fixture[], prefix: string) => fixtures.filter((f) => f.collection.startsWith(prefix))
const day = (d: Date) => d.toDateString()

describe('scenarioName', () => {
  it('defaults to owner-with-items', () => {
    expect(DEFAULT_SCENARIO).toBe('owner-with-items')
  })

  it('refuses an unknown scenario, naming the known ones', () => {
    expect(() => scenarioName('nope')).toThrow(/"nope".*owner-with-items, new-member/)
  })
})

describe('owner-with-items', () => {
  it('passes the platform schemas', async () => {
    await expect(seeded('owner-with-items')).resolves.not.toHaveLength(0)
  })

  it('has a Member with Targets set', async () => {
    const fixtures = await seeded('owner-with-items')
    const { users } = uxScenario(scenarioName('owner-with-items'), NOW)
    expect(fixtures.find((f) => f.collection === 'members' && f.id === users[0]!.uid)).toBeDefined()
    expect(fixtures.find((f) => f.collection === nutrition.NUTRITION_TARGETS_COLLECTION && f.id === users[0]!.uid)).toBeDefined()
  })

  it('has several Foods', async () => {
    expect(inCollection(await seeded('owner-with-items'), nutrition.FOODS_COLLECTION).length).toBeGreaterThan(1)
  })

  it('logs on today and an earlier Day, across more than one Meal Type, with an estimated Quick Entry', async () => {
    const entries = inCollection(await seeded('owner-with-items'), nutrition.NUTRITION_LOGS_COLLECTION).map((f) => f.data as nutrition.LogEntry)
    const days = new Set(entries.map((e) => day(e.eatenAt as Date)))
    expect(days.has(day(NOW))).toBe(true)
    expect(days.size).toBeGreaterThan(1)
    expect(new Set(entries.map((e) => e.mealType)).size).toBeGreaterThan(1)
    expect(entries.some((e) => e.source.kind === 'quick' && e.estimated === true)).toBe(true)
  })
})

describe('new-member', () => {
  it('has a Member and nothing else of the Member’s', async () => {
    const fixtures = await seeded('new-member')
    const { users } = uxScenario(scenarioName('new-member'), NOW)
    expect(users).toHaveLength(1)
    expect(fixtures.find((f) => f.collection === 'members' && f.id === users[0]!.uid)).toBeDefined()
    expect(fixtures.filter((f) => ['meta', 'members'].includes(f.collection))).toHaveLength(fixtures.length)
  })
})
