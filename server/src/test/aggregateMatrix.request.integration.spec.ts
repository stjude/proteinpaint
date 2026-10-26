/*
	Request-based tests for the termdb/aggregateMatrix route on the TermdbTest dataset.

	Covers every row x column term type combination that TermdbTest can serve, so that the supported
	combinations are documented by the test: dictionary (categorical, float), geneExpression, ssGSEA,
	and geneVariant. pseudobulk is not configured in TermdbTest, so only its rejection is tested here;
	its method availability is covered by server/src/aggregateMatrix/test/aggregateMethods.unit.spec.ts.

	Run from the server dir:
	npm run test:request
*/

import tape from 'tape'
import { startTestServer, type TestServer } from '../../test/testServer.ts'

const genome = 'hg38-test'
const dslabel = 'TermdbTest'

let server: TestServer

/** Term wrappers by kind. Each entry is a section's terms, as the client sends them. */
const sex = { term: { id: 'sex', name: 'Sex', type: 'categorical' }, q: {} }
const diaggrp = { term: { id: 'diaggrp', name: 'Diagnosis group', type: 'categorical' }, q: {} }
/** The server does not fill in dictionary terms from the database. Numeric dictionary terms are binned
 * with term.bins.default, so the client must send it, as it does with every filled term. */
const agedx = {
	term: {
		id: 'agedx',
		name: 'Age at diagnosis',
		type: 'float',
		bins: {
			default: { type: 'regular-bin', bin_size: 5, startinclusive: true, first_bin: { startunbounded: true, stop: 5 } }
		}
	},
	q: {}
}
const ge = (gene: string) => ({ term: { type: 'geneExpression', id: gene, gene, name: gene }, q: {} })
const ssgsea = (id: string) => ({ term: { type: 'ssGSEA', id, name: id }, q: {} })
const isoform = (isoform: string, name: string) => ({
	term: { type: 'isoformExpression', id: isoform, isoform, name },
	q: {}
})
const methylation = (name: string, chr: string, start: number, stop: number) => ({
	term: {
		type: 'dnaMethylation',
		id: `${chr}:${start}-${stop}`,
		name,
		chr,
		start,
		stop,
		genomicFeatureType: 'promoter'
	},
	q: {}
})
const gv = (gene: string) => ({
	term: {
		type: 'geneVariant',
		kind: 'gene',
		id: gene,
		gene,
		name: gene,
		genes: [{ type: 'geneVariant', kind: 'gene', id: gene, gene, name: gene }]
	},
	q: { type: 'values' }
})

type Kind = {
	label: string
	/** Sections, keyed by name */
	axis: Record<string, any[]>
	/** Number of entries the axis resolves to. Dictionary terms expand by observed values or bins, so are not fixed. */
	count?: number
	numeric: boolean
}

const kinds: Kind[] = [
	{ label: 'categorical', axis: { Sex: [sex] }, numeric: false },
	{ label: 'float', axis: { Age: [agedx] }, numeric: true },
	{ label: 'geneExpression', axis: { Genes: [ge('TP53'), ge('KRAS')] }, count: 2, numeric: true },
	{
		label: 'ssGSEA',
		axis: { Sets: [ssgsea('HALLMARK_ADIPOGENESIS'), ssgsea('HALLMARK_ALLOGRAFT_REJECTION')] },
		count: 2,
		numeric: true
	},
	{ label: 'geneVariant', axis: { Variants: [gv('KRAS'), gv('TP53')] }, count: 2, numeric: false },
	{
		label: 'isoformExpression',
		axis: { Isoforms: [isoform('ENST00000269305', 'TP53'), isoform('ENST00000311936', 'KRAS')] },
		count: 2,
		numeric: true
	},
	{
		label: 'dnaMethylation',
		axis: {
			// The TermdbTest methylation file only has probes on chr17, in the TP53 region
			Regions: [
				methylation('TP53 promoter', 'chr17', 7673484, 7681953),
				methylation('TP53 3 prime', 'chr17', 7682557, 7687424)
			]
		},
		count: 2,
		numeric: true
	}
]

