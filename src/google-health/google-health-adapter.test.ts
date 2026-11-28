import { afterEach, describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { dataPointName } from './google-health.ts'
import { googleHealth } from './google-health-adapter.ts'
import type { GoogleHealthDeps } from './google-health-adapter.ts'
import { HealthRequestError, NotConnectedError, NotLinkedError } from './google-health.ts'
import type { TokenResponse } from './gis.ts'
import { googleHealthContract } from './google-health.contract.ts'

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

const IDENTITY = { name: 'users/me/identity', legacyUserId: 'legacy', healthUserId: '123' }

/** The operation Google answers a create with: the data point rides in `response`. */
const created = (name: string) =>
  json({
    done: true,
    response: { '@type': 'type.googleapis.com/google.devicesandservices.health.v4.DataPoint', name, dataSource: {}, nutritionLog: {} },
  })

const BATCH_DELETED = {
  done: true,
  response: {
    '@type': 'type.googleapis.com/google.devicesandservices.health.v4.BatchDeleteDataPointsResponse',
    dataPoints: [{ name: 'users/123/dataTypes/nutrition-log/dataPoints/abc' }],
  },
}

let issued = 0
googleHealthContract('googleHealth', () => {
  const { health, fetchStub } = setup()
  fetchStub.mockImplementation(async (url) => {
    const text = String(url)
    if (text.endsWith('/identity')) return json(IDENTITY)
    if (text.endsWith(':batchDelete')) return json(BATCH_DELETED)
    return created(`users/123/dataTypes/nutrition-log/dataPoints/p-${issued++}`)
  })
  return { health, requests: () => fetchStub.mock.calls.length }
})

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
  afterEach(() => vi.unstubAllEnvs())

  const offsets = async (eatenAt: Date) => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(async (url) => (String(url).endsWith('/identity') ? json({}) : created(POINT)))
    await health.connect()
    await health.create({ ...entry, eatenAt })
    const { interval } = JSON.parse(fetchStub.mock.calls[1]![1]?.body as string).nutritionLog
    return [interval.startUtcOffset, interval.endUtcOffset]
  }

  it('signs the offset east positive and west negative', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(await offsets(new Date('2026-11-27T12:30:00Z'))).toEqual(['-18000s', '-18000s'])
  })

  it('takes each end\'s own offset across a DST change', async () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem')
    // Daylight time ends 2026-10-25 at 23:00Z: +3 before, +2 after.
    expect(await offsets(new Date('2026-10-24T22:59:30Z'))).toEqual(['10800s', '7200s'])
  })

  it('posts the entry mapped onto a nutrition-log data point and returns its name', async () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem')
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(async (url) => (String(url).endsWith('/identity') ? json({}) : created(POINT)))
    await health.connect()
    expect(await health.create(entry)).toBe(POINT)
    const [url, init] = fetchStub.mock.calls[1]!
    expect(url).toBe('https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' })
    expect(JSON.parse(init?.body as string)).toEqual({
      nutritionLog: {
        foodDisplayName: 'Canteen schnitzel',
        mealType: 'LUNCH',
        energy: { kcal: 650 },
        totalCarbohydrate: { grams: 70 },
        totalFat: { grams: 25 },
        nutrients: [{ nutrient: 'PROTEIN', quantity: { grams: 30 } }],
        interval: {
          startTime: '2026-11-27T12:30:00.000Z',
          startUtcOffset: '7200s',
          endTime: '2026-11-27T12:31:00.000Z',
          endUtcOffset: '7200s',
        },
      },
    })
  })

  it('types the 400 Google answers an unnested body with', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(async (url) =>
      String(url).endsWith('/identity')
        ? json(IDENTITY)
        : json(
            {
              error: {
                code: 400,
                status: 'INVALID_ARGUMENT',
                message: 'Invalid JSON payload received. Unknown name "foodDisplayName" at \'data_point\': Cannot find field.',
              },
            },
            400,
          ),
    )
    await health.connect()
    await expect(health.create(entry)).rejects.toMatchObject({ name: 'HealthRequestError', status: 400 })
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

describe('the account link check', () => {
  const identityThenPoint = (identity: () => Response) => async (url: Parameters<typeof fetch>[0]) =>
    String(url).endsWith('/identity') ? identity() : created(POINT)

  it('GETs the identity once per token, before the first write', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(identityThenPoint(() => json({})))
    await health.connect()
    await health.create(entry)
    await health.create(entry)
    expect(fetchStub.mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)).toEqual([
      'GET https://health.googleapis.com/v4/users/me/identity',
      'POST https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints',
      'POST https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints',
    ])
    expect(fetchStub.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: 'Bearer tok' })
  })

  it('sends one identity request for writes started together', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(identityThenPoint(() => json({})))
    await health.connect()
    await Promise.all([health.create(entry), health.create(entry)])
    expect(fetchStub.mock.calls.filter(([url]) => String(url).endsWith('/identity'))).toHaveLength(1)
  })

  it('rejects remove as not linked, deleting nothing', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(identityThenPoint(() => json({ error: { details: [{ reason: 'ACCOUNT_NOT_LINKED' }] } }, 400)))
    await health.connect()
    await expect(health.remove([dataPointName(POINT)])).rejects.toBeInstanceOf(NotLinkedError)
    expect(fetchStub).toHaveBeenCalledTimes(1)
  })

  it('rejects as not linked when the write itself says so', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(async (url) =>
      String(url).endsWith('/identity') ? json({}) : json({ error: { details: [{ reason: 'ACCOUNT_NOT_LINKED' }] } }, 400),
    )
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotLinkedError)
  })

  it('does not take ACCOUNT_NOT_LINKED in free text for the structured reason', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(identityThenPoint(() => new Response('ACCOUNT_NOT_LINKED', { status: 500 })))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(HealthRequestError)
  })

  it('types a 401 from identity as not connected and drops the token', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(identityThenPoint(() => new Response('Unauthorized', { status: 401 })))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotConnectedError)
    expect(health.isConnected()).toBe(false)
  })

  it('checks again with a new token', async () => {
    let issued = 0
    const { health, fetchStub } = setup(({ callback }) => callback({ access_token: `tok-${issued++}`, expires_in: '3599' }))
    fetchStub.mockImplementation(identityThenPoint(() => json({})))
    await health.connect()
    await health.create(entry)
    await health.connect()
    await health.create(entry)
    expect(fetchStub.mock.calls.filter(([url]) => String(url).endsWith('/identity'))).toHaveLength(2)
  })

  it('rejects as not linked, writing nothing, and checks again next time', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(
      identityThenPoint(() => json({ error: { status: 'FAILED_PRECONDITION', details: [{ reason: 'ACCOUNT_NOT_LINKED' }] } }, 400)),
    )
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotLinkedError)
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotLinkedError)
    expect(fetchStub.mock.calls.every(([url]) => String(url).endsWith('/identity'))).toBe(true)
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })
})

