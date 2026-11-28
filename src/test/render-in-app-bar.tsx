import { render } from '@testing-library/preact'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import type { ComponentChildren } from 'preact'

/** Renders a screen inside the top app bar, where its title and back arrow are shown. */
export function renderInAppBar(screen: ComponentChildren, title = 'Screen') {
  return render(<TopAppBar title={title}>{screen}</TopAppBar>)
}
