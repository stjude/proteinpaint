// Generic result list: groups each handler's rows under a heading, adds the "Displaying N out of M" note
// when the server capped a kind, and renders heading/note rows. Everything specific to a result kind lives
// in its handler (./handlers); nothing here knows about genes, samples, etc.
import type { OmnisearchResult, OmnisearchResultKey } from '#types'
import type { HandlerDeps, OmnisearchHandler } from './types.ts'

export type ListEntry =
	| { type: 'heading'; name: string }
	| { type: 'note'; name: string; testid: string }
	| { type: 'item'; handler: OmnisearchHandler; row: any }

/** Build the popup's rows: for each handler with results, a heading, its rows, and a truncation
 * note when the server's total exceeds what it returned. Group order is handler order. */
export function buildResultList(handlers: OmnisearchHandler[], data: OmnisearchResult): ListEntry[] {
	const list: ListEntry[] = []
	const earlier: Record<string, any[]> = {}
	for (const handler of handlers) {
		const rows = handler.buildRows(data, earlier)
		earlier[handler.key] = rows
		if (!rows.length) continue
		list.push({ type: 'heading', name: handler.heading })
		for (const row of rows) list.push({ type: 'item', handler, row })
		const returned = handler.countReturned ? handler.countReturned(data) : rows.length
		// the server reports a total for some result keys only (not for coord)
		const total = (data.totals as Partial<Record<OmnisearchResultKey, number>> | undefined)?.[handler.key]
		if (typeof total == 'number' && total > returned) {
			list.push({
				type: 'note',
				testid: `sjpp-mass-chat-note-${handler.key}`,
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
 * Built from the loaded handlers (those the dataset supports), so it cannot drift from what the search does. */
export function describeSearchable(handlers: OmnisearchHandler[]): string {
	const parts = handlers.map(h => (h.hint ? `${h.label} (${h.hint})` : h.label))
	return `Searchable: ${parts.join(', ')}`
}
