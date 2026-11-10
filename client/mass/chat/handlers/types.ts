// The omnisearch is organized by RESULT KIND: one handler per kind of thing the user can find (dictionary
// variable, gene, sample, genomic region). A result kind is not a term type or a data type: a gene result
// can launch gene expression, variant and methylation plots; a sample or a genomic region has no term type
// at all. So the term-type differences live INSIDE the handler that needs them (see gene.ts).
//
// To add a result kind (e.g. genesets): add one file in this directory implementing OmnisearchHandler and
// add it to index.ts. To add an action for an existing kind (e.g. pseudobulk for a gene): edit that kind's
// handler only.
import type { OmnisearchResult } from '#types'
import type { ResultsPopup } from '../popup.ts'
import type { Launcher } from '../launcher.ts'

export type Coord = { chr: string; start: number; stop: number }

/** What the user typed and whether they pressed Enter. */
export type SearchInput = { prompt: string; enter: boolean }

/** A handler's contribution to one search. `active` is whether this kind is searched for this input (at
 * least one active handler is needed for a request to be sent). `request` is merged into the single
 * termdb/chat request and carries this handler's flag(s) whether on or off, so a kind that is not searched
 * is explicitly switched off server-side. */
export type HandlerPlan = { active: boolean; request: Record<string, any> }

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
	/** short id used in test ids and notes: 'dictionary' | 'genes' | 'samples' | 'coord' */
	readonly id: string
	/** field of the server's OmnisearchResult holding this kind's matches (and the key of its `totals`) */
	readonly key: 'dictionaryTerms' | 'genes' | 'samples' | 'coord'
	/** group heading in the results popup */
	readonly heading: string
	/** singular noun for the "Displaying N out of M <noun> matches" note */
	readonly noun: string
	/** name in the "Searchable: ..." note under the input */
	readonly label: string
	/** extra instruction after the label in that note, e.g. 'press Enter to search' */
	readonly hint?: string
	/** false when this dataset cannot produce this kind; set by init(). A disabled handler is not searched,
	 * not listed in the note and renders nothing. */
	enabled: boolean
	/** Called once. Decide everything that depends only on the dataset (termdbConfig) here and store it, so
	 * it is never re-derived per search, per result or per click. Sets `enabled`. */
	init(ctx: HandlerCtx): void
	/** Whether and how to search this kind for the typed input. Must work (return inactive) when disabled. */
	plan(input: SearchInput): HandlerPlan
	/** Server response -> this kind's rows (no heading or note rows; those are generic). `earlier` holds the
	 * rows already built by the handlers listed before this one, keyed by handler id, for the rare handler
	 * that must not repeat what an earlier kind already shows (genes vs a dictionary term of the same name). */
	buildRows(data: OmnisearchResult, earlier: Record<string, any[]>): Row[]
	/** Number of matches the server returned before any client-side filtering; defaults to rows.length. The
	 * truncation note compares it with the server's total. */
	countReturned?(data: OmnisearchResult): number
	/** Render one row into its <tr>, including what happens on click (launch a plot, open a picker, ...) */
	renderRow(tr: any, row: Row, deps: HandlerDeps): void
}

/** The plan of a handler that is not searched. */
export function inactive(request: Record<string, any> = {}): HandlerPlan {
	return { active: false, request }
}
