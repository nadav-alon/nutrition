import { HealthRequestError, NotConnectedError, NotLinkedError, dataPointName } from './google-health.ts'
import type { GoogleHealth, HealthEntry } from './google-health.ts'
import type { GisOauth2 } from './gis.ts'

/** The public OAuth web client for this app (Personal mode). */
export const CLIENT_ID = '465702061647-iof716k14dhp3lg1dr19l4n6dchgigm9.apps.googleusercontent.com'
export const SCOPE = 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly'

const API = 'https://health.googleapis.com/v4'
const DATA_POINTS = `${API}/users/me/dataTypes/nutrition-log/dataPoints`
const IDENTITY = `${API}/users/me/identity`
const MINUTE_MS = 60_000

export interface GoogleHealthDeps {
  readonly gis: GisOauth2
  readonly fetch: typeof fetch
  /** The clock; tokens expire against it. */
  readonly now: () => Date
}

interface Token {
  readonly value: string
  readonly expiresAt: number
}

/** An instant with the local UTC offset in force at it, in the shape the API's `interval` wants. */
function timeAt(instant: Date) {
  return { time: instant.toISOString(), utcOffset: `${-instant.getTimezoneOffset() * 60}s` }
}

function toDataPoint(entry: HealthEntry) {
  const start = timeAt(entry.eatenAt)
  const end = timeAt(new Date(entry.eatenAt.getTime() + MINUTE_MS))
  return {
    foodDisplayName: entry.name,
    mealType: entry.mealType.toUpperCase(),
    energy: { kcal: entry.nutrition.kcal },
    totalCarbohydrate: { grams: entry.nutrition.carbsG },
    totalFat: { grams: entry.nutrition.fatG },
    nutrients: [{ nutrient: 'PROTEIN', quantity: { grams: entry.nutrition.proteinG } }],
    interval: {
      startTime: start.time,
      startUtcOffset: start.utcOffset,
      endTime: end.time,
      endUtcOffset: end.utcOffset,
    },
  }
}

/** The `GoogleHealth` adapter over the Google Health REST API and the GIS token client. */
export function googleHealth(deps: GoogleHealthDeps): GoogleHealth {
  let token: Token | undefined
  /** The token value whose account link has been confirmed, so the check runs once per token. */
  let linkedFor: string | undefined

  const live = () => (token && deps.now().getTime() < token.expiresAt ? token : undefined)

  /** Sends an authorised JSON request and returns the parsed body; failures are typed. */
  async function send(url: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
    const current = live()
    if (!current) throw new NotConnectedError()
    if (url !== IDENTITY && linkedFor !== current.value) {
      await send(IDENTITY, 'GET')
      linkedFor = current.value
    }
    let response: Response
    try {
      response = await deps.fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${current.value}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (error) {
      throw new HealthRequestError(undefined, error instanceof Error ? error.message : String(error))
    }
    if (!response.ok) {
      const text = await response.text()
      if (text.includes('ACCOUNT_NOT_LINKED')) throw new NotLinkedError()
      throw new HealthRequestError(response.status, text)
    }
    return response.json()
  }

  return {
    connect() {
      // Runs synchronously up to requestAccessToken so the popup opens inside the caller's gesture.
      return new Promise<void>((resolve, reject) => {
        const client = deps.gis.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(new NotConnectedError(response.error_description ?? response.error ?? 'No token granted'))
              return
            }
            const seconds = Number(response.expires_in)
            token = { value: response.access_token, expiresAt: deps.now().getTime() + seconds * 1000 }
            resolve()
          },
          error_callback: (error) => reject(new NotConnectedError(error.message ?? error.type ?? 'Consent refused')),
        })
        client.requestAccessToken()
      })
    },
    isConnected: () => live() !== undefined,
    async create(entry) {
      const body = await send(`${DATA_POINTS}`, 'POST', toDataPoint(entry))
      const name = (body as { name?: unknown } | undefined)?.name
      if (typeof name !== 'string') throw new HealthRequestError(undefined, 'Google Health returned no data point name')
      return dataPointName(name)
    },
    remove: () => Promise.reject(new Error('unimplemented')),
  }
}
