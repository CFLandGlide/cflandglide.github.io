import type { ReactNode } from 'react'
import { useApp } from '../state'
import { classNames } from '../lib/format'
import type { Filters } from '../lib/search'
import { Button, inputCls } from './ui'

function Chips({ options, value, onChange }: { options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => {
        const on = value.includes(v)
        return (
          <button key={v} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            className={classNames('rounded-md border px-2 py-0.5 text-[12.5px]', on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3')}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div><p className="mb-1.5 text-[12.5px] font-semibold text-ink">{title}</p>{children}</div>
}

function Range({ a, b, f, set, placeholder }: { a: keyof Filters; b: keyof Filters; f: Filters; set: (x: Partial<Filters>) => void; placeholder: [string, string] }) {
  return (
    <div className="flex items-center gap-1.5">
      <input inputMode="decimal" className={classNames(inputCls, 'w-24 py-1')} placeholder={placeholder[0]} value={f[a] as string} onChange={(e) => set({ [a]: e.target.value } as Partial<Filters>)} />
      <span className="text-ink-3">to</span>
      <input inputMode="decimal" className={classNames(inputCls, 'w-24 py-1')} placeholder={placeholder[1]} value={f[b] as string} onChange={(e) => set({ [b]: e.target.value } as Partial<Filters>)} />
    </div>
  )
}

function Radio<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return <Chips options={options} value={[value]} onChange={(v) => onChange((v.filter((x) => x !== value)[0] ?? options[0][0]) as T)} />
}

export function FiltersPanel({ onClose }: { onClose: () => void }) {
  const { filters: f, setFilters: set, clearFilters, data } = useApp()
  const statuses = data?.settings.statuses ?? []
  return (
    <div className="absolute inset-x-0 top-full z-30 border-b border-line bg-surface px-5 py-4 shadow-md">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
        <Group title="Status"><Chips options={statuses.map((s) => [s, s])} value={f.statuses} onChange={(v) => set({ statuses: v })} /></Group>
        <Group title="Address in source">
          <Chips options={[['exact', 'Exact address'], ['street_only', 'Street name only'], ['none', 'No address'], ['disputed', 'Disputed'], ['manual', 'Added manually'], ['unidentified', 'Unidentified record']]}
            value={f.addressStatus} onChange={(v) => set({ addressStatus: v })} />
        </Group>
        <Group title="Map"><Chips options={[['on_map', 'On the map'], ['not_on_map', 'Not on the map']]} value={f.location} onChange={(v) => set({ location: v })} /></Group>
        <Group title="Property type"><Chips options={[['Vacant / unimproved land', 'Vacant / unimproved land'], ['Not available in source', 'Not stated in source']]} value={f.types} onChange={(v) => set({ types: v })} /></Group>
        <Group title="Owner type"><Chips options={[['Individual(s)', 'Individual(s)'], ['Company', 'Company'], ['Trust', 'Trust'], ['Unknown', 'Unknown']]} value={f.ownerTypes} onChange={(v) => set({ ownerTypes: v })} /></Group>
        <Group title="Acreage"><Range a="acreMin" b="acreMax" f={f} set={set} placeholder={['min', 'max']} /></Group>
        <Group title="Last sale year"><Range a="saleFrom" b="saleTo" f={f} set={set} placeholder={['from', 'to']} /></Group>
        <Group title="Last sale price ($)"><Range a="priceMin" b="priceMax" f={f} set={set} placeholder={['min', 'max']} /></Group>
        <Group title="Value ($, assessed or estimated)"><Range a="valueMin" b="valueMax" f={f} set={set} placeholder={['min', 'max']} /></Group>
        <Group title="Contacted"><Radio value={f.contacted} onChange={(v) => set({ contacted: v })} options={[['any', 'Any'], ['yes', 'Contacted'], ['no', 'Not contacted']]} /></Group>
        <Group title="Follow-up"><Radio value={f.followUp} onChange={(v) => set({ followUp: v })} options={[['any', 'Any'], ['due', 'Due or overdue'], ['scheduled', 'Has a date'], ['none', 'No date']]} /></Group>
        <Group title="Reviewed / issues">
          <div className="flex flex-col gap-1.5">
            <Radio value={f.reviewed} onChange={(v) => set({ reviewed: v })} options={[['any', 'Any'], ['yes', 'Reviewed'], ['no', 'Not reviewed']]} />
            <Radio value={f.issues} onChange={(v) => set({ issues: v })} options={[['any', 'Any'], ['open', 'Has open conflicts']]} />
          </div>
        </Group>
      </div>
      <div className="mt-4 flex gap-2">
        <Button kind="primary" onClick={onClose}>Done</Button>
        <Button kind="quiet" onClick={clearFilters}>Clear filters</Button>
      </div>
    </div>
  )
}
