import { useApp } from '../../state'
import type { Property } from '../../types'
import { dateLong, dateTime, LOCATION_LABEL, money, num } from '../../lib/format'
import { countyAddress, countyMailing, countyOwner } from '../../lib/county'
import { Section, SourceTag } from '../ui'
import { Field, imported, isEdited, srcOf, useIssuesFor, type Item } from './fields'

export function OverviewTab({ p, items }: { p: Property; items: Item[] }) {
  const data = useApp((s) => s.data)!
  const sv = p.source_values as Record<string, unknown> | null
  const imp = imported(sv)
  const issues = useIssuesFor(items)
  const summary = data.summary_records.find((s) => s.property_id === p.id)
  const lookup = data.parcel_lookups.find((l) => l.property_id === p.id)
  const bedNote = (sv?.bed_bath_note as { value: string; src: string } | undefined)
  const f = (col: keyof Property, label: string, display: (v: never) => React.ReactNode, srcKey?: string) => (
    <Field label={label} value={p[col] === null ? null : display(p[col] as never)} src={srcKey ? srcOf(sv, srcKey) : null}
      edited={isEdited(sv, col, p[col])} original={imp?.[col] !== undefined ? display(imp[col] as never) : null} issues={issues(col)} />
  )
  const a = lookup?.attributes as Record<string, unknown> | undefined

  return (
    <>
      <Section title="Property">
        <dl>
          <Field label="Site address (as written)" value={p.site_address_as_written} src={srcOf(sv, 'site_address')} issues={issues('address_line')}
            hint={p.address_status === 'exact' ? null : 'Address Not Confirmed: the source has no full street address for this record.'} />
          {f('address_line', 'Street address', (v: string) => v, 'site_address')}
          <Field label="City / State" value={[p.city, p.state].filter(Boolean).join(', ')} />
          {f('zip', 'ZIP', (v: string) => v, 'zip_from_image')}
          <Field label="Account number" value={p.account_number} src={p.record_type === 'unidentified' ? 'Source document, p.65' : p.source_ref} issues={issues('account_number')}
            hint={p.record_type === 'unidentified' ? `Written in the source as ${p.account_number_as_written} (that number belongs to record #1).` : null} />
          <Field label="Parcel number" value={p.parcel_number} src={p.record_type === 'property' && p.parcel_number ? `Parcel screenshot in source (p.${p.source_pages?.split('–')[0]}) shows this parcel ID` : null}
            hint={p.parcel_number && p.parcel_number === p.account_number ? 'Same as the account number (Palm Beach County parcel control number).' : null} />
          <Field label="Location" value={LOCATION_LABEL[p.location_status]} src={p.location_source} issues={issues('location')}
            hint={p.lat !== null ? `${p.lat?.toFixed(6)}, ${p.lng?.toFixed(6)}${p.location_checked_at ? ` (checked ${dateTime(p.location_checked_at)})` : ''}` : 'No coordinates. Nothing is guessed.'} />
          {f('property_type', 'Property type', (v: string) => v, 'property_type')}
          {f('acreage', 'Acreage', (v: number) => `${num(v)} ac`, 'acreage')}
          {f('land_sqft', 'Land area', (v: number) => `${num(v, 0)} sq ft`, 'land_sqft')}
          {f('building_sqft', 'Building area', (v: number) => `${num(v, 0)} sq ft`, 'building_sqft')}
          {f('bedrooms', 'Bedrooms', (v: number) => String(v), 'bedrooms')}
          {f('bathrooms', 'Bathrooms', (v: number) => String(v), 'bathrooms')}
          {bedNote && <Field label="Rooms / building" value={bedNote.value} src={bedNote.src} />}
          {f('assessed_value', p.assessed_value_label ?? 'Tax assessed value', (v: number) => money(v), 'assessed')}
          {f('estimated_value', p.estimated_value_label ?? 'Estimated value', (v: number) => money(v), 'estimated')}
          {f('last_sale_date', 'Last sale date', (v: string) => dateLong(v), 'sale_date')}
          {f('last_sale_price', 'Last sale price', (v: number) => money(v), 'sale_price')}
          <Field label="Verification" value={p.verification_status} />
        </dl>
      </Section>

      {p.source_notes?.length > 0 && (
        <Section title="Research notes in the source document">
          <ul className="space-y-2 text-[13.5px]">
            {p.source_notes.map((n, i) => <li key={i} className="border-l-2 border-line pl-3 text-ink-2">{n.value} <SourceTag src={n.src} /></li>)}
          </ul>
        </Section>
      )}

      {summary && (
        <Section title="Summary entry (p.1–4), as written">
          <dl>
            <Field label="Address" value={summary.address_as_written} />
            <Field label="Owner" value={summary.owner_as_written} />
            <Field label="Property value" value={summary.value_as_written} />
            <Field label="Acreage" value={summary.acreage_as_written} />
            <Field label="Last sold" value={summary.last_sold_as_written} />
            <Field label="Linked to this record by" value={summary.link_basis} />
          </dl>
        </Section>
      )}

      <Section title="County parcel record (live check)">
        {!lookup && <p className="text-[13px] text-ink-2">Not checked yet. Use “Locate parcels” in Data check.</p>}
        {lookup && lookup.status !== 'found' && <p className="text-[13px] text-ink-2">{lookup.status === 'not_found' ? 'The county returned no parcel with this ID.' : `Lookup failed: ${lookup.error}`} Checked {dateTime(lookup.fetched_at)}.</p>}
        {lookup?.status === 'found' && a && (
          <>
            <p className="mb-2 text-[12.5px] text-ink-3">From Palm Beach County’s public parcel data, fetched {dateTime(lookup.fetched_at)}. Shown for comparison only; it is not part of the source document and never replaces it.</p>
            <dl>
              <Field label="Parcel ID" value={String(a.PARID ?? '')} />
              <Field label="Owner" value={countyOwner(a)} />
              <Field label="Site address" value={countyAddress(a) ?? '(blank)'} />
              <Field label="Mailing address" value={countyMailing(a)} />
              <Field label="Use" value={String(a.PROPERTY_USE ?? '') || null} />
              <Field label="Acres" value={a.ACRES !== undefined && a.ACRES !== null ? `${num(Number(a.ACRES), 4)} ac` : null} />
              <Field label="Latest sale" value={a.SALE_DATE ? `${dateLong(String(a.SALE_DATE))}, ${money(Number(a.PRICE ?? 0))}` : null} />
              <Field label="Assessed value" value={money(Number(a.ASSESSED_VAL ?? NaN))} />
              <Field label="Total market value" value={money(Number(a.TOTAL_MARKET ?? NaN))} />
            </dl>
          </>
        )}
        {lookup?.geocode && (
          <p className="mt-2 text-[12.5px] text-ink-2">Google address check: {lookup.geocode.result === 'agrees' ? 'agrees with the county parcel' : lookup.geocode.result === 'no_result' ? 'Google could not find the address' : `does not match (${Math.round(lookup.geocode.distance_to_parcel_m ?? 0)} m from the parcel)`}{lookup.geocode.formatted_address ? `: “${lookup.geocode.formatted_address}”` : ''}.</p>
        )}
      </Section>
    </>
  )
}
