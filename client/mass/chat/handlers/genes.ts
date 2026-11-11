// Result kind: genes. Selecting a gene shows one row of action buttons per category the dataset supports AND
// this gene has (gene expression, variants, DNA methylation). The term-type differences live here.
//
// See _README.md for the design (term types, plots, when a button is shown) and what every handler exports.
//
// NOT YET IMPLEMENTED (kept out of the render code on purpose):
//  - PSEUDO BULK category (Summary, Survival): needs server-side work first. GeneDataTypeAvailability
//    (shared/types/src/routes/termdb.chat.ts) and getGeneDataTypes (server/src/chat/search.ts) do not know
//    about ds.queries.singleCell.pseudobulk, and a pseudobulk term needs assay+memberId+category
//    (shared/types/src/terms/pseudobulk.ts), not a flat per-gene boolean.
import { TermTypes, type GeneDataTypeAvailability, type OmnisearchResult, type GBRestrictMode } from '#types'
import { dtsnvindel, dtcnv, dtsv, dtfusionrna } from '#shared/common.js'
import { escapeHtml } from '../../../dom/escapeHtml.ts'
import { addActionButton } from '../buttons.ts'
import { MIN_PROMPT_LENGTH_FOR_GENE_SEARCH, withinLength } from '../constants.ts'
import type { Coord, HandlerCtx, HandlerDeps, OmnisearchHandler, SearchInput } from '../types.ts'

export type GeneRow = {
	name: string
	gene: string
	dataTypes: GeneDataTypeAvailability
	/** server-resolved default coordinate; null when not resolved (e.g. protein-only datasets) */
	coord: Coord | null
}

/** Dataset-wide flags derived once from termdbConfig. */
export type DatasetFlags = {
	/** survival plots are allowed: allowedTermTypes includes 'survival' (the plot can also be launched from the
	 * data dictionary, so supportedChartTypes is not used) */
	hasSurvival: boolean
	/** the dataset has gene variant terms, which the variant Summary plot needs */
	hasGeneVariant: boolean
	/** the one genome browser view the dataset allows; undefined when it allows both */
	gbRestrictMode?: GBRestrictMode
}

/** One launchable button for a selected gene. */
export type GeneActionDef = {
	id: string
	label: string
	testid: (gene: string) => string
	/** per-gene gate, evaluated from the server-provided data types of that gene */
	available: (row: GeneRow) => boolean
	/** `button` is the clicked button, for a picker that opens under it */
	run: (handler: SearchResultHandler, deps: HandlerDeps, row: GeneRow, button?: HTMLElement) => Promise<void>
}

/** A term type of a gene (gene expression, variants, DNA methylation, later pseudobulk). It only knows how to
 * produce this gene's term; the plot buttons (PLOT_TYPES) are the same for every term type and are chained on. */
export type GeneTermTypeDef = {
	id: string
	/** middle part of the plot buttons' data-testid, e.g. `sjpp-mass-chat-gene-<testidKey>-survival-<gene>` */
	testidKey: string
	/** row label, may depend on which variant types this gene has */
	label: (row: GeneRow) => string
	/** per-gene gate: does this gene have this term type? */
	available: (row: GeneRow) => boolean
	/** dataset-wide gate for this term type's plot buttons, evaluated once in init() */
	enabled: (flags: DatasetFlags) => boolean
	/** produce the gene's term wrapper and pass it on. Callback style because some term types need user input
	 * first (DNA methylation picks a region). */
	withTerm: (
		handler: SearchResultHandler,
		deps: HandlerDeps,
		row: GeneRow,
		onTerm: (tw: any) => Promise<void>
	) => Promise<void>
	/** buttons that are not plots of the term, e.g. genome browser views */
	extraActions?: Array<GeneActionDef & { enabled: (flags: DatasetFlags) => boolean }>
}

/** A plot that can be made from any term type. Gated once per dataset. */
export type GenePlotTypeDef = {
	id: 'summary' | 'survival'
	label: string
	enabled: (flags: DatasetFlags) => boolean
	/** `tw` is the gene's term wrapper from a GeneTermTypeDef */
	launch: (handler: SearchResultHandler, deps: HandlerDeps, tw: any, button?: HTMLElement) => Promise<void>
}

/** The row of buttons of one term type after the dataset gates are applied */
export type GeneCategoryDef = {
	termType: GeneTermTypeDef
	plots: GenePlotTypeDef[]
	extras: GeneActionDef[]
}

/** Variant sub-types a gene can have, in display order. svfusion maps to two dts (SV and fusion). */
const VARIANT_TYPES = [
	{ key: 'snvindel', label: 'SNV/indel', dts: [dtsnvindel] },
	{ key: 'cnv', label: 'CNV', dts: [dtcnv] },
	{ key: 'svfusion', label: 'SV/fusion', dts: [dtsv, dtfusionrna] }
] as const

