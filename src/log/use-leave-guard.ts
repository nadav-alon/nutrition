import { useEffect } from 'preact/hooks'

const discardPrompt = 'Discard your unsaved changes?'

/**
 * Guards a screen with unsaved changes. While `dirty`, closing or reloading the page raises the
 * browser's own warning. The returned `confirmLeave` is for in-app exits: true at once when
 * nothing is unsaved, otherwise whether the Member agreed to discard.
 */
export function useLeaveGuard(dirty: boolean): { confirmLeave: () => boolean } {
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return { confirmLeave: () => !dirty || confirm(discardPrompt) }
}
