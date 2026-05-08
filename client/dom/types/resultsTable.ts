/** A row used by the results table where the first cell typically holds the
 * row's identifier (gene name, promoter id, protein accession, etc.). Generic
 * — callers shape it however they like. `value` is `string | number` because
 * numeric stats (q-values, fold-change, subject counts) are passed through
 * unwrapped alongside string identifiers. */
export type ResultsTableRow = Array<{ value?: string | number; [key: string]: any }>

/** Data item passed to button callbacks for selection tracking. The table is
 * data-agnostic — items can be points (manhattan), promoters (volcano DM),
 * cohort×protein dots (proteinView), pre-built rows for the GRIN2 top-genes
 * table, etc. */
export type ResultsDataItem = ResultsTableRow | { [key: string]: any }

/** Options for showResultsTable. Renderable via prebuilt columns/rows, or
 * built from `hits` for the manhattan default shape. Pass `app` to opt into
 * the built-in Matrix/Lollipop buttons (gene-data only). */
export interface ShowResultsTableOpts {
	/** Div selection where the table will be rendered */
	tableDiv: any
	/** Manhattan-shape items used when `columns`/`rows` are omitted. Each must
	 * carry gene/chrom/start/end/color/type/q_value/nsubj fields. Other plots
	 * (volcano, proteinView) skip this and pass `columns`/`rows` directly. */
	hits?: any[]
	/** App context for dispatching Matrix/Lollipop actions. When omitted, no
	 * built-in buttons are rendered — the right choice for non-gene callers. */
	app?: any
	/** Menu instance to hide on button actions. */
	clickMenu?: any
	/** Pre-built columns. Required for non-manhattan callers. */
	columns?: any[]
	/** Pre-built rows. Required for non-manhattan callers. */
	rows?: any[]
	/** Original data items for button callbacks and selection tracking.
	 * Defaults to `hits`. */
	dataItems?: any[]
	/** Extracts the row's identifier (gene name, promoter id, protein
	 * accession, etc.) from a data item. Used by the Lollipop button to
	 * remember which row the user touched last. Defaults to `item.gene`,
	 * which works for ManhattanPoint. */
	getRowKey?: (item: any) => string
	/** Format for matrix button text. Use {n} as placeholder for count.
	 * Defaults to "Matrix ({n})". */
	matrixButtonFormat?: string
	/** Additional options passed directly to renderTable. */
	[key: string]: any
}
