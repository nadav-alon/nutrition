import type { LogEntry } from '../log/log-store.ts'

declare const dataPointNameBrand: unique symbol

/** The resource name Google Health gives a data point it created: `users/me/dataTypes/nutrition-log/dataPoints/…`. */
export type DataPointName = string & { readonly [dataPointNameBrand]: true }

/** The guard: whether `value` names a data point. */
export function isDataPointName(value: string): value is DataPointName {
  return value.startsWith('users/') && value.includes('/dataPoints/')
}

/** The constructor: narrows, or throws naming the offending value. */
export function dataPointName(value: string): DataPointName {
  if (!isDataPointName(value)) throw new Error(`Not a data point name: ${JSON.stringify(value)}`)
  return value
}

/** What Google Health needs to know about a Log Entry; the name is as logged, Estimated is not marked. */
export type HealthEntry = Pick<LogEntry, 'name' | 'mealType' | 'nutrition' | 'eatenAt'>

/** The Member's Google account has no Google Health account linked to it. */
export class NotLinkedError extends Error {
  override readonly name = 'NotLinkedError'
  constructor() {
    super('This Google account is not linked to Google Health')
  }
}

/** There is no live token: `connect()` was never granted, the token expired, or consent was refused. */
export class NotConnectedError extends Error {
  override readonly name = 'NotConnectedError'
  constructor(reason = 'Not connected to Google Health') {
    super(reason)
  }
}

/** Any other failure; `status` is the HTTP status, absent when the request never got a response. */
export class HealthRequestError extends Error {
  override readonly name = 'HealthRequestError'
  readonly status: number | undefined
  constructor(status: number | undefined, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Write-only access to the Member's Google Health nutrition logs. Every method but `isConnected`
 * rejects with a `NotLinkedError`, `NotConnectedError` or `HealthRequestError`.
 */
export interface GoogleHealth {
  /**
   * Asks for a token through Google's consent popup. Must be called from inside a user gesture,
   * before any `await`. Resolves once the token is live; rejects with `NotConnectedError` when
   * consent is refused.
   */
  connect(): Promise<void>
  /** Whether a token is held and has not yet expired (about an hour; there is no refresh token). */
  isConnected(): boolean
  /** Writes `entry` as a nutrition log and returns the data point's name. */
  create(entry: HealthEntry): Promise<DataPointName>
  /** Deletes the named data points; an empty list sends nothing. */
  remove(names: readonly DataPointName[]): Promise<void>
}
