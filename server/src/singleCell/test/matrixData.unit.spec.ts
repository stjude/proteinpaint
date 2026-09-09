import tape from 'tape'
import { getSingleCellCellValues, annotateSingleCellTerm, hydrateMetaResultCellRows } from '../matrixData.ts'
import { SINGLECELL_NUMERIC_VALUE, SINGLECELL_GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#types'

tape('single cell numeric values omit missing/nonfinite fields and preserve zero', async test => {
	const categories = ['', ' \t', undefined, null, 'NA', 'NaN', 'Infinity', '0', '-2', ' 2.5 ']
	const ds = {
		queries: { singleCell: { data: { get: async () => ({
			plots: [{ noExpCells: categories.map((category, i) => ({ cellId: String(i), category })) }]
		}) } } }
	}
	const values = await getSingleCellCellValues({}, {
		term: { type: SINGLECELL_NUMERIC_VALUE, name: 'score', plot: 'UMAP', sample: { sID: 's1' } }
	}, ds)
	test.deepEqual(values.map(cell => cell.value), [0, -2, 2.5], 'only finite, nonblank values are returned')
	test.deepEqual(values.map(cell => cell.cellId), ['7', '8', '9'], 'values retain their cell IDs')
	test.end()
})

function plotDataset(cells: any[]) {
	return { queries: { singleCell: { data: {
		get: async (_q?: any) => ({ plots: [{ noExpCells: cells }] })
	} } } } as any
}

function wrapper(type = SINGLECELL_NUMERIC_VALUE): any {
	return { $id: 'term', term: { type, name: 'score', plot: 'UMAP', sample: { sID: 's1' } }, q: { mode: 'continuous' } }
}

async function rejects(test, run, expected: RegExp) {
	try {
		await run()
		test.fail('expected rejection')
	} catch (error: any) {
		test.ok(expected.test(error.message || String(error)), `rejects with ${expected}`)
	}
}

tape('single cell getters forward column and expression query context', async test => {
	const tw = wrapper(SINGLECELL_CELLTYPE)
	const ds = plotDataset([{ cellId: 'c1', sampleId: 12, category: '0' }, { cellId: 'c2', category: '' }])
	const get = ds.queries.singleCell.data.get
	ds.queries.singleCell.data.get = async q => {
		test.deepEqual(q, { sample: tw.term.sample, plots: ['UMAP'], colorBy: { UMAP: 'score' } }, 'selects requested plot and column')
		return get()
	}
	const cells = await getSingleCellCellValues({}, tw, ds)
	test.deepEqual(cells.map(c => c.value), ['0', ''], 'categorical values are not coerced or dropped')
	test.equal(cells[0].sampleId, 12, 'preserves sample mapping')

	const exp = wrapper(SINGLECELL_GENE_EXPRESSION)
	exp.term.gene = 'TP53'
	const q = { filter0: 'filter', __abortSignal: {} }
	const expressionDs = { queries: { singleCell: { geneExpression: { get: async (query, sample, gene) => {
		test.equal(query, q, 'forwards original expression query')
		test.equal(sample, exp.term.sample, 'forwards sample')
		test.equal(gene, 'TP53', 'forwards gene')
		return { c1: 0, c2: 1.5 }
	} } } } }
	test.deepEqual(await getSingleCellCellValues(q, exp, expressionDs), [
		{ cellId: 'c1', value: 0 }, { cellId: 'c2', value: 1.5 }
	], 'expression values include zero without requiring plot data')
	await rejects(test, () => getSingleCellCellValues({}, exp, {}), /singleCell.geneExpression/)
	await rejects(test, () => getSingleCellCellValues({}, tw, {}), /singleCell.data/)
	ds.queries.singleCell.data.get = async () => { throw new Error('plot read failed') }
	await rejects(test, () => getSingleCellCellValues({}, tw, ds), /plot read failed/)
	test.end()
})

tape('single cell annotation preserves existing rows and continuous values', async test => {
	const ds = plotDataset([{ cellId: 'c1', category: '0' }, { cellId: 'c2', category: '-2' }, { cellId: 'missing', category: '' }])
	const samples: any = { c1: { sample: 'c1', other: { value: 'existing' } } }
	const existing = samples.c1
	const refs = { other: { bins: [] } }
	await annotateSingleCellTerm({ ds, filter: { lst: [{}] } }, wrapper(), samples, refs)
	test.equal(samples.c1, existing, 'annotates existing row in place')
	test.deepEqual(samples.c1.term, { value: 0, key: 0 }, 'zero is a continuous value and key')
	test.deepEqual(samples.c2, { sample: 'c2', term: { value: -2, key: -2 } }, 'creates a cell row')
	test.equal(samples.c1.other.value, 'existing', 'retains previous term')
	test.notOk(samples.missing, 'does not create rows for missing numeric values')
	test.deepEqual(refs, { other: { bins: [] } }, 'continuous terms do not add bins')
	test.end()
})

for (const mode of ['discrete', 'binary']) {
	tape(`single cell numeric ${mode} bins include boundaries and leave request bins unchanged`, async test => {
		for (const type of [SINGLECELL_NUMERIC_VALUE, SINGLECELL_GENE_EXPRESSION]) {
			const tw = wrapper(type)
			tw.q = { mode, type: 'custom-bin', lst: [
				{ startunbounded: true, stop: 0, stopinclusive: false, label: 'negative', color: '#123456' },
				{ start: 0, startinclusive: true, stopunbounded: true, label: 'nonnegative' }
			] }
			const before = structuredClone(tw.q)
			const ds = plotDataset([{ cellId: 'a', category: '-1' }, { cellId: 'b', category: '0' }, { cellId: 'c', category: '2' }])
			ds.queries.singleCell.geneExpression = { get: async () => ({ a: -1, b: 0, c: 2 }) }
			const samples: any = {}, refs: any = {}
			await annotateSingleCellTerm({ ds }, tw, samples, refs)
			test.deepEqual([samples.a.term, samples.b.term, samples.c.term], [
				{ value: -1, key: 'negative' }, { value: 0, key: 'nonnegative' }, { value: 2, key: 'nonnegative' }
			], `${type}: bins change keys but preserve measurements`)
			test.ok(refs.term.bins[0].color, 'assigns a palette color to the first bin')
			test.ok(refs.term.bins[1].color, 'assigns missing bin color')
			test.deepEqual(tw.q, before, 'does not mutate custom bin configuration')
		}
		test.end()
	})
}

tape('single cell regular bins use term bounds and reject missing custom bins', async test => {
	const tw = wrapper()
	tw.term.bins = { min: -1, max: 3 }
	tw.q = { mode: 'discrete', type: 'regular-bin', bin_size: 2,
		startinclusive: true, stopinclusive: false, first_bin: { startunbounded: true, stop: 0 },
		last_bin: { start: 2, stopunbounded: true } }
	const ds = plotDataset([-1, 0, 1, 2, 3].map((v, i) => ({ cellId: String(i), category: String(v) })))
	const samples: any = {}, refs: any = {}
	await annotateSingleCellTerm({ ds }, tw, samples, refs)
	test.equal(refs.term.bins.length, 3, 'computes first, middle and last bins')
	test.equal(samples['0'].term.key, refs.term.bins[0].label, 'negative value in first bin')
	test.equal(samples['1'].term.key, refs.term.bins[1].label, 'zero starts middle bin')
	test.equal(samples['2'].term.key, refs.term.bins[1].label, 'one remains in middle bin')
	test.equal(samples['3'].term.key, refs.term.bins[2].label, 'two starts last bin')
	test.equal(samples['4'].term.value, 3, 'maximum retains measurement')
	test.ok(refs.term.bins.every(b => b.color), 'computed bins have colors')
	tw.q = { mode: 'discrete', type: 'custom-bin' }
	await rejects(test, () => annotateSingleCellTerm({ ds }, tw, {}, {}), /q.lst\[\] is missing/)
	test.end()
})

tape('single cell categorical groups combine selected values and preserve ungrouped values', async test => {
	const tw = wrapper(SINGLECELL_CELLTYPE)
	tw.q = { customset: { groups: [{ name: 'immune', values: [{ key: 'T' }, { key: 'B' }] }] } }
	const ds = plotDataset(['T', 'B', 'other'].map(category => ({ cellId: category, category })))
	const samples: any = {}, refs = {}
	await annotateSingleCellTerm({ ds }, tw, samples, refs)
	test.deepEqual(samples.T.term, { value: 'immune', key: 'immune' }, 'groups T cells')
	test.deepEqual(samples.B.term, samples.T.term, 'groups B cells into same category')
	test.deepEqual(samples.other.term, { value: 'other', key: 'other' }, 'retains unmatched category')
	test.deepEqual(refs, {}, 'categorical grouping does not create numeric bins')
	test.end()
})

function metaDataset(cells: any[]) {
	const ds = plotDataset(cells)
	ds.queries.singleCell.data.metaIdMap = new Map([['s1', new Map([['mapped', 'A'], ['excluded', 'B']])]])
	ds.queries.singleCell.samples = { sampleMappingCache: {
		sampleIntId2Name: new Map([[1, 'A'], [2, 'B']]),
		sampleName2IntId: new Map([['A', 1], ['B', 2]])
	} }
	return ds
}

tape('single cell meta mapping resolves names and numeric IDs and clones cohort annotations', async test => {
	const ds = metaDataset([
		{ cellId: 'mapped', sampleId: 2, category: '1' },
		{ cellId: 'integer', sampleId: 1, category: '2' },
		{ cellId: 'string', sampleId: '1', category: '3' },
		{ cellId: 'name', sampleId: 'A', category: '4' },
		{ cellId: 'unmapped', category: '5' }
	])
	const tw = wrapper(); tw.term.sample.isMetaResult = true
	const samples: any = { '1': { sample: '1', cohort: { value: ['original'] } } }
	await annotateSingleCellTerm({ ds }, tw, samples, {})
	for (const id of ['mapped', 'integer', 'string', 'name']) {
		test.equal(samples[id].sampleId, '1', `${id}: resolves to cohort sample 1`)
		test.equal(samples[id].sample, id, 'row keeps cell ID')
		test.deepEqual(samples[id].cohort, samples['1'].cohort, 'inherits cohort annotations')
	}
	samples.mapped.cohort.value.push('changed')
	test.deepEqual(samples['1'].cohort.value, ['original'], 'cell mutation does not change parent')
	test.deepEqual(samples.integer.cohort.value, ['original'], 'cell mutation does not change sibling')
	test.notOk(samples.unmapped, 'omits meta cells without a sample mapping')
	test.end()
})

tape('single cell meta filtering and database mapping fallback', async test => {
	for (const filter of [{ filter: { lst: [{}] } }, { filter0: 'cohort filter' }]) {
		const ds = metaDataset([{ cellId: 'mapped', category: '0' }, { cellId: 'excluded', category: '1' }])
		const tw = wrapper(); tw.term.sample.isMetaResult = true
		const q = { ds, ...filter }
		ds.queries.singleCell.samples.getFilteredSingleCellSamples = async query => {
			test.equal(query, q, 'forwards filter query')
			return new Set(['A'])
		}
		const samples: any = {}
		await annotateSingleCellTerm(q, tw, samples, {})
		test.deepEqual(Object.keys(samples), ['mapped'], 'omits cells belonging to excluded cohort samples')
	}
	const ds = metaDataset([{ cellId: 'mapped', category: '0' }])
	delete ds.queries.singleCell.samples.sampleMappingCache
	ds.cohort = { termdb: { q: { sampleName2id: name => name == 'A' ? 7 : undefined } } }
	const tw = wrapper(); tw.term.sample.isMetaResult = true
	const samples: any = {}
	await annotateSingleCellTerm({ ds }, tw, samples, {})
	test.equal(samples.mapped.sampleId, '7', 'uses database when cache is absent')
	ds.cohort.termdb.q.sampleName2id = () => undefined
	await rejects(test, () => annotateSingleCellTerm({ ds }, tw, {}, {}), /cannot map sample name = A/)
	test.end()
})

tape('hydrate meta rows fills late cohort annotations without overwriting cell data', test => {
	const samples: any = {
		'1': { sample: '1', cohort: { value: 'late' }, shared: { value: 'parent' } },
		cell: { sample: 'cell', sampleId: '1', shared: { value: 'cell' } },
		orphan: { sample: 'orphan', sampleId: 'missing' },
		ordinary: { sample: 'ordinary' }
	}
	hydrateMetaResultCellRows(samples)
	test.deepEqual(samples.cell, { sample: 'cell', sampleId: '1', cohort: { value: 'late' }, shared: { value: 'cell' } }, 'adds missing annotations and keeps cell identity and values')
	test.deepEqual(samples.orphan, { sample: 'orphan', sampleId: 'missing' }, 'ignores absent parent rows')
	test.deepEqual(samples.ordinary, { sample: 'ordinary' }, 'ignores non-meta rows')
	const before = structuredClone(samples)
	hydrateMetaResultCellRows(samples)
	test.deepEqual(samples, before, 'hydration is idempotent')
	test.end()
})

tape('single cell gene expression meta rows resolve through plot metadata', async test => {
	const ds = metaDataset([])
	ds.queries.singleCell.geneExpression = { get: async () => ({ mapped: 0, unknown: 1 }) }
	const tw = wrapper(SINGLECELL_GENE_EXPRESSION)
	tw.term.sample.isMetaResult = true
	const samples: any = {}
	await annotateSingleCellTerm({ ds }, tw, samples, {})
	test.deepEqual(samples, {
		mapped: { sample: 'mapped', sampleId: '1', term: { value: 0, key: 0 } }
	}, 'expression cells without sample IDs use metaIdMap and omit unmapped cells')
	test.end()
})

tape('single cell empty data leaves existing annotations unchanged', async test => {
	for (const type of [SINGLECELL_NUMERIC_VALUE, SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION]) {
		const ds = plotDataset([])
		ds.queries.singleCell.geneExpression = { get: async () => ({}) }
		const tw = wrapper(type)
		test.deepEqual(await getSingleCellCellValues({}, tw, ds), [], `${type}: empty values`)
		const samples = { existing: { sample: 'existing', other: { value: 1, key: 1 } } }
		const before = structuredClone(samples)
		await annotateSingleCellTerm({ ds }, tw, samples, {})
		test.deepEqual(samples, before, `${type}: no rows added or removed`)
	}
	test.end()
})
