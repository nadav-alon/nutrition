import { DATA_POINTS_PATH, NotConnectedError, dataPointName } from './google-health.ts'
import type { DataPointName, GoogleHealth, HealthEntry } from './google-health.ts'

/** An in-memory `GoogleHealth`; `created` is what is currently logged, oldest first. */
export interface FakeGoogleHealth extends GoogleHealth {
  readonly created: readonly { readonly name: DataPointName; readonly entry: HealthEntry }[]
  /** Makes the token expire, as it does after about an hour. */
  expire(): void
  /** Makes the next `create` or `remove` reject with `error` (queued, in order), whatever the connection. */
  fail(error: Error): void
  /** Makes the next `connect()` reject as not connected, as when consent is refused. */
  refuseConsent(reason?: string): void
}

export function fakeGoogleHealth(options: { connected?: boolean } = {}): FakeGoogleHealth {
  let connected = options.connected ?? false
  let counter = 0
  const failures: Error[] = []
  let refusal: { reason?: string } | undefined
  let created: { name: DataPointName; entry: HealthEntry }[] = []

  const failIfQueued = () => {
    const error = failures.shift()
    if (error) throw error
  }

  const requireConnected = () => {
    if (!connected) throw new NotConnectedError()
  }

  return {
    get created() {
      return created
    },
    expire() {
      connected = false
    },
    fail(error) {
      failures.push(error)
    },
    refuseConsent(reason) {
      refusal = reason === undefined ? {} : { reason }
    },
    async connect() {
      if (refusal) {
        const { reason } = refusal
        refusal = undefined
        throw new NotConnectedError(reason)
      }
      connected = true
    },
    isConnected: () => connected,
    async create(entry) {
      failIfQueued()
      requireConnected()
      const name = dataPointName(`${DATA_POINTS_PATH}/fake-${counter++}`)
      created.push({ name, entry })
      return name
    },
    async remove(names) {
      // Like the adapter, an empty list sends nothing, so it needs neither a token nor a link.
      if (names.length === 0) return
      failIfQueued()
      requireConnected()
      created = created.filter((point) => !names.includes(point.name))
    },
  }
}
