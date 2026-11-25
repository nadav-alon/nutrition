import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import type { nutrition } from 'data-platform'
import { AccountAction } from './gate/account.tsx'
import { dayOf, type Day } from './day.ts'
import { DayScreen } from './day-screen/DayScreen.tsx'
import { FoodsScreen } from './foods-screen/FoodsScreen.tsx'
import type { Foods } from './foods/foods.ts'
import { LogScreen } from './log-screen/LogScreen.tsx'
import { LogEntryScreen } from './log/LogEntryScreen.tsx'
import type { LogStore } from './log/log-store.ts'
import { useDayEntries } from './log/use-day-entries.ts'
import type { Route } from './routes.ts'
import { TargetsScreen } from './targets/TargetsScreen.tsx'
import type { TargetsPort } from './targets/targets-port.ts'
import { useRoute } from './use-route.ts'

/** The ports of the signed-in Member's data that the screens work against. */
export interface AppPorts {
  log: LogStore
  foods: Foods
  targets: TargetsPort
}

/** The signed-in app: the Member's Day as home, with the screens reached from it. */
export function App({ log, foods, targets }: AppPorts) {
  const now = new Date()
  const today = dayOf(now)
  const [route, go, back] = useRoute(today)
  const home: Route = { name: 'day', day: today }
  const backToDay = (day: Day) => back({ name: 'day', day })
  return (
    <TopAppBar title="Nutrition">
      <AccountAction />
      {route.name === 'day' && (
        <>
          <DayScreen
            log={log}
            targets={targets}
            now={now}
            day={route.day}
            onDayChange={(day) => go({ name: 'day', day })}
            onOpenEntry={(entry) => go({ name: 'entry', day: route.day, id: entry.id })}
            onLog={(day) => go({ name: 'log', day })}
          />
          <nav class="screen home-links">
            <Button variant="tonal" onClick={() => go({ name: 'foods' })}>
              Foods
            </Button>
            <Button variant="tonal" onClick={() => go({ name: 'targets' })}>
              Targets
            </Button>
          </nav>
        </>
      )}
      {route.name === 'log' && (
        <LogScreen
          key={JSON.stringify(route.estimate ?? null)}
          log={log}
          foods={foods}
          day={route.day}
          now={now}
          estimate={route.estimate}
          onDone={() => backToDay(route.day)}
        />
      )}
      {route.name === 'entry' && (
        <LogEntryLoader log={log} day={route.day} id={route.id} onDone={() => backToDay(route.day)} />
      )}
      {route.name === 'foods' && (
        <FoodsScreen
          foods={foods}
          form={route.form}
          onOpenForm={(form) => go({ name: 'foods', form })}
          onCloseForm={() => back({ name: 'foods' })}
          onLeave={() => back(home)}
        />
      )}
      {route.name === 'targets' && <TargetsScreen port={targets} onLeave={() => back(home)} />}
    </TopAppBar>
  )
}

/** The Log Entry `id` on `day`, found by watching the Day, so a refresh on its URL still opens it. */
function LogEntryLoader({ log, day, id, onDone }: { log: LogStore; day: Day; id: nutrition.LogEntryId; onDone: () => void }) {
  const dayEntries = useDayEntries(log, day)
  if (dayEntries.status === 'loading') return <p class="screen">Loading…</p>
  if (dayEntries.status === 'error') {
    return (
      <div class="screen" role="alert">
        <p>Could not load the entry.</p>
        <Button variant="tonal" onClick={onDone}>
          Back to the Day
        </Button>
      </div>
    )
  }
  const entry = dayEntries.entries.find((candidate) => candidate.id === id)
  if (entry === undefined) {
    return (
      <div class="screen">
        <p>That entry is no longer there.</p>
        <Button variant="tonal" onClick={onDone}>
          Back to the Day
        </Button>
      </div>
    )
  }
  return <LogEntryScreen store={log} entry={entry} onDone={onDone} />
}
