import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import type { TargetsPort } from '../targets/targets-port.ts'
import { servings } from '../log/servings.ts'
import type { NewLogEntry } from '../log/log-store.ts'
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

describe('DayScreen targets', () => {
  const bar = (name: string) => screen.getByRole('meter', { name })

  it('shows eaten and remaining against each Target', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    await log.create(entry('Rice', 'lunch', 12, 600))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000), proteinG: grams(50), carbsG: grams(100), fatG: grams(20) })
    renderScreen({ log, targets })
    expect(bar('Calories')).toHaveAttribute('aria-valuenow', '1000')
    expect(bar('Calories')).toHaveAttribute('aria-valuemax', '2000')
    expect(within(bar('Calories')).getByText('1000 kcal eaten · 1000 kcal left')).toBeInTheDocument()
    expect(within(bar('Protein')).getByText('20 g eaten · 30 g left')).toBeInTheDocument()
    expect(within(bar('Carbs')).getByText('40 g eaten · 60 g left')).toBeInTheDocument()
    expect(within(bar('Fat')).getByText('10 g eaten · 10 g left')).toBeInTheDocument()
  })

  it('shows only the total for a macro with no Target', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000) })
    renderScreen({ log, targets })
    expect(within(bar('Protein')).getByText('10 g eaten')).toBeInTheDocument()
    expect(bar('Protein')).not.toHaveAttribute('aria-valuemax')
  })

  it('shows totals only when the Member has no Targets', async () => {
    const log = fakeLogStore()
    await log.create(entry('Toast', 'breakfast', 8, 400))
    renderScreen({ log })
    expect(within(bar('Calories')).getByText('400 kcal eaten')).toBeInTheDocument()
  })

  it('shows an over-target macro as over', async () => {
    const log = fakeLogStore()
    await log.create(entry('Feast', 'dinner', 19, 2500))
    const targets = fakeTargetsPort()
    await targets.write({ kcal: kcal(2000) })
    renderScreen({ log, targets })
    expect(within(bar('Calories')).getByText('2500 kcal eaten · 500 kcal over')).toBeInTheDocument()
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
