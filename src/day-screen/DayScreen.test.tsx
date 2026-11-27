import { act, fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { useState } from 'preact/hooks'
import { dayOf } from '../day.ts'
import type { TargetsPort } from '../targets/targets-port.ts'
import { servings } from '../log/servings.ts'
import type { LogStore, NewLogEntry } from '../log/log-store.ts'
import { fakeLogStore } from '../log/fake-log-store.ts'
import { fakeTargetsPort } from '../targets/fake-targets-port.ts'
import { DayScreen, type DayScreenProps } from './DayScreen.tsx'

// 2026-03-10 12:00 in America/New_York (the test time zone).
const NOW = new Date('2026-03-10T16:00:00Z')

/** Holds the viewed Day the way the router does: it starts on today and follows `onDayChange`. */
function Harness(props: Partial<DayScreenProps>) {
  const [day, setDay] = useState(dayOf(NOW))
  return (
    <DayScreen
      log={fakeLogStore()}
      targets={fakeTargetsPort()}
      now={NOW}
      day={day}
      onDayChange={setDay}
      onOpenEntry={() => {}}
      onLog={() => {}}
      {...props}
    />
  )
}

function renderScreen(props: Partial<DayScreenProps> = {}) {
  return render(<Harness {...props} />)
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

const { grams, kcal } = nutrition

function entry(name: string, mealType: NewLogEntry['mealType'], hour: number, kcalTotal = 100, servingCount = 1): NewLogEntry {
  return {
    name,
    source: { kind: 'quick' },
    nutrition: { kcal: kcal(kcalTotal), proteinG: grams(10), carbsG: grams(20), fatG: grams(5) },
    servings: servings(servingCount),
    mealType,
    eatenAt: new Date(2026, 2, 10, hour),
  }
}

describe('DayScreen entries', () => {
  it('groups entries by Meal Type with name, servings and kcal, hiding empty groups', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 180, 2))
    await log.create(entry('Schnitzel', 'lunch', 12, 650, 1.5))
    renderScreen({ log })
    const breakfast = await screen.findByRole('group', { name: 'Breakfast' })
    expect(within(breakfast).getByText('Toast')).toBeInTheDocument()
    expect(within(breakfast).getByText('2 servings · 180 kcal')).toBeInTheDocument()
    const lunch = screen.getByRole('group', { name: 'Lunch' })
    expect(within(lunch).getByText('1.5 servings · 650 kcal')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Dinner' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Snack' })).not.toBeInTheDocument()
  })

  it('opens an entry when tapped', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8))
    const onOpenEntry = vi.fn()
    renderScreen({ log, onOpenEntry })
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ name: 'Toast' }))
  })

  it('shows the entries of the viewed Day', async () => {
    const log = fakeLogStore()
    await log.create({ ...entry('Yesterday toast', 'breakfast', 8), eatenAt: new Date(2026, 2, 9, 8) })
    renderScreen({ log })
    expect(screen.queryByText('Yesterday toast')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('Yesterday toast')).toBeInTheDocument()
  })

  it('shows an empty state, not empty groups, for an empty Day', () => {
    renderScreen()
    expect(screen.getByText('Nothing logged this day.')).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Protein' })).toHaveTextContent('Protein 0 g eaten')
  })
})

describe('DayScreen Log action', () => {
  it('opens logging for the viewed Day', () => {
    const onLog = vi.fn()
    renderScreen({ onLog })
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(onLog).toHaveBeenLastCalledWith('2026-03-10')
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(onLog).toHaveBeenLastCalledWith('2026-03-09')
  })
})

