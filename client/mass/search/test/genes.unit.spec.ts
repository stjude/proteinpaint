import tape from 'tape'
import {
	SearchResultHandler as GeneHandler,
	getDatasetFlags,
	hasAnyGeneAction,
	includeResult,
	variantCategoryLabel,
	variantDtCandidates,
	type GeneRow
} from '../handlers/genes.ts'
import { MIN_PROMPT_LENGTH_FOR_GENE_SEARCH, MAX_PROMPT_LENGTH_FOR_OMNISEARCH } from '../constants.ts'

/* Tests
	getDatasetFlags() / includeResult() / hasAnyGeneAction()
	init()
		- Survival button only when the dataset allows survival
		- protein / genomic / both browser buttons follow gbRestrictMode
	includeInSearch()
		- typing: gene length bounds; Enter ignores them
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
	t.comment('-***- mass/search/handlers/genes -***-')
	t.end()
})

tape('getDatasetFlags() survival gate and gbRestrictMode', t => {
	t.equal(getDatasetFlags({ allowedTermTypes: ['survival', 'categorical'] }).hasSurvival, true)
	t.equal(getDatasetFlags({ allowedTermTypes: ['categorical'] }).hasSurvival, false)
	t.equal(getDatasetFlags({ allowedTermTypes: ['geneVariant'] }).hasGeneVariant, true)
	t.equal(getDatasetFlags(undefined).hasGeneVariant, false, 'a missing config is not an error')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'protein' } }).gbRestrictMode, 'protein')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'genomic' } }).gbRestrictMode, 'genomic')
	t.equal(getDatasetFlags({ queries: {} }).gbRestrictMode, undefined, 'unset -> both views')
	t.equal(getDatasetFlags({ queries: { gbRestrictMode: 'bogus' } }).gbRestrictMode, undefined, 'unknown -> both views')
	t.end()
})

tape('includeResult() and hasAnyGeneAction()', t => {
	t.equal(includeResult({}), false)
	t.equal(includeResult({ allowedTermTypes: ['geneExpression'] }), true)
	t.equal(includeResult({ allowedTermTypes: ['dnaMethylation'] }), true, 'methylation alone is gene data')
	t.equal(includeResult({ queries: { cnv: {} } }), true)
	t.equal(hasAnyGeneAction(noTypes), false)
	t.equal(hasAnyGeneAction(undefined), false)
	t.equal(hasAnyGeneAction({ ...noTypes, dnaMethylation: true }), true)
	t.equal(hasAnyGeneAction({ ...noTypes, genomeBrowser: true }), true)
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
	const labels = (gbRestrictMode?: string) =>
		labelsFor(makeHandler({ allowedTermTypes: ['geneVariant'], queries: { gbRestrictMode } }), row)
	t.deepEqual(labels(), ['Summary', 'Protein view', 'Genome view'], 'both views')
	t.deepEqual(labels('protein'), ['Summary', 'Protein view'], 'protein only')
	t.deepEqual(labels('genomic'), ['Summary', 'Genome view'], 'genomic only')
	t.end()
})

tape('includeInSearch() typing follows the gene length bounds; Enter ignores them', t => {
	const h = makeHandler({ allowedTermTypes: ['geneExpression'] })
	t.equal(h.includeInSearch({ prompt: 'p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH - 1), enter: false }), false)
	t.equal(h.includeInSearch({ prompt: 'tp', enter: false }), true)
	t.equal(h.includeInSearch({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), enter: false }), false)
	t.equal(h.includeInSearch({ prompt: 'a', enter: true }), true, 'Enter ignores the length gates')
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
		{ dictionaryTerms: [{ name: 'Risk' }] }
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
	t.deepEqual(labelsFor(makeHandler({ allowedTermTypes: ['geneVariant'] }), geneRow({ cnv: true }, null)), [
		'Summary',
		'Protein view'
	])
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

tape('variant Summary is included only when allowedTermTypes has geneVariant', t => {
	const row = geneRow({ snvindel: true })
	t.deepEqual(
		labelsFor(makeHandler({}), row),
		['Protein view', 'Genome view'],
		'no geneVariant term type -> no Summary'
	)
	t.deepEqual(
		labelsFor(makeHandler({ allowedTermTypes: ['geneVariant'] }), row),
		['Summary', 'Protein view', 'Genome view'],
		'geneVariant term type -> Summary'
	)
	t.end()
})

tape('Survival is included in every row only when allowedTermTypes has survival', t => {
	const row = geneRow({ geneExpression: true, snvindel: true, dnaMethylation: true })
	const byRow = (termdbConfig: any) =>
		makeHandler(termdbConfig)
			.categoriesFor(row)
			.map(c => `${c.label}: ${c.actions.map(a => a.label).join(', ')}`)
	t.deepEqual(byRow({ allowedTermTypes: ['survival', 'geneVariant'] }), [
		'Gene Expression: Summary, Survival',
		'SNV/indel: Summary, Survival, Protein view, Genome view',
		'DNA methylation: Summary, Survival'
	])
	t.deepEqual(
		byRow({ allowedTermTypes: ['geneVariant'] }),
		['Gene Expression: Summary', 'SNV/indel: Summary, Protein view, Genome view', 'DNA methylation: Summary'],
		'no survival term type -> no Survival button anywhere'
	)
	t.deepEqual(
		makeHandler({ allowedTermTypes: ['survival'] })
			.categoriesFor(geneRow({ snvindel: true }))
			.flatMap(c => c.actions.map(a => a.label)),
		['Protein view', 'Genome view'],
		'variant Survival also needs the geneVariant term type, as its term2 is a gene variant term'
	)
	t.end()
})

/** a handler whose launchers record their calls, plus deps whose launcher records launchPlot */
function recorder() {
	const calls: any[] = []
	const record =
		(name: string) =>
		async (...args: any[]) =>
			void calls.push([name, ...args])
	const deps: any = {
		launcher: { launchPlot: record('launchPlot'), launchGenomeBrowserView: record('launchGenomeBrowserView') }
	}
	return { calls, record, deps }
}

