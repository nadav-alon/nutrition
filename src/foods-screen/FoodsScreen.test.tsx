import { useState } from 'preact/hooks'
import type { nutrition } from 'data-platform'
import { fireEvent, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import type { Foods as FoodsPort } from '../foods/foods.ts'
import { fakeFoods } from '../foods/fake-foods.ts'
import { apple, listed, schnitzel } from '../foods/foods.contract.ts'
import { renderInAppBar } from '../test/render-in-app-bar.tsx'
import { FoodsScreen } from './FoodsScreen.tsx'

/** The FoodsScreen with the open form kept in state, as the router keeps it in the URL. */
function Foods({ foods: port }: { foods: FoodsPort }) {
  const [form, setForm] = useState<'new' | nutrition.FoodId | undefined>()
  return <FoodsScreen foods={port} form={form} onOpenForm={setForm} onCloseForm={() => setForm(undefined)} onLeave={() => {}} />
}

describe('FoodsScreen list', () => {
  it('lists live Foods by name with place and per-Serving kcal, and marks Estimated ones', async () => {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    await foods.add(apple)
    renderInAppBar(<Foods foods={foods} />)
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
    renderInAppBar(<Foods foods={fakeFoods()} />)
    expect(await screen.findByText('No Foods yet.')).toBeInTheDocument()
  })

  it('shows a listing failure', async () => {
    const foods: FoodsPort = {
      ...fakeFoods(),
      watch(_listener, onError) {
        onError?.(new Error('boom'))
        return () => {}
      },
    }
    renderInAppBar(<Foods foods={foods} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})

describe('FoodsScreen search', () => {
  async function searched(query: string) {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    await foods.add(apple)
    renderInAppBar(<Foods foods={foods} />)
    await screen.findAllByRole('listitem')
    fireEvent.input(screen.getByLabelText('Search'), { target: { value: query } })
  }

  it('filters by name, ignoring case', async () => {
    await searched('APP')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent('Apple')
  })

  it('filters by place', async () => {
    await searched('canteen')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent('Canteen schnitzel')
  })

  it('says so when nothing matches', async () => {
    await searched('pizza')
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByText('No Foods match.')).toBeInTheDocument()
  })
})

function fill(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } })
}

function fillNutrition(kcal: string, protein: string, carbs: string, fat: string) {
  fill('Calories (kcal)', kcal)
  fill('Protein (g)', protein)
  fill('Carbs (g)', carbs)
  fill('Fat (g)', fat)
}

