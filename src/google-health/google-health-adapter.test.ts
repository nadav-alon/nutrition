import { describe, expect, it, vi } from 'vitest'
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
