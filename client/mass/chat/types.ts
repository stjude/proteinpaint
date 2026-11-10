import type { GeneDataTypeAvailability } from '#types'

export type Coord = { chr: string; start: number; stop: number }

/** Rows shown in the omnisearch results popup. `kind` is the discriminant: each kind has exactly one
 * renderer (see renderers.ts) and is built from the server response by buildResultRows (see rows.ts). */
export type HeadingRow = { kind: 'heading'; name: string }
export type NoteRow = { kind: 'note'; name: string; testid: string }
export type CoordRow = { kind: 'coord'; name: string; coord: Coord }
export type SampleRow = {
	kind: 'sample'
	name: string
	sampleId: number | string
	/** present only when the server confirmed this sample has single-cell data */
	singleCell?: { sID: string; eID?: string }
	/** present only when the sample has facet-table assays */
	facetTracks?: { facet: string; names: string[] }[]
	/** true only when the sample has plain whole-slide images */
	wsimages?: boolean
}
export type GeneRow = {
	kind: 'gene'
	name: string
	gene: string
	dataTypes: GeneDataTypeAvailability
	/** server-resolved default coordinate; null when not resolved (e.g. protein-only datasets) */
	coord: Coord | null
}
export type DictRow = {
	kind: 'dict'
	name: string
	/** the dictionary term as returned by the server; passed to the plot as `term` */
	term: any
	/** type-less terms (e.g. folders) are listed but not clickable */
	selectable: boolean
	ancestors: string
}

export type ResultRow = HeadingRow | NoteRow | CoordRow | SampleRow | GeneRow | DictRow

/** What the user can search for in this dataset; drives the "searchable items" note under the input. */
export type SearchableItem = {
	key: 'dictionary' | 'genes' | 'samples' | 'coord'
	label: string
	/** extra instruction appended to the label, e.g. samples are searched only on Enter */
	hint?: string
}

export type GbMode = 'protein' | 'genomic' | 'both'

/** One launchable button for a selected gene. Dataset-wide gates (`enabled`) are evaluated once when the
 * capabilities are built; per-gene gates (`available`) are evaluated for each gene result. */
export type GeneActionDef = {
	id: string
	label: string
	testid: (gene: string) => string
	/** dataset-wide gate, evaluated once from termdbConfig */
	enabled: (caps: DatasetFlags) => boolean
	/** per-gene gate, evaluated from the server-provided data types of that gene */
	available: (row: GeneRow) => boolean
	run: (launcher: GeneLauncher, row: GeneRow) => Promise<void>
}

export type GeneCategoryDef = {
	id: string
	/** row label, may depend on which variant types this gene has */
	label: (row: GeneRow) => string
	actions: GeneActionDef[]
}

/** Dataset-wide flags derived once from termdbConfig. */
export type DatasetFlags = {
	hasSurvival: boolean
	gbMode: GbMode
}

/** The subset of the launcher the gene actions need; keeps registry.ts free of DOM/app dependencies. */
export interface GeneLauncher {
	launchPlot(config: any): Promise<void>
	launchGeneVariantPlot(gene: string, dtCandidates: number[]): Promise<void>
	launchGenomeBrowserView(mode: 'protein' | 'genomic', opts: { gene?: string; coord?: Coord | null }): Promise<void>
	launchMethylationPlot(gene: string, coord: Coord | null): Promise<void>
	launchSurvivalWithCovariate(covariateField: 'term2', covariateTw: any): Promise<void>
}

/** Everything about the dataset that does not change between searches. Built once in init(). */
export type Capabilities = DatasetFlags & {
	/** chat (LLM) is available for this dataset */
	isChat: boolean
	searchable: SearchableItem[]
	/** categories with their dataset-enabled actions only; categories with no enabled action are dropped */
	geneCategories: GeneCategoryDef[]
}
