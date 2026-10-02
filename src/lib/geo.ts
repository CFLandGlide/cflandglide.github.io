// Small geometry helpers (planar approximation; fine at parcel scale).
type Ring = number[][] // [lng, lat][]

export function outerRings(g: GeoJSON.Geometry | null | undefined): Ring[] {
  if (!g) return []
  if (g.type === 'Polygon') return [g.coordinates[0] as Ring]
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p[0] as Ring)
  return []
}

function ringArea(r: Ring) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]
  return a / 2
}

export function pointInRing(lng: number, lat: number, r: Ring) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function pointInGeometry(lng: number, lat: number, g: GeoJSON.Geometry | null) {
  return outerRings(g).some((r) => pointInRing(lng, lat, r))
}

/** Area-weighted centroid of the largest ring; falls back to a point inside if the centroid is outside. */
export function centroid(g: GeoJSON.Geometry | null): { lat: number; lng: number } | null {
  const rings = outerRings(g)
  if (!rings.length) return null
  const r = rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a))
  const A = ringArea(r)
  let cx = 0, cy = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]
    cx += (r[j][0] + r[i][0]) * f
    cy += (r[j][1] + r[i][1]) * f
  }
  if (A === 0) {
    const n = r.length
    return { lng: r.reduce((s, p) => s + p[0], 0) / n, lat: r.reduce((s, p) => s + p[1], 0) / n }
  }
  const c = { lng: cx / (6 * A), lat: cy / (6 * A) }
  if (pointInRing(c.lng, c.lat, r)) return c
  // fallback: scan horizontal line through the centroid for the widest inside segment
  const xs: number[] = []
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if (yi > c.lat !== yj > c.lat) xs.push(((xj - xi) * (c.lat - yi)) / (yj - yi) + xi)
  }
  xs.sort((a, b) => a - b)
  return xs.length >= 2 ? { lng: (xs[0] + xs[1]) / 2, lat: c.lat } : c
}

const R = 6371008.8
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Distance in metres from a point to a polygon's boundary (0 if inside). */
export function distanceToGeometryM(p: { lat: number; lng: number }, g: GeoJSON.Geometry | null): number | null {
  const rings = outerRings(g)
  if (!rings.length) return null
  if (pointInGeometry(p.lng, p.lat, g)) return 0
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111320, ky = 110540
  let best = Infinity
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const ax = (r[i][0] - p.lng) * kx, ay = (r[i][1] - p.lat) * ky
      const bx = (r[i + 1][0] - p.lng) * kx, by = (r[i + 1][1] - p.lat) * ky
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
    }
  }
  return best
}

export function maxRadiusM(c: { lat: number; lng: number }, g: GeoJSON.Geometry | null) {
  let m = 0
  for (const r of outerRings(g)) for (const [lng, lat] of r) m = Math.max(m, distanceM(c, { lat, lng }))
  return m
}

export function headingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toR = Math.PI / 180
  const y = Math.sin((to.lng - from.lng) * toR) * Math.cos(to.lat * toR)
  const x = Math.cos(from.lat * toR) * Math.sin(to.lat * toR) - Math.sin(from.lat * toR) * Math.cos(to.lat * toR) * Math.cos((to.lng - from.lng) * toR)
  return ((Math.atan2(y, x) / toR) + 360) % 360
}

export function geometryAcres(g: GeoJSON.Geometry | null) {
  let m2 = 0
  for (const r of outerRings(g)) {
    if (!r.length) continue
    const lat0 = r[0][1]
    const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, ky = 110540
    m2 += Math.abs(ringArea(r.map(([x, y]) => [x * kx, y * ky])))
  }
  return m2 / 4046.8564224
}
