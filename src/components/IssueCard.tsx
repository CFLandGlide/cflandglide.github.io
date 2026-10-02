import { useState } from 'react'
import { useApp } from '../state'
import { classNames, dateTime, propertyTitle } from '../lib/format'
import type { DataIssue } from '../types'
import { Button, inputCls, SourceTag, Tag } from './ui'

const SEV: Record<DataIssue['severity'], [string, 'brick' | 'amber' | 'neutral']> = {
  critical: ['Affects owner–property link', 'brick'], conflict: ['Source conflict', 'amber'], info: ['For information', 'neutral'],
}

export function IssueCard({ issue, showProperty }: { issue: DataIssue & { live?: boolean }; showProperty?: boolean }) {
  const { data, setIssueStatus, select, setView } = useApp()
  const [acting, setActing] = useState<null | 'resolved' | 'accepted'>(null)
  const [note, setNote] = useState('')
  const prop = data!.properties.find((p) => p.id === issue.property_id)
  const related = (issue.related_property_ids ?? []).map((id) => data!.properties.find((p) => p.id === id)).filter(Boolean)
  const [label, tone] = SEV[issue.severity]
  const go = (id: string) => { select(id, 'sources'); if (useApp.getState().view !== 'list') setView('map') }
  return (
    <div className={classNames('rounded-md border bg-surface px-3.5 py-3', issue.status === 'open' ? 'border-line' : 'border-line-2 opacity-80')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone={tone}>{label}</Tag>
        {issue.category && <span className="text-[12px] text-ink-3">{issue.category}</span>}
        {issue.live && <span className="text-[12px] text-ink-3">(live check)</span>}
        <span className="ml-auto text-[12px] text-ink-3">{issue.status === 'open' ? 'Open' : issue.status === 'resolved' ? 'Resolved' : 'Accepted'}</span>
      </div>
      <p className="mt-1.5 text-[14px] font-semibold">{issue.title}</p>
      {showProperty && (prop || related.length > 0) && (
        <p className="mt-0.5 text-[12.5px] text-ink-2">
          {[prop, ...related].filter(Boolean).map((p, i) => (
            <span key={p!.id}>{i > 0 && ' and '}<button className="font-medium text-ink underline underline-offset-2" onClick={() => go(p!.id)}>{propertyTitle(p!)}</button>{p!.account_number ? ` (${p!.account_number})` : ''}</span>
          ))}
        </p>
      )}
      {issue.detail && <p className="mt-1 text-[13px] text-ink-2">{issue.detail}</p>}
      {issue.issue_values?.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 text-[13px]">
          {issue.issue_values.map((v, i) => <li key={i} className="flex flex-wrap items-baseline gap-1.5"><span className="font-medium">{v.value}</span><SourceTag src={v.src} /></li>)}
        </ul>
      )}
      {issue.status !== 'open' && (
        <p className="mt-2 text-[12.5px] text-ink-2">{issue.status === 'resolved' ? 'Resolved' : 'Accepted'} by {issue.resolved_by_name ?? 'unknown'}{issue.resolved_at ? `, ${dateTime(issue.resolved_at)}` : ''}{issue.resolution_note ? `: ${issue.resolution_note}` : ''}</p>
      )}
      {acting ? (
        <form className="mt-2 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await setIssueStatus(issue, acting, note)) { setActing(null); setNote('') } }}>
          <input autoFocus className={classNames(inputCls, 'min-w-56 flex-1')} placeholder={acting === 'resolved' ? 'What was checked or decided?' : 'Why is this acceptable as is?'} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button kind="primary" type="submit">{acting === 'resolved' ? 'Mark resolved' : 'Accept as is'}</Button>
          <Button kind="quiet" onClick={() => setActing(null)}>Cancel</Button>
        </form>
      ) : (
        <div className="mt-2 flex gap-1.5">
          {issue.status === 'open' ? (
            <><Button small onClick={() => setActing('resolved')}>Mark resolved</Button><Button small kind="quiet" onClick={() => setActing('accepted')}>Accept as is</Button></>
          ) : <Button small kind="quiet" onClick={() => setIssueStatus(issue, 'open', '')}>Reopen</Button>}
        </div>
      )}
    </div>
  )
}
