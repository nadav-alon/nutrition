import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { googleHealth } from './google-health-adapter.ts'
import type { GoogleHealthDeps } from './google-health-adapter.ts'
import { NotConnectedError } from './google-health.ts'
import type { TokenResponse } from './gis.ts'

/** A GIS stub: `grant` is what the popup answers when `requestAccessToken` runs. */
type Grant = (callbacks: {
  callback: (r: TokenResponse) => void
  error_callback: (e: { message?: string }) => void
}) => void

function stubGis(grant: Grant) {
  const requestAccessToken = vi.fn()
  const initTokenClient = vi.fn((config: Parameters<GoogleHealthDeps['gis']['initTokenClient']>[0]) => ({
    requestAccessToken: () => {
      requestAccessToken()
      grant(config)
    },
  }))
  return { gis: { initTokenClient }, initTokenClient, requestAccessToken }
}

const grantToken =
  (expires_in: string | number = '3599'): Grant =>
  (c) =>
    c.callback({ access_token: 'tok', expires_in })

function setup(grant: Grant = grantToken()) {
  let clock = new Date('2026-11-27T12:00:00Z')
  const stub = stubGis(grant)
  const fetchStub = vi.fn<typeof fetch>()
  const health = googleHealth({ gis: stub.gis, fetch: fetchStub, now: () => clock })
  return { health, stub, fetchStub, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) }
}

describe('connect and isConnected', () => {
  it('is not connected before connect()', () => {
    expect(setup().health.isConnected()).toBe(false)
  })

  it('requests a token with the write-only scope synchronously, inside the caller\'s gesture', () => {
    const { health, stub } = setup()
    void health.connect()
    expect(stub.requestAccessToken).toHaveBeenCalledOnce()
    expect(stub.initTokenClient.mock.calls[0]?.[0]).toMatchObject({
      client_id: '465702061647-iof716k14dhp3lg1dr19l4n6dchgigm9.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly',
    })
  })

  it('is connected once granted, until the token expires', async () => {
    const { health, advance } = setup(grantToken('3600'))
    await health.connect()
    expect(health.isConnected()).toBe(true)
    advance(3_599_999)
    expect(health.isConnected()).toBe(true)
    advance(1)
    expect(health.isConnected()).toBe(false)
  })

  it('rejects as not connected when consent is refused', async () => {
    const { health } = setup(({ callback }) => callback({ error: 'access_denied' }))
    await expect(health.connect()).rejects.toBeInstanceOf(NotConnectedError)
    expect(health.isConnected()).toBe(false)
  })

  it('rejects as not connected when the popup is closed', async () => {
    const { health } = setup(({ error_callback }) => error_callback({ message: 'Popup window closed' }))
    await expect(health.connect()).rejects.toMatchObject({ name: 'NotConnectedError', message: 'Popup window closed' })
  })
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const entry = {
  name: 'Canteen schnitzel',
  mealType: 'lunch',
  nutrition: { kcal: nutrition.kcal(650), proteinG: nutrition.grams(30), carbsG: nutrition.grams(70), fatG: nutrition.grams(25) },
  eatenAt: new Date('2026-11-27T12:30:00Z'),
} as const

const POINT = 'users/me/dataTypes/nutrition-log/dataPoints/abc'

describe('create', () => {
  it('posts the entry mapped onto a nutrition-log data point and returns its name', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockResolvedValue(json({ name: POINT }))
    await health.connect()
    expect(await health.create(entry)).toBe(POINT)
    const [url, init] = fetchStub.mock.calls[0]!
    expect(url).toBe('https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' })
    const offset = `${-new Date('2026-11-27T12:30:00Z').getTimezoneOffset() * 60}s`
    expect(JSON.parse(init?.body as string)).toEqual({
      foodDisplayName: 'Canteen schnitzel',
      mealType: 'LUNCH',
      energy: { kcal: 650 },
      totalCarbohydrate: { grams: 70 },
      totalFat: { grams: 25 },
      nutrients: [{ nutrient: 'PROTEIN', quantity: { grams: 30 } }],
      interval: {
        startTime: '2026-11-27T12:30:00.000Z',
        startUtcOffset: offset,
        endTime: '2026-11-27T12:31:00.000Z',
        endUtcOffset: offset,
      },
    })
  })

  it('rejects as not connected, sending nothing, with no token or an expired one', async () => {
    const { health, fetchStub, advance } = setup()
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotConnectedError)
    await health.connect()
    advance(3_600_000)
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotConnectedError)
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
