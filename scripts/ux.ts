import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { createServer } from 'vite'
import { LOCAL_PROJECT_ID, seedFixtures } from 'data-platform/local'
import { parseUxArgs } from './ux-args.ts'
import { uxScenario, type UxUser } from './ux-scenarios.ts'

/**
 * `npm run ux -- --scenario <name>`: the app on the local Firebase emulators, seeded for one
 * scenario. Only the `demo-` local project is ever used, so no production data is reachable.
 *
 * The emulator ports are the ones `data-platform/local`'s `connectLocal` connects to.
 */
const HOST = '127.0.0.1'
const AUTH_PORT = 9099
const FIRESTORE_PORT = 8090

const FIREBASE_CLI = createRequire(import.meta.url).resolve('firebase-tools/lib/bin/firebase.js')
const RULES_PATH = 'node_modules/data-platform/firestore.rules'

function waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, HOST)
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) reject(new Error(`Emulator on port ${port} never came up`))
        else setTimeout(attempt, 250)
      })
    }
    attempt()
  })
}

/** Writes the scenario's documents past the rules, so the Household starts claimed. */
async function seedFirestore(fixtures: ReturnType<typeof uxScenario>['fixtures']): Promise<void> {
  await seedFixtures({ set: async () => {} }, fixtures)
  const env = await initializeTestEnvironment({
    projectId: LOCAL_PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: HOST, port: FIRESTORE_PORT },
  })
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      for (const { collection, id, data } of fixtures) await db.doc(`${collection}/${id}`).set(data)
    })
  } finally {
    await env.cleanup()
  }
}

/** Creates each user in the Auth emulator under the uid the scenario's `members/{uid}` names, linked to Google so the fake Google sign-in lands on it. */
async function seedAuthUsers(users: readonly UxUser[]): Promise<void> {
  const response = await fetch(`http://${HOST}:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/projects/${LOCAL_PROJECT_ID}/accounts:batchCreate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      users: users.map(({ uid, email }) => ({
        localId: uid,
        email,
        emailVerified: true,
        providerUserInfo: [{ providerId: 'google.com', rawId: uid, federatedId: uid, email }],
      })),
    }),
  })
  if (!response.ok) throw new Error(`Seeding Auth emulator users failed: ${response.status} ${await response.text()}`)
}

/** Whether something already listens on `port`: an emulator of another run would otherwise be seeded as though it were ours. */
function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, HOST)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function main(): Promise<void> {
  const name = parseUxArgs(process.argv.slice(2))
  const { users, fixtures } = uxScenario(name, new Date())

  for (const port of [AUTH_PORT, FIRESTORE_PORT]) {
    if (await portTaken(port)) throw new Error(`Port ${port} is already in use; stop the other emulators (or \`npm run ux\`) first.`)
  }

  const configDir = mkdtempSync(join(tmpdir(), 'nutrition-ux-'))
  const configPath = join(configDir, 'firebase.json')
  writeFileSync(
    configPath,
    JSON.stringify({
      firestore: { rules: join(process.cwd(), RULES_PATH) },
      emulators: {
        auth: { host: HOST, port: AUTH_PORT },
        firestore: { host: HOST, port: FIRESTORE_PORT },
        ui: { enabled: false },
      },
    }),
  )
  const emulators = spawn(
    process.execPath,
    [FIREBASE_CLI, 'emulators:start', '--only', 'auth,firestore', '--project', LOCAL_PROJECT_ID, '--config', configPath],
    { stdio: 'inherit' },
  )
  const exited = new Promise<number>((resolve) => {
    emulators.once('error', (error) => {
      console.error(error.message)
      resolve(1)
    })
    emulators.once('exit', (code) => resolve(code ?? 1))
  })
  let server: Awaited<ReturnType<typeof createServer>> | undefined
  const stop = async () => {
    await server?.close()
    emulators.kill('SIGTERM')
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void stop())

  try {
    await Promise.race([
      Promise.all([waitForPort(FIRESTORE_PORT), waitForPort(AUTH_PORT)]),
      exited.then((code) => {
        throw new Error(`firebase emulators exited with code ${code} before they were ready`)
      }),
    ])
    await seedFirestore(fixtures)
    await seedAuthUsers(users)

    server = await createServer({ mode: 'emulator' })
    await server.listen()
    const [url = ''] = server.resolvedUrls?.local ?? []
    console.log(`\nSeeded scenario "${name}" into ${LOCAL_PROJECT_ID}.`)
    console.log(`App: ${url}`)
    for (const { email } of users) console.log(`Sign in with Google as ${email} (pick this account in the Auth emulator popup).`)
    process.exitCode = await exited
  } catch (error) {
    await stop()
    await exited
    throw error
  } finally {
    rmSync(configDir, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
