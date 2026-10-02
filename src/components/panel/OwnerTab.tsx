import { useApp } from '../../state'
import type { Property } from '../../types'
import { Section, SourceTag, Tag, Empty } from '../ui'
import { Field, imported, isEdited, RevealToggle, srcOf, useIssuesFor, type Item } from './fields'

export function OwnerTab({ p, items }: { p: Property; items: Item[] }) {
  const data = useApp((s) => s.data)!
  const revealed = useApp((s) => !!s.revealed[p.id])
  const owner = data.owners.find((o) => o.property_id === p.id && !o.archived)
  const contacts = data.owner_contacts.filter((c) => c.property_id === p.id && !c.archived)
  const issues = useIssuesFor(items)
  const sv = owner?.source_values as Record<string, unknown> | null
  const psv = p.source_values as Record<string, unknown> | null
  const imp = imported(sv)
  const o = owner
  const fld = (col: 'owner_name' | 'ownership_entity' | 'registered_agent' | 'registered_agent_address' | 'trustee' | 'mailing_address', label: string, src?: string | null) =>
    o && (o[col] || imp?.[col]) ? <Field label={label} value={o[col]} src={src ?? o.source_ref} edited={isEdited(sv, col, o[col])} original={imp?.[col] as string} issues={issues(col)} /> : null
  const contactIssues = items.filter((i) => i.field === 'contacts')

  return (
    <>
      <div className="mx-5 mt-4 rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] text-ink-2">
        Owner of record for account <b className="text-ink">{p.account_number ?? `(none — ${p.id})`}</b> only. Nothing on this tab comes from another property’s record.
      </div>
      <Section title="Property owner">
        {!o && <Empty title="No owner in the source for this record" />}
        {o && (
          <dl>
            {o.owner_name ? fld('owner_name', 'Owner of record', srcOf(psv, 'owner_of_record') ?? o.source_ref) : <Field label="Owner of record" value={null} src={o.source_ref} />}
            {fld('ownership_entity', 'Ownership entity')}
            {fld('registered_agent', 'Registered agent')}
            {fld('registered_agent_address', 'Registered agent address')}
            {fld('trustee', 'Trustee')}
            {fld('mailing_address', 'Owner mailing address', srcOf(psv, 'mailing') ?? o.source_ref)}
            {o.summary_owner_name && <Field label="Owner as written in summary" value={o.summary_owner_name} src="Summary table p.1 and summary list p.2–4" />}
            {Array.isArray(sv?.owner_lines_as_written) && (
              <Field label="Owner lines as written" src={o.source_ref}>
                <span className="whitespace-pre-line text-ink-2">{(sv!.owner_lines_as_written as string[]).join('\n')}</span>
              </Field>
            )}
          </dl>
        )}
      </Section>
      <Section title="Owner contact information" aside={contacts.length > 0 && <RevealToggle pid={p.id} />}>
        {o?.phones_listed_for && (
          <p className="mb-2 text-[13px] text-ink-2">The source lists these as “possible connected numbers” for <b className="text-ink">{o.phones_listed_for}{o.phones_listed_for_age ? ` (${o.phones_listed_for_age} in source)` : ''}</b>. They are not confirmed as the owner’s own numbers.</p>
        )}
        {!contacts.length && <Empty title="No owner phone numbers in the source" />}
        {contacts.length > 0 && !revealed && <p className="rounded-md border border-dashed border-line px-3 py-3 text-[13px] text-ink-2">{contacts.length} phone number{contacts.length > 1 ? 's' : ''} hidden. Select “Show contact details” to see them.</p>}
        {contacts.length > 0 && revealed && (
          <ul className="divide-y divide-line-2 rounded-md border border-line">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2">
                <a href={`tel:${c.phone?.replace(/\D/g, '')}`} className="text-[14px] font-semibold underline-offset-2 hover:underline">{c.phone}</a>
                {c.phone_type && <Tag>{c.phone_type}</Tag>}
                {c.connection_status && <span className="text-[12.5px] text-ink-2">{c.connection_status} (as listed)</span>}
                {c.highlight && <Tag tone={c.highlight === 'red' ? 'brick' : 'pine'} title="Highlight colour in the source document">Highlighted {c.highlight} in source</Tag>}
                <SourceTag src={c.source_ref} />
                {c.annotation && <p className="w-full text-[12.5px] text-ink-2">Note in source: “{c.annotation}”</p>}
              </li>
            ))}
          </ul>
        )}
        {contactIssues.map((i) => <p key={i.id} className="mt-2 text-[12.5px] text-ink-3">{i.title}. {i.detail}</p>)}
      </Section>
    </>
  )
}
