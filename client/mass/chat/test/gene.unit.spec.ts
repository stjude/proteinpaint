import tape from 'tape'
import {
	GeneHandler,
	getDatasetFlags,
	hasAnyGeneAction,
	hasGeneData,
	variantCategoryLabel,
	variantDtCandidates,
	type GeneRow
} from '../handlers/gene.ts'
import { MIN_PROMPT_LENGTH_FOR_GENE_SEARCH, MAX_PROMPT_LENGTH_FOR_OMNISEARCH } from '../handlers/constants.ts'

/* Tests
	getDatasetFlags() / hasGeneData() / hasAnyGeneAction()
	init()
		- enabled only when the dataset has gene data
		- Survival button only when the dataset allows survival
		- protein / genomic / both browser buttons follow gbRestrictMode
	plan()
		- typing: gene length bounds; Enter ignores them; request always carries includeGenes
	buildRows()
		- skips genes with no action, genes also in the dictionary rows, duplicates; missing coord -> null
	countReturned()
	categoriesFor()
		- only the categories and actions this gene has; Genome view hidden without a coordinate
	variantCategoryLabel() / variantDtCandidates()
	action run(): calls the launcher / handler method with the expected arguments
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
	return { name: 'TP53', gene: 'TP53', dataTypes: dt, coord: c }
}
function makeHandler(termdbConfig: any) {
	const h = new GeneHandler()
	h.init({ app: {}, termdbConfig })
	return h
}
const labelsFor = (h: GeneHandler, row: GeneRow) => h.categoriesFor(row).flatMap(c => c.actions.map(a => a.label))
const empty = { dictionaryTerms: [], genes: [], samples: [] }

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/gene -***-')
	t.end()
})

tape('getDatasetFlags() survival gate and gbRestrictMode', t => {
	t.equal(getDatasetFlags({ allowedTermTypes: ['survival', 'categorical'] }).hasSurvival, true)
	t.equal(getDatasetFlags({ allowedTermTypes: ['categorical'] }).hasSurvival, false)
	t.equal(getDatasetFlags(undefined).hasSurvival, false, 'a missing config is not an error')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'protein' } }).gbMode, 'protein')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'genomic' } }).gbMode, 'genomic')
	t.equal(getDatasetFlags({ queries: {} }).gbMode, 'both', 'unset -> both views')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'bogus' } }).gbMode, 'both', 'unknown value -> both views')
	t.end()
})

tape('hasGeneData() and hasAnyGeneAction()', t => {
	t.equal(hasGeneData({}), false)
	t.equal(hasGeneData({ allowedTermTypes: ['geneExpression'] }), true)
	t.equal(hasGeneData({ allowedTermTypes: ['dnaMethylation'] }), true, 'methylation alone is gene data')
	t.equal(hasGeneData({ queries: { cnv: {} } }), true)
	t.equal(hasAnyGeneAction(noTypes), false)
	t.equal(hasAnyGeneAction(undefined), false)
	t.equal(hasAnyGeneAction({ ...noTypes, dnaMethylation: true }), true)
	t.equal(hasAnyGeneAction({ ...noTypes, genomeBrowser: true }), true)
	t.end()
})

tape('init() enabled follows gene data', t => {
	t.equal(makeHandler({ allowedTermTypes: ['geneExpression'] }).enabled, true)
	t.equal(makeHandler({}).enabled, false)
	t.end()
})

tape('init() Survival only when the dataset allows survival', t => {
	const row = geneRow({ geneExpression: true })
	t.deepEqual(labelsFor(makeHandler({ allowedTermTypes: ['survival', 'geneExpression'] }), row), [
		'Summary',
		'Survival'
	])
	t.deepEqual(labelsFor(makeHandler({ allowedTermTypes: ['geneExpression'] }), row), ['Summary'])
	t.end()
})

tape('init() browser buttons follow gbRestrictMode', t => {
	const row = geneRow({ snvindel: true })
	const labels = (gbRestrictMode?: string) => labelsFor(makeHandler({ queries: { gbRestrictMode } }), row)
	t.deepEqual(labels(), ['Summary', 'Protein view', 'Genome view'], 'both views')
	t.deepEqual(labels('protein'), ['Summary', 'Protein view'], 'protein only')
	t.deepEqual(labels('genomic'), ['Summary', 'Genome view'], 'genomic only')
	t.end()
})

tape('plan() typing follows the gene length bounds; Enter ignores them', t => {
	const h = makeHandler({ allowedTermTypes: ['geneExpression'] })
	const short = h.plan({ prompt: 'p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH - 1), enter: false })
	t.equal(short.active, false)
	t.deepEqual(short.request, { includeGenes: false }, 'switched off server-side')
	t.deepEqual(h.plan({ prompt: 'tp', enter: false }), { active: true, request: { includeGenes: true } })
	t.equal(h.plan({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), enter: false }).active, false)
	t.equal(h.plan({ prompt: 'a', enter: true }).active, true, 'Enter ignores the length gates')
	t.end()
})

tape('plan() a disabled handler never searches', t => {
	const plan = makeHandler({}).plan({ prompt: 'TP53', enter: true })
	t.equal(plan.active, false)
	t.deepEqual(plan.request, { includeGenes: false })
	t.end()
})

tape('buildRows() filters and dedupes', t => {
	const h = makeHandler({ allowedTermTypes: ['geneExpression'] })
	const expOnly = { ...noTypes, geneExpression: true }
	const rows = h.buildRows(
		{
			...empty,
			genes: [
				{ gene: 'TP53', dataTypes: expOnly, coord },
				{ gene: 'tp53', dataTypes: expOnly, coord: null }, // duplicate (case-insensitive); the last one wins
				{ gene: 'NOACTION', dataTypes: noTypes, coord: null },
				{ gene: 'AKT1', dataTypes: expOnly, coord: null },
				{ gene: 'RISK', dataTypes: expOnly, coord: null } // also a dictionary row
			]
		},
		{ dictionary: [{ name: 'Risk' }] }
	)
	t.deepEqual(
		rows.map(r => r.gene),
		['tp53', 'AKT1'],
		'no-action, dictionary-duplicate and repeated genes are removed'
	)
	t.equal(rows[0].coord, null, 'a missing coord is null')
	t.deepEqual(h.buildRows({ ...empty, genes: undefined as any }, {}), [], 'undefined genes -> []')
	t.end()
})

tape('countReturned() is the raw server count, not the filtered one', t => {
	const h = makeHandler({ allowedTermTypes: ['geneExpression'] })
	const genes = [
		{ gene: 'A', dataTypes: { ...noTypes, geneExpression: true }, coord: null },
		{ gene: 'B', dataTypes: noTypes, coord: null }
	]
	t.equal(h.countReturned({ ...empty, genes }), 2)
	t.equal(h.buildRows({ ...empty, genes }, {}).length, 1)
	t.equal(h.countReturned({ ...empty, genes: undefined as any }), 0)
	t.end()
})

tape('categoriesFor() only the categories this gene has', t => {
	const h = makeHandler({ allowedTermTypes: ['survival'] })
	const cats = (row: GeneRow) => h.categoriesFor(row).map(c => c.label)
	t.deepEqual(cats(geneRow({ geneExpression: true })), ['Gene Expression'])
	t.deepEqual(cats(geneRow({ snvindel: true, cnv: true })), ['SNV/indel/CNV'])
	t.deepEqual(cats(geneRow({ dnaMethylation: true })), ['DNA methylation'])
	t.deepEqual(cats(geneRow({})), [], 'a gene with no data types has no categories')
	t.end()
})

tape('categoriesFor() Genome view is hidden when the gene has no coordinate', t => {
	t.deepEqual(labelsFor(makeHandler({}), geneRow({ cnv: true }, null)), ['Summary', 'Protein view'])
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

tape('actions call the launcher and handler methods with the expected arguments', async t => {
	const calls: any[] = []
	const record =
		(name: string) =>
		async (...args: any[]) =>
			void calls.push([name, ...args])
	const deps: any = {
		launcher: { launchPlot: record('launchPlot'), launchGenomeBrowserView: record('launchGenomeBrowserView') }
	}
	const h = makeHandler({ allowedTermTypes: ['survival'] })
	// the gene-specific launchers load heavy code lazily; replace them with recorders
	h.launchGeneVariantPlot = record('launchGeneVariantPlot') as any
	h.launchMethylationPlot = record('launchMethylationPlot') as any
	h.launchSurvivalWithCovariate = record('launchSurvivalWithCovariate') as any

	const row = geneRow({ geneExpression: true, snvindel: true, dnaMethylation: true })
	for (const { actions } of h.categoriesFor(row)) {
		for (const a of actions) await a.run(h, deps, row)
	}

	const tw = { term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' } }
	t.deepEqual(calls[0], ['launchPlot', { chartType: 'summary', term: tw }], 'expression summary')
	t.deepEqual(calls[1], ['launchSurvivalWithCovariate', deps, 'term2', tw], 'expression survival')
	t.equal(calls[2][0], 'launchGeneVariantPlot', 'variant summary')
	t.equal(calls[2][2], 'TP53')
	t.equal(calls[2][3].length, 1, 'snvindel only -> one dt candidate')
	t.deepEqual(calls[3], ['launchGenomeBrowserView', 'protein', { gene: 'TP53' }], 'protein view')
	t.deepEqual(calls[4], ['launchGenomeBrowserView', 'genomic', { coord }], 'genome view')
	t.deepEqual(calls[5], ['launchMethylationPlot', deps, 'TP53', coord], 'methylation')
	t.end()
})
