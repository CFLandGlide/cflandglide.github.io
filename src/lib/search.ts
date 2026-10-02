import type { AllData, Property } from '../types'
import { digits, hasLocation, ownerType, propertyTitle, today } from './format'

export interface Filters {
  statuses: string[]
  addressStatus: string[]
  location: string[] // 'on_map' | 'not_on_map'
  types: string[]
  ownerTypes: string[]
  acreMin: string; acreMax: string
  saleFrom: string; saleTo: string // years
  priceMin: string; priceMax: string
  valueMin: string; valueMax: string
  contacted: 'any' | 'yes' | 'no'
  followUp: 'any' | 'due' | 'scheduled' | 'none'
  reviewed: 'any' | 'yes' | 'no'
  issues: 'any' | 'open'
}

export const EMPTY_FILTERS: Filters = {
  statuses: [], addressStatus: [], location: [], types: [], ownerTypes: [], acreMin: '', acreMax: '', saleFrom: '', saleTo: '',
  priceMin: '', priceMax: '', valueMin: '', valueMax: '', contacted: 'any', followUp: 'any', reviewed: 'any', issues: 'any',
}

export function activeFilterCount(f: Filters) {
  let n = 0
  for (const k of ['statuses', 'addressStatus', 'location', 'types', 'ownerTypes'] as const) if (f[k].length) n++
  for (const [a, b] of [['acreMin', 'acreMax'], ['saleFrom', 'saleTo'], ['priceMin', 'priceMax'], ['valueMin', 'valueMax']] as const) if (f[a] || f[b]) n++
  for (const k of ['contacted', 'followUp', 'reviewed', 'issues'] as const) if (f[k] !== 'any') n++
  return n
}

interface Entry { text: string; label: string }
export interface Hit { property: Property; reason: string | null }

export function buildIndex(d: AllData) {
  const idx = new Map<string, Entry[]>()
  const push = (pid: string, label: string, ...vals: (string | null | undefined | number)[]) => {
    const text = vals.filter((v) => v !== null && v !== undefined && v !== '').join(' ')
    if (!text) return
    idx.set(pid, [...(idx.get(pid) ?? []), { text: text.toLowerCase(), label }])
  }
  for (const p of d.properties) {
    push(p.id, 'Address', propertyTitle(p), p.address_line, p.site_address_as_written)
    push(p.id, 'Account number', p.account_number, p.account_number_as_written)
    push(p.id, 'Parcel number', p.parcel_number)
    push(p.id, 'City', p.city, p.state, p.zip)
    push(p.id, 'Status', p.status)
    push(p.id, 'Research notes', p.research_notes)
  }
  for (const o of d.owners) push(o.property_id, 'Owner', o.owner_name, o.ownership_entity, o.registered_agent, o.trustee, o.summary_owner_name, o.phones_listed_for, o.mailing_address)
  for (const c of d.owner_contacts) push(c.property_id, `Owner phone ${c.phone}`, c.phone, digits(c.phone ?? ''), c.annotation)
  for (const r of d.relatives) {
    push(r.property_id, `Possible relative: ${r.name}`, r.name, r.address)
    for (const ph of r.phones) push(r.property_id, `Phone of possible relative ${r.name}`, ph.phone, digits(ph.phone))
  }
  for (const r of d.associates) {
    push(r.property_id, `Possible associate: ${r.name}`, r.name, r.address)
    for (const ph of r.phones) push(r.property_id, `Phone of possible associate ${r.name}`, ph.phone, digits(ph.phone))
  }
  for (const n of d.notes) push(n.property_id, 'Note', n.body)
  return idx
}

/** All words must match (anywhere in the property's data). Returns the first reason that matched. */
export function searchProperties(props: Property[], idx: Map<string, Entry[]>, q: string): Hit[] {
  const query = q.trim().toLowerCase()
  if (!query) return props.map((p) => ({ property: p, reason: null }))
  const words = query.split(/\s+/)
  const qd = digits(query)
  const hits: Hit[] = []
  for (const p of props) {
    const entries = idx.get(p.id) ?? []
    const all = entries.map((e) => e.text).join(' | ')
    const phoneHit = qd.length >= 4 && /^[\d\s()+.-]+$/.test(query) ? entries.find((e) => e.text.includes(qd)) : undefined
    if (phoneHit) { hits.push({ property: p, reason: phoneHit.label }); continue }
    if (words.every((w) => all.includes(w))) {
      const best = entries.find((e) => words.every((w) => e.text.includes(w))) ?? entries.find((e) => e.text.includes(words[0]))
      hits.push({ property: p, reason: best?.label ?? null })
    }
  }
  return hits
}

export function applyFilters(hits: Hit[], d: AllData, f: Filters, openIssueProps: Set<string>) {
  const owners = new Map(d.owners.map((o) => [o.property_id, o]))
  const n = (s: string) => (s === '' ? null : Number(s))
  const t = today()
  return hits.filter(({ property: p }) => {
    if (f.statuses.length && !f.statuses.includes(p.status)) return false
    if (f.addressStatus.length && !f.addressStatus.includes(p.record_type === 'unidentified' ? 'unidentified' : p.address_status)) return false
    if (f.location.length && !f.location.includes(hasLocation(p) ? 'on_map' : 'not_on_map')) return false
    if (f.types.length && !f.types.includes(p.property_type_group ?? 'Not available in source')) return false
    if (f.ownerTypes.length && !f.ownerTypes.includes(ownerType(owners.get(p.id)))) return false
    const range = (v: number | null, lo: string, hi: string) => {
      if (lo === '' && hi === '') return true
      if (v === null || v === undefined) return false
      return (n(lo) === null || v >= n(lo)!) && (n(hi) === null || v <= n(hi)!)
    }
    if (!range(p.acreage, f.acreMin, f.acreMax)) return false
    if (!range(p.last_sale_date ? Number(p.last_sale_date.slice(0, 4)) : null, f.saleFrom, f.saleTo)) return false
    if (!range(p.last_sale_price, f.priceMin, f.priceMax)) return false
    if (!range(p.assessed_value ?? p.estimated_value, f.valueMin, f.valueMax)) return false
    if (f.contacted !== 'any' && p.contacted !== (f.contacted === 'yes')) return false
    if (f.followUp === 'due' && !(p.follow_up_date && p.follow_up_date <= t)) return false
    if (f.followUp === 'scheduled' && !p.follow_up_date) return false
    if (f.followUp === 'none' && p.follow_up_date) return false
    if (f.reviewed !== 'any' && p.reviewed !== (f.reviewed === 'yes')) return false
    if (f.issues === 'open' && !openIssueProps.has(p.id)) return false
    return true
  })
}
