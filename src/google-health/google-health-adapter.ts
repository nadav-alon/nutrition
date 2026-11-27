import { HealthRequestError, NotConnectedError, NotLinkedError, isDataPointName } from './google-health.ts'
import type { GoogleHealth, HealthEntry } from './google-health.ts'
import type { GisOauth2 } from './gis.ts'

/** The public OAuth web client for this app (Personal mode). */
export const CLIENT_ID = '465702061647-iof716k14dhp3lg1dr19l4n6dchgigm9.apps.googleusercontent.com'
export const SCOPE = 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly'

const API = 'https://health.googleapis.com/v4'
const DATA_POINTS = `${API}/users/me/dataTypes/nutrition-log/dataPoints`
const IDENTITY = `${API}/users/me/identity`
const MINUTE_MS = 60_000
/** Google tokens last about an hour; used when the grant does not say. */
const DEFAULT_TOKEN_SECONDS = 3600

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

/** Whether an error body names ACCOUNT_NOT_LINKED in `error.details[].reason`. */
function reportsAccountNotLinked(text: string): boolean {
  try {
    const details = (JSON.parse(text) as { error?: { details?: unknown } }).error?.details
    return Array.isArray(details) && details.some((d: { reason?: unknown } | null) => d?.reason === 'ACCOUNT_NOT_LINKED')
  } catch {
    return false
  }
}

/** The `GoogleHealth` adapter over the Google Health REST API and the GIS token client. */
export function googleHealth(deps: GoogleHealthDeps): GoogleHealth {
  let token: Token | undefined
  /** The account-link check for one token value, kept in flight or settled so it runs once per token. */
  let linkCheck: { readonly token: string; readonly done: Promise<void> } | undefined

  const liveToken = () => (token && deps.now().getTime() < token.expiresAt ? token : undefined)

  /** Sends an authorised JSON request and returns the response text; failures are typed. */
  async function send(url: string, method: 'GET' | 'POST', body?: unknown): Promise<string> {
    const current = liveToken()
    if (!current) throw new NotConnectedError()
    return request(current.value, url, method, body)
  }

  /** Confirms once per token that the account is linked to Google Health; a failed check is retried next time. */
  async function ensureLinked(): Promise<void> {
    const current = liveToken()
    if (!current) throw new NotConnectedError()
    if (linkCheck?.token !== current.value) {
      const done = request(current.value, IDENTITY, 'GET').then(() => undefined)
      const check = { token: current.value, done }
      linkCheck = check
      done.catch(() => {
        if (linkCheck === check) linkCheck = undefined
      })
    }
    await linkCheck!.done
  }

  async function request(bearer: string, url: string, method: 'GET' | 'POST', body?: unknown): Promise<string> {
    let response: Response
    try {
      response = await deps.fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${bearer}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (error) {
      throw new HealthRequestError(undefined, error instanceof Error ? error.message : String(error))
    }
    if (!response.ok) {
      const text = await response.text()
      if (reportsAccountNotLinked(text)) throw new NotLinkedError()
      if (response.status === 401) {
        token = undefined
        throw new NotConnectedError('Google Health rejected the token')
      }
      throw new HealthRequestError(response.status, text)
    }
    return response.text()
  }

  /** Parses a success body as JSON; an empty body is `undefined`, an unparseable one a typed failure. */
  function parseBody(text: string): unknown {
    if (text.trim() === '') return undefined
    try {
      return JSON.parse(text)
    } catch {
      throw new HealthRequestError(undefined, 'Google Health returned a response that is not JSON')
    }
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
            const parsed = Number(response.expires_in)
            const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKEN_SECONDS
            token = { value: response.access_token, expiresAt: deps.now().getTime() + seconds * 1000 }
            resolve()
          },
          error_callback: (error) => reject(new NotConnectedError(error.message ?? error.type ?? 'Consent refused')),
        })
        client.requestAccessToken()
      })
    },
    isConnected: () => liveToken() !== undefined,
    async create(entry) {
      await ensureLinked()
      const body = parseBody(await send(DATA_POINTS, 'POST', toDataPoint(entry)))
      const name = (body as { name?: unknown } | undefined)?.name
      if (typeof name !== 'string') throw new HealthRequestError(undefined, 'Google Health returned no data point name')
      if (!isDataPointName(name)) throw new HealthRequestError(undefined, `Google Health returned an invalid data point name: ${name}`)
      return name
    },
    async remove(names) {
      if (names.length === 0) return
      // Plain DELETE on a data point returns 404; the API deletes through a batch call. Its reply body is ignored.
      await ensureLinked()
      await send(`${DATA_POINTS}:batchDelete`, 'POST', { names })
    },
  }
}
