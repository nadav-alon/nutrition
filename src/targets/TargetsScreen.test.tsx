import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { fakeTargetsPort } from './fake-targets-port.ts'
import type { Targets, TargetsPort } from './targets-port.ts'
import { TargetsScreen } from './TargetsScreen.tsx'

function type(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } })
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

/** What the port currently holds. */
function stored(port: TargetsPort): Targets | null {
  let current: Targets | null = null
  port.subscribe((targets) => (current = targets), () => {})()
  return current
}

describe('TargetsScreen', () => {
  it('prefills each field from the current Targets and leaves an unset Target empty', async () => {
    const port = fakeTargetsPort()
    await port.write({ kcal: nutrition.kcal(2000), proteinG: nutrition.grams(150) })
    render(<TargetsScreen port={port} />)
    expect(await screen.findByLabelText('Calories (kcal)')).toHaveValue(2000)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(150)
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(null)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(null)
  })

  it('shows empty fields when no Targets are set', async () => {
    render(<TargetsScreen port={fakeTargetsPort()} />)
    expect(await screen.findByLabelText('Calories (kcal)')).toHaveValue(null)
  })

  it.each(['0', '-5'])('blocks saving %s with a message on that field', async (value) => {
    const port = fakeTargetsPort()
    const write = vi.spyOn(port, 'write')
    render(<TargetsScreen port={port} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', value)
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/above zero/)
    expect(screen.getByLabelText('Protein (g)')).toBeInvalid()
    expect(write).not.toHaveBeenCalled()
  })

  it('writes the filled fields through the port and leaves an empty one unset', async () => {
    const port = fakeTargetsPort()
    await port.write({ kcal: nutrition.kcal(2000), fatG: nutrition.grams(60) })
    render(<TargetsScreen port={port} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    type('Fat (g)', '')
    save()
    await waitFor(() => expect(stored(port)).toEqual({ kcal: 2000, proteinG: 150 }))
  })

  it('shows why a write failed', async () => {
    const port = fakeTargetsPort()
    vi.spyOn(port, 'write').mockRejectedValue(new Error('offline'))
    render(<TargetsScreen port={port} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})
