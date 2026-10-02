import { create } from 'zustand'
import type { AllData, DataIssue, Note, Property, PropertyImage } from './types'
import { createStore, type DataStore, type Session, type TableName } from './lib/store'
import { EMPTY_FILTERS, type Filters } from './lib/search'
import { COUNTY_SOURCE, countyAddress, fetchCountyParcel } from './lib/county'

export type View = 'map' | 'list' | 'review' | 'check' | 'settings'

interface Toast { id: number; text: string; kind: 'ok' | 'error' }

interface AppState {
  store: DataStore | null
  ready: boolean
  session: Session | null
  member: boolean
  data: AllData | null
  loadError: string | null
  view: View
  selectedId: string | null
  panelTab: string
  query: string
  filters: Filters
  revealed: Record<string, boolean>
  toasts: Toast[]
  busy: string | null

  init(): Promise<void>
  refreshSession(): Promise<void>
  load(): Promise<void>
  setView(v: View): void
  select(id: string | null, tab?: string): void
  setTab(t: string): void
  setQuery(q: string): void
  setFilters(f: Partial<Filters>): void
  clearFilters(): void
  reveal(id: string): void
  toast(text: string, kind?: 'ok' | 'error'): void

  updateProperty(id: string, patch: Partial<Property>, what?: string): Promise<boolean>
  updateRow<T extends { id: string }>(table: TableName, id: string, patch: Partial<T>, what?: string): Promise<boolean>
  addProperty(p: Partial<Property>, ownerName: string, mailing: string): Promise<string | null>
  addNote(pid: string, body: string, category: string | null): Promise<boolean>
  editNote(n: Note, body: string, category: string | null): Promise<boolean>
  deleteNote(n: Note): Promise<boolean>
  setIssueStatus(issue: DataIssue & { live?: boolean }, status: DataIssue['status'], note: string): Promise<boolean>
  uploadImage(pid: string, file: File, caption: string): Promise<boolean>
  saveSetting(key: string, value: unknown): Promise<boolean>
  locateParcels(onlyMissing: boolean): Promise<void>
}

let toastId = 1
const mergeRow = <T extends { id: string }>(list: T[], row: T) => {
  const i = list.findIndex((r) => r.id === row.id)
  return i >= 0 ? list.map((r, j) => (j === i ? row : r)) : [...list, row]
}

