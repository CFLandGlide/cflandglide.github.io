import { useState } from 'react'
import { useApp } from '../../state'
import type { Note, Property } from '../../types'
import { classNames, dateTime } from '../../lib/format'
import { Button, Empty, inputCls, Section, Tag } from '../ui'

function NoteForm({ initial, category: cat0, categories, onSave, onCancel, saveLabel }: {
  initial: string; category: string | null; categories: string[]; onSave: (b: string, c: string | null) => Promise<boolean>; onCancel?: () => void; saveLabel: string
}) {
  const [body, setBody] = useState(initial)
  const [category, setCategory] = useState(cat0 ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return; setBusy(true); const ok = await onSave(body, category || null); setBusy(false); if (ok && !onCancel) { setBody(''); setCategory('') } }}>
      <textarea aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Called owner, no answer. Try again next week."
        className={classNames(inputCls, 'resize-y')} autoFocus={!!onCancel} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-line px-2 py-1 text-[13px] focus:border-ink focus:outline-none">
          <option value="">No category</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button kind="primary" type="submit" disabled={busy || !body.trim()}>{busy ? 'Saving…' : saveLabel}</Button>
        {onCancel && <Button kind="quiet" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}

export function NotesTab({ p }: { p: Property }) {
  const { data, addNote, editNote, deleteNote } = useApp()
  const notes = data!.notes.filter((n) => n.property_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const cats = data!.settings.note_categories
  return (
    <>
      <Section title="Add a note">
        <NoteForm initial="" category={null} categories={cats} saveLabel="Add note" onSave={(b, c) => addNote(p.id, b, c)} />
        <p className="mt-2 text-[12px] text-ink-3">Each note is kept separately with your name and the time. Adding a note never replaces an earlier one.</p>
      </Section>
      <Section title={`Notes (${notes.length}), newest first`}>
        {!notes.length && <Empty title="No notes yet">Add the first note above.</Empty>}
        <ul className="space-y-3">
          {notes.map((n: Note) => (
            <li key={n.id} className="rounded-md border border-line px-3 py-2.5">
              {editing === n.id ? (
                <NoteForm initial={n.body} category={n.category} categories={cats} saveLabel="Save changes" onCancel={() => setEditing(null)}
                  onSave={async (b, c) => { const ok = await editNote(n, b, c); if (ok) setEditing(null); return ok }} />
              ) : (
                <>
                  <p className="text-[13.5px] whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
                    {n.category && <Tag>{n.category}</Tag>}
                    <span>{n.created_by_name ?? 'Unknown'}, {dateTime(n.created_at)}</span>
                    {n.updated_at && <span>Edited {dateTime(n.updated_at)}{n.updated_by_name ? ` by ${n.updated_by_name}` : ''}</span>}
                    {!n.is_import && (
                      <span className="ml-auto flex gap-1">
                        <Button small kind="quiet" onClick={() => setEditing(n.id)}>Edit</Button>
                        {confirm === n.id
                          ? <><Button small kind="danger" onClick={async () => { await deleteNote(n); setConfirm(null) }}>Remove note</Button><Button small kind="quiet" onClick={() => setConfirm(null)}>Keep</Button></>
                          : <Button small kind="quiet" onClick={() => setConfirm(n.id)}>Remove</Button>}
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">Edits and removals stay in this property’s History.</p>
      </Section>
    </>
  )
}
