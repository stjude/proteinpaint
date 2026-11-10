import tape from 'tape'
import {
	buildCapabilities,
	describeSearchable,
	getDatasetFlags,
	getGeneCategoriesFor,
	getSearchableItems,
	variantCategoryLabel,
	variantDtCandidates
} from '../registry.ts'
import type { GeneRow } from '../types.ts'

/* Tests
	getDatasetFlags()
		- survival gate from allowedTermTypes
		- gbRestrictMode -> gbMode (default 'both')
	getSearchableItems() / describeSearchable()
		- dictionary is always searchable; genes, samples, coordinates depend on the dataset
	buildCapabilities()
		- Survival button only when the dataset allows survival
		- protein / genomic / both browser buttons follow gbRestrictMode
		- isChat follows queries.chat
	getGeneCategoriesFor()
		- only categories and actions this gene has
		- Genome view hidden when the gene has no resolved coordinate
	variantCategoryLabel() / variantDtCandidates()
	gene action run(): calls the launcher method with the expected arguments
*/

const noTypes = {
	geneExpression: false,
	dnaMethylation: false,
	snvindel: false,
	cnv: false,
	svfusion: false,
	genomeBrowser: false
}
const coord = { chr: 'chr17', start: 1, stop: 2 }
function geneRow(dataTypes: Partial<typeof noTypes>, c: typeof coord | null = coord): GeneRow {
	const dt = { ...noTypes, ...dataTypes }
	dt.genomeBrowser = dt.snvindel || dt.cnv || dt.svfusion
	return { kind: 'gene', name: 'TP53', gene: 'TP53', dataTypes: dt, coord: c }
}
const labelsFor = (caps: any, row: GeneRow) => getGeneCategoriesFor(caps, row).flatMap(c => c.actions.map(a => a.label))

tape('\n', t => {
	t.comment('-***- mass/chat/registry -***-')
	t.end()
})

tape('getDatasetFlags() survival gate', t => {
	t.equal(getDatasetFlags({ allowedTermTypes: ['survival', 'categorical'] }).hasSurvival, true)
	t.equal(getDatasetFlags({ allowedTermTypes: ['categorical'] }).hasSurvival, false)
	t.equal(getDatasetFlags(undefined).hasSurvival, false, 'a missing config is not an error')
	t.end()
})

tape('getDatasetFlags() gbRestrictMode -> gbMode', t => {
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'protein' } }).gbMode, 'protein')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'genomic' } }).gbMode, 'genomic')
	t.equal(getDatasetFlags({ queries: {} }).gbMode, 'both', 'unset -> both views')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'bogus' } }).gbMode, 'both', 'unknown value -> both views')
	t.end()
})

tape('getSearchableItems() dictionary only', t => {
	const flags = getDatasetFlags({})
	t.deepEqual(
		getSearchableItems({}, flags).map(i => i.key),
		['dictionary']
	)
	t.end()
})

tape('getSearchableItems() genes, samples and coordinates depend on the dataset', t => {
	const cfg = {
		allowedTermTypes: ['geneExpression'],
		displaySampleIds: true,
		queries: { snvindel: {} }
	}
	t.deepEqual(
		getSearchableItems(cfg, getDatasetFlags(cfg)).map(i => i.key),
		['dictionary', 'genes', 'samples', 'coord']
	)

	const proteinOnly = { ...cfg, queries: { snvindel: {}, gbRestrictMode: 'protein' } }
	t.notOk(
		getSearchableItems(proteinOnly, getDatasetFlags(proteinOnly)).some(i => i.key == 'coord'),
		'a protein-only genome browser cannot open a typed region'
	)

	const noSamples = { ...cfg, displaySampleIds: false }
	t.notOk(
		getSearchableItems(noSamples, getDatasetFlags(noSamples)).some(i => i.key == 'samples'),
		'samples not listed when the dataset does not display sample ids'
	)

	const methylationOnly = { allowedTermTypes: ['dnaMethylation'] }
	t.ok(
		getSearchableItems(methylationOnly, getDatasetFlags(methylationOnly)).some(i => i.key == 'genes'),
		'methylation alone makes genes searchable'
	)
	t.end()
})

tape('describeSearchable() lists items with their hints', t => {
	t.equal(
		describeSearchable([
			{ key: 'dictionary', label: 'Dictionary variables' },
			{ key: 'samples', label: 'Samples', hint: 'press Enter to search' }
		]),
		'Searchable: Dictionary variables, Samples (press Enter to search)'
	)
	t.end()
})

