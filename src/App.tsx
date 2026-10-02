import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from './state'
import { APP_NAME, LOCAL_TEST } from './config'
import { Button, inputCls, Label, Toasts } from './components/ui'
import { TopBar } from './components/TopBar'
import { MapView } from './components/MapView'
import { Sidebar } from './components/Sidebar'
import { TableView } from './components/TableView'
import { PropertyPanel } from './components/panel/PropertyPanel'
import { ReviewQueue } from './components/ReviewQueue'
import { DataCheck } from './components/DataCheck'
import { SettingsView } from './components/SettingsView'
import { ImportScreen } from './components/ImportScreen'
import { classNames } from './lib/format'

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1F3B33" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#E5397A" strokeWidth="3" />
      <circle cx="16" cy="16" r="2.6" fill="#fff" />
    </svg>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5"><Mark /><span className="font-serif text-[22px] font-semibold">{APP_NAME}</span></div>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const store = useApp((s) => s.store)!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { await store.signIn(email, password) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Centered>
      <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-5">
        <h1 className="mb-1 text-[16px] font-semibold">Log in</h1>
        <p className="mb-4 text-[13px] text-ink-2">Private property research. Only people on the team list can open it.</p>
        <Label htmlFor="em">Email</Label>
        <input id="em" type="email" autoComplete="username" required className={classNames(inputCls, 'mb-3')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Label htmlFor="pw">Password</Label>
        <input id="pw" type="password" autoComplete="current-password" required className={classNames(inputCls, 'mb-4')} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p role="alert" className="mb-3 rounded-md bg-brick-bg px-3 py-2 text-[13px] text-brick-ink">{err}</p>}
        <Button kind="primary" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
        {LOCAL_TEST && <p className="mt-3 text-[12px] text-ink-3">Local test mode: password is <b>local-test</b>.</p>}
      </form>
    </Centered>
  )
}

export default function App() {
  const { ready, store, session, member, data, loadError, view, selectedId, busy } = useApp()
  const init = useApp((s) => s.init)
  useEffect(() => { void init() }, [init])

  if (!ready) return <Centered><p className="text-ink-2">Loading…</p></Centered>
  if (!store) return (
    <Centered>
      <div className="rounded-lg border border-line bg-surface p-5 text-[13.5px]">
        <h1 className="mb-1 text-[16px] font-semibold">Database not connected yet</h1>
        <p className="text-ink-2">This copy of the app was built without its database address. Add the Supabase URL and public key to the build settings, then publish again.</p>
      </div>
    </Centered>
  )
  if (!session) return <><Login /><Toasts /></>
  if (!member) return (
    <Centered>
      <div className="rounded-lg border border-line bg-surface p-5 text-[13.5px]">
        <h1 className="mb-1 text-[16px] font-semibold">This login isn’t on the team list</h1>
        <p className="mb-4 text-ink-2">You’re logged in as <b>{session.email}</b>, but that email hasn’t been added to CFLandGlide. Ask a team member to add it in Settings → Team.</p>
        <Button onClick={() => store.signOut()}>Log out</Button>
      </div>
    </Centered>
  )
  if (loadError) return (
    <Centered>
      <div className="rounded-lg border border-line bg-surface p-5 text-[13.5px]">
        <h1 className="mb-1 text-[16px] font-semibold">The data didn’t load</h1>
        <p className="mb-4 text-ink-2">{loadError}</p>
        <Button onClick={() => useApp.getState().load()}>Try again</Button>
      </div>
    </Centered>
  )
  if (!data) return <Centered><p className="text-ink-2">Loading properties…</p></Centered>
  if (!data.properties.length) return <><ImportScreen /><Toasts /></>

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {busy && <div role="status" className="border-b border-line bg-pine-50 px-4 py-1.5 text-[13px] text-ink">{busy}</div>}
      <main className="flex min-h-0 flex-1">
        <div className={classNames('min-w-0 flex-1', view === 'map' ? 'flex' : 'hidden')}><MapView /></div>
        {view === 'map' && <aside className="w-[min(540px,44vw)] shrink-0 border-l border-line bg-surface">{selectedId ? <PropertyPanel /> : <Sidebar />}</aside>}
        {view === 'list' && (
          <>
            <div className="min-w-0 flex-1"><TableView /></div>
            {selectedId && <aside className="w-[min(540px,44vw)] shrink-0 border-l border-line bg-surface"><PropertyPanel /></aside>}
          </>
        )}
        {view === 'review' && <div className="min-w-0 flex-1"><ReviewQueue /></div>}
        {view === 'check' && <div className="min-w-0 flex-1"><DataCheck /></div>}
        {view === 'settings' && <div className="min-w-0 flex-1"><SettingsView /></div>}
      </main>
      <Toasts />
    </div>
  )
}
