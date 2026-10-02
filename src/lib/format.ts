import type { Owner, Property } from '../types'

export const NA = 'Not available in source'

export function money(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return null
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function num(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined) return null
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function dateLong(d: string | null | undefined) {
  if (!d) return null
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  if (!y) return d
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function dateTime(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Title used everywhere for a property. Never invents an address. */
export function propertyTitle(p: Property) {
  if (p.record_type === 'unidentified') return 'Unidentified record (p.65)'
  if (p.address_status === 'exact' && p.address_line) return p.address_line
  if (p.address_status === 'disputed' && p.address_line) return `${p.address_line} (disputed)`
  if (p.address_line) return `${p.address_line} — no street number`
  return 'No street address'
}

export function propertySubtitle(p: Property) {
  return [p.city, p.state, p.zip].filter(Boolean).join(', ').replace(/, (\d{5})$/, ' $1')
}

export function fullAddress(p: Property) {
  const line = p.address_line ?? ''
  return [line, [p.city, p.state].filter(Boolean).join(', ') + (p.zip ? ' ' + p.zip : '')].filter(Boolean).join(', ')
}

export const ADDRESS_LABEL: Record<string, string> = {
  exact: 'Exact address in source',
  street_only: 'Street name only',
  none: 'No address in source',
  disputed: 'Address disputed',
  manual: 'Entered manually',
}

export const LOCATION_LABEL: Record<string, string> = {
  exact_confirmed: 'Exact location confirmed',
  parcel_located: 'Located by parcel ID',
  needs_verification: 'Location needs verification',
  not_confirmed: 'Location not confirmed',
  not_located: 'Not located yet',
  manual: 'Placed manually — verify',
}

export function isConfirmedLocation(p: Property) {
  return p.location_status === 'exact_confirmed'
}

export function hasLocation(p: Property) {
  return p.lat !== null && p.lng !== null && ['exact_confirmed', 'parcel_located', 'needs_verification', 'manual'].includes(p.location_status)
}

export function ownerType(o: Owner | undefined): 'Company' | 'Trust' | 'Individual(s)' | 'Unknown' {
  if (!o || !o.owner_name) return 'Unknown'
  const n = o.owner_name.toUpperCase()
  if (/\bTRUST\b|\bTR\b/.test(n)) return 'Trust'
  if (/\b(LLC|INC|CORP|CO|LTD|LP|HOLDINGS|COMPANY)\b/.test(n)) return 'Company'
  return 'Individual(s)'
}

export function digits(s: string) {
  return s.replace(/\D/g, '')
}

export function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}
