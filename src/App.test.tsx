import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

describe('App', () => {
  it('shows a placeholder home under the Nutrition app bar', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Nutrition' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/nothing logged yet/i)
  })
})
