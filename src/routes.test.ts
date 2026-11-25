import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { day } from './day.ts'
import { hashFor, parseRoute, type Route } from './routes.ts'

const today = day('2026-03-10')
const routes: Route[] = [
  { name: 'day', day: day('2026-03-09') },
  { name: 'log', day: day('2026-03-09') },
  { name: 'entry', day: day('2026-03-09'), id: nutrition.logEntryId('a/b c') },
  { name: 'foods' },
  { name: 'foods', form: 'new' },
  { name: 'foods', form: nutrition.foodId('a/b c') },
  { name: 'targets' },
]

describe('routes', () => {
  it.each(routes)('round-trips $name through its hash', (route) => {
    expect(parseRoute(hashFor(route), today)).toEqual(route)
  })

  it.each(['', '#', '#/', '#/nope', '#/day/not-a-day', '#/day/2026-13-40', '#/foods/x/y', '#/day/2026-03-09/entry', '#/day/2026-03-09/entry/%E0%A4%A'])(
    'reads %j as today\'s Day',
    (hash) => {
      expect(parseRoute(hash, today)).toEqual({ name: 'day', day: today })
    },
  )

  it("reads #/log as the Log screen on today's Day", () => {
    expect(parseRoute('#/log', today)).toEqual({ name: 'log', day: today })
  })

  it("reads an estimate link as the Log screen on today's Day carrying the estimate", () => {
    expect(parseRoute('#/log?name=Soup&kcal=200&est=1', today)).toEqual({
      name: 'log',
      day: today,
      estimate: expect.objectContaining({ name: 'Soup', kcal: '200', estimated: true }),
    })
  })

  it('keeps the Day of #/day/…/log when it carries an estimate', () => {
    expect(parseRoute('#/day/2026-03-09/log?name=Soup', today)).toMatchObject({ name: 'log', day: day('2026-03-09') })
  })
})
