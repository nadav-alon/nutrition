import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { fakeFoods } from '../foods/fake-foods.ts'
import { apple, schnitzel } from '../foods/foods.contract.ts'
import { FoodsScreen } from './FoodsScreen.tsx'

describe('FoodsScreen list', () => {
  it('lists live Foods by name with place and per-Serving kcal, and marks Estimated ones', async () => {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    await foods.add(apple)
    render(<FoodsScreen foods={foods} />)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Apple')
    expect(items[0]).toHaveTextContent('95 kcal')
    expect(items[0]).not.toHaveTextContent('Estimated')
    expect(items[1]).toHaveTextContent('Canteen schnitzel')
    expect(items[1]).toHaveTextContent('Work canteen · 620 kcal')
    expect(items[1]).toHaveTextContent('Estimated')
  })

  it('says so when there are no Foods', async () => {
    render(<FoodsScreen foods={fakeFoods()} />)
    expect(await screen.findByText('No Foods yet.')).toBeInTheDocument()
  })

  it('shows a listing failure', async () => {
    const foods = { ...fakeFoods(), watch: (_l: unknown, onError?: (e: Error) => void) => (onError?.(new Error('boom')), () => {}) }
    render(<FoodsScreen foods={foods as never} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
