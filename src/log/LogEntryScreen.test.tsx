import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeLogStore } from './fake-log-store.ts'
import { LogEntryScreen } from './LogEntryScreen.tsx'
import { schnitzel } from './log-store.contract.ts'
import type { LogEntry, NewLogEntry } from './log-store.ts'

/** A fake store holding the schnitzel entry, with the entry as the screen is handed it. */
async function setup(logged: NewLogEntry = schnitzel) {
  const store = fakeLogStore()
  const id = await store.create(logged)
  const entry: LogEntry = { ...logged, id }
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

  it('is not dirty on open for an entry eaten at a time with seconds', async () => {
    const { onDone } = await setup({ ...schnitzel, eatenAt: new Date('2026-03-10T12:30:45.678Z') })
    const confirm = vi.spyOn(window, 'confirm')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('keeps the eaten time to the second when only servings change', async () => {
    const eatenAt = new Date('2026-03-10T12:30:45.678Z')
    const { stored, onDone } = await setup({ ...schnitzel, eatenAt })
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect((await stored())?.eatenAt).toEqual(eatenAt)
  })

  it('does not save servings that are not positive', async () => {
    await setup()
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/positive/i)
  })
})

describe('LogEntryScreen Meal Type and eaten time', () => {
  it('saves a changed Meal Type', async () => {
    const { stored, onDone } = await setup()
    fireEvent.change(screen.getByLabelText('Meal type'), { target: { value: 'snack' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect((await stored())?.mealType).toBe('snack')
  })

  it('keeps the chosen Meal Type when the eaten time moves into another band', async () => {
    const { stored, onDone } = await setup()
    // Lunch at 12:30 moved to 08:00 would be guessed as breakfast; the Member's lunch stands.
    fireEvent.input(screen.getByLabelText('Eaten at'), { target: { value: '2026-03-10T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const saved = await stored()
    expect(saved?.eatenAt).toEqual(new Date('2026-03-10T08:00'))
    expect(saved?.mealType).toBe('lunch')
  })

  it('does not save an eaten time that is cleared', async () => {
    await setup()
    fireEvent.input(screen.getByLabelText('Eaten at'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('LogEntryScreen delete', () => {
  it('asks first, then soft deletes and returns to the Day', async () => {
    const { store, entry, onDone, stored } = await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirm).toHaveBeenCalled()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(await stored()).toBeUndefined()
    await expect(store.update(entry.id, {})).rejects.toThrow()
    confirm.mockRestore()
  })

  it('does nothing when the Member declines', async () => {
    const { onDone, stored } = await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDone).not.toHaveBeenCalled()
    expect(await stored()).toBeDefined()
    confirm.mockRestore()
  })
})

describe('LogEntryScreen leaving', () => {
  it('leaves at once when nothing changed', async () => {
    const { onDone } = await setup()
    const confirm = vi.spyOn(window, 'confirm')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('asks before leaving with unsaved changes, and stays when the Member declines', async () => {
    const { onDone } = await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onDone).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it.each([
    ['servings of 0', 'Servings', '0'],
    ['cleared servings', 'Servings', ''],
    ['a cleared eaten time', 'Eaten at', ''],
  ])('asks before leaving with %s', async (_name, label, value) => {
    const { onDone } = await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.input(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('warns on page unload only while there are unsaved changes', async () => {
    await setup()
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(unload()).toBe(false)
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    await waitFor(() => expect(unload()).toBe(true))
  })
})
