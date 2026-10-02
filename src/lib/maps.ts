import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

export interface GoogleLibs {
  maps: google.maps.MapsLibrary
  marker: google.maps.MarkerLibrary
  streetView: google.maps.StreetViewLibrary
  geocoding: google.maps.GeocodingLibrary
  core: google.maps.CoreLibrary
}

let loading: Promise<GoogleLibs> | null = null
let authFailed = false
const authListeners = new Set<() => void>()

export function onMapsAuthFailure(cb: () => void) { authListeners.add(cb); if (authFailed) cb(); return () => { authListeners.delete(cb) } }

export function loadGoogle(apiKey: string): Promise<GoogleLibs> {
  if (loading) return loading
  ;(window as unknown as { gm_authFailure: () => void }).gm_authFailure = () => { authFailed = true; authListeners.forEach((l) => l()) }
  setOptions({ key: apiKey, v: 'weekly' })
  loading = Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('streetView'), importLibrary('geocoding'), importLibrary('core')])
    .then(([maps, marker, streetView, geocoding, core]) => ({ maps, marker, streetView, geocoding, core }))
    .catch((e) => { loading = null; throw e })
  return loading
}

export function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
}
