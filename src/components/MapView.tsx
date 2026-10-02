import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinOff } from 'lucide-react'
import { useApp } from '../state'
import { useDerived } from '../derived'
import { loadGoogle, onMapsAuthFailure } from '../lib/maps'
import { classNames, hasLocation, propertyTitle, today } from '../lib/format'
import { outerRings } from '../lib/geo'
import { DEFAULT_CENTER } from '../config'
import type { Owner, Property } from '../types'
import { StreetViewOverlay } from './StreetViewOverlay'
import { Button } from './ui'

const PINK = '#E5397A'

type Overlay = { marker: google.maps.marker.AdvancedMarkerElement; el: HTMLDivElement; shapes: (google.maps.Polygon | google.maps.Polyline)[]; sig: string }

function markerClass(p: Property, selected: boolean, dim: boolean) {
  const confirmed = p.location_status === 'exact_confirmed'
  const verify = p.location_status === 'needs_verification' || p.location_status === 'manual'
  return classNames('cfl-marker', confirmed ? 'confirmed' : 'unconfirmed', verify && 'verify', selected && 'selected', dim && 'dim')
}

function tipHtml(p: Property, o: Owner | undefined) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const title = p.address_status === 'exact' ? propertyTitle(p) : `${p.address_line ? p.address_line + ' — ' : ''}address not confirmed`
  return `<b>${esc(title)}</b>Owner: ${esc(o?.owner_name ?? 'not in source')}<br/>Status: ${esc(p.status)}`
}

