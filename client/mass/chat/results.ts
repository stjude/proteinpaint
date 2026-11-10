// Generic result list: groups each handler's rows under a heading, adds the "Displaying N out of M" note
// when the server capped a kind, and renders heading/note rows. Everything specific to a result kind lives
// in its handler (./handlers); nothing here knows about genes, samples, etc.
import type { OmnisearchResult } from '#types'
import type { HandlerDeps, OmnisearchHandler } from './handlers/types.ts'

export type ListEntry =
	| { type: 'heading'; name: string }
	| { type: 'note'; name: string; testid: string }
	| { type: 'item'; handler: OmnisearchHandler; row: any }

/** Build the popup's rows: for each enabled handler with results, a heading, its rows, and a truncation
 * note when the server's total exceeds what it returned. Group order is handler order. */
export function buildResultList(handlers: OmnisearchHandler[], data: OmnisearchResult): ListEntry[] {
	const list: ListEntry[] = []
	const earlier: Record<string, any[]> = {}
	for (const handler of handlers) {
		if (!handler.enabled) continue
		const rows = handler.buildRows(data, earlier)
		earlier[handler.id] = rows
		if (!rows.length) continue
		list.push({ type: 'heading', name: handler.heading })
		for (const row of rows) list.push({ type: 'item', handler, row })
		const returned = handler.countReturned ? handler.countReturned(data) : rows.length
		const total = (data.totals as Record<string, number> | undefined)?.[handler.key]
		if (typeof total == 'number' && total > returned) {
			list.push({
				type: 'note',
				testid: `sjpp-mass-chat-note-${handler.id}`,
				name: `Displaying ${rows.length} out of a total of ${total} ${handler.noun} matches`
			})
		}
	}
	return list
}

/** Render one list entry into its <tr>; items are rendered by their handler. */
export function renderEntry(tr: any, entry: ListEntry, deps: HandlerDeps) {
	if (entry.type == 'item') return entry.handler.renderRow(tr, entry.row, deps)
	if (entry.type == 'heading') {
		// group label spanning both columns; not selectable
		tr.append('td')
			.attr('colspan', 2)
			.attr('data-testid', `sjpp-mass-chat-heading-${entry.name.toLowerCase().replace(/\s+/g, '-')}`)
			.text(entry.name)
			.style('padding', '6px 10px 2px')
			.style('font-weight', 'bold')
			.style('font-size', '0.85em')
			.style('text-transform', 'uppercase')
			.style('opacity', 0.5)
		return
	}
	// "Displaying N out of M ... matches" at the bottom of a truncated group; not selectable
	tr.append('td')
		.attr('colspan', 2)
		.attr('data-testid', entry.testid)
		.text(entry.name)
		.style('padding', '2px 10px 6px')
		.style('font-size', '0.8em')
		.style('font-style', 'italic')
		.style('opacity', 0.6)
}

/** Text of the note under the search box, e.g.
 * "Searchable: Dictionary variables, Genes, Samples (press Enter to search), Genomic regions (chr:start-stop)".
 * Built from the enabled handlers, so it cannot drift from what the search actually does. */
export function describeSearchable(handlers: OmnisearchHandler[]): string {
	const parts = handlers.filter(h => h.enabled).map(h => (h.hint ? `${h.label} (${h.hint})` : h.label))
	return `Searchable: ${parts.join(', ')}`
}