/** Term types that are valid rows. Rows are never checked against the method, only the columns are. */
const rowKinds = kinds
/** Every column kind is tested against every row kind. */
const columnKinds = kinds

const expectedMethods = (kind: Kind) => (kind.numeric ? ['mean', 'percent', 'count'] : ['percent', 'count'])

tape('\n', test => {
	test.comment('-***- termdb/aggregateMatrix requests -***-')
	test.end()
})

tape('start server', async test => {
	test.timeoutAfter(90000)
	server = await startTestServer()
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('available methods follow the column term type', async test => {
	test.timeoutAfter(30000)
	for (const kind of columnKinds) {
		const res = await post({ getAvailableMethods: true, columns: kind.axis })
		test.notOk(res.error, `should not return an error for ${kind.label} columns`)
		test.deepEqual(
			res.availableMethods?.map(m => m.id),
			expectedMethods(kind),
			`should offer ${expectedMethods(kind).join(', ')} for ${kind.label} columns`
		)
	}
	test.end()
})

tape('available methods for columns of different term types in one axis', async test => {
	test.timeoutAfter(30000)
	// Numeric and non-numeric sections together can only offer methods that apply to both
	const res = await post({ getAvailableMethods: true, columns: { ...kinds[0].axis, ...kinds[2].axis } })
	test.notOk(res.error, 'should not return an error when sections have different term types')
	test.deepEqual(
		res.availableMethods?.map(m => m.id),
		['percent', 'count'],
		'should only offer methods that apply to every column term'
	)
	test.end()
})

tape('every row x column term type combination returns a matrix', async test => {
	test.timeoutAfter(240000)
	for (const row of rowKinds) {
		for (const column of columnKinds) {
			const [gradientMethod, sizeMethod] = column.numeric ? ['mean', 'percent'] : ['percent', 'count']
			const name = `rows=${row.label} columns=${column.label} (${gradientMethod}/${sizeMethod})`
			const res = await post({ rows: row.axis, columns: column.axis, gradientMethod, sizeMethod })
			if (res.error) {
				test.fail(`${name}: ${res.error}`)
				continue
			}
			const { rowCount } = res.axesLayout.rows
			const { colCount } = res.axesLayout.columns
			test.ok(res.data.length > 0, `${name}: should return rows`)
			test.equal(res.data.length, rowCount, `${name}: rows in data should match axesLayout.rows.rowCount`)
			test.ok(
				res.data.every(r => r.length == colCount),
				`${name}: every data row should have axesLayout.columns.colCount cells`
			)
			if (row.count) test.equal(rowCount, row.count, `${name}: should return one row per non-dictionary term`)
			if (column.count) test.equal(colCount, column.count, `${name}: should return one column per non-dictionary term`)
			const cell = res.data[0][0]
			for (const key of ['rowSection', 'row', 'colSection', 'column', 'colorValue', 'sizeValue']) {
				test.ok(key in cell, `${name}: cell should have .${key}`)
			}
			test.ok(
				res.sizeScale.min <= res.sizeScale.max && res.colorScale.min <= res.colorScale.max,
				`${name}: scales should be ordered`
			)
		}
	}
	test.end()
})

tape('geneVariant terms identified only by genes[]', async test => {
	test.timeoutAfter(30000)
	// The shape of the geneVariant terms in client/test/testdata/data.ts: no .id, .gene, or .name on the term
	const byGenes = (gene: any) => ({
		term: { type: 'geneVariant', genes: [{ ...gene, type: 'geneVariant' }] },
		q: { type: 'predefined-groupset', predefined_groupset_idx: 0, hiddenValues: {} }
	})
	const tp53 = byGenes({ kind: 'gene', gene: 'TP53' })
	const krasRegion = byGenes({ kind: 'coord', chr: 'chr12', start: 25205246, stop: 25250936, name: 'KRASregion' })
	const methods = { gradientMethod: 'percent', sizeMethod: 'count' }

	let res = await post({ rows: { Genes: [tp53, krasRegion] }, columns: kinds[0].axis, ...methods })
	test.notOk(res.error, 'should not return an error for rows that are only identified by genes[]')
	test.deepEqual(
		res.axesLayout?.rows.sections[0].terms,
		[
			{ id: 'TP53', label: 'TP53' },
			{ id: 'KRASregion', label: 'KRASregion' }
		],
		'should identify rows by their gene or region name'
	)
	test.deepEqual(
		res.data?.map(row => row[0].row),
		['TP53', 'KRASregion'],
		'should use the identifiers in the cells'
	)

	res = await post({ rows: kinds[0].axis, columns: { Genes: [tp53, krasRegion] }, ...methods })
	test.notOk(res.error, 'should not return an error for columns that are only identified by genes[]')
	test.deepEqual(
		res.axesLayout?.columns.sections[0].terms.map(term => term.id),
		['TP53', 'KRASregion'],
		'should identify columns by their gene or region name'
	)

	res = await post({
		rows: { Genes: [{ term: { type: 'geneVariant', genes: [{ kind: 'gene' }] }, q: {} }] },
		columns: kinds[0].axis,
		...methods
	})
	test.ok(
		/without an identifier/.test(String(res.error)),
		`should reject a geneVariant term that cannot be identified: ${res.error}`
	)
	test.end()
})

tape('geneVariant terms only match samples with a variant', async test => {
	test.timeoutAfter(30000)
	/* Not every sample with data for a gene has a variant: TermdbTest annotates wildtype (WT) and not tested (Blank)
	samples too, and those must not count. The expected counts do not come from this route. They were counted
	independently from the termdb/matrix response of sex and each gene variant term, keeping the samples that have
	a value with a class other than WT and Blank (a matrix value without a $ code). TP53 has 6 such samples, of
	which 3 for each sex key, and the KRAS region has 4, of which 3 for sex key 1 and 1 for sex key 2.
	The sex term has no values, so the columns are identified by the sex keys. */
	const byGenes = (gene: any) => ({ term: { type: 'geneVariant', genes: [{ ...gene, type: 'geneVariant' }] }, q: {} })
	const tp53 = byGenes({ kind: 'gene', gene: 'TP53' })
	const krasRegion = byGenes({ kind: 'coord', chr: 'chr12', start: 25205246, stop: 25250936, name: 'KRASregion' })

	const res = await post({
		rows: { Genes: [tp53, krasRegion] },
		columns: { Sex: [{ term: { id: 'sex', type: 'categorical' }, q: {} }] },
		gradientMethod: 'percent',
		sizeMethod: 'count'
	})
	test.notOk(res.error, 'should not return an error')
	const counts = Object.fromEntries(res.data.flat().map(cell => [`${cell.row}/${cell.column}`, cell.sizeValue]))
	test.deepEqual(
		counts,
		{ 'TP53/1': 3, 'TP53/2': 3, 'KRASregion/1': 3, 'KRASregion/2': 1 },
		'should count only the samples with a variant, by sex'
	)

	const percents = Object.fromEntries(res.data.flat().map(cell => [`${cell.row}/${cell.column}`, cell.colorValue]))
	test.ok(
		percents['TP53/1'] > percents['KRASregion/2'] && percents['KRASregion/2'] > 0,
		'should give percent values that follow the counts'
	)
	test.end()
})

tape('percent is bounded by the cohort', async test => {
	test.timeoutAfter(30000)
	const res = await post({
		rows: kinds[4].axis,
		columns: kinds[0].axis,
		gradientMethod: 'percent',
		sizeMethod: 'count'
	})
	test.notOk(res.error, 'should not return an error for geneVariant rows x categorical columns')
	const percents = res.data?.flat().map(cell => cell.colorValue) || []
	test.ok(percents.length > 0, 'should return cells')
	test.ok(
		percents.every(v => v === null || (v >= 0 && v <= 100)),
		'should return percent values between 0 and 100'
	)
	test.end()
})

tape('sections keep the order and grouping of the request', async test => {
	test.timeoutAfter(30000)
	const rows = { B: [gv('TP53')], A: [gv('KRAS')] }
	const res = await post({ rows, columns: kinds[0].axis, gradientMethod: 'percent', sizeMethod: 'count' })
	test.notOk(res.error, 'should not return an error')
	test.deepEqual(
		res.axesLayout?.rows.sections.map(s => s.id),
		['B', 'A'],
		'should return row sections in the requested order'
	)
	test.end()
})

tape('invalid requests are rejected', async test => {
	test.timeoutAfter(60000)
	const valid = { rows: kinds[4].axis, columns: kinds[0].axis, gradientMethod: 'percent', sizeMethod: 'count' }
	const cases: [string, any, RegExp][] = [
		['missing rows', { ...valid, rows: undefined }, /invalid \.rows/],
		['missing columns', { ...valid, columns: undefined }, /invalid \.columns/],
		['an empty section', { ...valid, rows: { A: [] } }, /invalid \.rows\[A\]/],
		['mixed term types in one section', { ...valid, columns: { A: [sex, ge('TP53')] } }, /must contain one term type/],
		[
			'several dictionary terms in one section',
			{ ...valid, columns: { A: [sex, diaggrp] } },
			/dictionary section 'A' must contain one term/
		],
		['identical gradient and size methods', { ...valid, sizeMethod: 'percent' }, /must be different/],
		['a missing size method', { ...valid, sizeMethod: undefined }, /invalid \.sizeMethod/],
		[
			'a method that does not apply to the column terms',
			{ ...valid, gradientMethod: 'mean' },
			/invalid \.gradientMethod/
		],
		['an unknown method', { ...valid, gradientMethod: 'median' }, /invalid \.gradientMethod/],
		[
			'pseudobulk columns when the dataset has no pseudobulk data',
			{
				...valid,
				rows: kinds[2].axis,
				columns: { Cells: [{ term: { type: 'pseudobulk', id: 'B', assay: 'geneExpression', memberId: 'Cell Type' } }] },
				gradientMethod: 'mean',
				sizeMethod: 'percent'
			},
			/invalid \.gradientMethod/
		],
		[
			'a bare term that is not wrapped in a term wrapper',
			{ ...valid, columns: { A: [{ id: 'sex', type: 'categorical' }] } },
			/must contain term wrappers/
		],
		[
			'a term type the matrix does not support',
			{ ...valid, rows: { A: [{ term: { id: 'x', name: 'x', type: 'survival' }, q: {} }] } },
			/unsupported term type 'survival'/
		],
		[
			'pseudobulk columns with dictionary rows',
			{
				...valid,
				columns: { Cells: [{ term: { type: 'pseudobulk', id: 'B', assay: 'geneExpression', memberId: 'Cell Type' } }] }
			},
			/require geneExpression rows/
		]
	]
	for (const [name, body, message] of cases) {
		const res = await post(body)
		test.ok(res.error, `should return an error for ${name}`)
		test.ok(message.test(String(res.error)), `should explain the error for ${name}: ${res.error}`)
	}
	test.end()
})

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

async function post(body: any, retries = 1): Promise<any> {
	try {
		const res = await fetch(`${server.url}/termdb/aggregateMatrix`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ genome, dslabel, ...body }),
			signal: AbortSignal.timeout(30000)
		})
		return await res.json()
	} catch (e: any) {
		// The server may close a kept-alive connection that the client then reuses. The route only reads data,
		// so a request that was reset before a response can be sent again.
		if (e.cause?.code == 'ECONNRESET' && retries > 0) return post(body, retries - 1)
		// A crashed server only shows up as a failed fetch, so include the end of its log
		throw new Error(`${e.message} (${e.cause?.code || e.cause?.message}). Server log: ${server.getLogs().slice(-3000)}`)
	}
}