tape('buildCapabilities() Survival only when the dataset allows survival', t => {
	const row = geneRow({ geneExpression: true })
	const withSurvival = buildCapabilities({ allowedTermTypes: ['survival', 'geneExpression'] })
	const without = buildCapabilities({ allowedTermTypes: ['geneExpression'] })
	t.deepEqual(labelsFor(withSurvival, row), ['Summary', 'Survival'])
	t.deepEqual(labelsFor(without, row), ['Summary'])
	t.end()
})

tape('buildCapabilities() browser buttons follow gbRestrictMode', t => {
	const row = geneRow({ snvindel: true })
	const labels = (gbRestrictMode?: string) => labelsFor(buildCapabilities({ queries: { gbRestrictMode } }), row)
	t.deepEqual(labels(), ['Summary', 'Protein view', 'Genome view'], 'both views')
	t.deepEqual(labels('protein'), ['Summary', 'Protein view'], 'protein only')
	t.deepEqual(labels('genomic'), ['Summary', 'Genome view'], 'genomic only')
	t.end()
})

tape('buildCapabilities() isChat follows queries.chat', t => {
	t.equal(buildCapabilities({ queries: { chat: {} } }).isChat, true)
	t.equal(buildCapabilities({ queries: {} }).isChat, false)
	t.equal(buildCapabilities(undefined).isChat, false)
	t.end()
})

tape('getGeneCategoriesFor() only the categories this gene has', t => {
	const caps = buildCapabilities({ allowedTermTypes: ['survival'] })
	const cats = (row: GeneRow) => getGeneCategoriesFor(caps, row).map(c => c.label)
	t.deepEqual(cats(geneRow({ geneExpression: true })), ['Gene Expression'])
	t.deepEqual(cats(geneRow({ snvindel: true, cnv: true })), ['SNV/indel/CNV'])
	t.deepEqual(cats(geneRow({ dnaMethylation: true })), ['DNA methylation'])
	t.deepEqual(cats(geneRow({})), [], 'a gene with no data types has no categories')
	t.end()
})

tape('getGeneCategoriesFor() Genome view is hidden when the gene has no coordinate', t => {
	const caps = buildCapabilities({})
	t.deepEqual(labelsFor(caps, geneRow({ cnv: true }, null)), ['Summary', 'Protein view'])
	t.end()
})

tape('variantCategoryLabel() and variantDtCandidates()', t => {
	t.equal(variantCategoryLabel(geneRow({ snvindel: true, cnv: true, svfusion: true })), 'SNV/indel/CNV/SV/fusion')
	t.equal(variantCategoryLabel(geneRow({ cnv: true })), 'CNV')
	t.equal(variantDtCandidates(geneRow({ snvindel: true })).length, 1, 'snvindel has one dt')
	t.equal(variantDtCandidates(geneRow({ svfusion: true })).length, 2, 'svfusion maps to the SV and fusion dts')
	t.equal(variantDtCandidates(geneRow({ snvindel: true, cnv: true, svfusion: true })).length, 4)
	t.deepEqual(variantDtCandidates(geneRow({})), [])
	t.end()
})

tape('gene actions call the launcher with the expected arguments', async t => {
	const calls: any[] = []
	const record =
		(name: string) =>
		async (...args: any[]) =>
			void calls.push([name, ...args])
	const launcher: any = {
		launchPlot: record('launchPlot'),
		launchGeneVariantPlot: record('launchGeneVariantPlot'),
		launchGenomeBrowserView: record('launchGenomeBrowserView'),
		launchMethylationPlot: record('launchMethylationPlot'),
		launchSurvivalWithCovariate: record('launchSurvivalWithCovariate')
	}
	const caps = buildCapabilities({ allowedTermTypes: ['survival'] })
	const row = geneRow({ geneExpression: true, snvindel: true, dnaMethylation: true })
	for (const { actions } of getGeneCategoriesFor(caps, row)) {
		for (const a of actions) await a.run(launcher, row)
	}

	const tw = { term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' } }
	t.deepEqual(calls[0], ['launchPlot', { chartType: 'summary', term: tw }], 'expression summary')
	t.deepEqual(calls[1], ['launchSurvivalWithCovariate', 'term2', tw], 'expression survival')
	t.equal(calls[2][0], 'launchGeneVariantPlot', 'variant summary')
	t.equal(calls[2][1], 'TP53')
	t.equal(calls[2][2].length, 1, 'snvindel only -> one dt candidate')
	t.deepEqual(calls[3], ['launchGenomeBrowserView', 'protein', { gene: 'TP53' }], 'protein view')
	t.deepEqual(calls[4], ['launchGenomeBrowserView', 'genomic', { coord }], 'genome view')
	t.deepEqual(calls[5], ['launchMethylationPlot', 'TP53', coord], 'methylation')
	t.end()
})
