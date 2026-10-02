import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useApp } from '../state'
import { useDerived } from '../derived'
import { classNames, hasLocation, LOCATION_LABEL, money, propertyTitle } from '../lib/format'
import type { Property } from '../types'
import { Tag } from './ui'

type Col = { key: string; label: string; get: (p: Property) => string | number | null; render?: (p: Property) => React.ReactNode; align?: 'right' }

export function TableView() {
  const { hits, data, openIssueProps } = useDerived()
  const { select, selectedId } = useApp()
  const owners = useMemo(() => new Map(data!.owners.map((o) => [o.property_id, o])), [data])
  const notesBy = useMemo(() => { const m = new Map<string, number>(); data!.notes.forEach((n) => m.set(n.property_id, (m.get(n.property_id) ?? 0) + 1)); return m }, [data])
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'record', dir: 1 })
  const cols: Col[] = [
    { key: 'record', label: '#', get: (p) => p.record_no ?? 999 },
    { key: 'property', label: 'Property', get: (p) => propertyTitle(p), render: (p) => (
      <div><p className="font-serif text-[14.5px] font-semibold">{propertyTitle(p)}</p>
        <div className="mt-0.5 flex flex-wrap gap-1">{p.address_status !== 'exact' && p.record_type !== 'unidentified' && <Tag dashed>Address not confirmed</Tag>}{p.record_type === 'unidentified' && <Tag tone="brick">Unidentified</Tag>}{openIssueProps.has(p.id) && <Tag tone="amber">Source conflict</Tag>}</div></div>) },
    { key: 'owner', label: 'Owner of record', get: (p) => owners.get(p.id)?.owner_name ?? '' },
    { key: 'account', label: 'Account #', get: (p) => p.account_number ?? '' },
    { key: 'acreage', label: 'Acreage', get: (p) => p.acreage, render: (p) => (p.acreage !== null ? `${p.acreage} ac` : <span className="text-ink-3">N/A</span>), align: 'right' },
    { key: 'sale', label: 'Last sale', get: (p) => p.last_sale_date ?? '', render: (p) => p.last_sale_date ? <span className="whitespace-nowrap">{p.last_sale_date}</span> : <span className="text-ink-3">N/A</span> },
    { key: 'price', label: 'Sale price', get: (p) => p.last_sale_price, render: (p) => money(p.last_sale_price) ?? <span className="text-ink-3">N/A</span>, align: 'right' },
    { key: 'status', label: 'Status', get: (p) => p.status, render: (p) => <Tag tone="pine">{p.status}</Tag> },
    { key: 'location', label: 'Location', get: (p) => LOCATION_LABEL[p.location_status], render: (p) => (
      <span className={classNames('text-[12.5px]', !hasLocation(p) && 'text-ink-3')}>{LOCATION_LABEL[p.location_status]}</span>) },
    { key: 'followup', label: 'Follow-up', get: (p) => p.follow_up_date ?? '', render: (p) => p.follow_up_date ?? '' },
    { key: 'notes', label: 'Notes', get: (p) => notesBy.get(p.id) ?? 0, align: 'right' },
  ]
  const shown = selectedId ? cols.filter((c) => !['location', 'followup', 'notes', 'record'].includes(c.key)) : cols
  const rows = useMemo(() => {
    const c = cols.find((x) => x.key === sort.key)!
    return [...hits].sort((a, b) => {
      const x = c.get(a.property), y = c.get(b.property)
      if (x === y) return 0
      if (x === null || x === '') return 1
      if (y === null || y === '') return -1
      return (x < y ? -1 : 1) * sort.dir
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, sort, owners, notesBy])
  return (
    <div className="scroll-thin h-full overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line">
            {shown.map((c) => (
              <th key={c.key} scope="col" className={classNames('px-3 py-2 font-semibold text-ink-2', c.align === 'right' ? 'text-right' : 'text-left')}>
                <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (sort.dir === 1 ? -1 : 1) : 1 })}>
                  {c.label}{sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ property: p }) => (
            <tr key={p.id} onClick={() => select(p.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') select(p.id) }}
              className={classNames('cursor-pointer border-b border-line-2 align-top', selectedId === p.id ? 'bg-flag-soft/60' : 'bg-surface hover:bg-paper')}>
              {shown.map((c) => <td key={c.key} className={classNames('px-3 py-2.5', c.align === 'right' && 'text-right')}>{c.render ? c.render(p) : c.get(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-8 text-center text-ink-2">No records match. Clear the search or filters to see everything.</p>}
    </div>
  )
}
