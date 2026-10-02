import { useApp } from '../../state'
import type { Property } from '../../types'
import { Empty, Section, SourceTag, Tag } from '../ui'
import { RevealToggle } from './fields'

export function PeopleTab({ p, kind }: { p: Property; kind: 'relatives' | 'associates' }) {
  const data = useApp((s) => s.data)!
  const revealed = useApp((s) => !!s.revealed[p.id])
  const people = data[kind].filter((r) => r.property_id === p.id && !r.archived).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const title = kind === 'relatives' ? 'Possible relatives' : 'Possible associates'
  return (
    <Section title={`${title} (${people.length})`} aside={people.length > 0 && <RevealToggle pid={p.id} />}>
      <p className="mb-3 text-[13px] text-ink-2">
        Listed in the source under this property’s record (account {p.account_number ?? 'none'}). They are <b className="text-ink">not owners</b>; the relationship is exactly as the source states it.
      </p>
      {!people.length && <Empty title={`No ${kind} listed in the source for this record`} />}
      <ul className="space-y-2">
        {people.map((r) => (
          <li key={r.id} className="rounded-md border border-line px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold">{r.name}</span>
              {r.relationship && <Tag tone="pine">{r.relationship}</Tag>}
              {r.age_in_source !== null && <span className="text-[12.5px] text-ink-3">{r.age_in_source} in source</span>}
              <SourceTag src={r.source_ref} />
            </div>
            {revealed ? (
              <div className="mt-1.5 text-[13px] text-ink-2">
                <p>{r.address ?? <span className="text-ink-3">No address in source</span>}</p>
                {r.phones.length ? (
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    {r.phones.map((ph, i) => <li key={i}><a className="font-medium text-ink underline-offset-2 hover:underline" href={`tel:${ph.phone.replace(/\D/g, '')}`}>{ph.phone}</a>{ph.type ? <span className="text-ink-3"> {ph.type}</span> : <span className="text-ink-3"> (no type in source)</span>}</li>)}
                  </ul>
                ) : <p className="text-ink-3">No phone numbers in source</p>}
              </div>
            ) : (
              <p className="mt-1 text-[12.5px] text-ink-3">{r.phones.length} phone{r.phones.length === 1 ? '' : 's'}{r.address ? ' and an address' : ''} hidden</p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