export function MapView() {
  const { data, hits } = useDerived()
  const { selectedId, select, setGoogle, google, streetViewFor } = useApp()
  const key = data?.settings.maps_api_key
  const mapId = data?.settings.maps_map_id || 'DEMO_MAP_ID'
  const div = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const overlays = useRef(new Map<string, Overlay>())
  const fitted = useRef(false)
  const [state, setState] = useState<'nokey' | 'loading' | 'ready' | 'error' | 'auth'>(key ? 'loading' : 'nokey')
  const [err, setErr] = useState('')
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid')
  const [showUnmapped, setShowUnmapped] = useState(false)

  const owners = useMemo(() => new Map((data?.owners ?? []).map((o) => [o.property_id, o])), [data])
  const hitIds = useMemo(() => new Set(hits.map((h) => h.property.id)), [hits])
  const located = useMemo(() => (data?.properties ?? []).filter((p) => !p.archived && hasLocation(p)), [data])
  const unmapped = useMemo(() => (data?.properties ?? []).filter((p) => !p.archived && !hasLocation(p)), [data])

  // Load Google Maps once a key exists
  useEffect(() => {
    if (!key) { setState('nokey'); return }
    let cancelled = false
    setState('loading')
    const off = onMapsAuthFailure(() => setState('auth'))
    loadGoogle(key).then((g) => {
      if (cancelled || !div.current) return
      setGoogle(g)
      map.current = new g.maps.Map(div.current, {
        center: DEFAULT_CENTER, zoom: 13, mapId, mapTypeId: 'hybrid', mapTypeControl: false, streetViewControl: false,
        fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy', tilt: 0,
      })
      setState('ready')
    }).catch((e) => { if (!cancelled) { setErr(String(e?.message ?? e)); setState('error') } })
    return () => { cancelled = true; off() }
  }, [key, mapId, setGoogle])

  useEffect(() => { map.current?.setMapTypeId(mapType) }, [mapType])

  // Draw / update markers and parcel outlines
  useEffect(() => {
    const m = map.current
    if (state !== 'ready' || !m || !google) return
    const keep = new Set<string>()
    const due = today()
    for (const p of located) {
      keep.add(p.id)
      const selected = p.id === selectedId
      const dim = !hitIds.has(p.id)
      const sig = JSON.stringify([p.lat, p.lng, p.location_status, p.status, p.follow_up_date, p.address_line, owners.get(p.id)?.owner_name, selected, dim, !!p.geometry])
      const existing = overlays.current.get(p.id)
      if (existing && existing.sig === sig) continue
      if (existing) { existing.marker.map = null; existing.shapes.forEach((s) => s.setMap(null)) }
      const el = document.createElement('div')
      el.className = markerClass(p, selected, dim)
      el.innerHTML = `<span class="stake"></span>${p.follow_up_date && p.follow_up_date <= due ? '<span class="due" title="Follow-up due"></span>' : ''}<span class="tip">${tipHtml(p, owners.get(p.id))}</span>`
      const marker = new google.marker.AdvancedMarkerElement({ map: m, position: { lat: p.lat!, lng: p.lng! }, content: el, gmpClickable: true,
        title: `${propertyTitle(p)} — account ${p.account_number ?? 'none'}`, zIndex: selected ? 1000 : dim ? 1 : 10 })
      marker.addEventListener('gmp-click', () => useApp.getState().select(p.id))
      const shapes: Overlay['shapes'] = []
      const confirmed = p.location_status === 'exact_confirmed'
      for (const ring of outerRings(p.geometry)) {
        const path = ring.map(([lng, lat]) => ({ lat, lng }))
        const fill = new google.maps.Polygon({ map: m, paths: path, clickable: true, fillColor: PINK, fillOpacity: selected ? 0.18 : dim ? 0.03 : 0.08,
          strokeColor: selected ? '#fff' : PINK, strokeOpacity: confirmed ? (dim ? 0.35 : 1) : 0, strokeWeight: selected ? 3 : 2, zIndex: selected ? 5 : 1 })
        fill.addListener('click', () => useApp.getState().select(p.id))
        shapes.push(fill)
        if (!confirmed) {
          // dashed outline = location from parcel ID, street address not confirmed
          shapes.push(new google.maps.Polyline({ map: m, path: [...path, path[0]], clickable: false, strokeOpacity: 0, zIndex: selected ? 6 : 2,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: dim ? 0.35 : 1, strokeColor: selected ? '#fff' : PINK, strokeWeight: selected ? 3 : 2.2, scale: 3 }, offset: '0', repeat: '11px' }] }))
        }
      }
      overlays.current.set(p.id, { marker, el, shapes, sig })
    }
    for (const [id, o] of overlays.current) if (!keep.has(id)) { o.marker.map = null; o.shapes.forEach((s) => s.setMap(null)); overlays.current.delete(id) }
    if (!fitted.current && located.length) {
      const b = new google.core.LatLngBounds()
      located.forEach((p) => b.extend({ lat: p.lat!, lng: p.lng! }))
      m.fitBounds(b, 80)
      fitted.current = true
    }
  }, [state, google, located, hitIds, selectedId, owners])

  // Bring the selected property into view (only when the selection changes)
  const panned = useRef<string | null>(null)
  useEffect(() => {
    const m = map.current
    const p = located.find((x) => x.id === selectedId)
    if (!m || !p || state !== 'ready' || panned.current === selectedId) return
    panned.current = selectedId
    m.panTo({ lat: p.lat!, lng: p.lng! })
    if ((m.getZoom() ?? 0) < 16) m.setZoom(17)
  }, [selectedId, located, state])
  useEffect(() => { if (!selectedId) panned.current = null }, [selectedId])

  // When a search narrows results, frame them (only when the set of matches changes)
  const framed = useRef('')
  useEffect(() => {
    const m = map.current
    if (!m || !google || state !== 'ready') return
    const shown = located.filter((p) => hitIds.has(p.id))
    const sig = shown.map((p) => p.id).join(',')
    if (sig === framed.current) return
    framed.current = sig
    if (!shown.length || shown.length === located.length) return
    const b = new google.core.LatLngBounds()
    shown.forEach((p) => b.extend({ lat: p.lat!, lng: p.lng! }))
    if (shown.length === 1) { m.panTo(b.getCenter()); m.setZoom(17) } else m.fitBounds(b, 80)
  }, [hitIds, located, google, state])

  return (
    <div className="relative h-full w-full bg-[#dfe6e1]">
      <div ref={div} className="absolute inset-0" />
      {state !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="max-w-md rounded-lg border border-line bg-surface p-5 text-[13.5px] shadow-sm">
            {state === 'nokey' && <><p className="mb-1 font-semibold">The map needs a Google Maps key</p><p className="mb-3 text-ink-2">Add the key and Map ID in Settings → Google Maps. Everything else works without it, including the list, notes and review queue.</p><Button onClick={() => useApp.getState().setView('settings')}>Open settings</Button></>}
            {state === 'loading' && <p className="text-ink-2">Loading Google Maps…</p>}
            {state === 'auth' && <><p className="mb-1 font-semibold">Google rejected the map key</p><p className="text-ink-2">Check that the key is correct, that billing is on, that “Maps JavaScript API” is enabled, and that the key allows this website’s address.</p></>}
            {state === 'error' && <><p className="mb-1 font-semibold">Google Maps didn’t load</p><p className="text-ink-2">{err || 'Check the internet connection and the key in Settings.'}</p></>}
          </div>
        </div>
      )}
      {state === 'ready' && (
        <>
          <div className="absolute left-3 top-3 flex overflow-hidden rounded-md border border-line bg-surface text-[13px] shadow-sm" role="group" aria-label="Map type">
            {(['roadmap', 'hybrid'] as const).map((t) => (
              <button key={t} onClick={() => setMapType(t)} aria-pressed={mapType === t} className={classNames('px-3 py-1.5 font-medium', mapType === t ? 'bg-ink text-white' : 'text-ink-2 hover:bg-pine-50')}>
                {t === 'roadmap' ? 'Map' : 'Satellite'}
              </button>
            ))}
          </div>
          <div className="absolute bottom-6 left-3 rounded-md border border-line bg-surface/95 px-3 py-2 text-[12px] text-ink-2 shadow-sm">
            <p className="mb-1 font-semibold text-ink">Map key</p>
            <p className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-flag shadow" /> Exact address confirmed (solid outline)</p>
            <p className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-flag bg-white" /> Located by parcel ID, address not confirmed (dashed)</p>
            <p className="flex items-center gap-2"><span className="grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-dashed border-flag bg-white text-[9px] font-bold text-ink">?</span> Location needs verification</p>
            <p className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-ink" /> Follow-up due</p>
          </div>
        </>
      )}
      {unmapped.length > 0 && (
        <div className="absolute right-3 top-3 w-72">
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
      {streetViewFor && google && <StreetViewOverlay propertyId={streetViewFor} />}
    </div>
  )
}
