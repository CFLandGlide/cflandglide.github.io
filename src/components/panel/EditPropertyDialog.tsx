import { useState } from 'react'
import { useApp } from '../../state'
import type { Owner, Property } from '../../types'
import { ADDRESS_LABEL } from '../../lib/format'
import { Button, inputCls, Label, Modal } from '../ui'
import { imported } from './fields'

type PField = { key: keyof Property; label: string; kind: 'text' | 'number' | 'date' | 'textarea' }
const PFIELDS: PField[] = [
  { key: 'address_line', label: 'Street address', kind: 'text' }, { key: 'zip', label: 'ZIP', kind: 'text' },
  { key: 'property_type', label: 'Property type', kind: 'text' }, { key: 'acreage', label: 'Acreage', kind: 'number' },
  { key: 'land_sqft', label: 'Land area (sq ft)', kind: 'number' }, { key: 'building_sqft', label: 'Building area (sq ft)', kind: 'number' },
  { key: 'bedrooms', label: 'Bedrooms', kind: 'number' }, { key: 'bathrooms', label: 'Bathrooms', kind: 'number' },
  { key: 'assessed_value', label: 'Tax assessed value ($)', kind: 'number' }, { key: 'estimated_value', label: 'Estimated value ($)', kind: 'number' },
  { key: 'last_sale_date', label: 'Last sale date', kind: 'date' }, { key: 'last_sale_price', label: 'Last sale price ($)', kind: 'number' },
  { key: 'research_notes', label: 'Research notes (property summary)', kind: 'textarea' },
]
type OKey = 'owner_name' | 'ownership_entity' | 'registered_agent' | 'mailing_address'
const OFIELDS: { key: OKey; label: string }[] = [
  { key: 'owner_name', label: 'Owner of record' }, { key: 'ownership_entity', label: 'Ownership entity' },
  { key: 'registered_agent', label: 'Registered agent' }, { key: 'mailing_address', label: 'Owner mailing address' },
]

