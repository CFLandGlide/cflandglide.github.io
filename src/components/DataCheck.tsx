import { useApp } from '../state'
import { useDerived } from '../derived'
import { validationReport } from '../lib/checks'
import { ADDRESS_LABEL, classNames, LOCATION_LABEL, propertyTitle } from '../lib/format'
import { Button, Tag } from './ui'
import { SourceImages } from './SourceImages'

function Row({ label, value, note, warn }: { label: string; value: number | string; note?: string; warn?: boolean }) {
  return (
    <tr className="border-b border-line-2">
      <th scope="row" className="py-2 pr-4 text-left font-normal text-ink-2">{label}{note && <span className="block text-[12px] text-ink-3">{note}</span>}</th>
      <td className={classNames('py-2 text-right text-[15px] font-semibold', warn && Number(value) > 0 && 'text-amber-ink')}>{value}</td>
    </tr>
  )
}

export function DataCheck() {
  const { data } = useDerived()
  const { locateParcels, busy, select, setView } = useApp()
  const r = validationReport(data!)
  const lookups = new Map(data!.parcel_lookups.map((l) => [l.property_id, l]))
  const props = [...data!.properties].filter((p) => !p.archived).sort((a, b) => (a.record_no ?? 999) - (b.record_no ?? 999))
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="font-serif text-[26px] font-semibold">Data check</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-2">The validation report, worked out live from the data. Numbers change as parcels are located and review items are cleared.</p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <table className="w-full text-[13.5px]">
            <tbody>
              <Row label="Total properties found" value={r.total} note={r.unidentified ? `Plus ${r.unidentified} unidentified block (p.65), kept separate` : undefined} />
              <Row label="Properties with exact addresses" value={r.exactAddress} />
              <Row label="Properties without exact addresses" value={r.noExactAddress} note={r.disputed ? `Includes ${r.disputed} disputed address` : undefined} />
              <Row label="Properties placed on the map" value={r.located} note={`${r.exactConfirmed} exact address confirmed, ${r.parcelLocated} located by parcel ID only`} />
              <Row label="Properties needing manual location checks" value={r.needsLocationCheck} warn note={r.notLocated ? `${r.notLocated} not on the map yet` : undefined} />
              <Row label="Properties with owner information" value={r.withOwner} />
              <Row label="Properties with owner contact numbers" value={r.withContacts} note={`${r.ownerPhones} owner numbers, ${r.relatives} possible relatives, ${r.associates} possible associates`} />
              <Row label="Properties with open conflicts" value={r.withConflicts} warn />
              <Row label="Duplicate account numbers" value={r.duplicateAccountNumbers} warn />
              <Row label="Potential duplicate properties" value={r.potentialDuplicates} warn />
              <Row label="Records requiring manual review" value={r.needsReview} warn note={`${r.openInfo} more items for information only`} />
            </tbody>
          </table>
          <div className="space-y-4">
            <SourceImages />
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[14px] font-semibold">Locate parcels</p>
              <p className="mt-1 text-[13px] text-ink-2">Looks up each parcel ID in Palm Beach County’s public parcel data and draws its outline. Addresses are never guessed. {r.countyChecked} of {r.total} checked so far.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button kind="primary" disabled={!!busy} onClick={() => locateParcels(true)}>Locate missing</Button>
                <Button disabled={!!busy} onClick={() => locateParcels(false)}>Re-check all</Button>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[14px] font-semibold">How exact addresses are confirmed</p>
              <p className="mt-1 text-[13px] text-ink-2">A street address becomes “Exact location confirmed” only when the county’s own record for that parcel lists the same site address. Otherwise it stays “Located by parcel ID” and shows up in the Review queue.</p>
            </div>
          </div>
        </div>

        <h2 className="mt-10 mb-2 text-[16px] font-semibold">Location status by record</h2>
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-line text-left text-ink-2">
              <th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Property</th><th className="px-3 py-2 font-semibold">Account #</th>
              <th className="px-3 py-2 font-semibold">Address in source</th><th className="px-3 py-2 font-semibold">County lookup</th><th className="px-3 py-2 font-semibold">County site address</th><th className="px-3 py-2 font-semibold">On the map as</th>
            </tr></thead>
            <tbody>
              {props.map((p) => {
                const l = lookups.get(p.id)
                return (
                  <tr key={p.id} className="cursor-pointer border-b border-line-2 hover:bg-paper" onClick={() => { setView('list'); select(p.id) }}>
                    <td className="px-3 py-2">{p.record_no ?? '—'}</td>
                    <td className="px-3 py-2 font-serif text-[14px] font-semibold">{propertyTitle(p)}</td>
                    <td className="px-3 py-2">{p.account_number ?? 'None'}</td>
                    <td className="px-3 py-2">{p.record_type === 'unidentified' ? <Tag tone="brick">Unidentified</Tag> : <Tag dashed={p.address_status !== 'exact'}>{ADDRESS_LABEL[p.address_status]}</Tag>}</td>
                    <td className="px-3 py-2">{p.record_type === 'unidentified' ? 'Not looked up' : !l ? 'Not yet' : l.status === 'found' ? 'Parcel found' : l.status === 'not_found' ? 'Not found' : l.status === 'multiple' ? 'Several matches' : `Failed: ${l.error ?? ''}`}</td>
                    <td className="px-3 py-2">{l?.status !== 'found' ? '—' : String(l.attributes?.SITE_ADDR_STR ?? '').trim() || <span className="text-ink-3">(none on county record)</span>}</td>
                    <td className="px-3 py-2">{LOCATION_LABEL[p.location_status]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
