import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { classNames } from '../lib/format'
import { useApp } from '../state'

export function Button({ children, onClick, kind = 'plain', disabled, title, type = 'button', small, className }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'plain' | 'quiet' | 'danger'; disabled?: boolean; title?: string
  type?: 'button' | 'submit'; small?: boolean; className?: string
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={classNames('inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-45 disabled:cursor-not-allowed',
        small ? 'px-2 py-1 text-[12.5px]' : 'px-3 py-1.5 text-[13.5px]',
        kind === 'primary' && 'bg-ink text-white hover:bg-[#16302a]',
        kind === 'plain' && 'border border-line bg-surface hover:border-ink-3',
        kind === 'quiet' && 'text-ink-2 hover:bg-pine-50 hover:text-ink',
        kind === 'danger' && 'border border-brick-ink/30 text-brick-ink hover:bg-brick-bg', className)}>
      {children}
    </button>
  )
}

export function Tag({ children, tone = 'neutral', dashed, title }: { children: ReactNode; tone?: 'neutral' | 'pine' | 'flag' | 'amber' | 'brick'; dashed?: boolean; title?: string }) {
  return (
    <span title={title} className={classNames('inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[1px] text-[12px] font-medium leading-[18px] whitespace-nowrap',
      dashed ? 'border-dashed' : 'border-solid',
      tone === 'neutral' && 'border-line bg-surface text-ink-2',
      tone === 'pine' && 'border-pine-100 bg-pine-50 text-ink',
      tone === 'flag' && 'border-flag/40 bg-flag-soft text-[#9b1d4f]',
      tone === 'amber' && 'border-amber-ink/25 bg-amber-bg text-amber-ink',
      tone === 'brick' && 'border-brick-ink/25 bg-brick-bg text-brick-ink')}>
      {children}
    </span>
  )
}

export function pagesOf(src: string | null | undefined) {
  if (!src) return null
  const m = [...src.matchAll(/p\.\s?(\d+(?:\s?[–-]\s?\d+)?)/g)].map((x) => x[1].replace(/\s/g, ''))
  if (!m.length) return null
  return 'p.' + [...new Set(m)].join(', ')
}

/** Small page tag that shows where a value came from. */
export function SourceTag({ src, label }: { src: string | null | undefined; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  if (!src) return null
  const short = label ?? pagesOf(src) ?? 'source'
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="rounded-[4px] border border-line-2 bg-paper px-1 text-[11px] leading-[16px] font-medium text-ink-3 hover:border-ink-3 hover:text-ink">
        {short}
      </button>
      {open && (
        <span role="dialog" className="absolute left-0 top-[calc(100%+4px)] z-40 w-72 rounded-md border border-line bg-surface p-2.5 text-[12.5px] leading-snug text-ink-2 shadow-lg">
          <span className="mb-1 block font-semibold text-ink">Source</span>{src}
        </span>
      )}
    </span>
  )
}

export function Modal({ title, children, onClose, wide, footer }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10221c]/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={classNames('flex max-h-[90vh] w-full flex-col rounded-lg bg-surface shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line-2 px-5 py-3">
          <h2 className="font-serif text-[18px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-3 hover:bg-pine-50 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-[12.5px] font-medium text-ink-2">{children}</label>
}

export const inputCls = 'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13.5px] placeholder:text-ink-3 focus:border-ink focus:outline-none'

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={classNames('pointer-events-auto max-w-lg rounded-md px-4 py-2 text-[13.5px] shadow-lg', t.kind === 'error' ? 'bg-brick-ink text-white' : 'bg-ink text-white')}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-4 py-6 text-center text-ink-2">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-[13px]">{children}</div>}
    </div>
  )
}

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-line-2 px-5 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
