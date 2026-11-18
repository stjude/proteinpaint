import type { MassAppApi, ControlInputEntry } from '#mass/types/mass'
import type { ActionMenuItem } from '#dom'
import type { VolcanoRenderRequest } from '#types'

/** What a handler reads to build its request. VolcanoModel provides it. */
export type VolcanoRequestContext = {
	app: MassAppApi
	config: any
	settings: any
	/** the volcanoRender{} that every request carries */
	getVolcanoRender(): VolcanoRenderRequest
	/** replaces the {in: false} "others" placeholder in samplelst.groups[] with the group it stands for */
	setOthersGroup(samplelst: any): void
	/** copies config.confounderTws[] to body.tw and body.tw2 */
	addConfounderTw(body: any): void
}

/** The effect size on the x axis, and the cutoff that applies to it, in that field's units */
export type EffectAxis = {
	/** left out for fold_change, the server's default */
	xField?: VolcanoRenderRequest['xField']
	cutoff: number
	/** recenters the axis on the median effect size, see VolcanoRenderRequest.centerX */
	centerX?: boolean
}

/** A button of the volcano's action bar. The bar renders them in its own order; a handler only
 * says which apply. */
export type VolcanoAction =
	| 'confounders'
	| 'highlight'
	| 'statistics'
	| 'pValueTable'
	/** hierarchical clustering of the significant rows, see VolcanoHandler.clusterTerms */
	| 'clustering'
	/** the expression test on the genes under gene-body loss DMRs, when the dataset has gene counts */
	| 'geneBodyLoss'
	/** the genes near the scan's DMRs, with expression and literature, when the dataset has gene counts */
	| 'dmrGeneLink'
	/** methylation against expression change by gene, when the dataset has gene counts and per-CpG data */
	| 'starburst'

/** What decides whether an offered action applies to this run */
export type VolcanoRunContext = {
	settings: any
	config: any
	/** set on a DMR scan */
	scan?: any
}

/** A column of the p-value table, and of the hover table of several dots. Its header and its cells
 * are defined together, so a column cannot end up over another column's cells. */
export type VolcanoColumn = {
	label: string
	/** the header in the hover table of several dots, where space is short. label when left out */
	short?: string
	/** the cell of a row */
	value: (d: any) => string | number
}

/** A row of the tooltip of one dot: the label, which may hold html, and the value */
export type TooltipRow = [string, string | number]

/** The tooltip rows that every data type shows, for a handler to place among its own */
export type SharedTooltipRows = {
	/** the effect size that the x axis plots */
	effect: TooltipRow
	/** the one p-value, or the original and, where there is one, the adjusted p-value */
	pValues: TooltipRow[]
}

/** The code that differs by the data type of a differential analysis (config.termType), so the
 * volcano can ask the handler instead of testing the term type. */
