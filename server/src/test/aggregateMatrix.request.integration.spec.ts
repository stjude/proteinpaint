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
	{ label: 'geneVariant', axis: { Variants: [gv('KRAS'), gv('TP53')] }, count: 2, numeric: false }
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

async function post(body: any) {
	const res = await fetch(`${server.url}/termdb/aggregateMatrix`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ genome, dslabel, ...body }),
		signal: AbortSignal.timeout(30000)
	})
	return await res.json()
}
