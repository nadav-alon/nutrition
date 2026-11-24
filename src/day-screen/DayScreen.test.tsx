import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { fakeLogStore } from '../log/fake-log-store.ts'
import { fakeTargetsPort } from '../targets/fake-targets-port.ts'
import { DayScreen, type DayScreenProps } from './DayScreen.tsx'

// 2026-03-10 12:00 in America/New_York (the test time zone).
const NOW = new Date('2026-03-10T16:00:00Z')

function renderScreen(props: Partial<DayScreenProps> = {}) {
  return render(
    <DayScreen
      log={fakeLogStore()}
      targets={fakeTargetsPort()}
      now={NOW}
      onOpenEntry={() => {}}
      onLog={() => {}}
      {...props}
    />,
  )
}

describe('DayScreen day navigation', () => {
  it('shows today by default, with next disabled', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })

  it('steps to earlier Days and back', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByRole('heading', { name: '2026-03-09' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })
})