function presentVariantTypes(row: GeneRow) {
	return VARIANT_TYPES.filter(v => row.dataTypes?.[v.key])
}

/** Row label for the variant category, e.g. "SNV/indel/CNV/SV/fusion" or just "CNV" when that is all this
 * gene has. */
export function variantCategoryLabel(row: GeneRow): string {
	return presentVariantTypes(row)
		.map(v => v.label)
		.join('/')
}

/** All dts to try, in order, when launching the variant summary: launchGeneVariantPlot uses the first one
 * the dataset has a predefined groupset for. */
export function variantDtCandidates(row: GeneRow): number[] {
	return presentVariantTypes(row).flatMap(v => [...v.dts])
}

/** Plot types, chained onto every term type below. Survival always takes the gene's term as term2. */
const PLOT_TYPES: GenePlotTypeDef[] = [
	{
		id: 'summary',
		label: 'Summary',
		enabled: () => true,
		launch: (_h, d, tw) => d.launcher.launchPlot({ chartType: 'summary', term: tw })
	},
	{
		id: 'survival',
		label: 'Survival',
		enabled: flags => flags.hasSurvival,
		launch: (h, d, tw, button) => h.launchSurvivalWithTerm2(d, tw, button)
	}
]

/** To add a term type (e.g. pseudobulk): add one entry. It gets the plot buttons for free. */
const TERM_TYPES: GeneTermTypeDef[] = [
	{
		id: 'geneExpression',
		testidKey: 'exp',
		label: () => 'Gene Expression',
		available: row => Boolean(row.dataTypes?.geneExpression),
		enabled: () => true,
		withTerm: (_h, _d, row, onTerm) => onTerm({ term: { gene: row.gene, name: row.name, type: 'geneExpression' } })
	},
	{
		id: 'geneVariant',
		testidKey: 'variant',
		label: variantCategoryLabel,
		available: row => presentVariantTypes(row).length > 0,
		// the variant term is a geneVariant term, which the dataset must allow
		enabled: flags => flags.hasGeneVariant,
		withTerm: async (h, d, row, onTerm) => onTerm(await h.getGeneVariantTw(d, row.gene, variantDtCandidates(row))),
		extraActions: [
			{
				id: 'geneVariant-protein',
				label: 'Protein view',
				testid: gene => `sjpp-mass-chat-gene-protein-${gene}`,
				enabled: flags => !flags.gbRestrictMode || flags.gbRestrictMode == 'protein',
				available: row => presentVariantTypes(row).length > 0,
				run: (_h, d, row) => d.launcher.launchGenomeBrowserView('protein', { gene: row.gene })
			},
			{
				id: 'geneVariant-genomic',
				label: 'Genome view',
				testid: gene => `sjpp-mass-chat-gene-genomic-${gene}`,
				enabled: flags => !flags.gbRestrictMode || flags.gbRestrictMode == 'genomic',
				// a genomic view needs the gene's locus; hide the button when the server could not resolve it
				available: row => presentVariantTypes(row).length > 0 && Boolean(row.coord),
				run: (_h, d, row) => d.launcher.launchGenomeBrowserView('genomic', { coord: row.coord })
			}
		]
	},
	{
		id: 'dnaMethylation',
		testidKey: 'methylation',
		label: () => 'DNA methylation',
		available: row => Boolean(row.dataTypes?.dnaMethylation),
		enabled: () => true,
		withTerm: (h, d, row, onTerm) => h.pickMethylationTerm(d, row.gene, row.coord, term => onTerm({ term }))
	}
]

/** Dataset-wide flags from termdbConfig. gbRestrictMode limits the genome browser to one view. */
export function getDatasetFlags(termdbConfig: any): DatasetFlags {
	const allowed: string[] = termdbConfig?.allowedTermTypes || []
	const restrict = termdbConfig?.queries?.gbRestrictMode
	// anything but a known restriction (including a missing one) allows both views
	const gbRestrictMode: GBRestrictMode | undefined =
		restrict == 'protein' || restrict == 'genomic' ? restrict : undefined
	return {
		hasSurvival: allowed.includes(TermTypes.SURVIVAL),
		hasGeneVariant: allowed.includes(TermTypes.GENE_VARIANT),
		gbRestrictMode
	}
}

/** Whether this dataset has genes to search: it has any gene data type to act on (mirrors the server's
 * hasGeneData). */
export function includeResult(termdbConfig: any): boolean {
	const allowed: string[] = termdbConfig?.allowedTermTypes || []
	const q = termdbConfig?.queries || {}
	return (
		allowed.includes(TermTypes.GENE_EXPRESSION) ||
		allowed.includes(TermTypes.DNA_METHYLATION) ||
		Boolean(q.snvindel || q.cnv || q.svfusion)
	)
}

