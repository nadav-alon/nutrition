import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
