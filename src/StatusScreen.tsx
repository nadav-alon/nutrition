import type { ComponentChildren } from 'preact'
import { BackArrow } from './BackArrow.tsx'

/** A screen that is only a Back and, optionally, one message: loading, failed, or gone. */
export function StatusScreen({ onBack, alert, children }: { onBack: () => void; alert?: boolean; children?: ComponentChildren }) {
  return (
    <main class="screen" role={alert ? 'alert' : undefined}>
      <BackArrow onClick={onBack} />
      {children}
    </main>
  )
}
