import { NotConnectedError } from './google-health.ts'
import type { GoogleHealth } from './google-health.ts'
import type { GisOauth2 } from './gis.ts'

/** The public OAuth web client for this app (Personal mode). */
export const CLIENT_ID = '465702061647-iof716k14dhp3lg1dr19l4n6dchgigm9.apps.googleusercontent.com'
export const SCOPE = 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly'

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

/** The `GoogleHealth` adapter over the Google Health REST API and the GIS token client. */
export function googleHealth(deps: GoogleHealthDeps): GoogleHealth {
  let token: Token | undefined

  const live = () => (token && deps.now().getTime() < token.expiresAt ? token : undefined)

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
    create: () => Promise.reject(new Error('unimplemented')),
    remove: () => Promise.reject(new Error('unimplemented')),
  }
}
