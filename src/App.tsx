import { TopAppBar, TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import type { nutrition } from 'data-platform'
import { StatusScreen } from './StatusScreen.tsx'
import { AccountAction } from './gate/account.tsx'
import { dayLabel, type Day } from './day.ts'
import { DayScreen } from './day-screen/DayScreen.tsx'
import { FoodsScreen } from './foods-screen/FoodsScreen.tsx'
import type { Foods } from './foods/foods.ts'
import { LogScreen } from './log-screen/LogScreen.tsx'
import { LogEntryScreen } from './log/LogEntryScreen.tsx'
import type { LogStore } from './log/log-store.ts'
import { useDayEntries } from './log/use-day-entries.ts'
import type { Route } from './routes.ts'
import type { SettingsPort } from './settings/settings-port.ts'
import { TargetsScreen } from './targets/TargetsScreen.tsx'
import type { TargetsPort } from './targets/targets-port.ts'
import { useNow } from './use-now.ts'
import { useRoute } from './use-route.ts'

/** The ports of the signed-in Member's data that the screens work against. */
export interface AppPorts {
  log: LogStore
  foods: Foods
  targets: TargetsPort
  settings: SettingsPort
}

/** The signed-in app: the Member's Day as home, with the screens reached from it. */
export function App({ log, foods, targets, settings }: AppPorts) {
  const { now, today } = useNow()
  const [route, go, back, backToAny] = useRoute(today)
  const home: Route = { name: 'day', day: today }
  /** Back to the Day the Member came from, whichever it was, else on to today's. */
  const leaveToDay = () => backToAny(home, (from) => from.name === 'day')
  const backToDay = (day: Day) => back({ name: 'day', day })
  return (
    <TopAppBar title={titleOf(route, now)}>
      <TopAppBarActions>
        <nav class="app-nav" aria-label="Main">
          <Button
            variant={route.name === 'foods' ? 'tonal' : 'text'}
            aria-current={route.name === 'foods' ? 'page' : undefined}
            onClick={() => go({ name: 'foods' })}
          >
            Foods
          </Button>
          <Button
            variant={route.name === 'targets' ? 'tonal' : 'text'}
            aria-current={route.name === 'targets' ? 'page' : undefined}
            onClick={() => go({ name: 'targets' })}
          >
            Targets
          </Button>
        </nav>
      </TopAppBarActions>
      <AccountAction />
      {route.name === 'day' && (
        <DayScreen
          log={log}
          targets={targets}
          now={now}
          day={route.day}
          onDayChange={(day) => go({ name: 'day', day })}
          onOpenEntry={(entry) => go({ name: 'entry', day: route.day, id: entry.id })}
          onLog={(day) => go({ name: 'log', day })}
          onSetTargets={() => go({ name: 'targets' })}
        />
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
          onLeave={leaveToDay}
        />
      )}
      {route.name === 'targets' && <TargetsScreen targets={targets} settings={settings} onLeave={leaveToDay} />}
    </TopAppBar>
  )
}

/** The app bar's title for `route`: the app's name on the Day, the screen's own elsewhere, the Log screen's naming the Day it logs to. */
function titleOf(route: Route, now: Date): string {
  switch (route.name) {
    case 'day':
      return 'Nutrition'
    case 'log':
      return `Log · ${dayLabel(route.day, now)}`
    case 'entry':
      return 'Log Entry'
    case 'foods':
      return route.form === undefined ? 'Foods' : route.form === 'new' ? 'Add food' : 'Edit food'
    case 'targets':
      return 'Targets'
  }
}

/** The Log Entry `id` on `day`, found by watching the Day, so a refresh on its URL still opens it. */
function LogEntryLoader({ log, day, id, onDone }: { log: LogStore; day: Day; id: nutrition.LogEntryId; onDone: () => void }) {
  const dayEntries = useDayEntries(log, day)
  if (dayEntries.status === 'loading') {
    return (
      <StatusScreen onBack={onDone}>
        <p>Loading…</p>
      </StatusScreen>
    )
  }
  if (dayEntries.status === 'error') {
    return (
      <StatusScreen onBack={onDone} alert>
        <p>Could not load the entry.</p>
      </StatusScreen>
    )
  }
  const entry = dayEntries.entries.find((candidate) => candidate.id === id)
  if (entry === undefined) {
    return (
      <StatusScreen onBack={onDone}>
        <p>That entry is no longer there.</p>
      </StatusScreen>
    )
  }
  return <LogEntryScreen store={log} entry={entry} onDone={onDone} />
}
