import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { App, type AppPorts } from './App.tsx'
import { dayOf, previousDay } from './day.ts'
import { fakeFoods } from './foods/fake-foods.ts'
import { fakeLogStore } from './log/fake-log-store.ts'
import { servings } from './log/servings.ts'
import { fakeTargetsPort } from './targets/fake-targets-port.ts'

const today = dayOf(new Date())

function ports(): AppPorts {
  return { log: fakeLogStore(), foods: fakeFoods(), targets: fakeTargetsPort() }
}

beforeEach(() => {
  location.hash = ''
})

describe('App routes', () => {
  it('opens on today\'s Day, with Foods and Targets reachable from it', () => {
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Targets' })).toBeInTheDocument()
  })

  it('keeps the viewed Day in the URL, so a refresh stays on it', () => {
    const first = render(<App {...ports()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(location.hash).toBe(`#/day/${previousDay(today)}`)
    first.unmount()
    render(<App {...ports()} />)
    expect(screen.getByRole('heading', { name: previousDay(today) })).toBeInTheDocument()
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