export const useApp = create<AppState>((set, get) => ({
  store: null, ready: false, session: null, member: false, data: null, loadError: null,
  view: 'map', selectedId: null, panelTab: 'overview', query: '', filters: EMPTY_FILTERS, revealed: {},
  toasts: [], busy: null,

  async init() {
    const store = await createStore()
    set({ store })
    if (!store) { set({ ready: true }); return }
    store.onAuthChange(() => { void get().refreshSession() })
    await get().refreshSession()
    set({ ready: true })
  },

  async refreshSession() {
    const store = get().store!
    const session = await store.getSession()
    const member = session ? await store.isMember() : false
    const changed = session?.email !== get().session?.email
    set({ session, member })
    if (session && member && (changed || !get().data)) await get().load()
    if (!session) set({ data: null })
  },

  async load() {
    try {
      const data = await get().store!.loadAll()
      set({ data, loadError: null })
    } catch (e) {
      set({ loadError: (e as Error).message })
    }
  },

  setView: (view) => set({ view }),
  select: (selectedId, tab) => set({ selectedId, panelTab: tab ?? (selectedId === get().selectedId ? get().panelTab : 'overview') }),
  setTab: (panelTab) => set({ panelTab }),
  setQuery: (query) => set({ query }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  reveal: (id) => set({ revealed: { ...get().revealed, [id]: !get().revealed[id] } }),
  toast(text, kind = 'ok') {
    const id = toastId++
    set({ toasts: [...get().toasts, { id, text, kind }].slice(-2) })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 8000 : 2600)
  },

  async updateProperty(id, patch, what) {
    const d = get().data!
    const cur = d.properties.find((p) => p.id === id)!
    try {
      const row = await get().store!.update<Property>('properties', id, patch, cur.updated_at)
      set({ data: { ...get().data!, properties: mergeRow(get().data!.properties, row) } })
      if (what) get().toast(what)
      return true
    } catch (e) {
      get().toast((e as Error).message, 'error')
      return false
    }
  },

  async updateRow(table, id, patch, what) {
    const key = table as keyof AllData
    const list = get().data![key] as unknown as { id: string; updated_at?: string }[]
    const cur = list.find((r) => r.id === id)
    try {
      const row = await get().store!.update<{ id: string }>(table, id, patch, cur?.updated_at ?? null)
      set({ data: { ...get().data!, [key]: mergeRow(get().data![key] as unknown as { id: string }[], row) } })
      if (what) get().toast(what)
      return true
    } catch (e) {
      get().toast((e as Error).message, 'error')
      return false
    }
  },

  async addProperty(p, ownerName, mailing) {
    const store = get().store!
    const id = `M-${crypto.randomUUID().slice(0, 8)}`
    try {
      const prop = await store.insert<Property>('properties', { ...p, id, record_type: 'manual', status: p.status ?? 'New' })
      const owner = ownerName || mailing ? await store.insert('owners', { id: `${id}-O1`, property_id: id, owner_name: ownerName || null, mailing_address: mailing || null }) : null
      const d = get().data!
      set({ data: { ...d, properties: [...d.properties, prop], owners: owner ? [...d.owners, owner as AllData['owners'][number]] : d.owners } })
      get().toast('Property added')
      return id
    } catch (e) {
      get().toast((e as Error).message, 'error')
      return null
    }
  },

  async addNote(pid, body, category) {
    try {
      const n = await get().store!.insert<Note>('notes', { property_id: pid, body: body.trim(), category })
      set({ data: { ...get().data!, notes: [...get().data!.notes, n] } })
      get().toast('Note added')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },
  async editNote(n, body, category) {
    try {
      const row = await get().store!.update<Note>('notes', n.id, { body: body.trim(), category })
      set({ data: { ...get().data!, notes: mergeRow(get().data!.notes, row) } })
      get().toast('Note updated')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },
  async deleteNote(n) {
    try {
      await get().store!.update<Note>('notes', n.id, { deleted_at: new Date().toISOString() })
      set({ data: { ...get().data!, notes: get().data!.notes.filter((x) => x.id !== n.id) } })
      get().toast('Note removed (kept in history)')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },

  async setIssueStatus(issue, status, note) {
    const store = get().store!
    try {
      let row: DataIssue
      if (issue.live && !get().data!.data_issues.some((i) => i.id === issue.id)) {
        // a live check becomes a stored review item the first time someone reviews it
        row = await store.insert<DataIssue>('data_issues', {
          id: issue.id, property_id: issue.property_id, related_property_ids: issue.related_property_ids ?? [], severity: issue.severity,
          category: issue.category, field: issue.field, title: issue.title, detail: issue.detail, issue_values: issue.issue_values,
        })
        row = await store.update<DataIssue>('data_issues', row.id, { status, resolution_note: note || null })
      } else {
        row = await store.update<DataIssue>('data_issues', issue.id, { status, resolution_note: note || null })
      }
      set({ data: { ...get().data!, data_issues: mergeRow(get().data!.data_issues, row) } })
      get().toast(status === 'open' ? 'Reopened' : status === 'resolved' ? 'Marked resolved' : 'Marked as accepted')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },

  async uploadImage(pid, file, caption) {
    const store = get().store!
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
      const path = `uploads/${pid}/${crypto.randomUUID().slice(0, 8)}-${safe}`
      await store.uploadFile(path, file, file.type || 'application/octet-stream')
      const row = await store.insert<PropertyImage>('property_images', { property_id: pid, storage_path: path, file_name: file.name, caption: caption || null, source: 'Uploaded in app', is_source: false })
      set({ data: { ...get().data!, property_images: [...get().data!.property_images, row] } })
      get().toast('Image added')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },

  async saveSetting(key, value) {
    try {
      await get().store!.saveSetting(key, value)
      set({ data: { ...get().data!, settings: { ...get().data!.settings, [key]: value } } })
      get().toast('Saved')
      return true
    } catch (e) { get().toast((e as Error).message, 'error'); return false }
  },

  async locateParcels(onlyMissing) {
    const store = get().store!
    const d = get().data!
    const lookups = new Map(d.parcel_lookups.map((l) => [l.property_id, l]))
    const targets = d.properties.filter((p) => p.record_type !== 'unidentified' && !p.archived && p.parcel_number && p.location_status !== 'manual'
      && (!onlyMissing || !lookups.get(p.id) || lookups.get(p.id)?.status === 'error'))
    let found = 0, missing = 0, failed = 0
    for (const [i, p] of targets.entries()) {
      set({ busy: `Looking up parcel ${i + 1} of ${targets.length} with the county…` })
      const r = await fetchCountyParcel(d.settings.county_parcel_service, p.parcel_number!)
      const fetched_at = new Date().toISOString()
      const prev = lookups.get(p.id)
      await store.upsertLookup({ property_id: p.id, parcel_id: p.parcel_number, source: COUNTY_SOURCE, fetched_at, status: r.status,
        attributes: r.attributes ?? null, geometry: r.geometry ?? null, centroid_lat: r.centroid?.lat ?? null, centroid_lng: r.centroid?.lng ?? null,
        error: r.error ?? null, geocode: prev?.geocode ?? null, geocode_checked_at: prev?.geocode_checked_at ?? null })
      const fresh = get().data!.properties.find((x) => x.id === p.id)!
      if (r.status === 'found' && r.centroid) {
        found++
        // An exact address is confirmed only when the county's own record for this parcel lists the same site address
        const norm = (x: string | null | undefined) => String(x ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
        const ca = countyAddress(r.attributes)
        const status = fresh.address_status === 'exact' && ca && norm(ca) === norm(fresh.address_line) ? 'exact_confirmed' : 'parcel_located'
        await get().updateProperty(p.id, { lat: r.centroid.lat, lng: r.centroid.lng, geometry: r.geometry ?? null, location_source: COUNTY_SOURCE,
          location_checked_at: fetched_at, location_status: status })
      } else if (r.status === 'error') {
        failed++
      } else {
        missing++
        await get().updateProperty(p.id, { location_status: 'not_confirmed', location_checked_at: fetched_at })
      }
    }
    await get().load()
    set({ busy: null })
    if (targets.length) {
      get().toast(`County lookup: ${found} located, ${missing} not found${failed ? `, ${failed} failed (try again)` : ''}`, failed ? 'error' : 'ok')
      await store.logEvent(null, 'locate', `County parcel lookup: ${found} located, ${missing} not found, ${failed} failed`)
    }
  }
}))
