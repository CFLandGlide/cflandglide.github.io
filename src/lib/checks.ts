// Live validation checks. They are recomputed from the data every time, so the Review Queue and
// Data Check never go stale. Nothing here changes data.
import type { AllData, DataIssue, IssueValue, Property } from '../types'
import { countyAddress, countyMailing, countyOwner } from './county'
import { digits, hasLocation } from './format'

export interface Check {
  id: string
  severity: 'critical' | 'conflict' | 'info'
  category: string
  title: string
  detail: string
  property_id: string | null
  related_property_ids?: string[]
  field?: string
  values: IssueValue[]
}

const norm = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }

export function computeChecks(d: AllData): Check[] {
  const out: Check[] = []
  const props = d.properties.filter((p) => !p.archived)
  const label = (p: Property) => `record #${p.record_no ?? '—'} (${p.account_number ?? p.id})`

  // Duplicate account numbers, including "as written" numbers on unidentified blocks
  const byAcct = new Map<string, Property[]>()
  for (const p of props) for (const a of [p.account_number, p.account_number_as_written]) if (a) byAcct.set(a, [...(byAcct.get(a) ?? []), p])
  for (const [a, ps] of byAcct) {
    const uniq = [...new Set(ps)]
    const covered = d.data_issues.some((i) => i.category === 'Duplicate account number' && uniq.every((p) => i.property_id === p.id || i.related_property_ids.includes(p.id)))
    if (uniq.length > 1 && !covered) out.push({ id: `AUTO-dupacct-${a}`, severity: 'critical', category: 'Duplicate account number', property_id: uniq[0].id,
      related_property_ids: uniq.slice(1).map((p) => p.id), field: 'account_number',
      title: `Account number ${a} appears on ${uniq.length} records`, detail: 'The same account number is used by more than one record. They are kept separate.',
      values: uniq.map((p) => ({ value: label(p), src: p.source_ref ?? 'Entered in app' })) })
  }
  // Duplicate exact addresses
  const byAddr = new Map<string, Property[]>()
  for (const p of props) if (p.address_line && (p.address_status === 'exact' || p.address_status === 'manual')) byAddr.set(norm(p.address_line), [...(byAddr.get(norm(p.address_line)) ?? []), p])
  for (const [a, ps] of byAddr) if (ps.length > 1) out.push({ id: `AUTO-dupaddr-${hash(a)}`, severity: 'conflict', category: 'Possible duplicate property', property_id: ps[0].id,
    related_property_ids: ps.slice(1).map((p) => p.id), field: 'site_address', title: `${ps.length} records share the address ${ps[0].address_line}`,
    detail: 'Check whether these are the same property.', values: ps.map((p) => ({ value: label(p), src: p.source_ref ?? 'Entered in app' })) })

  // Phones that appear under more than one property
  const phoneProps = new Map<string, Set<string>>()
  const add = (ph: string | null, pid: string) => { const k = digits(ph ?? ''); if (k.length >= 10) phoneProps.set(k, new Set([...(phoneProps.get(k) ?? []), pid])) }
  for (const c of d.owner_contacts) if (!c.archived) add(c.phone, c.property_id)
  for (const r of [...d.relatives, ...d.associates]) if (!r.archived) for (const ph of r.phones) add(ph.phone, r.property_id)
  for (const [ph, ids] of phoneProps) if (ids.size > 1) {
    const list = [...ids]
    out.push({ id: `AUTO-sharedphone-${ph}`, severity: 'info', category: 'Phone on several properties', property_id: list[0], related_property_ids: list.slice(1),
      title: `Phone ${ph.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')} appears under ${ids.size} properties`,
      detail: 'Each listing stays with its own property. This is shown so nobody assumes it belongs to one owner.', values: [] })
  }

  const lookups = new Map(d.parcel_lookups.map((l) => [l.property_id, l]))
  const ownerOf = new Map(d.owners.filter((o) => !o.archived).map((o) => [o.property_id, o]))
  for (const p of props) {
    if (p.record_type === 'unidentified') continue
    const l = lookups.get(p.id)
    if (!hasLocation(p)) {
      out.push({ id: `AUTO-noloc-${p.id}-${p.location_status}`, severity: 'info', category: 'Not on the map', property_id: p.id, field: 'location',
        title: l?.status === 'not_found' ? 'County has no parcel with this ID' : l?.status === 'error' ? 'County lookup failed' : 'No map location yet',
        detail: l?.status === 'error' ? `${l.error ?? ''} Use “Locate parcels” in Data check to try again.` : l?.status === 'not_found'
          ? 'The county parcel service returned nothing for this parcel ID, so the property is not placed on the map.'
          : 'Run “Locate parcels” in Data check to look this parcel up by its parcel ID.', values: [] })
    }
    if (l?.geocode && l.geocode.result !== 'agrees' && p.address_status === 'exact') {
      out.push({ id: `AUTO-geocode-${p.id}-${hash(JSON.stringify(l.geocode))}`, severity: 'conflict', category: 'Address check', property_id: p.id, field: 'location',
        title: 'Google’s location for the address does not match the county parcel',
        detail: l.geocode.result === 'no_result' ? 'Google could not find this address.' : `Google placed “${l.geocode.query}” ${l.geocode.distance_to_parcel_m !== undefined ? Math.round(l.geocode.distance_to_parcel_m) + ' m from' : 'away from'} the county parcel outline (match type ${l.geocode.location_type ?? 'unknown'}). The map uses the county parcel; Street View stays off until verified.`,
        values: [{ value: l.geocode.formatted_address ?? '(no result)', src: `Google geocoding, ${l.geocode_checked_at?.slice(0, 10) ?? ''}` },
          { value: 'Parcel outline', src: `Palm Beach County GIS, ${l.fetched_at?.slice(0, 10) ?? ''}` }] })
    }
    if (l?.status === 'found' && l.attributes) {
      const a = l.attributes
      const src = `Palm Beach County GIS, fetched ${l.fetched_at?.slice(0, 10) ?? ''}`
      const docSrc = p.source_ref ? `Source document, p.${p.source_pages}` : 'Entered in app'
      const o = ownerOf.get(p.id)
      const co = countyOwner(a)
      if (o?.owner_name && co) {
        const first = norm(String(a.OWNER_NAME1 ?? '')).replace(/ $/, '')
        if (first && !norm(o.owner_name).includes(first)) out.push({ id: `AUTO-cowner-${p.id}-${hash(co + o.owner_name)}`, severity: 'conflict', category: 'County record differs',
          property_id: p.id, field: 'owner_name', title: 'County owner name differs from the document', detail: 'The county parcel record names a different owner. The document value is kept; nothing was changed.',
          values: [{ value: o.owner_name, src: docSrc }, { value: co, src }] })
      }
      const ca = countyAddress(a)
      if (p.address_status === 'exact' || p.address_status === 'disputed') {
        if (!ca || norm(ca) !== norm(p.address_line)) out.push({ id: `AUTO-caddr-${p.id}-${hash(String(ca))}`, severity: p.address_status === 'disputed' ? 'info' : 'conflict',
          category: 'County record differs', property_id: p.id, field: 'site_address', title: ca ? 'County site address differs from the document' : 'County has no site address for this parcel',
          detail: 'The document address is kept as written.', values: [{ value: p.site_address_as_written ?? p.address_line ?? '', src: docSrc }, { value: ca ?? '(blank)', src }] })
      } else if (ca) {
        out.push({ id: `AUTO-caddrnew-${p.id}-${hash(ca)}`, severity: 'info', category: 'Lead (not used)', property_id: p.id, field: 'site_address',
          title: `County lists a site address: ${ca}`, detail: 'The document has no street number for this parcel. The county address is shown as a lead only; the address stays Not Confirmed until someone verifies it.',
          values: [{ value: p.site_address_as_written ?? '', src: docSrc }, { value: ca, src }] })
      }
      const acres = Number(a.ACRES)
      if (p.acreage && acres && Math.abs(acres - p.acreage) / p.acreage > 0.05) out.push({ id: `AUTO-cacres-${p.id}-${acres}`, severity: 'info', category: 'County record differs', property_id: p.id, field: 'acreage',
        title: 'County acreage differs from the document', detail: 'More than 5% apart.', values: [{ value: `${p.acreage} ac`, src: docSrc }, { value: `${acres} ac`, src }] })
      if (p.last_sale_date && a.SALE_DATE && String(a.SALE_DATE) !== p.last_sale_date) out.push({ id: `AUTO-csale-${p.id}-${a.SALE_DATE}-${a.PRICE}`, severity: 'info', category: 'County record differs', property_id: p.id, field: 'last_sale_date',
        title: 'County’s latest sale differs from the document', detail: 'The county record shows a different latest sale. The document’s sale is kept as written.',
        values: [{ value: `${p.last_sale_date} — $${Number(p.last_sale_price ?? 0).toLocaleString()}`, src: docSrc }, { value: `${a.SALE_DATE} — $${Number(a.PRICE ?? 0).toLocaleString()}`, src }] })
      const cm = countyMailing(a)
      if (o?.mailing_address && cm && !norm(o.mailing_address).includes(norm(String(a.PADDR1 ?? '')))) out.push({ id: `AUTO-cmail-${p.id}-${hash(cm)}`, severity: 'info', category: 'County record differs', property_id: p.id, field: 'mailing_address',
        title: 'County mailing address differs from the document', detail: 'The document value is kept.', values: [{ value: o.mailing_address, src: docSrc }, { value: cm, src }] })
    }
    if (!ownerOf.get(p.id)?.owner_name && p.record_type !== 'manual') out.push({ id: `AUTO-noowner-${p.id}`, severity: 'info', category: 'Missing owner', property_id: p.id, field: 'owner_name',
      title: 'No owner of record', detail: 'The source has no owner for this record.', values: [] })
  }
  return out
}

