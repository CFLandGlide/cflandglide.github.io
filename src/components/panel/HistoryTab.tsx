import { useEffect, useState } from 'react'
import { useApp } from '../../state'
import type { AuditEntry, Property } from '../../types'
import { dateTime } from '../../lib/format'
import { Empty, Section } from '../ui'

const FIELD_LABEL: Record<string, string> = {
  status: 'Status', contacted: 'Contacted', follow_up_date: 'Follow-up date', verification_status: 'Verification', reviewed: 'Reviewed',
  owner_name: 'Owner name', mailing_address: 'Mailing address', body: 'Note text', category: 'Note category', deleted_at: 'Note removed',
  location_status: 'Location status', lat: 'Latitude', lng: 'Longitude', geometry: 'Parcel outline', location_source: 'Location source',
  caption: 'Image caption', image_notes: 'Image notes', resolution_note: 'Review note', address_line: 'Street address', last_sale_date: 'Last sale date',
  last_sale_price: 'Last sale price', acreage: 'Acreage', research_notes: 'Research notes', property_type: 'Property type',
}
const TABLE_LABEL: Record<string, string> = { properties: 'Property', owners: 'Owner', owner_contacts: 'Owner phone', relatives: 'Relative', associates: 'Associate',
  notes: 'Note', property_images: 'Image', data_issues: 'Review item', event: 'Event' }

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(blank)'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') return v.length > 140 ? v.slice(0, 140) + '…' : v
  if (typeof v === 'number') return String(v)
  return JSON.stringify(v).slice(0, 140)
}

export function describe(a: AuditEntry) {
  if (a.table_name === 'event') return a.note ?? a.action
  const t = TABLE_LABEL[a.table_name] ?? a.table_name
  if (a.action === 'insert') return `${t} added`
  if (a.action === 'delete') return `${t} removed`
  const f = FIELD_LABEL[a.field ?? ''] ?? a.field
  if (a.field === 'deleted_at') return 'Note removed (text kept in history)'
  return `${t === 'Property' ? '' : t + ': '}${f} changed from ${fmtVal(a.old_value)} to ${fmtVal(a.new_value)}`
}

export function HistoryTab({ p }: { p: Property }) {
  const store = useApp((s) => s.store)!
  const data = useApp((s) => s.data)
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { store.listAudit(p.id).then(setRows).catch((e) => setErr(e.message)) }, [store, p.id, data])
  return (
    <Section title="History of changes">
      {err && <p className="text-brick-ink">{err}</p>}
      {rows && !rows.length && <Empty title="No changes yet">Imported source values are the starting point. Every change after that is listed here with who made it and when.</Empty>}
      <ol className="space-y-2">
        {rows?.map((a) => (
          <li key={a.id} className="border-l-2 border-line pl-3">
            <p className="text-[13.5px]">{describe(a)}</p>
            <p className="text-[12px] text-ink-3">{a.changed_by_name ?? 'Unknown'}, {dateTime(a.changed_at)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
