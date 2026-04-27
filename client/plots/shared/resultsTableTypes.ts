/** A row used by the results table where the first cell typically holds the
 * gene/promoter/feature name. Generic — callers shape it however they like. */
export type ResultsTableRow = Array<{ value?: string; [key: string]: any }>

/** Data item passed to button callbacks for selection tracking. The table is
 * data-agnostic — items can be points (manhattan), promoters (volcano DM),
 * pre-built rows for the GRIN2 top-genes table, etc. */
export type ResultsDataItem = ResultsTableRow | { gene?: string; [key: string]: any }

/** Options for showResultsTable. Renderable via prebuilt columns/rows, or
 * built from `hits` for the manhattan default shape. Pass `app` to opt into
 * the built-in Matrix/Lollipop buttons (gene-data only). */
export interface ShowResultsTableOpts {
	/** Div selection where the table will be rendered */
	tableDiv: any
	/** Default-shape items used when `columns`/`rows` are not provided. Must
	 * carry gene/chrom/start/end/color/type/q_value/nsubj fields (manhattan). */
	hits?: any[]
	/** App context for dispatching Matrix/Lollipop actions. When omitted, no
	 * built-in buttons are rendered (volcano-style). */
	app?: any
	/** Menu instance to hide on button actions. */
	clickMenu?: any
	/** Pre-built columns. If not provided, builds default columns from `hits`. */
	columns?: any[]
	/** Pre-built rows. If not provided, builds from `hits`. */
	rows?: any[]
	/** Original data items for button callbacks and selection tracking.
	 * Defaults to `hits`. */
	dataItems?: any[]
	/** Function to extract gene name from a data item. Defaults to
	 * (item) => item.gene, which works for ManhattanPoint. */
	getGene?: (item: any) => string
	/** Format for matrix button text. Use {n} as placeholder for count.
	 * Defaults to "Matrix ({n})". */
	matrixButtonFormat?: string
	/** Additional options passed directly to renderTable. */
	[key: string]: any
}
