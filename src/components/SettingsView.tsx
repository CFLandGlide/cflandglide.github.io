import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useApp } from '../state'
import type { AuditEntry } from '../types'
import { dateTime } from '../lib/format'
import { Button, inputCls, Label } from './ui'
import { describe } from './panel/HistoryTab'

function ListEditor({ title, k, help, usage }: { title: string; k: 'statuses' | 'verification_statuses' | 'note_categories'; help: string; usage?: (name: string) => number }) {
  const { data, saveSetting, updateProperty } = useApp()
  const list = data!.settings[k]
  const [items, setItems] = useState(list)
  const [add, setAdd] = useState('')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setItems(list), [list])
  const dirty = JSON.stringify(items) !== JSON.stringify(list)
  const save = async () => {
    setErr(null)
    const clean = items.map((s) => s.trim()).filter(Boolean)
    if (new Set(clean).size !== clean.length) { setErr('Two entries have the same name.'); return }
    // renamed entries (same position, different text) carry their properties along
    const renames: [string, string][] = []
    list.forEach((old, i) => { if (items[i] !== undefined && items[i].trim() !== old && !list.includes(items[i].trim())) renames.push([old, items[i].trim()]) })
    const removed = list.filter((s) => !clean.includes(s) && !renames.some(([o]) => o === s))
    if (usage) for (const r of removed) if (usage(r) > 0) { setErr(`${usage(r)} record(s) still use “${r}”. Change them first, or rename it instead.`); return }
    if (!(await saveSetting(k, clean))) return
    if (k === 'statuses') for (const [o, n] of renames) for (const p of data!.properties.filter((x) => x.status === o)) await updateProperty(p.id, { status: n })
    if (k === 'verification_statuses') for (const [o, n] of renames) for (const p of data!.properties.filter((x) => x.verification_status === o)) await updateProperty(p.id, { verification_status: n })
  }
  const move = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setItems(n) }
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mb-3 text-[13px] text-ink-2">{help}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input aria-label={`${title} ${i + 1}`} className={inputCls} value={s} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />
            {usage && <span className="w-16 shrink-0 text-right text-[12px] text-ink-3">{usage(list[i] ?? s)} in use</span>}
            <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowUp size={15} /></button>
            <button aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowDown size={15} /></button>
            <button aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded p-1 text-ink-3 hover:text-brick-ink"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim()) { setItems([...items, add.trim()]); setAdd('') } }}>
        <input aria-label={`New ${title}`} className={inputCls} placeholder="Add another" value={add} onChange={(e) => setAdd(e.target.value)} />
        <Button type="submit">Add</Button>
      </form>
      {err && <p role="alert" className="mt-2 text-[13px] text-brick-ink">{err}</p>}
      <div className="mt-3 flex gap-2"><Button kind="primary" disabled={!dirty} onClick={save}>Save {title.toLowerCase()}</Button>{dirty && <Button kind="quiet" onClick={() => setItems(list)}>Undo changes</Button>}</div>
    </section>
  )
}

function MapsSettings() {
  const { data, saveSetting } = useApp()
  const [key, setKey] = useState(data!.settings.maps_api_key ?? '')
  const [mapId, setMapId] = useState(data!.settings.maps_map_id ?? '')
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Google Maps</h2>
      <p className="mb-3 text-[13px] text-ink-2">The map, satellite view, Street View and address checks need a Google Maps key and a Map ID. The key is stored in your private database, not in the website’s code. Restrict it in Google Cloud to this website’s address.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="gk">Maps API key</Label><input id="gk" className={inputCls} value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="AIza…" autoComplete="off" /></div>
        <div><Label htmlFor="gm">Map ID</Label><input id="gm" className={inputCls} value={mapId} onChange={(e) => setMapId(e.target.value.trim())} placeholder="e.g. 8f2c1a7b3d4e5f60" /></div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button kind="primary" onClick={async () => { await saveSetting('maps_api_key', key); await saveSetting('maps_map_id', mapId); if (confirm('Saved. Reload the page now so the map uses the new key?')) location.reload() }}>Save and reload</Button>
        <span className="text-[12px] text-ink-3">APIs to enable: Maps JavaScript API, Geocoding API.</span>
      </div>
    </section>
  )
}

function Team() {
  const { data, store, session, toast, load } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const members = data!.members
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Team</h2>
      <p className="mb-3 text-[13px] text-ink-2">Only these emails can open CFLandGlide. Everyone on the list has full access. Each person also needs a login (email and password) created in Supabase → Authentication → Users.</p>
      <ul className="mb-3 divide-y divide-line-2 rounded-md border border-line">
        {members.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-2 px-3 py-2 text-[13.5px]">
            <span><b>{m.display_name}</b> <span className="text-ink-2">{m.email}</span></span>
            {m.email !== session?.email && <Button small kind="quiet" onClick={async () => { if (!confirm(`Remove ${m.email} from the team? They will lose access.`)) return; try { await store!.removeMember(m.email); await load(); toast('Removed from the team') } catch (e) { toast((e as Error).message, 'error') } }}>Remove</Button>}
          </li>
        ))}
      </ul>
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => {
        e.preventDefault()
        if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid email', 'error'); return }
        try { await store!.addMember({ email, display_name: name || email.split('@')[0], added_by: session?.name }); setEmail(''); setName(''); await load(); toast('Added to the team') } catch (x) { toast((x as Error).message, 'error') }
      }}>
        <input aria-label="Email" className={inputCls} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input aria-label="Name shown on notes" className={inputCls} placeholder="Name shown on notes (e.g. Charley)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Add to team</Button>
      </form>
    </section>
  )
}

function GlobalHistory() {
  const { store, data } = useApp()
  const [rows, setRows] = useState<AuditEntry[]>([])
  useEffect(() => { store!.listAudit(null, 150).then(setRows).catch(() => setRows([])) }, [store, data])
  const props = new Map(data!.properties.map((p) => [p.id, p]))
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Recent changes (all properties)</h2>
      <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto scroll-thin">
        {rows.map((a) => (
          <li key={a.id} className="border-l-2 border-line pl-3 text-[13px]">
            <p>{a.property_id && props.get(a.property_id) ? <b className="font-medium">{props.get(a.property_id)!.address_line ?? props.get(a.property_id)!.account_number ?? a.property_id}: </b> : null}{describe(a)}</p>
            <p className="text-[12px] text-ink-3">{a.changed_by_name ?? 'Unknown'}, {dateTime(a.changed_at)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SettingsView() {
  const data = useApp((s) => s.data)!
  const use = (field: 'status' | 'verification_status') => (n: string) => data.properties.filter((p) => p[field] === n).length
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-5 px-6 py-6 lg:grid-cols-2">
        <h1 className="font-serif text-[26px] font-semibold lg:col-span-2">Settings</h1>
        <div className="lg:col-span-2"><MapsSettings /></div>
        <ListEditor title="Statuses" k="statuses" usage={use('status')} help="The research workflow. Rename an entry to rename it on every property that uses it (each change is logged)." />
        <ListEditor title="Verification levels" k="verification_statuses" usage={use('verification_status')} help="How far a record has been checked." />
        <ListEditor title="Note categories" k="note_categories" help="Optional labels for notes." />
        <Team />
        <div className="lg:col-span-2"><GlobalHistory /></div>
      </div>
    </div>
  )
}
