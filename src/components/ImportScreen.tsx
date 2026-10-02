import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useApp } from '../state'
import { preCheck, readBundle, runImport, type ImportBundle, type PreCheck } from '../lib/importer'
import { Button } from './ui'

export function ImportScreen() {
  const { store, load, session } = useApp()
  const [bundle, setBundle] = useState<ImportBundle | null>(null)
  const [checks, setChecks] = useState<PreCheck[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const blocked = checks?.some((c) => c.blocking && !c.ok)
  const t = bundle?.tables
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-serif text-[26px] font-semibold">Import the research document</h1>
        <p className="mt-1 text-[13.5px] text-ink-2">Logged in as {session?.name}. The database is empty. Choose the prepared import file (<b>cflandglide-import.json</b>). It is checked first; nothing is saved unless every check passes.</p>
        <input type="file" accept=".json,application/json" aria-label="Import file" className="mt-5 text-[13.5px]" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return
          setErr(null); setChecks(null); setBundle(null)
          try { const b = await readBundle(f); setBundle(b); setChecks(await preCheck(b)) } catch (x) { setErr((x as Error).message) }
        }} />
        {err && <p role="alert" className="mt-3 rounded-md bg-brick-bg px-3 py-2 text-[13px] text-brick-ink">{err}</p>}
        {bundle && t && (
          <div className="mt-6 rounded-lg border border-line bg-surface p-5">
            <p className="text-[14px] font-semibold">{bundle.meta.source}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {t.properties.filter((p) => p.record_type === 'property').length} properties, {t.properties.filter((p) => p.record_type === 'unidentified').length} unidentified block,{' '}
              {t.owner_contacts.length} owner phone numbers, {t.relatives.length} possible relatives, {t.associates.length} possible associates, {bundle.images.length} images, {t.data_issues.length} review items.
            </p>
            <h2 className="mt-4 mb-2 text-[13.5px] font-semibold">Checks before import</h2>
            <ul className="space-y-1.5">
              {checks?.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-[13px]">
                  {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ink" /> : c.blocking ? <XCircle size={16} className="mt-0.5 shrink-0 text-brick-ink" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-ink" />}
                  <span><b className="font-medium">{c.label}.</b> <span className="text-ink-2">{c.detail}</span></span>
                </li>
              ))}
            </ul>
            <h2 className="mt-4 mb-1 text-[13.5px] font-semibold">Decisions already applied</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{bundle.meta.decisions.map((d) => <li key={d}>{d}</li>)}</ul>
            <div className="mt-5 flex items-center gap-3">
              <Button kind="primary" disabled={!!blocked || !!progress} onClick={async () => {
                setErr(null)
                try { await runImport(store!, bundle, setProgress); setProgress('Done. Loading…'); await load(); const s = useApp.getState(); if (s.data?.properties.length) { s.setView('check'); await s.locateParcels(true) } }
                catch (x) { setErr((x as Error).message); setProgress(null) }
              }}>Import</Button>
              {progress && <span role="status" className="text-[13px] text-ink-2">{progress}</span>}
              {blocked && <span className="text-[13px] text-brick-ink">Import is blocked until the failed checks are fixed.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
