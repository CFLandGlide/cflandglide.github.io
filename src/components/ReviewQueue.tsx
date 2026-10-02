import { useState } from 'react'
import { useDerived } from '../derived'
import { classNames } from '../lib/format'
import { IssueCard } from './IssueCard'
import { Empty } from './ui'

const GROUPS = [
  ['critical', 'Affects which owner belongs to which parcel', 'Check these first. Nothing here was resolved automatically.'],
  ['conflict', 'Source conflicts', 'The document (or the county record) gives different values. Both are kept and shown with their sources.'],
  ['info', 'For information', 'Gaps and leads worth knowing about. They do not block anything.'],
] as const

export function ReviewQueue() {
  const { items } = useDerived()
  const [show, setShow] = useState<'open' | 'done' | 'all'>('open')
  const list = items.filter((i) => (show === 'all' ? true : show === 'open' ? i.status === 'open' : i.status !== 'open'))
  const counts = { open: items.filter((i) => i.status === 'open').length, done: items.filter((i) => i.status !== 'open').length, all: items.length }
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="font-serif text-[26px] font-semibold">Review queue</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-2">Everything questionable found in the source document, plus live checks against county records. Marking an item resolved or accepted records your name, the time and your note. It never changes the source values.</p>
        <div className="mt-4 flex gap-1" role="tablist">
          {([['open', 'Open'], ['done', 'Reviewed'], ['all', 'All']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)}
              className={classNames('rounded-md border px-3 py-1 text-[13px] font-medium', show === k ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3')}>
              {l} ({counts[k]})
            </button>
          ))}
        </div>
        {!list.length && <div className="mt-6"><Empty title={show === 'open' ? 'Nothing open' : 'Nothing here yet'} /></div>}
        {GROUPS.map(([sev, title, sub]) => {
          const g = list.filter((i) => i.severity === sev)
          if (!g.length) return null
          return (
            <section key={sev} className="mt-7">
              <h2 className="text-[16px] font-semibold">{title} <span className="font-normal text-ink-3">({g.length})</span></h2>
              <p className="mb-3 text-[13px] text-ink-2">{sub}</p>
              <div className="space-y-2.5">{g.map((i) => <IssueCard key={i.id} issue={i} showProperty />)}</div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
