// Local test store — used ONLY for local development/testing (VITE_LOCAL_TEST=1).
// It mirrors the database rules in supabase/setup.sql so behaviour can be tested without a server.
// Data lives in this browser's IndexedDB only. It is never part of the deployed site.
import type { AllData, AuditEntry, Member } from '../../types'
import { DEFAULT_SETTINGS, settingsFromRows } from './supabaseStore'
import { ConflictError, type DataStore, type Session, type TableName } from './types'

type Row = Record<string, unknown>
type DB = Record<TableName | 'audit_log', Row[]>

const PK: Partial<Record<TableName, string>> = { app_settings: 'key', app_members: 'email', parcel_lookups: 'property_id' }
const TABLES: (TableName | 'audit_log')[] = ['properties', 'owners', 'owner_contacts', 'relatives', 'associates', 'summary_records', 'notes',
  'property_images', 'data_issues', 'parcel_lookups', 'app_settings', 'app_members', 'audit_log']
const SOURCE_TABLES: TableName[] = ['properties', 'owners', 'owner_contacts', 'relatives', 'associates']
const CHILD_TABLES: TableName[] = ['owners', 'owner_contacts', 'relatives', 'associates', 'notes', 'property_images']

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cflandglide-local-test', 1)
    r.onupgradeneeded = () => { r.result.createObjectStore('kv') }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function kvGet<T>(k: string): Promise<T | undefined> {
  const d = await idb()
  return new Promise((res) => { const t = d.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result as T); t.onerror = () => res(undefined) })
}
async function kvSet(k: string, v: unknown) {
  const d = await idb()
  return new Promise<void>((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}

const now = () => new Date().toISOString()
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

export class LocalStore implements DataStore {
  readonly mode = 'local' as const
  private db: DB | null = null
  private listeners = new Set<() => void>()
  private auditId = 1

  private async load(): Promise<DB> {
    if (this.db) return this.db
    const saved = await kvGet<DB>('db')
    if (saved) this.db = saved
    else {
      this.db = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB
      this.db.app_members.push({ email: 'nicholle@local.test', display_name: 'Nicholle', added_at: now(), added_by: 'setup' })
      this.db.app_members.push({ email: 'charley@local.test', display_name: 'Charley', added_at: now(), added_by: 'setup' })
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) this.db.app_settings.push({ key: k, value: v, updated_at: now() })
      await this.persist()
    }
    this.auditId = Math.max(0, ...this.db.audit_log.map((a) => Number(a.id))) + 1
    return this.db
  }
  private async persist() { await kvSet('db', this.db) }

  private sessionEmail(): string | null { return localStorage.getItem('cfl-local-session') }
  private async who() {
    const db = await this.load(); const e = this.sessionEmail()
    return (db.app_members.find((m) => m.email === e)?.display_name as string) ?? e ?? 'system'
  }
  private async member() {
    const db = await this.load(); const e = this.sessionEmail()
    if (!e || !db.app_members.some((m) => m.email === e)) throw new Error('Not allowed: this login is not on the team list.')
  }

  async getSession(): Promise<Session | null> {
    const e = this.sessionEmail(); if (!e) return null
    return { email: e, name: await this.who() }
  }
  async signIn(email: string, password: string) {
    const db = await this.load()
    const e = email.trim().toLowerCase()
    if (password !== 'local-test' || !db.app_members.some((m) => m.email === e)) throw new Error('That email and password don’t match a login.')
    localStorage.setItem('cfl-local-session', e)
    this.listeners.forEach((l) => l())
  }
  async signOut() { localStorage.removeItem('cfl-local-session'); this.listeners.forEach((l) => l()) }
  onAuthChange(cb: () => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb) } }
  async isMember() { try { await this.member(); return true } catch { return false } }

  async loadAll(): Promise<AllData> {
    await this.member()
    const db = clone(await this.load())
    const sorted = <T>(t: TableName, k = 'id') => (db[t] as Row[]).sort((a, b) => String(a[k]).localeCompare(String(b[k]))) as unknown as T
    return {
      properties: sorted('properties'), owners: sorted('owners'), owner_contacts: sorted('owner_contacts'), relatives: sorted('relatives'),
      associates: sorted('associates'), summary_records: sorted('summary_records'),
      notes: (sorted('notes') as unknown as AllData['notes']).filter((n) => !n.deleted_at),
      property_images: sorted('property_images'), data_issues: sorted('data_issues'), parcel_lookups: sorted('parcel_lookups', 'property_id'),
      settings: settingsFromRows(db.app_settings as { key: string; value: unknown }[]), members: db.app_members as unknown as Member[],
    }
  }

  private async audit(table: string, row: Row, action: string, field: string | null, oldV: unknown, newV: unknown) {
    const db = await this.load()
    db.audit_log.push({ id: this.auditId++, table_name: table, row_id: String(row[PK[table as TableName] ?? 'id']),
      property_id: table === 'properties' ? row.id : row.property_id ?? null, action, field,
      old_value: field === 'geometry' && oldV ? '(parcel outline)' : oldV ?? null, new_value: field === 'geometry' && newV ? '(parcel outline)' : newV ?? null,
      note: null, changed_by_name: await this.who(), changed_at: now() })
  }

  async update<T>(table: TableName, id: string, patch: Partial<T>, expectedUpdatedAt?: string | null): Promise<T> {
    await this.member()
    const db = await this.load()
    const pk = PK[table] ?? 'id'
    const row = db[table].find((r) => r[pk] === id)
    if (!row) throw new Error('Saving: this change was not allowed.')
    if (table === 'summary_records') throw new Error('Saving: this change was not allowed.')
    if (expectedUpdatedAt && row.updated_at !== expectedUpdatedAt) throw new ConflictError()
    const p = patch as Row
    if (SOURCE_TABLES.includes(table) && row.source_values && 'source_values' in p && JSON.stringify(p.source_values) !== JSON.stringify(row.source_values))
      throw new Error('Original source values cannot be changed.')
    if (CHILD_TABLES.includes(table) && 'property_id' in p && p.property_id !== row.property_id) throw new Error('Records cannot be moved to a different property.')
    if (table === 'property_images' && row.is_source && ['storage_path', 'sha256', 'source', 'is_source', 'image_reading'].some((k) => k in p && JSON.stringify(p[k]) !== JSON.stringify(row[k])))
      throw new Error('Source-document images cannot be replaced.')
    if (table === 'data_issues' && ['property_id', 'severity', 'category', 'field', 'title', 'detail', 'issue_values'].some((k) => k in p && JSON.stringify(p[k]) !== JSON.stringify(row[k])))
      throw new Error('Review items cannot be rewritten. Only their status and resolution can change.')
    const skip = new Set(['updated_at', 'updated_by_name', 'created_at', 'created_by_name', 'created_by', 'resolved_by_name', 'resolved_at', 'reviewed_at', 'reviewed_by_name', 'location_checked_at'])
    for (const [k, v] of Object.entries(p)) {
      if (k === pk || k === 'created_at' || k === 'created_by_name') continue
      if (JSON.stringify(row[k] ?? null) !== JSON.stringify(v ?? null)) {
        if (!skip.has(k)) await this.audit(table, row, 'update', k, row[k], v)
        row[k] = v
      }
    }
    if (table === 'data_issues' && 'status' in p) { row.resolved_by_name = await this.who(); row.resolved_at = p.status === 'open' ? null : now() }
    if (table !== 'parcel_lookups') { row.updated_at = now(); row.updated_by_name = await this.who() }
    await this.persist()
    return clone(row) as T
  }

  async insert<T>(table: TableName, row: Partial<T>): Promise<T> {
    await this.member()
    const db = await this.load()
    const r = { ...(row as Row) }
    const pk = PK[table] ?? 'id'
    if (!r[pk]) r[pk] = crypto.randomUUID()
    if (db[table].some((x) => x[pk] === r[pk])) throw new Error('Saving: a record with this ID already exists.')
    if (table === 'properties' && r.account_number && db.properties.some((x) => x.account_number === r.account_number))
      throw new Error('Saving: duplicate key value violates unique constraint "properties_account_number_key"')
    if (table === 'notes') {
      if (!String(r.body ?? '').trim()) throw new Error('A note cannot be empty.')
      if (!r.is_import) { r.created_by_name = await this.who(); r.created_at = now() }
      r.updated_at = null; r.deleted_at = null; r.is_import = !!r.is_import
    } else if (table === 'property_images') {
      r.uploaded_by_name = r.uploaded_by_name ?? await this.who(); r.uploaded_at = r.uploaded_at ?? now()
      r.archived = !!r.archived
    } else {
      r.created_at = r.created_at ?? now(); r.updated_at = now(); r.created_by_name = r.created_by_name ?? await this.who()
    }
    if (table === 'owner_contacts' && !db.owners.some((o) => o.id === r.owner_id && o.property_id === r.property_id))
      throw new Error('Saving: a contact can only belong to an owner of the same property.')
    db[table].push(r)
    if (!(r.source_values || r.is_import || r.is_source || r.created_by_name === 'Imported from source document')) await this.audit(table, r, 'insert', null, null, null)
    await this.persist()
    return clone(r) as T
  }

  async insertMany(table: TableName, rows: Row[], onConflict = 'id') {
    await this.member()
    const db = await this.load()
    for (const r of rows) {
      if (db[table].some((x) => x[onConflict] === r[onConflict])) continue
      db[table].push({ archived: false, created_at: now(), updated_at: now(), ...clone(r) })
    }
    await this.persist()
  }

  async upsertLookup(row: Row) {
    await this.member()
    const db = await this.load()
    const i = db.parcel_lookups.findIndex((x) => x.property_id === row.property_id)
    if (i >= 0) db.parcel_lookups[i] = { ...db.parcel_lookups[i], ...clone(row), updated_at: now() }
    else db.parcel_lookups.push({ ...clone(row), updated_at: now() })
    await this.persist()
  }

  async saveSetting(key: string, value: unknown) {
    await this.member()
    const db = await this.load()
    const r = db.app_settings.find((x) => x.key === key)
    if (r) { await this.audit('app_settings', r, 'update', 'value', r.value, value); r.value = value; r.updated_at = now() }
    else db.app_settings.push({ key, value, updated_at: now() })
    await this.persist()
  }

  async addMember(m: Member) {
    await this.member()
    const db = await this.load()
    const email = m.email.trim().toLowerCase()
    if (db.app_members.some((x) => x.email === email)) throw new Error('Adding team member: that email is already on the team.')
    const r = { email, display_name: m.display_name.trim(), added_at: now(), added_by: m.added_by ?? null }
    db.app_members.push(r); await this.audit('app_members', r, 'insert', null, null, r); await this.persist()
  }
  async removeMember(email: string) {
    await this.member()
    const db = await this.load()
    const r = db.app_members.find((x) => x.email === email)
    db.app_members = db.app_members.filter((x) => x.email !== email)
    if (r) await this.audit('app_members', r, 'delete', null, r, null)
    await this.persist()
  }

  async listAudit(propertyId: string | null, limit = 300): Promise<AuditEntry[]> {
    await this.member()
    const db = await this.load()
    return clone(db.audit_log.filter((a) => !propertyId || a.property_id === propertyId).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit)) as unknown as AuditEntry[]
  }
  async logEvent(propertyId: string | null, action: string, note: string) {
    const db = await this.load()
    db.audit_log.push({ id: this.auditId++, table_name: 'event', row_id: null, property_id: propertyId, action, field: null, old_value: null, new_value: null, note, changed_by_name: await this.who(), changed_at: now() })
    await this.persist()
  }

  async uploadFile(path: string, file: Blob) {
    await this.member()
    if (await kvGet('file:' + path)) return
    await kvSet('file:' + path, file)
  }
  async fileUrl(path: string) {
    const f = await kvGet<Blob>('file:' + path)
    if (!f) throw new Error('Loading image: file not found')
    return URL.createObjectURL(f)
  }
}
