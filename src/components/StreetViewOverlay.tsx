import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../state'
import { distanceToGeometryM, headingDeg, maxRadiusM } from '../lib/geo'
import { propertyTitle } from '../lib/format'

// Street View is only shown when the panorama is within this distance of the county parcel outline.
const MAX_FROM_PARCEL_M = 40

export function StreetViewOverlay({ propertyId }: { propertyId: string }) {
  const { data, google, openStreetView } = useApp()
  const p = data!.properties.find((x) => x.id === propertyId)!
  const l = data!.parcel_lookups.find((x) => x.property_id === propertyId)
  const div = useRef<HTMLDivElement>(null)
  const [msg, setMsg] = useState<string>('Looking for Street View…')
  const [info, setInfo] = useState<string | null>(null)
  const confirmed = p.location_status === 'exact_confirmed'

  useEffect(() => {
    if (!google || !div.current || p.lat === null || p.lng === null) return
    let cancelled = false
    const center = confirmed && l?.geocode?.lat ? { lat: l.geocode.lat, lng: l.geocode.lng! } : { lat: p.lat, lng: p.lng }
    const parcelCenter = { lat: p.lat, lng: p.lng }
    const radius = confirmed ? 60 : Math.min(400, maxRadiusM(parcelCenter, p.geometry) + MAX_FROM_PARCEL_M)
    const svc = new google.streetView.StreetViewService()
    svc.getPanorama({ location: center, radius, preference: 'nearest', sources: ['outdoor'] })
      .then((res) => {
        if (cancelled) return
        const loc = res.data.location?.latLng
        if (!loc || !res.data.location) { setMsg('Street View unavailable for this property.'); return }
        const pano = { lat: loc.lat(), lng: loc.lng() }
        const dist = p.geometry ? distanceToGeometryM(pano, p.geometry) : null
        if (dist === null || dist > MAX_FROM_PARCEL_M) {
          setMsg(`Street View unavailable. The closest imagery is ${dist === null ? 'too far' : Math.round(dist) + ' m'} from this parcel, so it isn’t shown.`)
          return
        }
        new google.streetView.StreetViewPanorama(div.current!, {
          pano: res.data.location.pano, pov: { heading: headingDeg(pano, parcelCenter), pitch: 0 }, zoom: 0,
          addressControl: false, fullscreenControl: true, motionTracking: false, motionTrackingControl: false, showRoadLabels: true,
        })
        setMsg('')
        setInfo(`Imagery ${res.data.imageDate ? `from ${res.data.imageDate}, ` : ''}taken about ${Math.round(dist)} m from the parcel edge, facing the parcel.`)
      })
      .catch(() => { if (!cancelled) setMsg('Street View unavailable for this property.') })
    return () => { cancelled = true }
  }, [google, p, l, confirmed])

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-ink">
      <div className="flex items-start justify-between gap-3 bg-surface px-4 py-2.5">
        <div>
          <p className="font-serif text-[16px] font-semibold">Street View: {propertyTitle(p)}</p>
          <p className="text-[12.5px] text-ink-2">
            {confirmed ? 'At the confirmed address.' : 'Near the county parcel outline. The street address is not confirmed.'}
            {info ? ` ${info}` : ''}
          </p>
        </div>
        <button onClick={() => openStreetView(null)} className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[13px] font-medium hover:border-ink-3"><X size={15} /> Back to map</button>
      </div>
      <div className="relative flex-1">
        <div ref={div} className="absolute inset-0" />
        {msg && <div className="absolute inset-0 grid place-items-center p-6"><p className="max-w-md rounded-md bg-surface px-4 py-3 text-center text-[13.5px]">{msg}</p></div>}
      </div>
    </div>
  )
}
