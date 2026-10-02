import type { AllData, AuditEntry, Member } from '../../types'

export type TableName =
  | 'properties' | 'owners' | 'owner_contacts' | 'relatives' | 'associates' | 'summary_records'
  | 'notes' | 'property_images' | 'data_issues' | 'parcel_lookups' | 'app_settings' | 'app_members'

export interface Session { email: string; name: string }

export class ConflictError extends Error {
  constructor() {
    super('Someone else changed this record since you opened it. Reload to see the latest version, then make your change again.')
  }
}

export interface DataStore {
  readonly mode: 'supabase' | 'local'
  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  onAuthChange(cb: () => void): () => void
  isMember(): Promise<boolean>
  loadAll(): Promise<AllData>
  /** Update one row. When `expectedUpdatedAt` is given, the update only applies if nobody changed the row meanwhile. */
  update<T>(table: TableName, id: string, patch: Partial<T>, expectedUpdatedAt?: string | null): Promise<T>
  insert<T>(table: TableName, row: Partial<T>): Promise<T>
  /** Bulk insert for the importer; existing ids are left untouched. */
  insertMany(table: TableName, rows: Record<string, unknown>[], onConflict?: string): Promise<void>
  upsertLookup(row: Record<string, unknown>): Promise<void>
  saveSetting(key: string, value: unknown): Promise<void>
  addMember(m: Member): Promise<void>
  removeMember(email: string): Promise<void>
  listAudit(propertyId: string | null, limit?: number): Promise<AuditEntry[]>
  logEvent(propertyId: string | null, action: string, note: string): Promise<void>
  uploadFile(path: string, file: Blob, contentType: string): Promise<void>
  fileUrl(path: string): Promise<string>
  fileExists(path: string): Promise<boolean>
}
