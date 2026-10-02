import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { useApp } from '../../state'
import type { Property, PropertyImage } from '../../types'
import { dateTime } from '../../lib/format'
import { Button, Empty, inputCls, Label, Modal, Section, SourceTag, Tag } from '../ui'

function useUrl(path: string) {
  const store = useApp((s) => s.store)!
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { let c = false; store.fileUrl(path).then((u) => { if (!c) setUrl(u) }).catch(() => setErr(true)); return () => { c = true } }, [path, store])
  return { url, err }
}

function Thumb({ img, onOpen }: { img: PropertyImage; onOpen: () => void }) {
  const { url, err } = useUrl(img.storage_path)
  return (
    <button onClick={onOpen} className="group block overflow-hidden rounded-md border border-line text-left hover:border-ink-3">
      <div className="grid aspect-[2/1] place-items-center bg-paper">
        {url ? <img src={url} alt={img.caption ?? 'Property image'} className="h-full w-full object-cover" onError={() => null} /> : <span className="px-3 text-center text-[12px] text-ink-3">{err ? (img.is_source ? 'Original image not uploaded yet. Add it in Data check → Original images.' : 'Image could not load') : 'Loading…'}</span>}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[13px] font-medium">{img.caption ?? img.file_name}</p>
        <p className="text-[12px] text-ink-3">{img.is_source ? 'From the source document' : `Added by ${img.uploaded_by_name ?? 'unknown'}, ${dateTime(img.uploaded_at)}`}</p>
      </div>
    </button>
  )
}

function Viewer({ img, onClose }: { img: PropertyImage; onClose: () => void }) {
  const { url } = useUrl(img.storage_path)
  const updateRow = useApp((s) => s.updateRow)
  const [caption, setCaption] = useState(img.caption ?? '')
  const [notes, setNotes] = useState(img.image_notes ?? '')
  return (
    <Modal wide title={img.caption ?? img.file_name ?? 'Image'} onClose={onClose}
      footer={<><Button kind="quiet" onClick={onClose}>Close</Button><Button kind="primary" onClick={async () => { if (await updateRow<PropertyImage>('property_images', img.id, { caption: caption || null, image_notes: notes || null }, 'Image details saved')) onClose() }}>Save details</Button></>}>
      {url && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={img.caption ?? ''} className="w-full rounded-md border border-line" /></a>}
      <p className="mt-1 text-[12px] text-ink-3">Select the image to open it full size in a new tab.</p>
      {img.is_source && (
        <div className="mt-3 rounded-md border border-line bg-paper p-3 text-[12.5px] text-ink-2">
          <p className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-ink">Original image from the source document</span><SourceTag src={img.source} /></p>
          {img.verification && <p className="mt-1">{img.verification}.</p>}
          {img.image_reading && <p className="mt-1">The screenshot shows: parcel {img.image_reading.parcel}; owner “{img.image_reading.owner}”; address “{img.image_reading.address}”; mailing “{img.image_reading.mailing}”.</p>}
          {img.sha256 && <p className="mt-1 break-all text-ink-3">Fingerprint (SHA-256): {img.sha256}</p>}
        </div>
      )}
      <div className="mt-3 grid gap-3">
        <div><Label htmlFor="cap">Caption</Label><input id="cap" className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
        <div><Label htmlFor="inotes">Image notes</Label><textarea id="inotes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
    </Modal>
  )
}

export function ImagesTab({ p }: { p: Property }) {
  const { data, uploadImage } = useApp()
  const imgs = data!.property_images.filter((i) => i.property_id === p.id && !i.archived).sort((a, b) => Number(b.is_source) - Number(a.is_source) || a.uploaded_at.localeCompare(b.uploaded_at))
  const [open, setOpen] = useState<PropertyImage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Section title="Images">
        {!imgs.length && <Empty title="No images for this record" />}
        <div className="grid grid-cols-1 gap-3">
          {imgs.map((i) => <div key={i.id} className="relative">{i.is_source && <span className="absolute right-2 top-2 z-10"><Tag tone="pine">Source document</Tag></span>}<Thumb img={i} onOpen={() => setOpen(i)} /></div>)}
        </div>
      </Section>
      <Section title="Add an image">
        <form className="grid gap-2" onSubmit={async (e) => { e.preventDefault(); if (!file) return; setBusy(true); if (await uploadImage(p.id, file, caption)) { setFile(null); setCaption(''); (e.target as HTMLFormElement).reset() } setBusy(false) }}>
          <input aria-label="Image file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px]" />
          <input aria-label="Caption" placeholder="Caption (optional)" className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <div><Button kind="primary" type="submit" disabled={!file || busy}><Upload size={14} /> {busy ? 'Uploading…' : 'Add image'}</Button></div>
          <p className="text-[12px] text-ink-3">Images are stored privately and attached to this property only.</p>
        </form>
      </Section>
      {open && <Viewer img={open} onClose={() => setOpen(null)} />}
    </>
  )
}
