import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { App, type AppPorts } from './App.tsx'
import { dayOf, previousDay } from './day.ts'
import { fakeFoods } from './foods/fake-foods.ts'
import { fakeLogStore } from './log/fake-log-store.ts'
import { servings } from './log/servings.ts'
import { fakeSettingsPort } from './settings/fake-settings-port.ts'
import { fakeTargetsPort } from './targets/fake-targets-port.ts'
import { expectOneBackInAppBar } from './test/render-in-app-bar.tsx'

const today = dayOf(new Date())

function ports(): AppPorts {
  return { log: fakeLogStore(), foods: fakeFoods(), targets: fakeTargetsPort(), settings: fakeSettingsPort() }
}

beforeEach(() => {
  location.hash = ''
})

describe('App routes', () => {
  it("opens on today's Day", () => {
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('puts Foods and Targets in the header navigation only, leaving Log the one action in the Day', () => {
    render(<App {...ports()} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('button', { name: 'Foods' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Targets' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Foods' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Targets' })).toHaveLength(1)
    const day = screen.getByRole('heading', { name: 'Today' }).closest('section')!
    expect(within(day).getByRole('button', { name: 'Log' })).toBeInTheDocument()
  })

  it('keeps the navigation on every screen and marks the current one', async () => {
    render(<App {...ports()} />)
    const nav = () => screen.getByRole('navigation', { name: 'Main' })
    fireEvent.click(within(nav()).getByRole('button', { name: 'Foods' }))
    await screen.findByRole('button', { name: 'Back' })
    expect(within(nav()).getByRole('button', { name: 'Foods' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(within(nav()).getByRole('button', { name: 'Targets' }))
    expect(location.hash).toBe('#/targets')
    expect(within(nav()).getByRole('button', { name: 'Targets' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('button', { name: 'Foods' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the viewed Day in the URL, so a refresh stays on it', () => {
    const first = render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(location.hash).toBe(`#/day/${previousDay(today)}`)
    first.unmount()
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument()
  })

  it('replaces the history entry when moving between Days, so back leaves the Day screen in one step', () => {
    render(<App {...ports()} />)
    const before = history.length
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(history.length).toBe(before)
  })

  it("leaves a route meaning today when the Member comes back to today's Day", () => {
    location.hash = `#/day/${today}/log`
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(location.hash).toBe('#/')
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('rewrites a dated hash that names today to the route meaning today', () => {
    location.hash = `#/day/${today}`
    render(<App {...ports()} />)
    expect(location.hash).toBe('#/')
  })

  it('leaves a route meaning today when Done returns through the real history from Log', async () => {
    location.hash = `#/day/${today}`
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(location.hash).toBe(`#/day/${today}/log`)
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(location.hash).toBe('#/'))
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('returns to the Log list on system back from the Quick Entry step', async () => {
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quick entry' }))
    history.back()
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    expect(location.hash).toBe(`#/day/${today}/log`)
  })

  it('lands on the Day when a Quick Entry is saved from its own history entry', async () => {
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quick entry' }))
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Apple' } })
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)']) {
      fireEvent.input(screen.getByLabelText(label), { target: { value: '1' } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(location.hash).toBe('')
  })

  it("leaves a route meaning today when stepping forward reaches today's Day", () => {
    location.hash = `#/day/${previousDay(today)}`
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(location.hash).toBe('#/')
  })

  it('moves to the new Today when left open past local midnight on Today', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    try {
      vi.setSystemTime(new Date(2026, 10, 26, 23, 59, 0))
      render(<App {...ports()} />)
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
      expect(location.hash).toBe('#/day/2026-11-26')
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes to Foods and Targets, and the browser back returns to the Day', async () => {
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Foods' }))
    expect(location.hash).toBe('#/foods')
    await screen.findByRole('button', { name: 'Back' })
    history.back()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Targets' }))
    expect(location.hash).toBe('#/targets')
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull()
  })

  it.each(['Foods', 'Targets'])('goes back from %s to the Day that was being viewed, by history', async (name) => {
    location.hash = `#/day/${previousDay(today)}`
    render(<App {...ports()} />)
    const push = vi.spyOn(history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument())
    expect(location.hash).toBe(`#/day/${previousDay(today)}`)
    expect(push).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })

  it('leaves the Day history as it was when Back from Foods is followed by the system back', async () => {
    location.hash = `#/day/${previousDay(today)}`
    render(<App {...ports()} />)
    const depth = history.length
    fireEvent.click(screen.getByRole('button', { name: 'Foods' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument())
    expect(history.length).toBe(depth + 1)
    history.back()
    await waitFor(() => expect(location.hash).not.toBe(`#/day/${previousDay(today)}`))
    expect(location.hash).not.toMatch(/foods/)
  })

  it('goes Yesterday → Foods → Edit food, then Back and Back return to Foods and then Yesterday', async () => {
    const p = ports()
    const id = await p.foods.add({
      name: 'Apple',
      estimated: false,
      perServing: { kcal: nutrition.kcal(95), proteinG: nutrition.grams(0), carbsG: nutrition.grams(25), fatG: nutrition.grams(0) },
    })
    location.hash = `#/day/${previousDay(today)}`
    render(<App {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Foods' }))
    fireEvent.click(await screen.findByRole('button', { name: /Apple/ }))
    expect(location.hash).toBe(`#/foods/${id}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(location.hash).toBe('#/foods'))
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument())
    expect(location.hash).toBe(`#/day/${previousDay(today)}`)
  })

  describe('Log Entry states', () => {
    const entryHash = `#/day/${today}/entry/nope`

    it('has one Back in the app bar while loading', () => {
      const p = ports()
      p.log = { ...p.log, watchDay: () => () => {} }
      location.hash = entryHash
      render(<App {...p} />)
      expect(screen.getByText('Loading…')).toBeInTheDocument()
      expectOneBackInAppBar()
    })

    it('has one Back in the app bar when the Day fails to load', async () => {
      const p = ports()
      p.log = { ...p.log, watchDay: (_start, _end, _onEntries, onError) => (onError?.(new Error('boom')), () => {}) }
      location.hash = entryHash
      render(<App {...p} />)
      await screen.findByText('Could not load the entry.')
      expectOneBackInAppBar()
    })

    it('has one Back in the app bar when the entry is no longer there', async () => {
      location.hash = entryHash
      render(<App {...ports()} />)
      await screen.findByText('That entry is no longer there.')
      expectOneBackInAppBar()
    })
  })

  it.each([
    ['#/foods', 'Foods'],
    ['#/foods/new', 'Add food'],
    ['#/targets', 'Targets'],
    [`#/day/${today}/log`, 'Log'],
  ])('titles %s "%s" in the app bar', (hash, title) => {
    location.hash = hash
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })

  it.each([
    [today, 'Log · Today'],
    [previousDay(today), 'Log · Yesterday'],
  ])('titles the Log screen for %s "%s"', (logDay, title) => {
    location.hash = `#/day/${logDay}/log`
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })

  it('titles a Food being edited "Edit food", and a Log Entry "Log Entry"', async () => {
    const p = ports()
    const id = await p.foods.add({
      name: 'Apple',
      estimated: false,
      perServing: { kcal: nutrition.kcal(95), proteinG: nutrition.grams(0.5), carbsG: nutrition.grams(25), fatG: nutrition.grams(0.3) },
    })
    location.hash = `#/foods/${id}`
    const first = render(<App {...p} />)
    await screen.findByDisplayValue('Apple')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edit food')
    first.unmount()
    location.hash = `#/day/${today}/entry/nope`
    render(<App {...p} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log Entry')
  })

  it('opens the Log screen for the viewed Day', () => {
    render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(location.hash).toBe(`#/day/${previousDay(today)}/log`)
    expect(screen.queryByRole('heading', { name: previousDay(today) })).toBeNull()
  })

  it("opens an estimate link on today's Quick Entry, filled in", () => {
    location.hash = '#/log?name=Soup&kcal=200&protein=10&carbs=20&fat=5&servings=2&est=1'
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { name: 'Quick entry' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Soup')
    expect(screen.getByLabelText('Servings')).toHaveValue(2)
    expect(screen.getByLabelText('Estimated')).toBeChecked()
  })

  it('opens a Log Entry from the Day, and finds it again from its URL', async () => {
    const p = ports()
    await p.log.create({
      name: 'Toast',
      source: { kind: 'quick' },
      nutrition: { kcal: nutrition.kcal(100), proteinG: nutrition.grams(1), carbsG: nutrition.grams(2), fatG: nutrition.grams(3) },
      servings: servings(1),
      mealType: 'breakfast',
      eatenAt: new Date(),
    })
    const first = render(<App {...p} />)
    fireEvent.click(await screen.findByText('Toast'))
    expect(location.hash).toMatch(/^#\/day\/.+\/entry\//)
    expect(await screen.findByText('Toast')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull()
    first.unmount()
    render(<App {...p} />)
    expect(await screen.findByText('Toast')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull()
  })

  it('gives the Foods form its own route, so back returns to the list and a refresh keeps the form', async () => {
    const p = ports()
    const id = await p.foods.add({
      name: 'Apple',
      perServing: { kcal: nutrition.kcal(95), proteinG: nutrition.grams(0), carbsG: nutrition.grams(25), fatG: nutrition.grams(0) },
      estimated: false,
    })
    const first = render(<App {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Foods' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    expect(location.hash).toBe('#/foods/new')
    history.back()
    expect(await screen.findByRole('button', { name: 'Add food' })).toBeInTheDocument()
    expect(location.hash).toBe('#/foods')
    first.unmount()
    location.hash = `#/foods/${id}`
    render(<App {...p} />)
    expect(await screen.findByDisplayValue('Apple')).toBeInTheDocument()
  })

  it('returns to the Day by going back when it is the entry just before, not by stacking another', async () => {
    render(<App {...ports()} />)
    const push = vi.spyOn(history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(push).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument())
    expect(push).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })
})
