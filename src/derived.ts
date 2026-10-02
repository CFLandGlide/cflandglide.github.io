import { useMemo } from 'react'
import { useApp } from './state'
import { applyFilters, buildIndex, searchProperties } from './lib/search'
import { reviewItems } from './lib/checks'

/** Search + filters + review items, shared by map, list and panel so they always agree. */
export function useDerived() {
  const data = useApp((s) => s.data)
  const query = useApp((s) => s.query)
  const filters = useApp((s) => s.filters)
  const idx = useMemo(() => (data ? buildIndex(data) : new Map()), [data])
  const items = useMemo(() => (data ? reviewItems(data) : []), [data])
  const openIssueProps = useMemo(() => new Set(items.filter((i) => i.status === 'open' && i.severity !== 'info').flatMap((i) => [i.property_id, ...(i.related_property_ids ?? [])]).filter(Boolean) as string[]), [items])
  const hits = useMemo(() => {
    if (!data) return []
    const visible = data.properties.filter((p) => !p.archived)
    const ordered = [...visible].sort((a, b) => (a.record_no ?? 999) - (b.record_no ?? 999) || a.id.localeCompare(b.id))
    return applyFilters(searchProperties(ordered, idx, query), data, filters, openIssueProps)
  }, [data, idx, query, filters, openIssueProps])
  return { data, hits, items, openIssueProps }
}
