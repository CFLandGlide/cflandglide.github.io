import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AllData, AuditEntry, Member, Settings } from '../../types'
import { ConflictError, type DataStore, type Session, type TableName } from './types'

const PK: Partial<Record<TableName, string>> = { app_settings: 'key', app_members: 'email', parcel_lookups: 'property_id' }
const BUCKET = 'property-images'

export const DEFAULT_SETTINGS: Settings = {
  statuses: ['New', 'Researching', 'Needs Verification', 'Contacted', 'Follow Up', 'Interested', 'Not Interested', 'Complete'],
  verification_statuses: ['Unverified', 'Partially verified', 'Verified'],
  note_categories: ['General', 'Call', 'Research', 'Site visit', 'Follow-up'],
  county_parcel_service:
    'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_WebMercator/FeatureServer/0',
}

export function settingsFromRows(rows: { key: string; value: unknown }[]): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS }
  for (const r of rows) (s as unknown as Record<string, unknown>)[r.key] = r.value
  return s
}

export class SupabaseStore implements DataStore {
  readonly mode = 'supabase' as const
  private sb: SupabaseClient
  private urlCache = new Map<string, { url: string; exp: number }>()

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  }

  private fail(error: { message: string } | null, what: string): never | void {
    if (error) throw new Error(`${what}: ${error.message}`)
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession()
    const email = data.session?.user.email?.toLowerCase()
    if (!email) return null
    const { data: m } = await this.sb.from('app_members').select('display_name').eq('email', email).maybeSingle()
    return { email, name: (m?.display_name as string) || email }
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password don’t match a login.' : error.message)
  }

  async signOut() { await this.sb.auth.signOut() }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => cb())
    return () => data.subscription.unsubscribe()
  }

  async isMember() {
    const { data, error } = await this.sb.rpc('is_member')
    if (error) return false
    return data === true
  }

  private async all<T>(table: TableName, order = 'id'): Promise<T[]> {
    const out: T[] = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await this.sb.from(table).select('*').order(order).range(from, from + page - 1)
      this.fail(error, `Loading ${table}`)
      out.push(...((data ?? []) as T[]))
      if (!data || data.length < page) break
    }
    return out
  }

  async loadAll(): Promise<AllData> {
    const [properties, owners, owner_contacts, relatives, associates, summary_records, notes, property_images, data_issues, parcel_lookups, settings, members] =
      await Promise.all([
        this.all<AllData['properties'][number]>('properties'),
        this.all<AllData['owners'][number]>('owners'),
        this.all<AllData['owner_contacts'][number]>('owner_contacts'),
        this.all<AllData['relatives'][number]>('relatives'),
        this.all<AllData['associates'][number]>('associates'),
        this.all<AllData['summary_records'][number]>('summary_records'),
        this.all<AllData['notes'][number]>('notes'),
        this.all<AllData['property_images'][number]>('property_images'),
        this.all<AllData['data_issues'][number]>('data_issues'),
        this.all<AllData['parcel_lookups'][number]>('parcel_lookups', 'property_id'),
        this.all<{ key: string; value: unknown }>('app_settings', 'key'),
        this.all<Member>('app_members', 'email'),
      ])
    return {
      properties, owners, owner_contacts, relatives, associates, summary_records,
      notes: notes.filter((n) => !n.deleted_at), property_images, data_issues, parcel_lookups,
      settings: settingsFromRows(settings), members,
    }
  }

  async update<T>(table: TableName, id: string, patch: Partial<T>, expectedUpdatedAt?: string | null): Promise<T> {
    let q = this.sb.from(table).update(patch as Record<string, unknown>).eq(PK[table] ?? 'id', id)
    if (expectedUpdatedAt) q = q.eq('updated_at', expectedUpdatedAt)
    const { data, error } = await q.select().maybeSingle()
    this.fail(error, 'Saving')
    if (!data) {
      if (expectedUpdatedAt) throw new ConflictError()
      throw new Error('Saving: this change was not allowed.')
    }
    return data as T
  }

  async insert<T>(table: TableName, row: Partial<T>): Promise<T> {
    const { data, error } = await this.sb.from(table).insert(row as Record<string, unknown>).select().single()
    this.fail(error, 'Saving')
    return data as T
  }

  async insertMany(table: TableName, rows: Record<string, unknown>[], onConflict = 'id') {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await this.sb.from(table).upsert(rows.slice(i, i + 200), { onConflict, ignoreDuplicates: true, defaultToNull: false })
      this.fail(error, `Importing ${table}`)
    }
  }

  async upsertLookup(row: Record<string, unknown>) {
    const { error } = await this.sb.from('parcel_lookups').upsert(row, { onConflict: 'property_id' })
    this.fail(error, 'Saving parcel lookup')
  }

  async saveSetting(key: string, value: unknown) {
    const { error } = await this.sb.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
    this.fail(error, 'Saving setting')
  }

  async addMember(m: Member) {
    const { error } = await this.sb.from('app_members').insert({ email: m.email.toLowerCase().trim(), display_name: m.display_name.trim(), added_by: m.added_by ?? null })
    this.fail(error, 'Adding team member')
  }

  async removeMember(email: string) {
    const { error } = await this.sb.from('app_members').delete().eq('email', email)
    this.fail(error, 'Removing team member')
  }

  async listAudit(propertyId: string | null, limit = 300): Promise<AuditEntry[]> {
    let q = this.sb.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(limit)
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data, error } = await q
    this.fail(error, 'Loading history')
    return (data ?? []) as AuditEntry[]
  }

  async logEvent(propertyId: string | null, action: string, note: string) {
    const s = await this.getSession()
    await this.sb.from('audit_log').insert({ table_name: 'event', property_id: propertyId, action, note, changed_by_name: s?.name ?? null })
  }

  async uploadFile(path: string, file: Blob, contentType: string) {
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType, upsert: false })
    if (error && !/already exists|Duplicate/i.test(error.message)) throw new Error(`Uploading image: ${error.message}`)
  }

  async fileExists(path: string) {
    const i = path.lastIndexOf('/')
    const { data } = await this.sb.storage.from(BUCKET).list(path.slice(0, i), { search: path.slice(i + 1), limit: 100 })
    return !!data?.some((f) => f.name === path.slice(i + 1))
  }

  async fileUrl(path: string) {
    const c = this.urlCache.get(path)
    if (c && c.exp > Date.now()) return c.url
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 3600)
    this.fail(error, 'Loading image')
    this.urlCache.set(path, { url: data!.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
    return data!.signedUrl
  }
}