const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function EditPropertyDialog({ p, onClose }: { p: Property; onClose: () => void }) {
  const { data, updateProperty, updateRow, store, session } = useApp()
  const owner = data!.owners.find((o) => o.property_id === p.id && !o.archived)
  const pImp = imported(p.source_values as Record<string, unknown>)
  const oImp = imported(owner?.source_values)
  const [pv, setPv] = useState<Record<string, string>>(Object.fromEntries(PFIELDS.map((f) => [f.key, toStr(p[f.key])])))
  const [ov, setOv] = useState<Record<string, string>>(Object.fromEntries(OFIELDS.map((f) => [f.key, toStr(owner?.[f.key])])))
  const [addr, setAddr] = useState(p.address_status)
  const [lat, setLat] = useState(p.location_status === 'manual' ? toStr(p.lat) : '')
  const [lng, setLng] = useState(p.location_status === 'manual' ? toStr(p.lng) : '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr(null)
    const patch: Partial<Property> = {}
    for (const f of PFIELDS) {
      const raw = pv[f.key].trim()
      let v: string | number | null = raw === '' ? null : raw
      if (f.kind === 'number' && raw !== '') { v = Number(raw.replace(/[$,\s]/g, '')); if (Number.isNaN(v)) { setErr(`${f.label} must be a number.`); return } }
      if (JSON.stringify(v) !== JSON.stringify(p[f.key] ?? null)) (patch as Record<string, unknown>)[f.key] = v
    }
    if (addr !== p.address_status) patch.address_status = addr
    if (lat || lng) {
      const la = Number(lat), ln = Number(lng)
      if (Number.isNaN(la) || Number.isNaN(ln) || la < 24 || la > 31.5 || ln < -88 || ln > -79) { setErr('Manual location must be a Florida latitude and longitude, e.g. 26.93 and -80.19.'); return }
      if (la !== p.lat || ln !== p.lng || p.location_status !== 'manual')
        Object.assign(patch, { lat: la, lng: ln, location_status: 'manual', location_source: `Entered manually by ${session?.name ?? 'a team member'}`, location_checked_at: new Date().toISOString() })
    } else if (p.location_status === 'manual') {
      Object.assign(patch, { lat: null, lng: null, geometry: null, location_status: 'not_located', location_source: null })
    }
    const opatch: Partial<Owner> = {}
    for (const f of OFIELDS) {
      const v = ov[f.key].trim() || null
      if (v !== (owner?.[f.key] ?? null)) opatch[f.key] = v
    }
    setBusy(true)
    let ok = true
    if (Object.keys(patch).length) ok = await updateProperty(p.id, patch)
    if (ok && Object.keys(opatch).length) {
      if (owner) ok = await updateRow<Owner>('owners', owner.id, opatch)
      else {
        try {
          const row = await store!.insert<Owner>('owners', { id: `${p.id}-O-${crypto.randomUUID().slice(0, 6)}`, property_id: p.id, ...opatch })
          useApp.setState({ data: { ...useApp.getState().data!, owners: [...useApp.getState().data!.owners, row] } })
        } catch (e) { setErr((e as Error).message); ok = false }
      }
    }
    setBusy(false)
    if (ok) { useApp.getState().toast(Object.keys(patch).length || Object.keys(opatch).length ? 'Changes saved. Original source values are kept.' : 'Nothing changed'); onClose() }
  }

  const orig = (imp: Record<string, unknown> | null, k: string) => imp && k in imp ? <span className="mt-0.5 block text-[12px] text-ink-3">Original source value: {toStr(imp[k]) || '(blank)'}</span> : null

  return (
    <Modal wide title="Edit property" onClose={onClose}
      footer={<><Button kind="quiet" onClick={onClose}>Cancel</Button><Button kind="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button></>}>
      <p className="mb-4 rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] text-ink-2">
        Changes are saved as updated values with your name and the time. The original values from the source document are never overwritten and stay visible next to each field.
      </p>
      <h3 className="mb-2 text-[13.5px] font-semibold">Property</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PFIELDS.map((f) => (
          <div key={f.key} className={f.kind === 'textarea' ? 'sm:col-span-2' : ''}>
            <Label htmlFor={`e-${f.key}`}>{f.label}</Label>
            {f.kind === 'textarea'
              ? <textarea id={`e-${f.key}`} rows={3} className={inputCls} value={pv[f.key]} onChange={(e) => setPv({ ...pv, [f.key]: e.target.value })} />
              : <input id={`e-${f.key}`} type={f.kind === 'date' ? 'date' : 'text'} inputMode={f.kind === 'number' ? 'decimal' : undefined} className={inputCls} value={pv[f.key]} onChange={(e) => setPv({ ...pv, [f.key]: e.target.value })} />}
            {orig(pImp, f.key)}
          </div>
        ))}
        <div>
          <Label htmlFor="e-addr">Address status</Label>
          <select id="e-addr" className={inputCls} value={addr} onChange={(e) => setAddr(e.target.value as Property['address_status'])}>
            {Object.entries(ADDRESS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="mt-0.5 block text-[12px] text-ink-3">Set to “Exact address” only once the street address is verified. Original: {ADDRESS_LABEL[String(pImp?.address_status ?? p.address_status)]}</span>
        </div>
      </div>
      <h3 className="mt-5 mb-2 text-[13.5px] font-semibold">Owner of record (this property only)</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OFIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`o-${f.key}`}>{f.label}</Label>
            <input id={`o-${f.key}`} className={inputCls} value={ov[f.key]} onChange={(e) => setOv({ ...ov, [f.key]: e.target.value })} />
            {orig(oImp, f.key)}
          </div>
        ))}
      </div>
      <h3 className="mt-5 mb-1 text-[13.5px] font-semibold">Manual map location (optional)</h3>
      <p className="mb-2 text-[12.5px] text-ink-2">Only use this if you have verified where the property is. It shows on the map as “Placed manually — verify”. Leave blank to use the county parcel location.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="m-lat">Latitude</Label><input id="m-lat" className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="26.9301" /></div>
        <div><Label htmlFor="m-lng">Longitude</Label><input id="m-lng" className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-80.1902" /></div>
      </div>
      {err && <p role="alert" className="mt-3 rounded-md bg-brick-bg px-3 py-2 text-[13px] text-brick-ink">{err}</p>}
    </Modal>
  )
}
