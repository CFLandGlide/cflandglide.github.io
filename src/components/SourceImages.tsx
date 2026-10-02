import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Upload } from 'lucide-react'
import { useApp } from '../state'
import { fileFingerprint } from '../lib/importer'
import { propertyTitle } from '../lib/format'

/** Uploads the original images from the source document. Each file is matched to its property by
 *  its SHA-256 fingerprint (recorded at import), never by file name or order. */
export function SourceImages() {
  const { data, store, toast } = useApp()
  const src = data!.property_images.filter((i) => i.is_source && !i.archived)
  const [present, setPresent] = useState<Record<string, boolean> | null>(null)
  const [results, setResults] = useState<{ text: string; ok: boolean }[]>([])
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    const entries = await Promise.all(src.map(async (i) => [i.id, await store!.fileExists(i.storage_path).catch(() => false)] as const))
    setPresent(Object.fromEntries(entries))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, store])
  useEffect(() => { void check() }, [check])

  if (!src.length) return null
  const have = present ? src.filter((i) => present[i.id]).length : null

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const out: { text: string; ok: boolean }[] = []
    let added = 0
    for (const f of Array.from(files)) {
      const fp = await fileFingerprint(f)
      const match = src.find((i) => i.sha256 === fp)
      if (!match) { out.push({ text: `${f.name}: not one of the original images from the document, so it was ignored.`, ok: false }); continue }
      const p = data!.properties.find((x) => x.id === match.property_id)!
      const where = `record #${p.record_no} (${propertyTitle(p)}, account ${p.account_number})`
      if (present?.[match.id]) { out.push({ text: `${f.name}: already uploaded for ${where}.`, ok: true }); continue }
      try {
        await store!.uploadFile(match.storage_path, f, 'image/png')
        out.push({ text: `${f.name}: fingerprint matches, saved to ${where}.`, ok: true })
        added++
      } catch (e) {
        out.push({ text: `${f.name}: upload failed (${(e as Error).message}). Try again.`, ok: false })
      }
    }
    setResults(out)
    await check()
    setBusy(false)
    if (added) { toast(`${added} original image${added > 1 ? 's' : ''} added`); await store!.logEvent(null, 'images', `Uploaded ${added} original source image(s), each matched by fingerprint`) }
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold">
        Original images {have === src.length && <CheckCircle2 size={16} className="text-ink" />}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        {have === null ? 'Checking…' : `${have} of ${src.length} uploaded.`} Each file is matched to its property by its digital fingerprint, not its name, so it can’t land on the wrong property.
      </p>
      {have !== null && have < src.length && (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13.5px] font-medium text-white hover:bg-[#16302a]">
          <Upload size={15} /> {busy ? 'Uploading…' : 'Upload images'}
          <input type="file" accept="image/png" multiple className="sr-only" disabled={busy} onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
        </label>
      )}
      {have !== null && have < src.length && <p className="mt-2 text-[12px] text-ink-3">Select all 14 image files at once (hold Ctrl or Shift while clicking).</p>}
      {results.length > 0 && (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-[12.5px] scroll-thin">
          {results.map((r, k) => <li key={k} className={r.ok ? 'text-ink-2' : 'text-brick-ink'}>{r.text}</li>)}
        </ul>
      )}
    </div>
  )
}
