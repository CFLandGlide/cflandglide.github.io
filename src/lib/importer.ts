// Imports the prepared source bundle (cflandglide-import.json). Checks everything first; imports nothing if a blocking problem is found.
import type { DataStore, TableName } from './store'

export interface ImportBundle {
  format: 'cflandglide-import'
  version: number
  meta: { name: string; source: string; built_at: string; decisions: string[] }
  tables: Record<string, Record<string, unknown>[]>
  images: { id: string; property_id: string; storage_path: string; content_type: string; sha256: string; base64?: string }[]
  images_separate?: boolean
}

export interface PreCheck { label: string; ok: boolean; detail: string; blocking: boolean }

const ORDER: TableName[] = ['properties', 'owners', 'owner_contacts', 'relatives', 'associates', 'summary_records', 'data_issues', 'notes']

async function sha256(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function b64(s: string) {
  const bin = atob(s); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function readBundle(file: File): Promise<ImportBundle> {
  const text = await file.text()
  let j: ImportBundle
  try { j = JSON.parse(text) } catch { throw new Error('This file is not a CFLandGlide import file.') }
  if (j.format !== 'cflandglide-import') throw new Error('This file is not a CFLandGlide import file.')
  return j
}

export async function preCheck(b: ImportBundle): Promise<PreCheck[]> {
  const t = b.tables
  const checks: PreCheck[] = []
  const props = t.properties ?? []
  const pids = new Set(props.map((p) => p.id as string))
  const dupIds = (rows: Record<string, unknown>[]) => rows.length - new Set(rows.map((r) => r.id)).size
  for (const name of ORDER) {
    const d = dupIds(t[name] ?? [])
    if (d) checks.push({ label: `Unique IDs in ${name}`, ok: false, detail: `${d} duplicate ID(s)`, blocking: true })
  }
  checks.push({ label: 'Unique record IDs', ok: !checks.some((c) => c.label.startsWith('Unique IDs')), detail: 'Every row has its own ID', blocking: true })
  const accts = props.map((p) => p.account_number).filter(Boolean)
  const dupAcct = accts.length - new Set(accts).size
  checks.push({ label: 'Unique account numbers', ok: dupAcct === 0, detail: dupAcct ? `${dupAcct} duplicate(s)` : `${accts.length} account numbers, all different`, blocking: true })
  let orphans = 0
  for (const name of ['owners', 'owner_contacts', 'relatives', 'associates', 'summary_records', 'notes'])
    for (const r of t[name] ?? []) if (!pids.has(r.property_id as string)) orphans++
  checks.push({ label: 'Every person, phone and note belongs to a property in this file', ok: orphans === 0, detail: orphans ? `${orphans} row(s) point to a missing property` : 'All linked', blocking: true })
  const ownerProp = new Map((t.owners ?? []).map((o) => [o.id as string, o.property_id as string]))
  const crossed = (t.owner_contacts ?? []).filter((c) => ownerProp.get(c.owner_id as string) !== c.property_id).length
  checks.push({ label: 'Owner phones sit under the owner of the same property', ok: crossed === 0, detail: crossed ? `${crossed} phone(s) cross properties` : 'All match', blocking: true })
  const phoneProps = new Map<string, Set<string>>()
  const add = (ph: unknown, pid: unknown) => { const k = String(ph ?? '').replace(/\D/g, ''); if (k) phoneProps.set(k, new Set([...(phoneProps.get(k) ?? []), String(pid)])) }
  for (const c of t.owner_contacts ?? []) add(c.phone, c.property_id)
  for (const r of [...(t.relatives ?? []), ...(t.associates ?? [])]) for (const ph of (r.phones as { phone: string }[]) ?? []) add(ph.phone, r.property_id)
  const shared = [...phoneProps.values()].filter((s) => s.size > 1).length
  checks.push({ label: 'No phone number is listed under two different properties', ok: shared === 0, detail: shared ? `${shared} number(s) appear under more than one property — they will stay separate` : `${phoneProps.size} numbers checked`, blocking: false })
  let badImg = 0
  const separate = b.images.filter((im) => !im.base64)
  for (const im of b.images) {
    if (!pids.has(im.property_id)) badImg++
    else if (im.base64 && (await sha256(b64(im.base64))) !== im.sha256) badImg++
  }
  checks.push({ label: 'Images are intact and each belongs to its property', ok: badImg === 0,
    detail: badImg ? `${badImg} image(s) failed` : separate.length
      ? `${separate.length} images are added on the next screen, where each is matched to its property by fingerprint`
      : `${b.images.length} images match their original fingerprints`, blocking: true })
  return checks
}

export async function runImport(store: DataStore, b: ImportBundle, progress: (msg: string) => void) {
  for (const name of ORDER) {
    const rows = b.tables[name] ?? []
    progress(`Saving ${rows.length} ${name.replace('_', ' ')}…`)
    await store.insertMany(name, rows)
  }
  let i = 0
  const withFiles = b.images.filter((im) => im.base64)
  for (const im of withFiles) {
    progress(`Uploading image ${++i} of ${withFiles.length}…`)
    await store.uploadFile(im.storage_path, new Blob([b64(im.base64!) as BlobPart], { type: im.content_type }), im.content_type)
  }
  progress('Saving image records…')
  await store.insertMany('property_images', b.tables.property_images ?? [])
  await store.logEvent(null, 'import', `Imported source document: ${b.meta.source}`)
}

export async function fileFingerprint(f: Blob) {
  return sha256(new Uint8Array(await f.arrayBuffer()))
}
