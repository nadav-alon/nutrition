import { render, screen } from '@testing-library/preact'
import { expect } from 'vitest'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import type { ComponentChildren } from 'preact'

/** Renders a screen inside the top app bar, where its title and back arrow are shown. */
export function renderInAppBar(screen: ComponentChildren, title = 'Screen') {
  return render(<TopAppBar title={title}>{screen}</TopAppBar>)
}

/** Asserts the screen shown has exactly one Back, and that it sits in the app bar's leading slot. */
export function expectOneBackInAppBar() {
  const backs = screen.getAllByRole('button', { name: /back/i })
  expect(backs).toHaveLength(1)
  expect(backs[0].closest('.shell-top-bar__navigation')).not.toBeNull()
}
