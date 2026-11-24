import { fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initFirebase: vi.fn(),
}))

vi.mock('data-platform/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('data-platform/client')>()),
  initFirebase: mocks.initFirebase,
  authClient: () => ({ onAuthChange: () => () => {}, signIn: vi.fn(), signOut: vi.fn() }),
}))

import { localKit } from 'data-platform/local'
import { Root } from './Root.tsx'
import { expectAlertBanner } from './test/alert-banner.ts'

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  mocks.initFirebase.mockReset().mockReturnValue({ app: {}, db: {} })
})

afterEach(() => vi.unstubAllEnvs())

describe('Root', () => {
  it('shows the setup screen when no config is stored', () => {
    render(<Root />)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Set up' }))
    expect(screen.queryByRole('banner')).toBeNull()
    expect(mocks.initFirebase).not.toHaveBeenCalled()
  })

  it('connects with the stored config and waits at the gate', () => {
    const config = {
      apiKey: 'k',
      authDomain: 'a',
      projectId: 'p',
      storageBucket: 's',
      messagingSenderId: '1',
      appId: 'x',
    }
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(config))
    render(<Root />)
    expect(mocks.initFirebase).toHaveBeenCalledWith(config, { local: undefined })
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
  })

  it('runs against the local kit in emulator mode, skipping setup', () => {
    vi.stubEnv('MODE', 'emulator')
    render(<Root />)
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
    expect(mocks.initFirebase).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'demo-data-platform-local' }),
      { local: localKit },
    )
  })

  it('connects with a config carried by a #config= link and strips the link', () => {
    const config = { apiKey: 'k', authDomain: 'a', projectId: 'p', storageBucket: 's', messagingSenderId: '1', appId: 'x' }
    history.replaceState(null, '', '/nutrition/#config=' + btoa(JSON.stringify(config)))
    render(<Root />)
    expect(mocks.initFirebase).toHaveBeenCalledWith(config, { local: undefined })
    expect(location.hash).toBe('')
  })

  it('asks before a link repoints the stored config, then switches on accept', () => {
    const stored = { apiKey: 'k', authDomain: 'a', projectId: 'p', storageBucket: 's', messagingSenderId: '1', appId: 'x' }
    const other = { ...stored, projectId: 'other' }
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', '/nutrition/#config=' + btoa(JSON.stringify(other)))
    render(<Root />)
    expect(screen.getByRole('heading', { name: 'Switch Household?' })).toBeInTheDocument()
    expect(mocks.initFirebase).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /switch to other/i }))
    expect(mocks.initFirebase).toHaveBeenCalledWith(other, { local: undefined })
  })

  it('ignores a malformed #config= link with a banner, keeping the stored config', () => {
    const stored = { apiKey: 'k', authDomain: 'a', projectId: 'p', storageBucket: 's', messagingSenderId: '1', appId: 'x' }
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', '/nutrition/#config=%%%')
    render(<Root />)
    expectAlertBanner(screen.getByText(/the link was ignored/i).closest('.ui-alert-banner') as HTMLElement)
    expect(mocks.initFirebase).toHaveBeenCalledWith(stored, { local: undefined })
  })
})
