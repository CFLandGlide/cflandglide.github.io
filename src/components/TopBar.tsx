import { useEffect, useRef, useState } from 'react'
import { Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useApp, type View } from '../state'
import { useDerived } from '../derived'
import { activeFilterCount } from '../lib/search'
import { classNames } from '../lib/format'
import { exportBackup, exportContacts, exportProperties } from '../lib/exporters'
import { Button } from './ui'
import { FiltersPanel } from './FiltersPanel'
import { AddPropertyDialog } from './AddPropertyDialog'

export function TopBar() {
  const { view, setView, query, setQuery, filters, clearFilters, session, store } = useApp()
  const { hits, items, data } = useDerived()
  const [showFilters, setShowFilters] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [adding, setAdding] = useState(false)
  const nf = activeFilterCount(filters)
  const openReview = items.filter((i) => i.status === 'open' && i.severity !== 'info').length
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  const tabs: [View, string, number?][] = [['map', 'Map'], ['list', 'List'], ['review', 'Review queue', openReview], ['check', 'Data check'], ['settings', 'Settings']]
  const total = data?.properties.filter((p) => !p.archived).length ?? 0
  const filtered = hits.length !== total
  const ids = new Set(hits.map((h) => h.property.id))

  return (
    <header className="relative z-30 border-b border-line bg-surface">
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-2">
        <div className="flex shrink-0 items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1F3B33" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#E5397A" strokeWidth="3" /><circle cx="16" cy="16" r="2.6" fill="#fff" /></svg>
          <span className="font-serif text-[18px] font-semibold tracking-[-0.01em]">CFLandGlide</span>
          <span className="hidden text-[12.5px] text-ink-3 lg:inline">Jupiter Farm, FL</span>
        </div>
        <div className="relative max-w-xl flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search properties"
            placeholder="Search address, owner, account #, phone, status or notes"
            className="w-full rounded-md border border-line bg-paper py-1.5 pr-8 pl-8 text-[13.5px] placeholder:text-ink-3 focus:border-ink focus:bg-surface focus:outline-none" />
          {query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"><X size={14} /></button>}
        </div>
        <Button kind={nf ? 'primary' : 'plain'} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={15} /> Filters{nf ? ` (${nf})` : ''}
        </Button>
        {(nf > 0 || query) && <Button kind="quiet" onClick={() => { clearFilters(); setQuery('') }}>Clear all</Button>}
        <div className="ml-auto flex items-center gap-2">
          <Button kind="plain" onClick={() => setAdding(true)}><Plus size={15} /> Add property</Button>
          <div className="relative">
            <Button kind="plain" onClick={() => setShowExport(!showExport)}><Download size={15} /> Export</Button>
            {showExport && data && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-72 rounded-md border border-line bg-surface p-1.5 shadow-lg" onMouseLeave={() => setShowExport(false)}>
                {[
                  [`Properties (${filtered ? `${hits.length} shown` : 'all'})`, () => exportProperties(data, filtered ? ids : undefined), 'Spreadsheet (.csv), one row per property'],
                  [`Contacts (${filtered ? `${hits.length} shown` : 'all'})`, () => exportContacts(data, filtered ? ids : undefined), 'Owner phones, relatives and associates, each tied to its property'],
                  ['Full backup', () => exportBackup(data), 'Everything, as a .json file'],
                ].map(([l, fn, sub]) => (
                  <button key={l as string} onClick={() => { (fn as () => void)(); setShowExport(false) }} className="block w-full rounded px-2.5 py-1.5 text-left hover:bg-pine-50">
                    <span className="block text-[13.5px] font-medium">{l as string}</span><span className="block text-[12px] text-ink-3">{sub as string}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-l border-line-2 pl-3 text-[13px]">
            <span className="text-ink-2">{session?.name}</span>
            <button className="text-ink-3 underline-offset-2 hover:text-ink hover:underline" onClick={() => store?.signOut()}>Log out</button>
          </div>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-3" aria-label="Views">
        {tabs.map(([v, l, n]) => (
          <button key={v} onClick={() => setView(v)} aria-current={view === v ? 'page' : undefined}
            className={classNames('relative -mb-px border-b-2 px-3 pb-2 pt-1 text-[13.5px] font-medium', view === v ? 'border-flag text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
            {l}{n ? <span className="ml-1.5 rounded-full bg-amber-bg px-1.5 text-[11.5px] text-amber-ink">{n}</span> : null}
          </button>
        ))}
        <span className="ml-auto pb-2 text-[12.5px] text-ink-3">{filtered ? `${hits.length} of ${total} records match` : `${total} records`}</span>
      </nav>
      {showFilters && <FiltersPanel onClose={() => setShowFilters(false)} />}
      {adding && <AddPropertyDialog onClose={() => setAdding(false)} />}
    </header>
  )
}
