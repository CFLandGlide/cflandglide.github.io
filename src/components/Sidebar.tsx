import { useApp } from '../state'
import { useDerived } from '../derived'
import { classNames, hasLocation, money, propertyTitle, today } from '../lib/format'
import { Tag } from './ui'

export function Sidebar() {
  const { hits, data, openIssueProps } = useDerived()
  const select = useApp((s) => s.select)
  const query = useApp((s) => s.query)
  const owners = new Map(data!.owners.map((o) => [o.property_id, o]))
  const t = today()
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line-2 px-5 py-3">
        <p className="text-[13px] text-ink-2">{hits.length} {hits.length === 1 ? 'record' : 'records'}{query ? ` match “${query}”` : ''}. Select one to open it.</p>
      </div>
      <ul className="scroll-thin flex-1 overflow-y-auto">
        {hits.map(({ property: p, reason }) => {
          const o = owners.get(p.id)
          return (
            <li key={p.id} className="border-b border-line-2">
              <button onClick={() => select(p.id)} className="block w-full px-5 py-3 text-left hover:bg-paper">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-[15.5px] font-semibold leading-snug">{propertyTitle(p)}</p>
                    <p className="truncate text-[13px] text-ink-2">{o?.owner_name ?? 'No owner in source'}</p>
                  </div>
                  <Tag tone="pine">{p.status}</Tag>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                  <span>{p.account_number ? `Acct ${p.account_number}` : 'No account number'}</span>
                  {p.acreage !== null && <span>{p.acreage} ac</span>}
                  {p.last_sale_date && <span>Sold {p.last_sale_date.slice(0, 4)}{p.last_sale_price !== null ? ` for ${money(p.last_sale_price)}` : ''}</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {!hasLocation(p) && <Tag dashed>Not on the map</Tag>}
                  {p.address_status !== 'exact' && p.record_type !== 'unidentified' && <Tag dashed>Address not confirmed</Tag>}
                  {p.record_type === 'unidentified' && <Tag tone="brick">Unidentified record</Tag>}
                  {openIssueProps.has(p.id) && <Tag tone="amber">Source conflict</Tag>}
                  {p.contacted && <Tag>Contacted</Tag>}
                  {p.follow_up_date && <Tag tone={p.follow_up_date <= t ? 'flag' : 'neutral'}>Follow up {p.follow_up_date}</Tag>}
                  {p.reviewed && <Tag>Reviewed</Tag>}
                </div>
                {reason && query && <p className={classNames('mt-1.5 text-[12px] text-ink-3')}>Matched: {reason}</p>}
              </button>
            </li>
          )
        })}
        {!hits.length && <li className="px-5 py-8 text-center text-[13.5px] text-ink-2">No records match. Try fewer words or clear the filters.</li>}
      </ul>
    </div>
  )
}
