import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { DataIssue, SourceValue } from '../../types'
import { NA } from '../../lib/format'
import { useApp } from '../../state'
import { SourceTag, Tag } from '../ui'

export type Item = DataIssue & { live?: boolean }

/** Which review-item field each displayed column relates to. */
export const ISSUE_FIELD: Record<string, string> = {
  address_line: 'site_address', last_sale_date: 'last_sale_date', last_sale_price: 'last_sale_date', owner_name: 'owner_name',
  mailing_address: 'mailing_address', account_number: 'account_number', acreage: 'acreage',
}

export function imported(sv: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  return (sv?._imported as Record<string, unknown>) ?? null
}

export function isEdited(sv: Record<string, unknown> | null | undefined, col: string, current: unknown) {
  const imp = imported(sv)
  if (!imp || !(col in imp)) return false
  return JSON.stringify(imp[col] ?? null) !== JSON.stringify(current ?? null)
}

export function ConflictNote({ issues }: { issues: Item[] }) {
  const [open, setOpen] = useState(false)
  if (!issues.length) return null
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-[5px] border border-amber-ink/25 bg-amber-bg px-1.5 text-[12px] font-medium text-amber-ink">
        <AlertTriangle size={12} /> Source conflict detected
      </button>
      {open && issues.map((i) => (
        <div key={i.id} className="mt-1.5 rounded-md border border-amber-ink/20 bg-amber-bg/50 p-2 text-[12.5px] text-ink-2">
          <p className="font-medium text-ink">{i.title}</p>
          {i.detail && <p className="mt-0.5">{i.detail}</p>}
          {i.issue_values?.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {i.issue_values.map((v, k) => <li key={k} className="flex flex-wrap items-baseline gap-1.5"><span className="font-medium text-ink">{v.value}</span><SourceTag src={v.src} /></li>)}
            </ul>
          )}
          {i.status !== 'open' && <p className="mt-1 text-ink-3">Marked {i.status} by {i.resolved_by_name}{i.resolution_note ? `: ${i.resolution_note}` : ''}</p>}
        </div>
      ))}
    </div>
  )
}

export function Field({ label, value, src, edited, original, issues = [], hint, children }: {
  label: string; value?: ReactNode; src?: string | null; edited?: boolean; original?: ReactNode; issues?: Item[]; hint?: ReactNode; children?: ReactNode
}) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="grid grid-cols-[150px_1fr] gap-x-3 py-[5px]">
      <dt className="pt-px text-[12.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[13.5px]">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          {children ?? (empty ? <span className="text-ink-3">{NA}</span> : <span className="break-words">{value}</span>)}
          {src && <SourceTag src={src} />}
          {edited && <Tag tone="flag" title="Changed in the app. The original source value is kept.">Edited</Tag>}
        </div>
        {edited && <p className="mt-0.5 text-[12px] text-ink-3">Original source value: {original === null || original === undefined || original === '' ? '(blank)' : original}</p>}
        {hint && <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>}
        <ConflictNote issues={issues} />
      </dd>
    </div>
  )
}

export function srcOf(sv: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = sv?.[key] as SourceValue | undefined
  return v && typeof v === 'object' && 'src' in v ? v.src : null
}

export function useIssuesFor(items: Item[]) {
  return (field: string) => items.filter((i) => i.field === ISSUE_FIELD[field] || i.field === field)
}

export function RevealToggle({ pid }: { pid: string }) {
  const revealed = useApp((s) => !!s.revealed[pid])
  const reveal = useApp((s) => s.reveal)
  return (
    <button onClick={() => reveal(pid)} aria-pressed={revealed}
      className="rounded-md border border-line px-2 py-0.5 text-[12.5px] font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
      {revealed ? 'Hide contact details' : 'Show contact details'}
    </button>
  )
}
