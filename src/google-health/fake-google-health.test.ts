import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { fakeGoogleHealth } from './fake-google-health.ts'
import { NotConnectedError } from './google-health.ts'

const entry = {
  name: 'Schnitzel',
  mealType: 'lunch',
  nutrition: { kcal: nutrition.kcal(500), proteinG: nutrition.grams(30), carbsG: nutrition.grams(40), fatG: nutrition.grams(20) },
  eatenAt: new Date('2026-11-27T12:00:00Z'),
} as const

describe('fakeGoogleHealth', () => {
  it('is not connected until connect() and rejects writes meanwhile', async () => {
    const health = fakeGoogleHealth()
    expect(health.isConnected()).toBe(false)
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotConnectedError)
    await health.connect()
    expect(health.isConnected()).toBe(true)
  })

  it('creates and removes data points by name', async () => {
    const health = fakeGoogleHealth({ connected: true })
    const first = await health.create(entry)
    const second = await health.create(entry)
    expect(first).not.toBe(second)
    await health.remove([first])
    expect(health.created.map((point) => point.name)).toEqual([second])
  })

  it('stops being connected on expire()', () => {
    const health = fakeGoogleHealth({ connected: true })
    health.expire()
    expect(health.isConnected()).toBe(false)
  })
})
