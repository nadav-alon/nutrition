import { core, nutrition } from 'data-platform'
import type { Fixture } from 'data-platform/local'

/** An account the Auth emulator is seeded with, so the fake Google sign-in as `email` lands on a Member. */
export interface UxUser {
  readonly uid: core.Uid
  readonly email: core.Email
}

/** What a scenario seeds: the accounts to sign in as, and the documents the Household starts with. */
export interface UxScenario {
  readonly users: readonly UxUser[]
  readonly fixtures: readonly Fixture[]
}

export const SCENARIO_NAMES = ['owner-with-items', 'new-member'] as const

declare const scenarioNameBrand: unique symbol;

/** One of {@link SCENARIO_NAMES}. */
export type ScenarioName = (typeof SCENARIO_NAMES)[number] & { readonly [scenarioNameBrand]: true }

/** The guard. */
export function isScenarioName(value: string): value is ScenarioName {
  return (SCENARIO_NAMES as readonly string[]).includes(value)
}

/** The constructor: narrows, or throws naming the offending value and the known scenarios. */
export function scenarioName(value: string): ScenarioName {
  if (!isScenarioName(value)) {
    throw new Error(`Unknown scenario ${JSON.stringify(value)}; known scenarios: ${SCENARIO_NAMES.join(', ')}`)
  }
  return value
}

export const DEFAULT_SCENARIO = scenarioName('owner-with-items')

const MEMBER: UxUser = { uid: core.uid('ux-member'), email: core.email('member@example.com') }

const ADDED_AT = { seconds: 1_700_000_000, nanoseconds: 0 }

const nutritionOf = (kcal: number, protein: number, carbs: number, fat: number): nutrition.Nutrition => ({
  kcal: nutrition.kcal(kcal),
  proteinG: nutrition.grams(protein),
  carbsG: nutrition.grams(carbs),
  fatG: nutrition.grams(fat),
})

/** The documents every scenario starts from: a claimed Household whose only Member is `MEMBER`. */
const household = (): Fixture[] => [
  { collection: 'meta', id: 'platform', data: { version: core.PLATFORM_VERSION } },
  { collection: 'meta', id: 'household', data: { owner: MEMBER.uid } },
  { collection: 'members', id: MEMBER.uid, data: { email: MEMBER.email, addedAt: ADDED_AT } },
]

/** `hour`:`minute` local time, `daysAgo` Days before the Day `now` falls in. */
function localTime(now: Date, daysAgo: number, hour: number, minute = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute)
}

const SCHNITZEL_PLATE = nutrition.foodId('schnitzel-plate')
const PROTEIN_BAR = nutrition.foodId('protein-bar')
const FALAFEL_PITA = nutrition.foodId('falafel-pita')

/** The Food fields a fixture may add to its name and Nutrition, typed so a typo fails to compile. */
type FoodExtras = Pick<nutrition.Food, 'place' | 'servingLabel' | 'estimated'>

/** A Log Entry's fields besides `eatenAt`, typed so a typo fails to compile. */
type LogEntryFields = Pick<nutrition.LogEntry, 'mealType' | 'source' | 'name' | 'servings' | 'nutrition' | 'estimated'>

const food = (id: nutrition.FoodId, name: string, perServing: nutrition.Nutrition, optional: FoodExtras = {}): Fixture => ({
  collection: nutrition.FOODS_COLLECTION,
  id,
  data: { name, perServing, ...optional },
})

const logEntry = (id: string, eatenAt: Date, entry: LogEntryFields): Fixture => ({
  collection: `${nutrition.NUTRITION_LOGS_COLLECTION}/${MEMBER.uid}/${nutrition.LOG_ENTRIES_COLLECTION}`,
  id,
  data: { eatenAt, ...entry },
})

function ownerWithItems(now: Date): UxScenario {
  const schnitzel = nutritionOf(720, 38, 64, 33)
  const bar = nutritionOf(210, 20, 22, 7)
  return {
    users: [MEMBER],
    fixtures: [
      ...household(),
      {
        collection: nutrition.NUTRITION_TARGETS_COLLECTION,
        id: MEMBER.uid,
        data: { kcal: nutrition.kcal(2200), proteinG: nutrition.grams(140), carbsG: nutrition.grams(240), fatG: nutrition.grams(70) },
      },
      food(SCHNITZEL_PLATE, 'Chicken schnitzel plate', schnitzel, { place: 'work canteen', servingLabel: '1 plate', estimated: true }),
      food(PROTEIN_BAR, 'Protein bar', bar, { servingLabel: '1 bar' }),
      food(FALAFEL_PITA, 'Falafel in a pita', nutritionOf(560, 18, 74, 21), { place: 'corner stand' }),
      logEntry('today-breakfast', localTime(now, 0, 7, 30), {
        mealType: 'breakfast',
        source: { kind: 'quick' },
        name: 'Yogurt and granola',
        servings: 1,
        nutrition: nutritionOf(320, 14, 45, 9),
      }),
      logEntry('today-lunch', localTime(now, 0, 12, 45), {
        mealType: 'lunch',
        source: { kind: 'food', foodId: SCHNITZEL_PLATE },
        name: 'Chicken schnitzel plate',
        servings: 1,
        nutrition: schnitzel,
      }),
      logEntry('today-snack', localTime(now, 0, 16, 15), {
        mealType: 'snack',
        source: { kind: 'quick' },
        name: 'Street shawarma, roughly',
        servings: 1,
        nutrition: nutritionOf(650, 35, 55, 30),
        estimated: true,
      }),
      logEntry('earlier-breakfast', localTime(now, 1, 8), {
        mealType: 'breakfast',
        source: { kind: 'quick' },
        name: 'Toast and eggs',
        servings: 1,
        nutrition: nutritionOf(380, 22, 34, 17),
      }),
      logEntry('earlier-snack', localTime(now, 1, 16, 30), {
        mealType: 'snack',
        source: { kind: 'food', foodId: PROTEIN_BAR },
        name: 'Protein bar',
        servings: 2,
        nutrition: nutritionOf(420, 40, 44, 14),
      }),
      logEntry('earlier-dinner', localTime(now, 1, 20), {
        mealType: 'dinner',
        source: { kind: 'food', foodId: FALAFEL_PITA },
        name: 'Falafel in a pita',
        servings: 1,
        nutrition: nutritionOf(560, 18, 74, 21),
      }),
    ],
  }
}

function newMember(): UxScenario {
  return { users: [MEMBER], fixtures: household() }
}

const SCENARIOS: Record<(typeof SCENARIO_NAMES)[number], (now: Date) => UxScenario> = {
  'owner-with-items': ownerWithItems,
  'new-member': newMember,
}

/** The Household a scenario starts from. `now` places Log Entries on today and on the Day before. */
export function uxScenario(name: ScenarioName, now: Date): UxScenario {
  const key: (typeof SCENARIO_NAMES)[number] = name
  return SCENARIOS[key](now)
}
