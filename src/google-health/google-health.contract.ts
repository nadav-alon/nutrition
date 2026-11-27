import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { NotConnectedError } from './google-health.ts'
import type { GoogleHealth, HealthEntry } from './google-health.ts'

export const lunch: HealthEntry = {
  name: 'Schnitzel',
  mealType: 'lunch',
  nutrition: { kcal: nutrition.kcal(500), proteinG: nutrition.grams(30), carbsG: nutrition.grams(40), fatG: nutrition.grams(20) },
  eatenAt: new Date('2026-11-27T12:00:00Z'),
}

/** What a contract run needs beyond the port: a way to see whether anything was sent. */
export interface ContractSubject {
  /** Not yet connected; `connect()` grants a live token and the account is linked. */
  readonly health: GoogleHealth
  /** How many requests have gone out to Google Health so far. */
  requests(): number
}

/** The behaviour every `GoogleHealth` keeps; `open` returns a fresh, not-yet-connected subject. */
export function googleHealthContract(name: string, open: () => ContractSubject) {
  describe(`${name} as GoogleHealth`, () => {
    it('is not connected before connect() and becomes connected after', async () => {
      const { health } = open()
      expect(health.isConnected()).toBe(false)
      await health.connect()
      expect(health.isConnected()).toBe(true)
    })

    it('rejects create and remove as not connected with no token, sending nothing', async () => {
      const { health, requests } = open()
      const created = await health.create(lunch).catch((e: unknown) => e)
      expect(created).toBeInstanceOf(NotConnectedError)
      await expect(health.remove([await connectedName(open)])).rejects.toBeInstanceOf(NotConnectedError)
      expect(requests()).toBe(0)
    })

    it('sends nothing for remove([]), connected or not', async () => {
      const { health, requests } = open()
      await health.remove([])
      await health.connect()
      await health.remove([])
      expect(requests()).toBe(0)
    })

    it('names each created data point distinctly', async () => {
      const { health } = open()
      await health.connect()
      expect(await health.create(lunch)).not.toBe(await health.create(lunch))
    })

    it('removes data points it created', async () => {
      const { health } = open()
      await health.connect()
      const name = await health.create(lunch)
      await expect(health.remove([name])).resolves.toBeUndefined()
    })
  })
}

async function connectedName(open: () => ContractSubject) {
  const { health } = open()
  await health.connect()
  return health.create(lunch)
}
