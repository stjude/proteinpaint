import { dtsnvindel, dtcnv, dtsv, dtfusionrna } from '#shared/common.js'
import type {
	Capabilities,
	DatasetFlags,
	GbMode,
	GeneActionDef,
	GeneCategoryDef,
	GeneRow,
	SearchableItem
} from './types.ts'

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
				run: (l, row) => l.launchPlot({ chartType: 'summary', term: geneExpressionTw(row) })
			},
			{
				id: 'geneExpression-survival',
				label: 'Survival',
				testid: gene => `sjpp-mass-chat-gene-exp-survival-${gene}`,
				enabled: caps => caps.hasSurvival,
				available: row => Boolean(row.dataTypes?.geneExpression),
				run: (l, row) => l.launchSurvivalWithCovariate('term2', geneExpressionTw(row))
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
				run: (l, row) => l.launchGeneVariantPlot(row.gene, variantDtCandidates(row))
			},
			{
				id: 'geneVariant-protein',
				label: 'Protein view',
				testid: gene => `sjpp-mass-chat-gene-protein-${gene}`,
				enabled: caps => caps.gbMode != 'genomic',
				available: row => presentVariantTypes(row).length > 0,
				run: (l, row) => l.launchGenomeBrowserView('protein', { gene: row.gene })
			},
			{
				id: 'geneVariant-genomic',
				label: 'Genome view',
				testid: gene => `sjpp-mass-chat-gene-genomic-${gene}`,
				enabled: caps => caps.gbMode != 'protein',
				// a genomic view needs the gene's locus; hide the button when the server could not resolve it
				available: row => presentVariantTypes(row).length > 0 && Boolean(row.coord),
				run: (l, row) => l.launchGenomeBrowserView('genomic', { coord: row.coord })
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
				run: (l, row) => l.launchMethylationPlot(row.gene, row.coord)
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

/** Which item types the omnisearch can find in this dataset. Derived from the same config as the action
 * gates so the note shown to the user cannot drift from what the search actually does. */
export function getSearchableItems(termdbConfig: any, flags: DatasetFlags): SearchableItem[] {
	const allowed: string[] = termdbConfig?.allowedTermTypes || []
	const q = termdbConfig?.queries || {}
	const hasGenomicAlterations = Boolean(q.snvindel || q.cnv || q.svfusion)
	const hasGeneData = allowed.includes('geneExpression') || allowed.includes('dnaMethylation') || hasGenomicAlterations

	const items: SearchableItem[] = [{ key: 'dictionary', label: 'Dictionary variables' }]
	if (hasGeneData) items.push({ key: 'genes', label: 'Genes' })
	if (termdbConfig?.displaySampleIds) items.push({ key: 'samples', label: 'Samples', hint: 'press Enter to search' })
	if (hasGenomicAlterations && flags.gbMode != 'protein') {
		items.push({ key: 'coord', label: 'Genomic regions', hint: 'chr:start-stop' })
	}
	return items
}

/** Text of the note under the search box, e.g.
 * "Searchable: Dictionary variables, Genes, Samples (press Enter to search), Genomic regions (chr:start-stop)". */
export function describeSearchable(items: SearchableItem[]): string {
	const parts = items.map(i => (i.hint ? `${i.label} (${i.hint})` : i.label))
	return `Searchable: ${parts.join(', ')}`
}

/** Build the registry once. Categories keep only actions the dataset allows; categories left with none
 * are dropped. */
export function buildCapabilities(termdbConfig: any): Capabilities {
	const flags = getDatasetFlags(termdbConfig)
	const geneCategories = GENE_CATEGORIES.map(cat => ({
		...cat,
		actions: cat.actions.filter(a => a.enabled(flags))
	})).filter(cat => cat.actions.length)
	return {
		...flags,
		isChat: Boolean(termdbConfig?.queries?.chat),
		searchable: getSearchableItems(termdbConfig, flags),
		geneCategories
	}
}

/** The categories (and their actions) to render for one gene result: the dataset-enabled ones filtered by
 * what this gene has. Empty categories are omitted. */
export function getGeneCategoriesFor(
	caps: Pick<Capabilities, 'geneCategories'>,
	row: GeneRow
): { category: GeneCategoryDef; label: string; actions: GeneActionDef[] }[] {
	return caps.geneCategories
		.map(category => ({
			category,
			label: category.label(row),
			actions: category.actions.filter(a => a.available(row))
		}))
		.filter(c => c.actions.length)
}
