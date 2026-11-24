import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { AccountAction } from './gate/account.tsx'

/** The signed-in app: the Member's home. */
export function App() {
  return (
    <TopAppBar title="Nutrition">
      <AccountAction />
      <main class="screen home">
        <p>Nothing logged yet.</p>
      </main>
    </TopAppBar>
  )
}
