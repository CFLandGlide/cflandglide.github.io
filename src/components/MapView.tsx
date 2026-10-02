import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPinOff } from 'lucide-react'
import { useApp } from '../state'
import { useDerived } from '../derived'
import { TILES } from '../lib/maps'
import { classNames, hasLocation, propertyTitle, today } from '../lib/format'
import { outerRings } from '../lib/geo'
import { DEFAULT_CENTER } from '../config'
import type { Owner, Property } from '../types'

const PINK = '#E5397A'

type Overlay = { marker: L.Marker; shapes: L.Polygon[]; sig: string }

function markerClass(p: Property, selected: boolean, dim: boolean) {
  const confirmed = p.location_status === 'exact_confirmed'
  const verify = p.location_status === 'needs_verification' || p.location_status === 'manual'
  return classNames('cfl-marker', confirmed ? 'confirmed' : 'unconfirmed', verify && 'verify', selected && 'selected', dim && 'dim')
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

/** The small hover card: address, owner name and status only (no phones or relatives). */
function tipHtml(p: Property, o: Owner | undefined) {
  const title = p.address_status === 'exact' ? propertyTitle(p) : `${p.address_line ? p.address_line + ' — ' : ''}address not confirmed`
  return `<b>${esc(title)}</b>Owner: ${esc(o?.owner_name ?? 'not in source')}<br/>Status: ${esc(p.status)}`
}

export function MapView() {
  const { data, hits } = useDerived()
  const { selectedId, select, view } = useApp()
  const div = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<{ map: L.TileLayer; satellite: L.TileLayer } | null>(null)
  const overlays = useRef(new Map<string, Overlay>())
  const fitted = useRef(false)
  const [mapType, setMapType] = useState<'map' | 'satellite'>('satellite')
  const [showUnmapped, setShowUnmapped] = useState(false)

  const owners = useMemo(() => new Map((data?.owners ?? []).map((o) => [o.property_id, o])), [data])
  const hitIds = useMemo(() => new Set(hits.map((h) => h.property.id)), [hits])
  const located = useMemo(() => (data?.properties ?? []).filter((p) => !p.archived && hasLocation(p)), [data])
  const unmapped = useMemo(() => (data?.properties ?? []).filter((p) => !p.archived && !hasLocation(p)), [data])

  // Create the map once
  useEffect(() => {
    if (!div.current || map.current) return
    const m = L.map(div.current, { center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], zoom: 13, zoomControl: false, maxZoom: 19 })
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    const mk = (t: (typeof TILES)[keyof typeof TILES]) => L.tileLayer(t.url, { attribution: t.attribution, maxNativeZoom: t.maxNativeZoom, maxZoom: 19 })
    layers.current = { map: mk(TILES.map), satellite: mk(TILES.satellite) }
    layers.current.satellite.addTo(m)
    map.current = m
    // Leaflet must re-measure when the map was hidden (e.g. after visiting the List view)
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(div.current)
    return () => { ro.disconnect(); m.remove(); map.current = null; overlays.current.clear(); fitted.current = false }
  }, [])

  useEffect(() => {
    const m = map.current, l = layers.current
    if (!m || !l) return
    const [on, off] = mapType === 'map' ? [l.map, l.satellite] : [l.satellite, l.map]
    if (m.hasLayer(off)) m.removeLayer(off)
    if (!m.hasLayer(on)) on.addTo(m)
  }, [mapType])

  // Frame all parcels — only once the map is actually visible (a hidden map has no size to fit into)
  const fitAll = () => {
    const m = map.current
    if (!m || fitted.current || !located.length || !div.current || div.current.clientWidth === 0) return
    m.invalidateSize()
    m.fitBounds(L.latLngBounds(located.map((p) => [p.lat!, p.lng!] as [number, number])), { padding: [80, 80], maxZoom: 16 })
    fitted.current = true
  }
  useEffect(() => { if (view === 'map') setTimeout(() => { map.current?.invalidateSize(); fitAll() }, 0) })

  // Draw / update markers and parcel outlines
  useEffect(() => {
    const m = map.current
    if (!m) return
    const keep = new Set<string>()
    const due = today()
    for (const p of located) {
      keep.add(p.id)
      const selected = p.id === selectedId
      const dim = !hitIds.has(p.id)
      const sig = JSON.stringify([p.lat, p.lng, p.location_status, p.status, p.follow_up_date, p.address_line, owners.get(p.id)?.owner_name, selected, dim, !!p.geometry])
      const existing = overlays.current.get(p.id)
      if (existing && existing.sig === sig) continue
      if (existing) { existing.marker.remove(); existing.shapes.forEach((s) => s.remove()) }
      const confirmed = p.location_status === 'exact_confirmed'
      const shapes: L.Polygon[] = []
      for (const ring of outerRings(p.geometry)) {
        const poly = L.polygon(ring.map(([lng, lat]) => [lat, lng] as [number, number]), {
          color: selected ? '#ffffff' : PINK, weight: selected ? 3 : 2, opacity: dim ? 0.35 : 1,
          dashArray: confirmed ? undefined : '7 6', // dashed = located by parcel ID, address not confirmed
          fillColor: PINK, fillOpacity: selected ? 0.2 : dim ? 0.03 : 0.1,
        }).addTo(m)
        poly.on('click', () => useApp.getState().select(p.id))
        shapes.push(poly)
      }
      const icon = L.divIcon({
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
        html: `<div class="${markerClass(p, selected, dim)}" data-marker="1" data-id="${esc(p.id)}"><span class="stake"></span>${p.follow_up_date && p.follow_up_date <= due ? '<span class="due" title="Follow-up due"></span>' : ''}<span class="tip">${tipHtml(p, owners.get(p.id))}</span></div>`,
      })
      const marker = L.marker([p.lat!, p.lng!], { icon, keyboard: true, alt: `${propertyTitle(p)}, account ${p.account_number ?? 'none'}`, zIndexOffset: selected ? 1000 : dim ? -100 : 0 }).addTo(m)
      marker.on('click', () => useApp.getState().select(p.id))
      overlays.current.set(p.id, { marker, shapes, sig })
    }
    for (const [id, o] of overlays.current) if (!keep.has(id)) { o.marker.remove(); o.shapes.forEach((s) => s.remove()); overlays.current.delete(id) }
    fitAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, hitIds, selectedId, owners])

  // Bring the selected property into view (only when the selection changes)
  const panned = useRef<string | null>(null)
  useEffect(() => {
    const m = map.current
    const p = located.find((x) => x.id === selectedId)
    if (!selectedId) { panned.current = null; return }
    if (!m || !p || panned.current === selectedId || !div.current || div.current.clientWidth === 0) return
    panned.current = selectedId
    m.setView([p.lat!, p.lng!], Math.max(m.getZoom(), 17), { animate: true })
  }, [selectedId, located, view])

  // When a search narrows the results, frame the matches
  const framed = useRef('')
  useEffect(() => {
    const m = map.current
    if (!m || !div.current || div.current.clientWidth === 0) return
    const shown = located.filter((p) => hitIds.has(p.id))
    const sig = shown.map((p) => p.id).join(',')
    if (sig === framed.current) return
    framed.current = sig
    if (!shown.length || shown.length === located.length) return
    if (shown.length === 1) m.setView([shown[0].lat!, shown[0].lng!], 17)
    else m.fitBounds(L.latLngBounds(shown.map((p) => [p.lat!, p.lng!] as [number, number])), { padding: [80, 80] })
  }, [hitIds, located, view])

  return (
    <div className="relative isolate h-full w-full bg-[#dfe6e1]">
      <div ref={div} className="absolute inset-0 z-0" />
      <div className="absolute left-3 top-3 z-[1000] flex overflow-hidden rounded-md border border-line bg-surface text-[13px] shadow-sm" role="group" aria-label="Map type">
        {(['map', 'satellite'] as const).map((t) => (
          <button key={t} onClick={() => setMapType(t)} aria-pressed={mapType === t} className={classNames('px-3 py-1.5 font-medium', mapType === t ? 'bg-ink text-white' : 'text-ink-2 hover:bg-pine-50')}>
            {t === 'map' ? 'Map' : 'Satellite'}
          </button>
        ))}
      </div>
      <div className="absolute bottom-6 left-3 z-[1000] rounded-md border border-line bg-surface/95 px-3 py-2 text-[12px] text-ink-2 shadow-sm">
        <p className="mb-1 font-semibold text-ink">Map key</p>
        <p className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-flag shadow" /> Exact address confirmed (solid outline)</p>
        <p className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-flag bg-white" /> Located by parcel ID, address not confirmed (dashed)</p>
        <p className="flex items-center gap-2"><span className="grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-dashed border-flag bg-white text-[9px] font-bold text-ink">?</span> Location needs verification</p>
        <p className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-ink" /> Follow-up due</p>
      </div>
      {unmapped.length > 0 && (
        <div className="absolute right-3 top-3 z-[1000] w-72">
          <button onClick={() => setShowUnmapped(!showUnmapped)} className="ml-auto flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] font-medium shadow-sm hover:border-ink-3">
            <MapPinOff size={15} /> Not on the map ({unmapped.length})
          </button>
          {showUnmapped && (
            <ul className="mt-1.5 rounded-md border border-line bg-surface p-1 shadow-lg">
              {unmapped.map((p) => (
                <li key={p.id}><button onClick={() => select(p.id)} className="w-full rounded px-2.5 py-1.5 text-left hover:bg-pine-50">
                  <span className="block font-serif text-[14px] font-semibold">{propertyTitle(p)}</span>
                  <span className="block text-[12px] text-ink-3">{p.record_type === 'unidentified' ? 'No account number — not mapped' : `Account ${p.account_number}`}</span>
                </button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
