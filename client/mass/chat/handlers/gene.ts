// Result kind: genes. Selecting a gene shows one row of action buttons per category the dataset supports AND
// this gene has (gene expression, variants, DNA methylation). The term-type differences live here.
//
// Dataset-wide gates (survival allowed? protein/genomic/both browser views?) are decided ONCE in init().
// Per-gene availability (which data types THIS gene has) comes from the server's result and is checked by
// each action's `available()`.
//
// To add a gene action: add one entry to the matching category in GENE_CATEGORIES below.
//
// NOT YET IMPLEMENTED (kept out of the render code on purpose):
//  - Survival for the SNV/indel/CNV/SV/fusion category: resolve the term wrapper as launchGeneVariantPlot
//    does, then launchSurvivalWithCovariate('term2', tw).
//  - Survival for DNA methylation: pass the region picker's resolved term to launchSurvivalWithCovariate.
//  - PSEUDO BULK category: needs server-side work first. GeneDataTypeAvailability
//    (shared/types/src/routes/termdb.chat.ts) and getGeneDataTypes (server/src/chat/search.ts) do not know
//    about ds.queries.singleCell.pseudobulk, and a pseudobulk term needs assay+memberId+category
//    (shared/types/src/terms/pseudobulk.ts), not a flat per-gene boolean.
import type { GeneDataTypeAvailability, OmnisearchResult } from '#types'
import { dtsnvindel, dtcnv, dtsv, dtfusionrna } from '#shared/common.js'
import { escapeHtml } from '../../../dom/escapeHtml.ts'
import { addActionButton } from '../buttons.ts'
import { MIN_PROMPT_LENGTH_FOR_GENE_SEARCH, withinLength } from './constants.ts'
import { inactive, type Coord, type HandlerCtx, type HandlerDeps, type HandlerPlan } from './types.ts'
import type { OmnisearchHandler, SearchInput } from './types.ts'

export type GeneRow = {
	name: string
	gene: string
	dataTypes: GeneDataTypeAvailability
	/** server-resolved default coordinate; null when not resolved (e.g. protein-only datasets) */
	coord: Coord | null
}

export type GbMode = 'protein' | 'genomic' | 'both'

/** Dataset-wide flags derived once from termdbConfig. */
export type DatasetFlags = { hasSurvival: boolean; gbMode: GbMode }

/** One launchable button for a selected gene. */
export type GeneActionDef = {
	id: string
	label: string
	testid: (gene: string) => string
	/** dataset-wide gate, evaluated once in init() */
	enabled: (flags: DatasetFlags) => boolean
	/** per-gene gate, evaluated from the server-provided data types of that gene */
	available: (row: GeneRow) => boolean
	run: (handler: GeneHandler, deps: HandlerDeps, row: GeneRow) => Promise<void>
}

