import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { fakeTargetsPort } from './fake-targets-port.ts'
import { TargetsScreen } from './TargetsScreen.tsx'

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
})
