import { ExternalLink } from 'lucide-react'
import type { Property } from '../../types'
import { Empty, Section, SourceTag } from '../ui'
import { IssueCard } from '../IssueCard'
import type { Item } from './fields'

export function SourcesTab({ p, items }: { p: Property; items: Item[] }) {
  const order = { critical: 0, conflict: 1, info: 2 }
  const sorted = [...items].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || order[a.severity] - order[b.severity])
  return (
    <>
      <Section title="Where this record comes from">
        <p className="text-[13.5px]">{p.source_ref ?? 'Added in the app (no source document).'}</p>
        {p.source_pages && <p className="mt-1 text-[13px] text-ink-2">Pages {p.source_pages} of the uploaded research document (65 pages).</p>}
        {p.source_links?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {p.source_links.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-1.5 text-[13px]">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">{l.label}<ExternalLink size={12} /></a>
                <SourceTag src={l.src} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={`Review items for this record (${items.filter((i) => i.status === 'open').length} open)`}>
        {!sorted.length && <Empty title="Nothing flagged for this record" />}
        <div className="space-y-2.5">{sorted.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
      </Section>
    </>
  )
}
