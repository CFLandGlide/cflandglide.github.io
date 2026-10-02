import { useMemo, useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, Eye, Navigation, NotebookPen, Pencil, X } from 'lucide-react'
import { useApp } from '../../state'
import { useDerived } from '../../derived'
import { issuesFor } from '../../lib/checks'
import { ADDRESS_LABEL, classNames, fullAddress, hasLocation, LOCATION_LABEL, propertySubtitle, propertyTitle } from '../../lib/format'
import { directionsUrl, googleMapsUrl } from '../../lib/maps'
import { Tag } from '../ui'
import { OverviewTab } from './OverviewTab'
import { OwnerTab } from './OwnerTab'
import { PeopleTab } from './PeopleTab'
import { NotesTab } from './NotesTab'
import { ImagesTab } from './ImagesTab'
import { SourcesTab } from './SourcesTab'
import { HistoryTab } from './HistoryTab'
import { EditPropertyDialog } from './EditPropertyDialog'

export function PropertyPanel() {
  const { selectedId, select, panelTab, setTab, updateProperty, openStreetView, toast, session, google } = useApp()
  const { data, items } = useDerived()
  const [editing, setEditing] = useState(false)
  const p = data!.properties.find((x) => x.id === selectedId)
  const mine = useMemo(() => (p ? issuesFor(items, p.id) : []), [items, p])
  if (!p) return null
  const settings = data!.settings
  const counts = {
    relatives: data!.relatives.filter((r) => r.property_id === p.id && !r.archived).length,
    associates: data!.associates.filter((r) => r.property_id === p.id && !r.archived).length,
    notes: data!.notes.filter((n) => n.property_id === p.id).length,
    images: data!.property_images.filter((i) => i.property_id === p.id && !i.archived).length,
    issues: mine.filter((i) => i.status === 'open').length,
  }
  const conflicts = mine.filter((i) => i.status === 'open' && i.severity !== 'info').length
  const located = hasLocation(p)
  const lookup = data!.parcel_lookups.find((l) => l.property_id === p.id)
  const dest = p.location_status === 'exact_confirmed' && lookup?.geocode?.lat ? { lat: lookup.geocode.lat, lng: lookup.geocode.lng! } : located ? { lat: p.lat!, lng: p.lng! } : null
  const svAllowed = located && !!p.geometry && p.location_status !== 'manual'
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`) } catch { toast('Copy failed — select the text instead', 'error') } }
  // Show the relatives / associates tab only when the source lists people of that kind (a record has one or the other)
  const people: [string, string, number?][] = []
  if (counts.relatives || !counts.associates) people.push(['relatives', 'Relatives', counts.relatives])
  if (counts.associates) people.push(['associates', 'Associates', counts.associates])
  const tabs: [string, string, number?][] = [['overview', 'Overview'], ['owner', 'Owner'], ...people,
    ['notes', 'Notes', counts.notes], ['images', 'Images', counts.images], ['sources', 'Sources', counts.issues], ['history', 'History']]

  const action = (label: string, icon: React.ReactNode, onClick: () => void, disabled?: string | false) => (
    <button onClick={onClick} disabled={!!disabled} title={disabled || label}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12.5px] font-medium text-ink hover:border-ink-3 disabled:cursor-not-allowed disabled:text-ink-3 disabled:opacity-60">
      {icon}{label}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-3">{p.record_type === 'unidentified' ? 'Unidentified block' : p.record_type === 'manual' ? 'Added in the app' : `Record #${p.record_no}`}{p.source_pages ? `, source p.${p.source_pages}` : ''}</p>
            <h2 className="font-serif text-[22px] leading-tight font-semibold break-words">{propertyTitle(p)}</h2>
            <p className="text-[13px] text-ink-2">{propertySubtitle(p)}</p>
          </div>
          <button onClick={() => select(null)} aria-label="Close property" className="rounded p-1 text-ink-3 hover:bg-pine-50 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-ink-2">Account</span>
          <span className="text-[13.5px] font-semibold">{p.account_number ?? 'None'}</span>
          {p.account_number && <button aria-label="Copy account number" onClick={() => copy(p.account_number!, 'Account number')} className="rounded p-0.5 text-ink-3 hover:text-ink"><Copy size={13} /></button>}
          <Tag dashed={p.address_status !== 'exact'} tone={p.address_status === 'disputed' ? 'amber' : 'neutral'}>{p.address_status === 'exact' ? ADDRESS_LABEL.exact : 'Address not confirmed'}</Tag>
          <Tag dashed={p.location_status !== 'exact_confirmed'}>{LOCATION_LABEL[p.location_status]}</Tag>
          {conflicts > 0 && <button onClick={() => setTab('sources')}><Tag tone="amber">{conflicts} source conflict{conflicts > 1 ? 's' : ''}</Tag></button>}
        </div>

        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
          <label htmlFor="st" className="text-ink-3">Status</label>
          <select id="st" value={p.status} onChange={(e) => updateProperty(p.id, { status: e.target.value }, `Status changed to ${e.target.value}`)}
            className="w-fit rounded-md border border-line bg-surface px-2 py-1 font-medium focus:border-ink focus:outline-none">
            {[...new Set([...settings.statuses, p.status])].map((s) => <option key={s}>{s}</option>)}
          </select>
          <label htmlFor="fu" className="text-ink-3">Follow-up</label>
          <div className="flex flex-wrap items-center gap-3">
            <input id="fu" type="date" value={p.follow_up_date ?? ''} onChange={(e) => updateProperty(p.id, { follow_up_date: e.target.value || null }, e.target.value ? `Follow-up set for ${e.target.value}` : 'Follow-up cleared')}
              className="rounded-md border border-line px-2 py-0.5 focus:border-ink focus:outline-none" />
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={p.contacted} onChange={(e) => updateProperty(p.id, { contacted: e.target.checked }, e.target.checked ? 'Marked as contacted' : 'Marked as not contacted')} className="accent-[#1f3b33]" /> Contacted</label>
          </div>
          <label htmlFor="vs" className="text-ink-3">Verification</label>
          <select id="vs" value={p.verification_status} onChange={(e) => updateProperty(p.id, { verification_status: e.target.value }, `Verification: ${e.target.value}`)} className="w-fit rounded-md border border-line bg-surface px-2 py-1 focus:border-ink focus:outline-none">
            {[...new Set([...settings.verification_statuses, p.verification_status])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {action('Street View', <Eye size={14} />, () => openStreetView(p.id), !svAllowed ? (located ? 'Street View is off for manually placed locations' : 'Street View unavailable: no confirmed location') : !google ? 'Google Maps is not loaded' : false)}
          {action('Open in Google Maps', <ExternalLink size={14} />, () => window.open(googleMapsUrl(dest!.lat, dest!.lng), '_blank', 'noopener'), !dest && 'No confirmed location')}
          {action('Directions', <Navigation size={14} />, () => window.open(directionsUrl(dest!.lat, dest!.lng), '_blank', 'noopener'), !dest && 'No confirmed location')}
          {action('Copy address', <Copy size={14} />, () => copy(p.address_status === 'exact' ? fullAddress(p) : `${p.site_address_as_written ?? ''} (address not confirmed; account ${p.account_number ?? 'none'})`, 'Address'))}
          {action('Add note', <NotebookPen size={14} />, () => setTab('notes'))}
          {action('Edit property', <Pencil size={14} />, () => setEditing(true))}
          {action(p.reviewed ? 'Reviewed' : 'Mark as reviewed', <CheckCircle2 size={14} className={p.reviewed ? 'text-ink' : ''} />, () =>
            updateProperty(p.id, p.reviewed ? { reviewed: false, reviewed_at: null, reviewed_by_name: null } : { reviewed: true, reviewed_at: new Date().toISOString(), reviewed_by_name: session?.name ?? null }, p.reviewed ? 'Review mark removed' : 'Marked as reviewed'))}
        </div>
        {p.reviewed && <p className="mt-1.5 text-[12px] text-ink-3">Reviewed by {p.reviewed_by_name} on {p.reviewed_at?.slice(0, 10)}</p>}
      </div>

      <div className="flex gap-0.5 overflow-x-auto border-b border-line px-3.5 scroll-thin" role="tablist">
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={panelTab === k} onClick={() => setTab(k)}
            className={classNames('-mb-px shrink-0 border-b-2 px-1.5 py-2 text-[12.5px] font-medium', panelTab === k ? 'border-flag text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
            {l}{n ? <span className="ml-1 text-ink-3">{n}</span> : null}
          </button>
        ))}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto" role="tabpanel">
        {p.record_type === 'unidentified' && (
          <div className="mx-5 mt-4 rounded-md border border-brick-ink/25 bg-brick-bg px-3 py-2.5 text-[13px] text-brick-ink">
            <p className="font-semibold">Unidentified record</p>
            <p>This block on p.65 is written with account number {p.account_number_as_written}, which belongs to record #1. Its owner, sale and image are blank. It is kept separate, is not linked to that parcel, and is not on the map.</p>
          </div>
        )}
        {panelTab === 'overview' && <OverviewTab p={p} items={mine} />}
        {panelTab === 'owner' && <OwnerTab p={p} items={mine} />}
        {panelTab === 'relatives' && <PeopleTab p={p} kind="relatives" />}
        {panelTab === 'associates' && <PeopleTab p={p} kind="associates" />}
        {panelTab === 'notes' && <NotesTab p={p} />}
        {panelTab === 'images' && <ImagesTab p={p} />}
        {panelTab === 'sources' && <SourcesTab p={p} items={mine} />}
        {panelTab === 'history' && <HistoryTab p={p} />}
      </div>
      {editing && <EditPropertyDialog p={p} onClose={() => setEditing(false)} />}
    </div>
  )
}
