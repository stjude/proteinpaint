import type { OmnisearchRequest, OmnisearchResult, OmnisearchResultKey } from '#types'
import type { ResultsPopup } from './popup.ts'
import type { Launcher } from './launcher.ts'

// The omnisearch is organized by RESULT KEY, one handler per field of the server's OmnisearchResult. See
// handlers/_README.md for the design, how handlers are loaded, and how to add one.

export type Coord = { chr: string; start: number; stop: number }

/** What the user typed and whether they pressed Enter. */
export type SearchInput = { prompt: string; enter: boolean }

/** Available when a handler is initialized, once per component. */
export type HandlerCtx = { app: any; termdbConfig: any }

/** Available when a handler renders a row or reacts to a click. */
export type HandlerDeps = {
	app: any
	popup: ResultsPopup
	launcher: Launcher
	/** add a chat-history bubble; `me` marks the user's side. `msg` is html: escape user input first. */
	addBubble: (arg: { msg: string; me?: number }) => any
}

export interface OmnisearchHandler<Row = any> {
	/** The field of the server's OmnisearchResult holding this kind's matches (and the key of its `totals`).
	 * Also the handler's file name in ./handlers and its entry in a request's `include` list. Typed from
	 * OmnisearchResult, so a handler cannot claim a result the server does not return. */
	readonly key: OmnisearchResultKey
	/** group heading in the results popup */
	readonly heading: string
	/** singular noun for the "Displaying N out of M <noun> matches" note */
	readonly noun: string
	/** name in the "Searchable: ..." note under the input */
	readonly label: string
	/** extra instruction after the label in that note, e.g. 'press Enter to search' */
	readonly hint?: string
	/** Called once, only for a dataset where the handler file's `includeResult(termdbConfig)` is true. Decide
	 * everything else that depends only on the dataset (termdbConfig) here and store it, so it is never
	 * re-derived per search, per result or per click. */
	init(ctx: HandlerCtx): void
	/** Whether this kind is searched for the typed input, i.e. whether `key` goes in the request's `include`
	 * list (e.g. length gates while typing; samples only on Enter). */
	includeInSearch(input: SearchInput): boolean
	/** Request fields this kind needs besides its `include` entry (the region handler's coordCandidates).
	 * Only called when includeInSearch() is true. */
	requestExtras?(input: SearchInput): Omit<OmnisearchRequest, 'include'>
	/** Server response -> this kind's rows (no heading or note rows; those are generic). `earlier` holds the
	 * rows already built by the handlers listed before this one, keyed by handler `key`, for the rare handler
	 * that must not repeat what an earlier kind already shows (genes vs a dictionary term of the same name). */
	buildRows(data: OmnisearchResult, earlier: Record<string, any[]>): Row[]
	/** Number of matches the server returned before any client-side filtering; defaults to rows.length. The
	 * truncation note compares it with the server's total. */
	countReturned?(data: OmnisearchResult): number
	/** Render one row into its <tr>, including what happens on click (launch a plot, open a picker, ...) */
	renderRow(tr: any, row: Row, deps: HandlerDeps): void
}