/** A gene is listed only if at least one action (expression / variant / genome browser / methylation) can
 * be offered for it. */
export function hasAnyGeneAction(dt: Partial<GeneDataTypeAvailability> | undefined | null): boolean {
	if (!dt) return false
	return Boolean(dt.geneExpression || dt.snvindel || dt.cnv || dt.svfusion || dt.genomeBrowser || dt.dnaMethylation)
}

export class SearchResultHandler implements OmnisearchHandler<GeneRow> {
	readonly key = 'genes' as const
	readonly heading = 'Genes'
	readonly noun = 'gene'
	readonly label = 'Genes'
	flags: DatasetFlags = { hasSurvival: false, hasGeneVariant: false }
	/** one entry per term type: the plot buttons and extra buttons this dataset allows. Term types left with
	 * none are dropped. */
	categories: GeneCategoryDef[] = []

	init({ termdbConfig }: HandlerCtx) {
		this.flags = getDatasetFlags(termdbConfig)
		this.categories = TERM_TYPES.map(termType => ({
			termType,
			plots: termType.enabled(this.flags) ? PLOT_TYPES.filter(p => p.enabled(this.flags)) : [],
			extras: (termType.extraActions || []).filter(a => a.enabled(this.flags))
		})).filter(c => c.plots.length || c.extras.length)
	}

	/** Typing: from the gene minimum length up to the max; Enter ignores the length gates. */
	includeInSearch({ prompt, enter }: SearchInput) {
		return enter || withinLength(prompt, MIN_PROMPT_LENGTH_FOR_GENE_SEARCH)
	}

	/** One row per gene. Genes with no available action and repeated genes are skipped. A gene whose name
	 * also appears among the dictionary rows is skipped too: the dictionary row is the more specific match. */
	buildRows(data: OmnisearchResult, earlier: Record<string, any[]> = {}): GeneRow[] {
		const dictionaryNames = new Set<string>((earlier.dictionaryTerms || []).map(r => String(r.name).toUpperCase()))
		const rows = new Map<string, GeneRow>()
		for (const g of Array.isArray(data.genes) ? data.genes : []) {
			const gene = g?.gene
			if (!gene || dictionaryNames.has(gene.toUpperCase())) continue
			if (!hasAnyGeneAction(g.dataTypes)) continue
			rows.set(gene.toUpperCase(), { name: gene, gene, dataTypes: g.dataTypes, coord: g.coord || null })
		}
		return [...rows.values()]
	}

	/** compare the server's total against what it returned, not what survived client-side filtering */
	countReturned(data: OmnisearchResult) {
		return Array.isArray(data.genes) ? data.genes.length : 0
	}

	/** The rows to show for one gene: the dataset-enabled buttons of each term type this gene has, plot buttons
	 * first. Each plot button chains the term type's term into the plot. Empty rows are omitted. */
	categoriesFor(row: GeneRow) {
		return this.categories
			.filter(c => c.termType.available(row))
			.map(({ termType, plots, extras }) => {
				const plotActions: GeneActionDef[] = plots.map(plot => ({
					id: `${termType.id}-${plot.id}`,
					label: plot.label,
					testid: gene =>
						`sjpp-mass-chat-gene-${termType.testidKey}-${plot.id == 'summary' ? '' : plot.id + '-'}${gene}`,
					available: () => true,
					run: (h, d, r, button) => termType.withTerm(h, d, r, tw => plot.launch(h, d, tw, button))
				}))
				return {
					category: termType,
					label: termType.label(row),
					actions: [...plotActions, ...extras].filter(a => a.available(row))
				}
			})
			.filter(c => c.actions.length)
	}

	renderRow(tr: any, row: GeneRow, deps: HandlerDeps) {
		// Clicking the name selects the gene: echoes "[ME] <name> (gene)" into chat history, then renders the
		// available categories into a new bubble right below it.
		tr.append('td')
			.text(row.name)
			.style('padding', '5px 10px')
			.style('cursor', 'pointer')
			.attr('class', 'sja_menuoption')
			.attr('data-testid', `sjpp-mass-chat-gene-select-${row.gene}`)
			.on('click', () => {
				deps.popup.inputNode.value = ''
				deps.popup.hide()
				deps.addBubble({ msg: escapeHtml(row.name) + ' (gene)', me: 1 })
				this.renderCategories(deps.addBubble({ msg: '' }), row, deps)
			})
	}

