import { NotConnectedError, dataPointName } from './google-health.ts'
import type { DataPointName, GoogleHealth, HealthEntry } from './google-health.ts'

/** An in-memory `GoogleHealth`; `created` is what is currently logged, oldest first. */
export interface FakeGoogleHealth extends GoogleHealth {
  readonly created: readonly { readonly name: DataPointName; readonly entry: HealthEntry }[]
  /** Makes the token expire, as it does after about an hour. */
  expire(): void
}

export function fakeGoogleHealth(options: { connected?: boolean } = {}): FakeGoogleHealth {
  let connected = options.connected ?? false
  let counter = 0
  let created: { name: DataPointName; entry: HealthEntry }[] = []

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
    async connect() {
      connected = true
    },
    isConnected: () => connected,
    async create(entry) {
      requireConnected()
      const name = dataPointName(`users/me/dataTypes/nutrition-log/dataPoints/fake-${counter++}`)
      created.push({ name, entry })
      return name
    },
    async remove(names) {
      requireConnected()
      created = created.filter((point) => !names.includes(point.name))
    },
  }
}
