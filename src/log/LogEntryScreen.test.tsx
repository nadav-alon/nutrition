import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeLogStore } from './fake-log-store.ts'
import { LogEntryScreen } from './LogEntryScreen.tsx'
import { schnitzel } from './log-store.contract.ts'
import type { LogEntry } from './log-store.ts'

/** A fake store holding the schnitzel entry, with the entry as the screen is handed it. */
async function setup() {
  const store = fakeLogStore()
  const id = await store.create(schnitzel)
  const entry: LogEntry = { ...schnitzel, id }
  const onDone = vi.fn()
  const view = render(<LogEntryScreen store={store} entry={entry} onDone={onDone} />)
  const stored = async () => {
    let latest: readonly LogEntry[] = []
    store.watchDay(new Date(0), new Date(8.64e15), (entries) => (latest = entries))()
    return latest[0]
  }
  return { store, entry, onDone, stored, ...view }
}

describe('LogEntryScreen', () => {
  it('shows the entry name and Nutrition totals as text, not inputs', async () => {
    await setup()
    expect(screen.getByRole('heading', { name: 'Schnitzel plate' })).toBeInTheDocument()
    expect(screen.getByText('650 kcal')).toBeInTheDocument()
    expect(screen.getByText('30 g', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('70 g', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('25 g', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/name/i)).toBeNull()
  })

  it('saves changed servings through update, so the totals rescale from the snapshot', async () => {
    const { stored, onDone } = await setup()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const saved = await stored()
    expect(saved?.servings).toBe(3)
    expect(saved?.nutrition.kcal).toBe(1300)
  })

  it('does not save servings that are not positive', async () => {
    await setup()
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/positive/i)
  })
})