	/** One line per category: a bold label, then its action buttons. */
	renderCategories(holder: any, row: GeneRow, deps: HandlerDeps) {
		for (const { label, actions } of this.categoriesFor(row)) {
			const line = holder.append('div').style('margin', '4px 0')
			line
				.append('span')
				.style('font-weight', 'bold')
				.style('margin-right', '8px')
				.text(label + ':')
			for (const action of actions) {
				addActionButton(line, deps, {
					label: action.label,
					testid: action.testid(row.gene),
					onClick: button => action.run(this, deps, row, button)
				})
			}
		}
	}

	/** The term wrapper of one gene's variants, restricted to one variant data type. dtCandidates are tried in
	 * order (svfusion has two dts) until a matching predefined groupset is found, since fillTermWrapper throws
	 * when the dataset lacks a groupset for a given dt. */
	async getGeneVariantTw(deps: HandlerDeps, gene: string, dtCandidates: number[]) {
		const { fillTermWrapper } = await import('#termsetting')
		let tw: any
		let lastErr: any
		for (const dt of dtCandidates) {
			const candidate: any = {
				term: {
					id: gene,
					name: gene,
					genes: [{ kind: 'gene', id: gene, gene, name: gene, type: 'geneVariant' }],
					type: 'geneVariant'
				},
				q: { type: 'predefined-groupset', dtLst: [dt] }
			}
			try {
				await fillTermWrapper(candidate, deps.app.vocabApi)
				tw = candidate
				break
			} catch (e) {
				lastErr = e
			}
		}
		if (!tw) throw lastErr
		return tw
	}

	/** DNA methylation: show a genome browser at the gene's default coordinates inline in the popup with a
	 * "Submit Region" button; on submit, `onTerm` gets the region-based dnaMethylation term. */
	async pickMethylationTerm(
		deps: HandlerDeps,
		gene: string,
		coord: Coord | null,
		onTerm: (term: any) => Promise<void>
	) {
		// coord is the gene's default coordinate, resolved server-side (GeneMatch.coord)
		if (!coord) throw new Error(`Could not resolve coordinates for gene "${gene}"`)
		// reuse the termdb search handler's region picker and term builder (client/termdb/handlers/dnaMethylation.ts)
		const { embedRegionPicker, makeMethylationRegionTerm } = await import('../../../termdb/handlers/dnaMethylation.ts')
		const { mayRenderSampleTypeRow } = await import('#dom')
		const { vocabApi } = deps.app
		const holder = deps.popup.openPicker(gene)
		const sampleTypeSelect = mayRenderSampleTypeRow(
			holder.append('div'),
			vocabApi.termdbConfig?.queries.dnaMethylation,
			vocabApi.termdbConfig
		)
		await embedRegionPicker({
			holder: holder.append('div'),
			genomeObj: deps.app.opts.genome,
			chr: coord.chr,
			start: coord.start,
			stop: coord.stop,
			onSubmit: async region => {
				const term = makeMethylationRegionTerm(sampleTypeSelect, vocabApi, region)
				if (term) await onTerm(term)
			}
		})
	}

	/** The dataset's only survival term for the active cohort, or undefined when it has none or several
	 * (termdbConfig.loneTermByType, computed by the server; the same lookup the cox regression uses). */
	async getLoneSurvivalTerm(deps: HandlerDeps) {
		const { getLoneTermByType } = await import('#plots/regression/Regression.ts')
		const { termdbConfig, activeCohort } = deps.app.getState()
		return getLoneTermByType(termdbConfig, activeCohort)?.survival
	}

	/** Survival plot with `term2` (the gene's term, from the row's term type) as the overlay. If the dataset has
	 * just one survival term, the plot is dispatched with it as term. Otherwise the user first picks the outcome:
	 * the termdb tree opens under the clicked `button`, since survival's getPlotConfig() requires config.term to
	 * already be a resolved term wrapper (mirrors charts.ts's showTree_select1term). */
	async launchSurvivalWithTerm2(deps: HandlerDeps, term2: any, button?: HTMLElement) {
		const lone = await this.getLoneSurvivalTerm(deps)
		if (lone) {
			await deps.launcher.launchPlot({
				chartType: 'survival',
				term: { term: structuredClone(lone) },
				term2
			})
			return
		}
		const { app, popup } = deps
		popup.tip.clear()
		// the survival term picker opens under the Survival button that was clicked
		popup.tip.showunder(button || popup.inputNode)
		const action: any = { type: 'plot_create', config: { chartType: 'survival', term2 } }
		const termdb = await import('../../../termdb/app')
		termdb.appInit({
			vocabApi: app.vocabApi,
			holder: popup.tip.d.append('div'),
			state: { nav: { header_mode: 'search_only' }, tree: { usecase: { target: 'survival', detail: 'term' } } },
			tree: {
				click_term: (term: any) => {
					action.config.term = term.term ? term : { term }
					popup.tip.hide()
					app.dispatch(action)
				}
			}
		})
	}
}
