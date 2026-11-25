import { useContext, useMemo } from 'preact/hooks'
import type { Firestore } from 'firebase/firestore'
import { App } from './App.tsx'
import { MemberContext } from './gate/account.tsx'
import { firestoreFoods } from './foods/firestore-foods.ts'
import { firestoreLogStore } from './log/firestore-log-store.ts'
import { firestoreTargetsPort } from './targets/firestore-targets-port.ts'

/** The app on the Firestore adapters of the Log, Foods and Targets ports, for the signed-in Member. Renders nothing outside an AuthGate. */
export function FirestoreApp({ db }: { db: Firestore }) {
  const member = useContext(MemberContext)
  const uid = member?.uid
  const ports = useMemo(
    () =>
      uid === undefined
        ? null
        : { log: firestoreLogStore(db, uid), foods: firestoreFoods(db), targets: firestoreTargetsPort(db, uid) },
    [db, uid],
  )
  return ports === null ? null : <App {...ports} />
}
