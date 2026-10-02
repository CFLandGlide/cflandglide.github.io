import type { AllData } from '../types'
import { ADDRESS_LABEL, LOCATION_LABEL, propertyTitle } from './format'

function csv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows.map((r) => r.map((v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\r\n')
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportProperties(d: AllData, ids?: Set<string>) {
  const owners = new Map(d.owners.map((o) => [o.property_id, o]))
  const notes = new Map<string, string[]>()
  for (const n of [...d.notes].sort((a, b) => b.created_at.localeCompare(a.created_at))) notes.set(n.property_id, [...(notes.get(n.property_id) ?? []), n.body])
  const rows = [['Record', 'Address', 'Account #', 'Parcel #', 'Address status', 'Location status', 'Latitude', 'Longitude', 'Owner of record', 'Ownership entity',
    'Registered agent', 'Owner mailing address', 'Property type', 'Acreage', 'Land sq ft', 'Assessed value', 'Estimated value', 'Last sale date', 'Last sale price',
    'Status', 'Contacted', 'Follow-up date', 'Verification', 'Reviewed', 'Notes (newest first)', 'Source pages']]
  for (const p of d.properties) {
    if (ids && !ids.has(p.id)) continue
    const o = owners.get(p.id)
    rows.push([p.record_no ?? '', propertyTitle(p), p.account_number, p.parcel_number, ADDRESS_LABEL[p.address_status], LOCATION_LABEL[p.location_status], p.lat, p.lng,
      o?.owner_name, o?.ownership_entity, o?.registered_agent, o?.mailing_address, p.property_type, p.acreage, p.land_sqft, p.assessed_value, p.estimated_value,
      p.last_sale_date, p.last_sale_price, p.status, p.contacted ? 'Yes' : 'No', p.follow_up_date, p.verification_status, p.reviewed ? 'Yes' : 'No',
      (notes.get(p.id) ?? []).join(' || '), p.source_pages] as never)
  }
  download(`cflandglide-properties-${stamp()}.csv`, csv(rows as never), 'text/csv')
}

export function exportContacts(d: AllData, ids?: Set<string>) {
  const props = new Map(d.properties.map((p) => [p.id, p]))
  const rows: (string | number | null)[][] = [['Property account #', 'Property', 'Person type', 'Name', 'Relationship (as in source)', 'Age (as in source)', 'Address', 'Phone', 'Phone type', 'Notes', 'Source']]
  const pt = (pid: string) => { const p = props.get(pid)!; return [p.account_number ?? p.id, propertyTitle(p)] }
  const owners = new Map(d.owners.map((o) => [o.id, o]))
  for (const c of d.owner_contacts) {
    if (ids && !ids.has(c.property_id)) continue
    const o = owners.get(c.owner_id)
    rows.push([...pt(c.property_id), 'Owner phone', o?.phones_listed_for ?? o?.owner_name ?? '', '', o?.phones_listed_for_age ?? '', '', c.phone, c.phone_type, [c.connection_status, c.annotation].filter(Boolean).join('; '), c.source_ref])
  }
  for (const [kind, list] of [['Possible relative', d.relatives], ['Possible associate', d.associates]] as const) for (const r of list) {
    if (ids && !ids.has(r.property_id)) continue
    if (!r.phones.length) rows.push([...pt(r.property_id), kind, r.name, r.relationship, r.age_in_source, r.address, '', '', '', r.source_ref])
    for (const ph of r.phones) rows.push([...pt(r.property_id), kind, r.name, r.relationship, r.age_in_source, r.address, ph.phone, ph.type, '', r.source_ref])
  }
  download(`cflandglide-contacts-${stamp()}.csv`, csv(rows), 'text/csv')
}

export function exportBackup(d: AllData) {
  const { settings, ...rest } = d
  const { maps_api_key: _k, ...safeSettings } = settings
  void _k
  download(`cflandglide-backup-${stamp()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...rest, settings: safeSettings }, null, 1), 'application/json')
}
