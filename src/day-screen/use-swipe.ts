import { useRef } from 'preact/hooks'

/** The horizontal travel, in CSS pixels, that makes a touch a swipe. */
const SWIPE_MIN_PX = 60

/**
 * Touch handlers to spread on an element: a mostly horizontal drag of at least `SWIPE_MIN_PX` calls
 * `onRight` (dragged right) or `onLeft`. Multi-touch gestures and cancelled touches are not swipes.
 */
export function useSwipe({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      start.current = touch && event.touches.length <= 1 ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchCancel: () => {
      start.current = null
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current
      const touch = event.changedTouches[0]
      start.current = null
      if (!from || !touch) return
      const dx = touch.clientX - from.x
      const dy = touch.clientY - from.y
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
      if (dx > 0) onRight()
      else onLeft()
    },
  }
}
