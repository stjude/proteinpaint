import tape from 'tape'
import { getPlotConfig, validatePlotConfig } from '../AggregateMatrix.ts'
import { getPieSizeDefaults } from '../settings/defaults.ts'

/*
Tests:
    - Accepted rows and columns
    - Rejected rows and columns 
    - Rejected methods
    - Pie charts do not need a gradient method
    - Pie charts default to larger dot sizes
    - Pie charts with many rows or columns default to smaller dot sizes
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
			'bare terms, as every term must be a term wrapper',
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

tape('Pie charts do not need a gradient method', function (test) {
	const pies = { rows: { Genes: [tw('geneVariant', 'TP53')] }, columns: { Sex: [tw('categorical', 'sex')] } }
	const withMethods = (aggregateMatrix: any, extra: any = pies) => config({ ...extra, settings: { aggregateMatrix } })
	test.equal(message(withMethods({ sizeMethod: 'count' })), undefined, 'Should accept pies without a gradient method')
	test.equal(
		message(withMethods({ gradientMethod: 'count', sizeMethod: 'count' })),
		undefined,
		'Should not compare the gradient method of pies with the size method'
	)
	test.ok(/dot size/.test(message(withMethods({}))!), 'Should still require a size method for pies')
	const mixed = { ...pies, columns: { Sex: [tw('categorical', 'sex')], Gene: [tw('geneVariant', 'KRAS')] } }
	test.ok(
		/color gradient/.test(message(withMethods({ sizeMethod: 'count' }, mixed))!),
		'Should require a gradient method when an axis has both gene variant and other terms'
	)
	test.end()
})

tape('Pie charts default to larger dot sizes', function (test) {
	const sizes = (cfg: any) => {
		const { minDotSize, maxDotSize, dotInputMin, dotInputMax } = getPlotConfig(cfg).settings.aggregateMatrix
		return { minDotSize, maxDotSize, dotInputMin, dotInputMax }
	}
	const pieSizes = { minDotSize: 30, maxDotSize: 60, dotInputMin: 5, dotInputMax: 300 }
	const dotSizes = { minDotSize: 5, maxDotSize: 20, dotInputMin: 2, dotInputMax: 35 }
	const gv = { Variants: [tw('geneVariant', 'TP53')] }
	const sex = { Sex: [tw('categorical', 'sex')] }

	test.deepEqual(sizes(config({ rows: gv, columns: sex })), pieSizes, 'Should use pie sizes with gene variant rows')
	test.deepEqual(sizes(config({ rows: sex, columns: gv })), pieSizes, 'Should use pie sizes with gene variant columns')
	test.deepEqual(
		sizes(config({ rows: sex, columns: sex })),
		dotSizes,
		'Should use dot sizes without a gene variant term'
	)
	test.deepEqual(
		sizes(config({ rows: gv, columns: { Other: [tw('geneVariant', 'KRAS')] } })),
		dotSizes,
		'Should use dot sizes when every term is a gene variant'
	)
	test.deepEqual(
		sizes(
			config({
				rows: gv,
				columns: sex,
				settings: { aggregateMatrix: { ...settings.aggregateMatrix, minDotSize: 50, maxDotSize: 120 } }
			})
		),
		{ ...pieSizes, minDotSize: 50, maxDotSize: 120 },
		'Should keep sizes set by the user'
	)
	test.end()
})

tape('Pie charts with many rows or columns default to smaller dot sizes', function (test) {
	// The room for the cells is 1000 wide and 650 high, and a cell is 2.5 times the largest dot
	const viewport = { width: 1400, height: 900 }
	const terms = (count: number) => ({ Terms: Array.from({ length: count }, () => tw('categorical')) })
	const sizes = (rows: number, columns: number, overrides = {}) => {
		const { minDotSize, maxDotSize } = getPieSizeDefaults(terms(rows), terms(columns), overrides, viewport)
		return { minDotSize, maxDotSize }
	}

	test.deepEqual(sizes(3, 2), { minDotSize: 30, maxDotSize: 60 }, 'Should keep the pie defaults when the cells fit')
	test.deepEqual(
		sizes(10, 2),
		{ minDotSize: 13, maxDotSize: 26 },
		'Should fit the rows in the height, and keep the ratio of the min size to the max size'
	)
	test.deepEqual(sizes(2, 20), { minDotSize: 10, maxDotSize: 20 }, 'Should fit many columns in the width')
	test.deepEqual(sizes(2, 8), { minDotSize: 25, maxDotSize: 50 }, 'Should fit fewer columns in the width')
	test.deepEqual(
		sizes(200, 200),
		{ minDotSize: 10, maxDotSize: 20 },
		'Should not go below the max size of a dot, or the ratio of the min size to it'
	)
	test.deepEqual(
		sizes(200, 200, { minDotSize: 10 }),
		{ minDotSize: 30, maxDotSize: 60 },
		'Should leave the defaults alone when the user sets a min size'
	)
	test.deepEqual(
		sizes(200, 200, { maxDotSize: 80 }),
		{ minDotSize: 30, maxDotSize: 60 },
		'Should leave the defaults alone when the user sets a max size'
	)
	test.end()
})