describe('FoodsScreen add', () => {
  it('saves a new Food from the form and returns to the list showing it', async () => {
    const foods = fakeFoods()
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    fill('Name', ' Falafel ')
    fill('Place', 'Corner stall')
    fill('Serving label', '1 pita')
    fillNutrition('450', '15', '55', '18')
    fireEvent.click(screen.getByLabelText('Estimated'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('Falafel')
    expect(row).toHaveTextContent('Corner stall · 450 kcal')
    expect(row).toHaveTextContent('Estimated')
    expect(await listed(foods)).toEqual([
      expect.objectContaining({
        name: 'Falafel',
        place: 'Corner stall',
        servingLabel: '1 pita',
        perServing: { kcal: 450, proteinG: 15, carbsG: 55, fatG: 18 },
        estimated: true,
      }),
    ])
  })

  it('leaves out an empty place and serving label', async () => {
    const foods = fakeFoods()
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    fill('Name', 'Apple')
    fillNutrition('95', '0', '25', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('listitem')
    const [food] = await listed(foods)
    expect(food).not.toHaveProperty('place')
    expect(food).not.toHaveProperty('servingLabel')
    expect(food?.estimated).toBe(false)
  })

  it.each([
    ['a missing name', () => fill('Name', ' '), 'Name'],
    ['a missing Nutrition value', () => fill('Fat (g)', ''), 'Fat (g)'],
    ['a negative Nutrition value', () => fill('Protein (g)', '-1'), 'Protein (g)'],
  ])('blocks saving with %s, with a message on that field', async (_name, spoil, label) => {
    const foods = fakeFoods()
    const add = vi.spyOn(foods, 'add')
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    fill('Name', 'Apple')
    fillNutrition('95', '0', '25', '0')
    spoil()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText(label)).toBeInvalid()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('keeps the form and says so when saving fails', async () => {
    const foods = fakeFoods()
    vi.spyOn(foods, 'add').mockRejectedValue(new Error('offline'))
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    fill('Name', 'Apple')
    fillNutrition('95', '0', '25', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('offline'))
    expect(screen.getByLabelText('Name')).toHaveValue('Apple')
  })
})

describe('FoodsScreen edit', () => {
  async function opened() {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: /Canteen schnitzel/ }))
    return foods
  }

  it('opens the same form prefilled with the Food', async () => {
    await opened()
    expect(screen.getByLabelText('Name')).toHaveValue('Canteen schnitzel')
    expect(screen.getByLabelText('Place')).toHaveValue('Work canteen')
    expect(screen.getByLabelText('Serving label')).toHaveValue('1 plate')
    expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(620)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(34)
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(41)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(33)
    expect(screen.getByLabelText('Estimated')).toBeChecked()
  })

  it('saves the changes to that Food and returns to the list', async () => {
    const foods = await opened()
    fill('Name', 'School schnitzel')
    fill('Calories (kcal)', '580')
    fireEvent.click(screen.getByLabelText('Estimated'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('School schnitzel')
    expect(row).toHaveTextContent('580 kcal')
    expect(row).not.toHaveTextContent('Estimated')
    expect(await listed(foods)).toHaveLength(1)
  })

  it('clears the place and serving label when they are emptied', async () => {
    const foods = await opened()
    fill('Place', '')
    fill('Serving label', '')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('listitem')
    const [food] = await listed(foods)
    expect(food?.place).toBeUndefined()
    expect(food?.servingLabel).toBeUndefined()
  })

  it('blocks saving invalid input as when adding', async () => {
    const foods = await opened()
    const edit = vi.spyOn(foods, 'edit')
    fill('Name', '')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('Name')).toBeInvalid()
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
    expect(edit).not.toHaveBeenCalled()
  })
})

describe('FoodsScreen delete', () => {
  async function opened() {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    await foods.add(apple)
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: /Canteen schnitzel/ }))
    return foods
  }

  it('offers no delete when adding', async () => {
    renderInAppBar(<Foods foods={fakeFoods()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('asks first, then soft deletes the Food and returns to the list without it', async () => {
    const foods = await opened()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const softDelete = vi.spyOn(foods, 'softDelete')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Canteen schnitzel'))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect(screen.getByRole('listitem')).toHaveTextContent('Apple')
    expect(softDelete).toHaveBeenCalledOnce()
  })

  it('keeps the Food when the Member declines', async () => {
    const foods = await opened()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const softDelete = vi.spyOn(foods, 'softDelete')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(softDelete).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toHaveValue('Canteen schnitzel')
  })

  it('ignores a second Delete while the first is in flight, and disables Save', async () => {
    const foods = await opened()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let release: () => void = () => {}
    const softDelete = vi.spyOn(foods, 'softDelete').mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(softDelete).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    release()
  })

  it('keeps the form and says so when deleting fails', async () => {
    const foods = await opened()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(foods, 'softDelete').mockRejectedValue(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('offline'))
  })
})

describe('FoodsScreen back arrow', () => {
  it('has one Back in the list and one in the form, and no other', async () => {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    renderInAppBar(<Foods foods={foods} />)
    await screen.findByRole('listitem')
    expect(screen.getAllByRole('button', { name: /back/i })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
    expect(screen.getAllByRole('button', { name: /back/i })).toHaveLength(1)
  })
})

describe('FoodsScreen leaving the form', () => {
  async function opened() {
    const foods = fakeFoods()
    await foods.add(schnitzel)
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: /Canteen schnitzel/ }))
  }

  it('goes back to the list without asking when nothing changed', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    await opened()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await screen.findByRole('listitem')).toBeInTheDocument()
  })

  it('asks before leaving with unsaved changes, and stays when the Member declines', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await opened()
    fill('Place', 'Home')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByLabelText('Place')).toHaveValue('Home')
  })

  it('discards the changes when the Member agrees', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await opened()
    fill('Place', 'Home')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('listitem')).toHaveTextContent('Work canteen')
  })

  it('counts a half-filled new Food as unsaved', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderInAppBar(<Foods foods={fakeFoods()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    fill('Name', 'Apple')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
  })

  it('counts unparseable text in a number field as unsaved, and blocks saving it', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const foods = fakeFoods()
    const add = vi.spyOn(foods, 'add')
    renderInAppBar(<Foods foods={foods} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
    const field = screen.getByLabelText('Protein (g)')
    Object.defineProperty(field, 'validity', { value: { badInput: true }, configurable: true })
    fill('Protein (g)', '')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
    fill('Name', 'Apple')
    fill('Calories (kcal)', '95')
    fill('Carbs (g)', '25')
    fill('Fat (g)', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(field).toBeInvalid()
    expect(add).not.toHaveBeenCalled()
  })

  it('raises the browser warning on unload only while there are unsaved changes', async () => {
    await opened()
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(unload()).toBe(false)
    fill('Place', 'Home')
    await waitFor(() => expect(unload()).toBe(true))
  })
})