export type VolcanoHandler = {
	termType: string
	/** server route of the analysis */
	route: string
	/** The analysis compares config.samplelst.groups[]. Its response then keeps the request as
	 * response.daRequest, which GSEA snapshots to ask the server to recompute a missing cache, and
	 * gives a group defined by a filter its sample count. */
	comparesGroups: boolean
	getRequestBody(ctx: VolcanoRequestContext): object | Promise<object>
	/** the x axis of the volcano. fold_change with settings.foldChangeCutoff when left out */
	getEffectAxis?(settings: any): EffectAxis

	/** What a dot is, plural, as in "Number of significant genes". The stats rows, and through them
	 * the caption of the action bar, are named with it. */
	getRowNoun(settings: any): string
	/** What the action bar captions the significant count with. `significant <row noun>` when left out */
	getSignificantNoun?(settings: any, scan?: any): string
	/** Words for the two directions of change, named for the case group. up/down when left out */
	directions?: { up: string; down: string }
	/** The data carry one p-value, an FDR, instead of an original and an adjusted p-value */
	fdrOnly?: boolean

	/** the buttons of the action bar that apply to this data type */
	actions: readonly VolcanoAction[]
	/** of those, the ones that this run cannot offer */
	getHiddenActions?(run: VolcanoRunContext): VolcanoAction[]
	/** whether the differential analysis offers gene set enrichment off this analysis */
	gsea: boolean

	/** The identity of a row: what config.highlightedData holds, and what matches a table row, a
	 * hover-table row or a click-menu row back to its dot. Not the displayed label, which may be
	 * formatted. */
	getRowKey(d: any): string
	/** the columns that name a row, first in the p-value table and in the hover table */
	getIdColumns(settings: any): VolcanoColumn[]
	/** The p-value table's effect-size column, the one drawn as a bar and sorted by.
	 * log₂(fold-change) when left out or undefined */
	getTableEffectColumn?(run: VolcanoRunContext): VolcanoColumn | undefined
	/** the p-value table's columns between the effect size and the p-values */
	getExtraColumns?(run: VolcanoRunContext): VolcanoColumn[]
	/** the tooltip of one dot, in order */
	getTooltipRows(d: any, run: Omit<VolcanoRunContext, 'config'>, shared: SharedTooltipRows): TooltipRow[]

	/** adds the settings of the data type to the shared defaults */
	addDefaultSettings?(defaults: any, opts: any): void
	/** corrects the settings of a run, after the sample limit is checked. Runs for a data type that
	 * compares groups */
	validateSettings?(settings: any, opts: any): void
	/** the controls of the data type, listed before the shared ones */
	getControlInputs?(ctx: ControlContext): ControlInputEntry[]
	/** the shared controls that the data type leaves out, by settingsKey */
	leavesOutControls?: string[]
	/** the plot config of the data type, which getPlotConfig() adds */
	getPlotConfig?(opts: any, app: any): object
	/** the wait message counts the seconds, for an analysis that may take a minute or more */
	showsElapsedTime?: boolean

	/** the click actions of a dot, in order */
	getRowActions?(d: any, ctx: RowActionContext): ActionMenuItem[]
	/** The rows of the clustering action, as terms of hierCluster's data type. The gene expression of
	 * each row's gene when left out */
	clusterTerms?: ClusterTerms

	/** the labels of the two groups above the plot, control first. Each group's name and size when
	 * left out */
	getGroupLabels?(config: any, response: any): [string, string]
	/** the labels of the sample size rows of the stats, for a data type that compares no groups of
	 * its own. A data type that compares groups names them */
	sampleSizeLabels?: [string, string]
	/** the settings of a run that the provenance line records, before its significance cutoffs */
	getProvenance?(settings: any, response: any, scan?: any): string[]

	/** the pre-analysis panel that launches the analysis */
	preAnalysis?: PreAnalysisHandler
}

/** The terms that the clustering action clusters the significant rows by */
export type ClusterTerms = {
	/** the hierCluster dataType of the terms */
	dataType: string
	/** the term of a row, or undefined for a row that cannot be clustered */
	getTerm(d: any, vocabApi: any): object | undefined
	/** whether the dataset has the data of the terms. Offered always when left out */
	isAvailable?(termdbConfig: any): boolean
}

/** What the controls of a data type are built from */
export type ControlContext = {
	/** the regulatory-element classes of the dataset, from termdbConfig.queries.dnaMethylation */
	elementTypes: { key: string; label: string }[]
	/** the major chromosomes of the genome */
	chromosomes: string[]
}

/** What the click actions of a dot read and launch */
export type RowActionContext = {
	/** VolcanoInteractions, whose launchers the actions call */
	interactions: any
	/** the config of the volcano plot */
	config: any
	termdbConfig: any
	/** termdbConfig.queries */
	queries: any
	/** set on a DMR scan */
	scan?: any
}

/** An analysis method in the pre-analysis panel. One that cannot run is grayed out with the reason */
export type MethodOption = { label: string; value: string; disabled?: boolean; reason?: string }

/** The parts of the pre-analysis panel that differ by data type */
export type PreAnalysisHandler = {
	/** the analysis methods to choose from. None to choose from when left out */
	getMethodOptions?(ctx: {
		numControl: number
		numCase: number
		/** the methods that the server would refuse for memory */
		lowMemoryMethods: string[]
		sampleLabel: string
	}): MethodOption[]
	/** the method that the dataset prefers, listed first */
	getPreferredMethod?(termdbConfig: any): string | undefined
	/** volcano settings of the launch that follow from the number of samples with data */
	getLaunchSettings?(numSamples: number): object
	/** the element classes to choose from, and the class that the panel starts on */
	getElementClasses?(termdbConfig: any): { elementTypes: { key: string; label: string }[]; defaultElementType?: string }
}
