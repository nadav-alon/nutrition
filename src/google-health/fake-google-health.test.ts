import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { fakeGoogleHealth } from './fake-google-health.ts'
import { HealthRequestError, NotConnectedError, NotLinkedError } from './google-health.ts'
import { googleHealthContract } from './google-health.contract.ts'

googleHealthContract('fakeGoogleHealth', () => {
  const health = fakeGoogleHealth()
  return { health, requests: () => health.created.length }
})

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

  it('rejects the next write with a queued failure, once, in order', async () => {
    const health = fakeGoogleHealth({ connected: true })
    const name = await health.create(entry)
    health.fail(new NotLinkedError())
    health.fail(new HealthRequestError(429, 'Quota exceeded'))
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotLinkedError)
    await expect(health.remove([name])).rejects.toMatchObject({ status: 429, message: 'Quota exceeded' })
    await expect(health.create(entry)).resolves.toBeDefined()
  })

  it('refuses consent once when asked, leaving it not connected', async () => {
    const health = fakeGoogleHealth()
    health.refuseConsent('access_denied')
    await expect(health.connect()).rejects.toMatchObject({ name: 'NotConnectedError', message: 'access_denied' })
    expect(health.isConnected()).toBe(false)
    await health.connect()
    expect(health.isConnected()).toBe(true)
  })

  it('stops being connected on expire()', () => {
    const health = fakeGoogleHealth({ connected: true })
    health.expire()
    expect(health.isConnected()).toBe(false)
  })
})
