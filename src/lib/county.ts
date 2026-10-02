// Palm Beach County parcel lookup by parcel ID (PCN). Runs in the browser, straight against the county's public GIS.
import { centroid } from './geo'

export const COUNTY_SOURCE = 'Palm Beach County parcel GIS (looked up by parcel ID)'
const FIELDS = ['PARID', 'PARCEL_NUMBER', 'OWNER_NAME1', 'OWNER_NAME2', 'SITE_ADDR_STR', 'MUNICIPALITY', 'PADDR1', 'PADDR2', 'PADDR3',
  'CITYNAME', 'STATE', 'ZIP1', 'ACRES', 'SALE_DATE', 'PRICE', 'ASSESSED_VAL', 'TOTAL_MARKET', 'PROPERTY_USE', 'SUBDIV_NAME', 'LEGAL1']

export interface CountyResult {
  status: 'found' | 'not_found' | 'multiple' | 'error'
  attributes?: Record<string, unknown>
  geometry?: GeoJSON.Geometry
  centroid?: { lat: number; lng: number } | null
  error?: string
}

export async function fetchCountyParcel(serviceUrl: string, pcn: string): Promise<CountyResult> {
  if (!/^\d{17}$/.test(pcn)) return { status: 'error', error: 'Parcel ID must be 17 digits.' }
  const url = `${serviceUrl.replace(/\/+$/, '')}/query?where=${encodeURIComponent(`PARID='${pcn}'`)}` +
    `&outFields=${FIELDS.join(',')}&returnGeometry=true&outSR=4326&f=geojson`
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 20000)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) return { status: 'error', error: `County service answered ${res.status}` }
    const j = await res.json()
    if (j.error) return { status: 'error', error: j.error.message ?? 'County service error' }
    const feats = (j.features ?? []) as { geometry: GeoJSON.Geometry; properties: Record<string, unknown> }[]
    // Never accept a parcel whose ID is not exactly the one asked for.
    const exact = feats.filter((f) => String(f.properties?.PARID ?? '') === pcn)
    if (exact.length === 0) return { status: 'not_found' }
    if (exact.length > 1) return { status: 'multiple', attributes: exact[0].properties }
    const f = exact[0]
    const attrs = { ...f.properties }
    if (typeof attrs.SALE_DATE === 'number') attrs.SALE_DATE = new Date(attrs.SALE_DATE as number).toISOString().slice(0, 10)
    return { status: 'found', attributes: attrs, geometry: f.geometry, centroid: centroid(f.geometry) }
  } catch (e) {
    return { status: 'error', error: (e as Error).name === 'AbortError' ? 'County service timed out' : `Could not reach the county service (${(e as Error).message})` }
  } finally {
    clearTimeout(t)
  }
}

export function countyAddress(a: Record<string, unknown> | null | undefined) {
  if (!a) return null
  const s = String(a.SITE_ADDR_STR ?? '').trim()
  return s || null
}
export function countyMailing(a: Record<string, unknown> | null | undefined) {
  if (!a) return null
  const parts = [a.PADDR1, a.PADDR2, a.PADDR3].map((x) => String(x ?? '').trim()).filter(Boolean)
  const cityLine = [a.CITYNAME, a.STATE, a.ZIP1].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
  return [...parts, cityLine].filter(Boolean).join(', ') || null
}
export function countyOwner(a: Record<string, unknown> | null | undefined) {
  if (!a) return null
  return [a.OWNER_NAME1, a.OWNER_NAME2].map((x) => String(x ?? '').trim()).filter(Boolean).join(' / ') || null
}
