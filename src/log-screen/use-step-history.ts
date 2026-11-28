import { useEffect, useRef } from 'preact/hooks'

/** Whether a history entry is a Log step's own: the marker lives on the entry, so it survives the screen remounting. */
function isStepEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'logStep' in state && state.logStep === true
}

export interface StepHistory {
  /** Gives the step its own history entry, unless the current one already is. */
  enter: () => void
  /** The in-app Back from a step: pops the step's entry, so it behaves as system back does. */
  back: () => void
  /** Leaves after a save: drops the step's entry first, so the Day the Member goes to is one entry back, not two. */
  finish: () => void
}

/**
 * History bookkeeping for the confirm and Quick Entry steps, each of which has an entry of its own
 * so system back returns to the Log list. `inStep` says whether the screen is on a step; `onPopped`
 * is called when system back (or `back`) has popped the step's entry; `onDone` leaves the screen
 * once `finish` has dropped it. A screen that opens on a step gets its entry on mount.
 */
export function useStepHistory({ inStep, onPopped, onDone }: { inStep: boolean; onPopped: () => void; onDone: () => void }): StepHistory {
  const latest = useRef({ inStep, onPopped, onDone })
  latest.current = { inStep, onPopped, onDone }
  /** Set by `finish`: the next pop is the save dropping the step's entry, so leave rather than return to the list. */
  const finishing = useRef(false)

  const enter = () => {
    if (!isStepEntry(history.state)) history.pushState({ ...history.state, logStep: true }, '', location.href)
  }
  useEffect(() => {
    if (latest.current.inStep) enter()
    // A step entry the screen remounted onto (a refresh, or system back from another screen) has no
    // step to show: drop it, or the list's Back would land on an identical entry.
    else if (isStepEntry(history.state)) history.back()
  }, [])
  useEffect(() => {
    const onPop = () => {
      const { inStep: stepping, onPopped, onDone } = latest.current
      if (isStepEntry(history.state)) {
        // Forward onto a step entry whose step is gone: skip it.
        if (!stepping) history.back()
        return
      }
      if (finishing.current) {
        finishing.current = false
        setTimeout(onDone)
      } else onPopped()
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  return {
    enter,
    back: () => (isStepEntry(history.state) ? history.back() : latest.current.onPopped()),
    finish: () => {
      if (!isStepEntry(history.state)) return latest.current.onDone()
      finishing.current = true
      history.back()
    },
  }
}