/** Stored issues plus live checks; a live check that someone already reviewed shows its stored status. */
export function reviewItems(d: AllData) {
  const stored = new Map(d.data_issues.map((i) => [i.id, i]))
  const live = computeChecks(d).map((c) => stored.get(c.id) ?? ({ ...c, issue_values: c.values, related_property_ids: c.related_property_ids ?? [], status: 'open', resolution_note: null,
    resolved_by_name: null, resolved_at: null, created_at: '', created_by_name: 'Live check', field: c.field ?? null } as DataIssue & { live?: boolean }))
  const liveIds = new Set(live.map((i) => i.id))
  const rest = d.data_issues.filter((i) => !liveIds.has(i.id))
  return [...rest, ...live].map((i) => ({ ...i, live: i.id.startsWith('AUTO-') }))
}

export function issuesFor(items: ReturnType<typeof reviewItems>, pid: string) {
  return items.filter((i) => i.property_id === pid || i.related_property_ids?.includes(pid))
}

export function validationReport(d: AllData) {
  const props = d.properties.filter((p) => !p.archived)
  const real = props.filter((p) => p.record_type !== 'unidentified')
  const items = reviewItems(d)
  const open = items.filter((i) => i.status === 'open')
  const withConflict = new Set(open.filter((i) => i.severity !== 'info').flatMap((i) => [i.property_id, ...(i.related_property_ids ?? [])]).filter(Boolean))
  const dupAcct = items.filter((i) => i.category === 'Duplicate account number')
  const dupProp = items.filter((i) => i.category === 'Possible duplicate property')
  const contactsBy = new Set(d.owner_contacts.filter((c) => !c.archived).map((c) => c.property_id))
  const ownerBy = new Set(d.owners.filter((o) => o.owner_name && !o.archived).map((o) => o.property_id))
  return {
    total: real.length,
    unidentified: props.filter((p) => p.record_type === 'unidentified').length,
    exactAddress: real.filter((p) => p.address_status === 'exact').length,
    noExactAddress: real.filter((p) => p.address_status !== 'exact').length,
    disputed: real.filter((p) => p.address_status === 'disputed').length,
    located: real.filter(hasLocation).length,
    exactConfirmed: real.filter((p) => p.location_status === 'exact_confirmed').length,
    parcelLocated: real.filter((p) => p.location_status === 'parcel_located').length,
    needsLocationCheck: real.filter((p) => ['needs_verification', 'not_confirmed', 'not_located', 'manual'].includes(p.location_status)).length,
    notLocated: real.filter((p) => !hasLocation(p)).length,
    withOwner: real.filter((p) => ownerBy.has(p.id)).length,
    withContacts: real.filter((p) => contactsBy.has(p.id)).length,
    withConflicts: real.filter((p) => withConflict.has(p.id)).length,
    duplicateAccountNumbers: dupAcct.length,
    potentialDuplicates: dupProp.length,
    needsReview: open.filter((i) => i.severity !== 'info').length,
    openInfo: open.filter((i) => i.severity === 'info').length,
    relatives: d.relatives.filter((r) => !r.archived).length,
    associates: d.associates.filter((r) => !r.archived).length,
    ownerPhones: d.owner_contacts.filter((c) => !c.archived).length,
    countyChecked: d.parcel_lookups.filter((l) => l.status).length,
    geocodeChecked: d.parcel_lookups.filter((l) => l.geocode).length,
  }
}