describe('DayScreen without Targets', () => {
  it('says no Targets are set and links to the Targets screen, until Targets exist', async () => {
    const targets = fakeTargetsPort()
    renderScreen({ targets })
    expect(screen.getByText(/No Targets set/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set Targets' })).toHaveAttribute('href', '#/targets')
    await act(() => targets.write({ kcal: kcal(2000) }))
    expect(screen.queryByText(/No Targets set/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Set Targets' })).not.toBeInTheDocument()
  })
})

describe('DayScreen targets', () => {
  const bar = (name: string) => screen.getByRole('meter', { name })
  const expectMeterReads = (name: string, figures: string) => {
    expect(within(bar(name)).getByText(`${name} ${figures}`)).toBeInTheDocument()
    expect(bar(name)).toHaveAttribute('aria-valuetext', figures)
  }

  it('shows eaten and remaining against each Target', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    await log.create(entry('Rice', 'lunch', 12, 600))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000), proteinG: grams(50), carbsG: grams(100), fatG: grams(20) })
    renderScreen({ log, targets })
    expect(bar('Calories')).toHaveAttribute('aria-valuenow', '1000')
    expect(bar('Calories')).toHaveAttribute('aria-valuemax', '2000')
    expectMeterReads('Calories', '1000 kcal eaten · 1000 kcal left')
    expectMeterReads('Protein', '20 g eaten · 30 g left')
    expectMeterReads('Carbs', '40 g eaten · 60 g left')
    expectMeterReads('Fat', '10 g eaten · 10 g left')
  })

  it('shows only the total for a macro with no Target', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000) })
    renderScreen({ log, targets })
    expectMeterReads('Protein', '10 g eaten')
    expect(bar('Protein')).not.toHaveAttribute('aria-valuemax')
  })

  it('shows totals only when the Member has no Targets', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    renderScreen({ log })
    expectMeterReads('Calories', '400 kcal eaten')
    expectMeterReads('Protein', '10 g eaten')
    expectMeterReads('Carbs', '20 g eaten')
    expectMeterReads('Fat', '5 g eaten')
  })

  it('shows an over-target macro as over', async () => {
    const log = fakeLogStore()
    await log.create(entry('Feast', 'dinner', 19, 2500))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000) })
    renderScreen({ log, targets })
    expectMeterReads('Calories', '2500 kcal eaten · 500 kcal over')
    expect(bar('Calories')).toHaveClass('over')
    expect(bar('Protein')).not.toHaveClass('over')
  })

  it('says so when the Targets cannot be read', () => {
    const targets: TargetsPort = {
      subscribe: (_onChange, onError) => {
        onError(new Error('offline'))
        return () => {}
      },
      write: async () => {},
    }
    renderScreen({ targets })
    expect(screen.getByText('Targets unavailable.')).toBeInTheDocument()
  })
})

describe('DayScreen robustness', () => {
  const bar = (name: string) => screen.getByRole('meter', { name })

  it('rounds totals and differences for display', async () => {
    const log = fakeLogStore()
    const piece = (name: string) => ({
      ...entry(name, 'lunch', 12),
      nutrition: { kcal: kcal(100.04), proteinG: grams(0.1), carbsG: grams(0.2), fatG: grams(10) },
    })
    await log.create(piece('A'))
    await log.create(piece('B'))
    await log.create(piece('C'))
    const targets = fakeTargetsPort()
    await targets.write({ proteinG: grams(1), carbsG: grams(0.5) })
    renderScreen({ log, targets })
    expect(within(bar('Protein')).getByText('Protein 0.3 g eaten · 0.7 g left')).toBeInTheDocument()
    expect(within(bar('Carbs')).getByText('Carbs 0.6 g eaten · 0.1 g over')).toBeInTheDocument()
    expect(within(bar('Fat')).getByText('Fat 30 g eaten')).toBeInTheDocument()
    expect(screen.getAllByText('1 serving · 100 kcal')).toHaveLength(3)
  })

  it('renders no progress bar for a Target of 0', async () => {
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(0) })
    renderScreen({ targets })
    expect(within(bar('Calories')).getByText('Calories 0 kcal eaten · 0 kcal left')).toBeInTheDocument()
    expect(bar('Calories').querySelector('progress')).toBeNull()
  })

  it('says so, not "Nothing logged", when the Log cannot be read', () => {
    const log: LogStore = {
      ...fakeLogStore(),
      watchDay: (_start, _end, _onEntries, onError) => {
        onError?.(new Error('offline'))
        return () => {}
      },
    }
    renderScreen({ log })
    expect(screen.getByText('Log unavailable.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing logged this day.')).not.toBeInTheDocument()
  })

  it('shows loading, not the empty state or the previous Day, until the snapshot arrives', () => {
    const base = fakeLogStore()
    const pending: Array<() => void> = []
    const log: LogStore = {
      ...base,
      watchDay: (start, end, onEntries, onError) => {
        let live = true
        pending.push(() => {
          if (live) base.watchDay(start, end, onEntries, onError)
        })
        return () => {
          live = false
        }
      },
    }
    renderScreen({ log })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Nothing logged this day.')).not.toBeInTheDocument()
    act(() => pending.splice(0).forEach((deliver) => deliver()))
    expect(screen.getByText('Nothing logged this day.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('meter', { name: 'Calories' })).not.toBeInTheDocument()
  })
})
