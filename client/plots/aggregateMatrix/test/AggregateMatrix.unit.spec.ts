import tape from 'tape'
import { getPlotConfig, validatePlotConfig, wrapBareTerms } from '../AggregateMatrix.ts'

/*
Tests:
    - Accepted rows and columns
    - Rejected rows and columns 
    - Rejected methods
    - Bare terms are wrapped before validation
*/

const tw = (type: string, id = type) => ({ term: { id, name: id, type } })
const settings = { aggregateMatrix: { gradientMethod: 'mean', sizeMethod: 'percent' } }
const config = (overrides: any = {}) => ({
	rows: { Genes: [tw('geneExpression', 'TP53'), tw('geneExpression', 'KRAS')] },
	columns: { 'Cell type': [tw('pseudobulk', 'B'), tw('pseudobulk', 'CD4')] },
	settings,
	...overrides
})

function message(cfg: any) {
	try {
		validatePlotConfig(cfg)
	} catch (e: any) {
		return e.message
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/aggregateMatrix/AggregateMatrix validatePlotConfig -***-')
	test.end()
})

tape('Accepted rows and columns', function (test) {
	test.equal(message(config()), undefined, 'Should accept geneExpression rows and pseudobulk columns')
	for (const type of [
		'categorical',
		'float',
		'geneExpression',
		'isoformExpression',
		'ssGSEA',
		'dnaMethylation',
		'geneVariant'
	]) {
		test.equal(
			message(config({ rows: { A: [tw('geneVariant', 'KRAS')] }, columns: { B: [tw(type)] } })),
			undefined,
			`Should accept geneVariant rows and ${type} columns`
		)
	}
	test.end()
})

tape('Rejected rows and columns', function (test) {
	const cases: [string, any, RegExp][] = [
		['no config', null, /Invalid config/],
		['missing rows', config({ rows: undefined }), /invalid \.rows/],
		['missing columns', config({ columns: undefined }), /invalid \.columns/],
		['empty rows', config({ rows: {} }), /invalid \.rows: no sections/],
		['an empty section', config({ columns: { A: [] } }), /invalid \.columns\[A\]/],
		[
			'bare terms, which getPlotConfig wraps before validating',
			config({ rows: { Genes: [{ name: 'TP53', gene: 'TP53', type: 'geneExpression' }] } }),
			/must contain term wrappers/
		],
		[
			'several dictionary terms in a section',
			config({ rows: { A: [tw('categorical', 'sex'), tw('categorical', 'diaggrp')] }, columns: { B: [tw('ssGSEA')] } }),
			/dictionary section 'A' must contain one term/
		],
		[
			'mixed term types in a section',
			config({ columns: { B: [tw('geneExpression'), tw('ssGSEA')] } }),
			/must contain one term type/
		],
		['an unsupported term type', config({ columns: { B: [tw('survival')] } }), /unsupported term type 'survival'/],
		[
			'pseudobulk with other columns',
			config({ columns: { A: [tw('pseudobulk', 'B')], B: [tw('categorical', 'sex')] } }),
			/cannot be combined/
		],
		[
			'pseudobulk columns without geneExpression rows',
			config({ rows: { A: [tw('categorical', 'sex')] } }),
			/require geneExpression rows/
		]
	]
	for (const [name, cfg, expected] of cases) {
		const error = message(cfg)
		test.ok(error && expected.test(error), `Should reject ${name}: ${error}`)
	}
	test.end()
})

tape('Rejected methods', function (test) {
	const withMethods = (aggregateMatrix: any) => config({ settings: { aggregateMatrix } })
	test.ok(/dot size/.test(message(withMethods({ gradientMethod: 'mean' }))!), 'Should require a size method')
	test.ok(/color gradient/.test(message(withMethods({ sizeMethod: 'percent' }))!), 'Should require a gradient method')
	test.ok(
		/cannot be the same/.test(message(withMethods({ gradientMethod: 'mean', sizeMethod: 'mean' }))!),
		'Should reject identical methods'
	)
	test.end()
})

tape('Bare terms are wrapped before validation', function (test) {
	const bareRows = {
		Genes: [{ name: 'TP53', gene: 'TP53', type: 'geneExpression' }, tw('geneExpression', 'KRAS').term]
	}
	const bareColumns = {
		'Cell type': [{ name: 'B', id: 'B', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' }]
	}

	const wrapped: any = { rows: structuredClone(bareRows), columns: structuredClone(bareColumns) }
	wrapBareTerms(wrapped)
	test.deepEqual(wrapped.rows.Genes[0], { term: bareRows.Genes[0] }, 'Should wrap a bare row term')
	test.deepEqual(
		wrapped.columns['Cell type'][0],
		{ term: bareColumns['Cell type'][0] },
		'Should wrap a bare column term'
	)

	const wrappers = config()
	const before = structuredClone(wrappers)
	wrapBareTerms(wrappers)
	test.deepEqual(wrappers, before, 'Should not change term wrappers')

	const invalid: any = { rows: [{ type: 'geneExpression' }], columns: { A: 'x' } }
	test.doesNotThrow(() => wrapBareTerms(invalid), 'Should leave invalid axes for validatePlotConfig to reject')
	test.deepEqual(invalid, { rows: [{ type: 'geneExpression' }], columns: { A: 'x' } }, 'Should not change invalid axes')

	const plotConfig: any = getPlotConfig({ rows: bareRows, columns: bareColumns, settings })
	test.deepEqual(
		plotConfig.rows.Genes.map(item => item.term.gene || item.term.id),
		['TP53', 'KRAS'],
		'Should accept bare terms in getPlotConfig and wrap every one'
	)
	test.equal(plotConfig.columns['Cell type'][0].term.id, 'B', 'Should wrap bare column terms in getPlotConfig')
	test.end()
})