tape(
	'every plot button chains its term type into the plot; survival takes it as term2 and gets the clicked button',
	async t => {
		const { calls, record, deps } = recorder()
		const h = makeHandler({ allowedTermTypes: ['survival', 'geneVariant'] })
		// replace the parts that load heavy code or render UI
		const variantTw = { term: { id: 'TP53' }, q: {} }
		const regionTerm = { type: 'dnaMethylation', chr: 'chr17', start: 1, stop: 2 }
		h.getGeneVariantTw = (async () => variantTw) as any
		h.pickMethylationTerm = (async (_d: any, _g: string, _c: any, onTerm: any) => onTerm(regionTerm)) as any
		h.launchSurvivalWithTerm2 = record('launchSurvivalWithTerm2') as any

		const button: any = { clicked: true }
		const row = geneRow({ geneExpression: true, snvindel: true, dnaMethylation: true })
		for (const { actions } of h.categoriesFor(row)) {
			for (const a of actions) await a.run(h, deps, row, button)
		}

		const expTw = { term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' } }
		t.deepEqual(calls[0], ['launchPlot', { chartType: 'summary', term: expTw }], 'expression summary')
		t.deepEqual(calls[1], ['launchSurvivalWithTerm2', deps, expTw, button], 'expression survival')
		t.deepEqual(calls[2], ['launchPlot', { chartType: 'summary', term: variantTw }], 'variant summary')
		t.deepEqual(calls[3], ['launchSurvivalWithTerm2', deps, variantTw, button], 'variant survival')
		t.deepEqual(calls[4], ['launchGenomeBrowserView', 'protein', { gene: 'TP53' }], 'protein view')
		t.deepEqual(calls[5], ['launchGenomeBrowserView', 'genomic', { coord }], 'genome view')
		t.deepEqual(calls[6], ['launchPlot', { chartType: 'summary', term: { term: regionTerm } }], 'methylation summary')
		t.deepEqual(calls[7], ['launchSurvivalWithTerm2', deps, { term: regionTerm }, button], 'methylation survival')
		t.end()
	}
)

tape('testids per term type and plot', t => {
	const h = makeHandler({ allowedTermTypes: ['survival', 'geneVariant'] })
	const ids = h
		.categoriesFor(geneRow({ geneExpression: true, snvindel: true, dnaMethylation: true }))
		.flatMap(c => c.actions.map(a => a.testid('TP53')))
	t.deepEqual(ids, [
		'sjpp-mass-search-gene-exp-TP53',
		'sjpp-mass-search-gene-exp-survival-TP53',
		'sjpp-mass-search-gene-variant-TP53',
		'sjpp-mass-search-gene-variant-survival-TP53',
		'sjpp-mass-search-gene-protein-TP53',
		'sjpp-mass-search-gene-genomic-TP53',
		'sjpp-mass-search-gene-methylation-TP53',
		'sjpp-mass-search-gene-methylation-survival-TP53'
	])
	t.end()
})

tape('launchSurvivalWithTerm2() dispatches directly when the dataset has one survival term', async t => {
	const { calls, deps } = recorder()
	const h = makeHandler({})
	const lone = { id: 'os', name: 'Overall survival', type: 'survival' }
	h.getLoneSurvivalTerm = (async () => lone) as any
	const tw = { term: { gene: 'TP53', type: 'geneExpression' } }
	await h.launchSurvivalWithTerm2(deps, tw)
	t.equal(calls.length, 1, 'launches without opening the term tree')
	const [name, config] = calls[0]
	t.equal(name, 'launchPlot')
	t.deepEqual(config, { chartType: 'survival', term: { term: lone }, term2: tw }, 'lone term is the outcome')
	t.notEqual(config.term.term, lone, 'the dataset term is copied, not shared')
	t.end()
})
