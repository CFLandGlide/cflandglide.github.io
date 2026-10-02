import { useState } from 'react'
import { useApp } from '../state'
import type { Property } from '../types'
import { Button, inputCls, Label, Modal } from './ui'

export function AddPropertyDialog({ onClose }: { onClose: () => void }) {
  const { addProperty, data, select, setView } = useApp()
  const [v, setV] = useState({ address_line: '', city: 'Jupiter', state: 'FL', zip: '', account_number: '', owner: '', mailing: '', acreage: '', exact: false })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof v, x: string | boolean) => setV({ ...v, [k]: x })
  const save = async () => {
    setErr(null)
    const acct = v.account_number.replace(/\D/g, '')
    if (v.account_number && acct.length !== 17) { setErr('Palm Beach County account numbers have 17 digits. Leave it blank if you don’t have it.'); return }
    if (acct && data!.properties.some((p) => p.account_number === acct || p.account_number_as_written === acct)) { setErr(`Account ${acct} is already in CFLandGlide. Search for it instead of adding it again.`); return }
    if (!v.address_line.trim() && !acct) { setErr('Enter at least a street address or an account number.'); return }
    const acres = v.acreage ? Number(v.acreage) : null
    if (acres !== null && Number.isNaN(acres)) { setErr('Acreage must be a number.'); return }
    setBusy(true)
    const row: Partial<Property> = {
      address_line: v.address_line.trim() || null, city: v.city.trim() || null, state: v.state.trim() || null, zip: v.zip.trim() || null,
      account_number: acct || null, parcel_number: acct || null, acreage: acres,
      address_status: v.address_line.trim() ? (v.exact ? 'exact' : 'manual') : 'none', location_status: 'not_located',
      site_address_as_written: v.address_line.trim() || null, property_type_group: 'Not available in source',
    }
    const id = await addProperty(row, v.owner.trim(), v.mailing.trim())
    setBusy(false)
    if (id) { onClose(); setView('map'); select(id) }
  }
  return (
    <Modal title="Add a property" onClose={onClose} footer={<><Button kind="quiet" onClick={onClose}>Cancel</Button><Button kind="primary" disabled={busy} onClick={save}>{busy ? 'Adding…' : 'Add property'}</Button></>}>
      <p className="mb-3 text-[13px] text-ink-2">Added properties are marked “Added in the app”. With an account number, “Locate parcels” in Data check can place it on the map from county records.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label htmlFor="a1">Street address</Label><input id="a1" className={inputCls} value={v.address_line} onChange={(e) => set('address_line', e.target.value)} placeholder="House number and street" /></div>
        <div><Label htmlFor="a2">City</Label><input id="a2" className={inputCls} value={v.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="a3">State</Label><input id="a3" className={inputCls} value={v.state} onChange={(e) => set('state', e.target.value)} /></div><div><Label htmlFor="a4">ZIP</Label><input id="a4" className={inputCls} value={v.zip} onChange={(e) => set('zip', e.target.value)} /></div></div>
        <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={v.exact} onChange={(e) => set('exact', e.target.checked)} className="accent-[#1f3b33]" /> This street address is verified</label>
        <div className="col-span-2"><Label htmlFor="a5">Account / parcel number (17 digits)</Label><input id="a5" className={inputCls} value={v.account_number} onChange={(e) => set('account_number', e.target.value)} placeholder="17 digits, e.g. from the Property Appraiser site" /></div>
        <div className="col-span-2"><Label htmlFor="a6">Owner of record</Label><input id="a6" className={inputCls} value={v.owner} onChange={(e) => set('owner', e.target.value)} /></div>
        <div className="col-span-2"><Label htmlFor="a7">Owner mailing address</Label><input id="a7" className={inputCls} value={v.mailing} onChange={(e) => set('mailing', e.target.value)} /></div>
        <div><Label htmlFor="a8">Acreage</Label><input id="a8" className={inputCls} inputMode="decimal" value={v.acreage} onChange={(e) => set('acreage', e.target.value)} /></div>
      </div>
      {err && <p role="alert" className="mt-3 rounded-md bg-brick-bg px-3 py-2 text-[13px] text-brick-ink">{err}</p>}
    </Modal>
  )
}