export type GeneCategoryDef = {
	id: string
	/** row label, may depend on which variant types this gene has */
	label: (row: GeneRow) => string
	actions: GeneActionDef[]
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

const geneExpressionTw = (row: GeneRow) => ({ term: { gene: row.gene, name: row.name, type: 'geneExpression' } })

const GENE_CATEGORIES: GeneCategoryDef[] = [
	{
		id: 'geneExpression',
		label: () => 'Gene Expression',
		actions: [
			{
				id: 'geneExpression-summary',
				label: 'Summary',
				testid: gene => `sjpp-mass-chat-gene-exp-${gene}`,
				enabled: () => true,
				available: row => Boolean(row.dataTypes?.geneExpression),
				run: (_h, d, row) => d.launcher.launchPlot({ chartType: 'summary', term: geneExpressionTw(row) })
			},
			{
				id: 'geneExpression-survival',
				label: 'Survival',
				testid: gene => `sjpp-mass-chat-gene-exp-survival-${gene}`,
				enabled: flags => flags.hasSurvival,
				available: row => Boolean(row.dataTypes?.geneExpression),
				run: (h, d, row) => h.launchSurvivalWithCovariate(d, 'term2', geneExpressionTw(row))
			}
		]
	},
	{
		id: 'geneVariant',
		label: variantCategoryLabel,
		actions: [
			{
				id: 'geneVariant-summary',
				label: 'Summary',
				testid: gene => `sjpp-mass-chat-gene-variant-${gene}`,
				enabled: () => true,
				available: row => presentVariantTypes(row).length > 0,
				run: (h, d, row) => h.launchGeneVariantPlot(d, row.gene, variantDtCandidates(row))
			},
			{
				id: 'geneVariant-protein',
				label: 'Protein view',
				testid: gene => `sjpp-mass-chat-gene-protein-${gene}`,
				enabled: flags => flags.gbMode != 'genomic',
				available: row => presentVariantTypes(row).length > 0,
				run: (_h, d, row) => d.launcher.launchGenomeBrowserView('protein', { gene: row.gene })
			},
			{
				id: 'geneVariant-genomic',
				label: 'Genome view',
				testid: gene => `sjpp-mass-chat-gene-genomic-${gene}`,
				enabled: flags => flags.gbMode != 'protein',
				// a genomic view needs the gene's locus; hide the button when the server could not resolve it
				available: row => presentVariantTypes(row).length > 0 && Boolean(row.coord),
				run: (_h, d, row) => d.launcher.launchGenomeBrowserView('genomic', { coord: row.coord })
			}
		]
	},
	{
		id: 'dnaMethylation',
		label: () => 'DNA methylation',
		actions: [
			{
				id: 'dnaMethylation-summary',
				label: 'Summary',
				testid: gene => `sjpp-mass-chat-gene-methylation-${gene}`,
				enabled: () => true,
				available: row => Boolean(row.dataTypes?.dnaMethylation),
				run: (h, d, row) => h.launchMethylationPlot(d, row.gene, row.coord)
			}
		]
	}
]

/** Dataset-wide flags from termdbConfig. gbRestrictMode limits the genome browser to one view. */
export function getDatasetFlags(termdbConfig: any): DatasetFlags {
	const allowed: string[] = termdbConfig?.allowedTermTypes || []
	const restrict = termdbConfig?.queries?.gbRestrictMode
	const gbMode: GbMode = restrict == 'protein' || restrict == 'genomic' ? restrict : 'both'
	return { hasSurvival: allowed.includes('survival'), gbMode }
}

/** True when the dataset has any gene data type to act on (mirrors the server's hasGeneData). */
export function hasGeneData(termdbConfig: any): boolean {
	const allowed: string[] = termdbConfig?.allowedTermTypes || []
	const q = termdbConfig?.queries || {}
	return (
		allowed.includes('geneExpression') ||
		allowed.includes('dnaMethylation') ||
		Boolean(q.snvindel || q.cnv || q.svfusion)
	)
}

/** A gene is listed only if at least one action (expression / variant / genome browser / methylation) can
 * be offered for it. */
export function hasAnyGeneAction(dt: Partial<GeneDataTypeAvailability> | undefined | null): boolean {
	if (!dt) return false
	return Boolean(dt.geneExpression || dt.snvindel || dt.cnv || dt.svfusion || dt.genomeBrowser || dt.dnaMethylation)
}

export class GeneHandler implements OmnisearchHandler<GeneRow> {
	readonly id = 'genes'
	readonly key = 'genes' as const
	readonly heading = 'Genes'
	readonly noun = 'gene'
	readonly label = 'Genes'
	enabled = false
	flags: DatasetFlags = { hasSurvival: false, gbMode: 'both' }
	/** categories keeping only the actions this dataset allows; categories left with none are dropped */
	categories: GeneCategoryDef[] = []

	init({ termdbConfig }: HandlerCtx) {
		this.enabled = hasGeneData(termdbConfig)
		this.flags = getDatasetFlags(termdbConfig)
		this.categories = GENE_CATEGORIES.map(cat => ({
			...cat,
			actions: cat.actions.filter(a => a.enabled(this.flags))
		})).filter(cat => cat.actions.length)
	}

	plan({ prompt, enter }: SearchInput): HandlerPlan {
		const active = this.enabled && (enter || withinLength(prompt, MIN_PROMPT_LENGTH_FOR_GENE_SEARCH))
		return active ? { active, request: { includeGenes: true } } : inactive({ includeGenes: false })
	}

	/** One row per gene. Genes with no available action and repeated genes are skipped. A gene whose name
	 * also appears among the dictionary rows is skipped too: the dictionary row is the more specific match. */
	buildRows(data: OmnisearchResult, earlier: Record<string, any[]> = {}): GeneRow[] {
		const dictionaryNames = new Set<string>((earlier.dictionary || []).map(r => String(r.name).toUpperCase()))
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

	/** The categories (and their actions) to show for one gene: the dataset-enabled ones filtered by what
	 * this gene has. Empty categories are omitted. */
	categoriesFor(row: GeneRow) {
		return this.categories
			.map(category => ({
				category,
				label: category.label(row),
				actions: category.actions.filter(a => a.available(row))
			}))
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
					onClick: () => action.run(this, deps, row)
				})
			}
		}
	}

	/** Mutated-vs-wildtype barchart for one gene, restricted to a variant data type. dtCandidates are tried
	 * in order (svfusion has two dts) until a matching predefined groupset is found, since fillTermWrapper
	 * throws when the dataset lacks a groupset for a given dt. */
	async launchGeneVariantPlot(deps: HandlerDeps, gene: string, dtCandidates: number[]) {
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
		await deps.launcher.launchPlot({ chartType: 'summary', term: tw })
	}

	/** DNA methylation: show a genome browser at the gene's default coordinates inline in the popup with a
	 * "Submit Region" button; on submit, open a summary plot of the region-based dnaMethylation term. */
	async launchMethylationPlot(deps: HandlerDeps, gene: string, coord: Coord | null) {
		// coord is the gene's default coordinate, resolved server-side (GeneMatch.coord)
		if (!coord) throw new Error(`Could not resolve coordinates for gene "${gene}"`)
		const { embedMethylationRegionPicker } = await import('../methylationPicker.ts')
		const holder = deps.popup.openPicker(gene)
		await embedMethylationRegionPicker({
			holder: holder.append('div'),
			genomeObj: deps.app.opts.genome,
			vocabApi: deps.app.vocabApi,
			chr: coord.chr,
			start: coord.start,
			stop: coord.stop,
			callback: async (term: any) => {
				await deps.launcher.launchPlot({ chartType: 'summary', term: { term } })
			}
		})
	}

	/** Open the termdb tree to pick a survival outcome term, then dispatch a survival plot with
	 * `covariateField` pre-set to `covariateTw`. survival's getPlotConfig() requires config.term to already be
	 * a resolved term wrapper, so unlike launchPlot() this can't dispatch directly: it must collect the
	 * outcome term first (mirrors charts.ts's showTree_select1term). */
	async launchSurvivalWithCovariate(deps: HandlerDeps, covariateField: 'term2', covariateTw: any) {
		const { app, popup } = deps
		popup.tip.clear()
		popup.tip.showunder(popup.inputNode)
		const action: any = { type: 'plot_create', config: { chartType: 'survival', [covariateField]: covariateTw } }
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