describe('a grant without a usable expires_in', () => {
  it('falls back to an hour', async () => {
    const { health, advance } = setup(({ callback }) => callback({ access_token: 'tok' }))
    await health.connect()
    expect(health.isConnected()).toBe(true)
    advance(3_599_999)
    expect(health.isConnected()).toBe(true)
    advance(1)
    expect(health.isConnected()).toBe(false)
  })
})

describe('remove', () => {
  it('posts the names to batchDelete', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(async (url) => json(String(url).endsWith('/identity') ? IDENTITY : BATCH_DELETED))
    await health.connect()
    await health.remove([dataPointName(POINT)])
    const [url, init] = fetchStub.mock.calls[1]!
    expect(url).toBe('https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints:batchDelete')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ names: [POINT] })
  })

  it('sends nothing for no names', async () => {
    const { health, fetchStub } = setup()
    await health.connect()
    await health.remove([])
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('rejects as not connected without a live token', async () => {
    const { health } = setup()
    await expect(health.remove([dataPointName(POINT)])).rejects.toBeInstanceOf(NotConnectedError)
  })
})

describe('malformed successes', () => {
  const afterIdentity = (response: () => Response) => async (url: Parameters<typeof fetch>[0]) =>
    String(url).endsWith('/identity') ? json({}) : response()

  it('treats an empty batchDelete reply as success', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(afterIdentity(() => new Response('', { status: 200 })))
    await health.connect()
    await expect(health.remove([dataPointName(POINT)])).resolves.toBeUndefined()
  })

  it('ignores a non-JSON batchDelete reply', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(afterIdentity(() => new Response('ok', { status: 200 })))
    await health.connect()
    await expect(health.remove([dataPointName(POINT)])).resolves.toBeUndefined()
  })

  it('types a non-JSON create reply', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(afterIdentity(() => new Response('<html>', { status: 200 })))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(HealthRequestError)
  })

  it.each([
    ['not done', { done: false, response: { name: POINT } }],
    ['no done', { response: { name: POINT } }],
    ['no response', { done: true }],
    ['no name in the response', { done: true, response: {} }],
    ['a name at the top level only', { name: POINT }],
  ])('types a create operation with %s', async (_, reply) => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(afterIdentity(() => json(reply)))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(HealthRequestError)
  })

  it('types a data point name that is not one', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(afterIdentity(() => json({ done: true, response: { name: 'nonsense' } })))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(HealthRequestError)
  })
})

describe('other failures', () => {
  const failing = (response: () => Promise<Response>) => async (url: Parameters<typeof fetch>[0]) =>
    String(url).endsWith('/identity') ? json({}) : response()

  it('keeps the status and message of an error response', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(failing(async () => new Response('Quota exceeded', { status: 429 })))
    await health.connect()
    const error = await health.create(entry).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HealthRequestError)
    expect(error).toMatchObject({ status: 429, message: 'Quota exceeded' })
  })

  it('keeps the message of a request that never got a response, with no status', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(failing(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await health.connect()
    const error = await health.remove([dataPointName(POINT)]).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HealthRequestError)
    expect(error).toMatchObject({ status: undefined, message: 'Failed to fetch' })
  })

  it('types a 401 as not connected, since the token is no longer accepted', async () => {
    const { health, fetchStub } = setup()
    fetchStub.mockImplementation(failing(async () => new Response('Unauthorized', { status: 401 })))
    await health.connect()
    await expect(health.create(entry)).rejects.toBeInstanceOf(NotConnectedError)
    expect(health.isConnected()).toBe(false)
  })
})
