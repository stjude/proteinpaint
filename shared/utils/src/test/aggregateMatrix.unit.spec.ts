import tape from 'tape'
import {
	AGG_MATRIX_COLUMN_TYPES,
	AGG_MATRIX_ROW_TYPES,
	validateAggMatrixAxes,
	validateAggMatrixAxis
} from '../aggregateMatrix.js'

/* test sections
   - accepted term types
   - validateAggMatrixAxis(): accepted sections
   - validateAggMatrixAxis(): rejected axes and sections
   - validateAggMatrixAxes(): combinations of rows and columns
*/

const tw = (type: string, id = type) => ({ term: { id, name: id, type } })
const geneTw = (gene: string) => ({ term: { id: gene, gene, name: gene, type: 'geneExpression' } })
const pseudobulkTw = (id: string) => ({
	term: { id, name: id, type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' }
})

function message(fn: () => void) {
	try {
		fn()
	} catch (e: any) {
		return e.message
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- shared/aggregateMatrix -***-')
	test.end()
})

tape('accepted term types', test => {
	for (const type of ['categorical', 'integer', 'float', 'geneExpression', 'ssGSEA', 'geneVariant']) {
		test.ok(AGG_MATRIX_ROW_TYPES.includes(type), `${type} should be an accepted row type`)
		test.ok(AGG_MATRIX_COLUMN_TYPES.includes(type), `${type} should be an accepted column type`)
	}
	test.notOk(AGG_MATRIX_ROW_TYPES.includes('pseudobulk'), 'pseudobulk should not be an accepted row type')
	test.ok(AGG_MATRIX_COLUMN_TYPES.includes('pseudobulk'), 'pseudobulk should be an accepted column type')
	test.end()
})

tape('validateAggMatrixAxis(): accepted sections', test => {
	for (const name of ['rows', 'columns'] as const) {
		test.equal(
			message(() => validateAggMatrixAxis({ A: [tw('categorical')] }, name)),
			undefined,
			`${name}: one dictionary term`
		)
		test.equal(
			message(() => validateAggMatrixAxis({ A: [tw('float')] }, name)),
			undefined,
			`${name}: one numeric dictionary term`
		)
		test.equal(
			message(() => validateAggMatrixAxis({ A: [geneTw('TP53'), geneTw('KRAS')] }, name)),
			undefined,
			`${name}: many geneExpression terms in one section`
		)
		test.equal(
			message(() =>
				validateAggMatrixAxis(
					{ A: [tw('geneVariant', 'KRAS'), tw('geneVariant', 'TP53')], B: [tw('geneVariant', 'NRAS')] },
					name
				)
			),
			undefined,
			`${name}: many geneVariant terms across sections`
		)
		test.equal(
			message(() => validateAggMatrixAxis({ A: [tw('categorical')], B: [tw('ssGSEA')] }, name)),
			undefined,
			`${name}: sections of different term types`
		)
	}
	test.equal(
		message(() => validateAggMatrixAxis({ A: [pseudobulkTw('B'), pseudobulkTw('CD4')] }, 'columns')),
		undefined,
		'columns: many pseudobulk terms in one section'
	)
	test.equal(
		message(() => validateAggMatrixAxis({}, 'columns', true)),
		undefined,
		'should allow an empty axis on request'
	)
	test.end()
})

tape('validateAggMatrixAxis(): rejected axes and sections', test => {
	const cases: [string, any, 'rows' | 'columns', RegExp][] = [
		['a missing axis', undefined, 'rows', /invalid \.rows$/],
		['an array instead of sections', [tw('categorical')], 'rows', /invalid \.rows$/],
		['an empty axis', {}, 'columns', /invalid \.columns: no sections/],
		['a blank section name', { ' ': [tw('categorical')] }, 'rows', /every \.rows section requires a name/],
		['an empty section', { A: [] }, 'rows', /invalid \.rows\[A\]/],
		['a section that is not a list', { A: tw('categorical') }, 'rows', /invalid \.rows\[A\]/],
		[
			'a bare term, not a term wrapper',
			{ A: [{ id: 'TP53', gene: 'TP53', type: 'geneExpression' }] },
			'rows',
			/must contain term wrappers/
		],
		['a term wrapper without a type', { A: [{ term: { id: 'x' } }] }, 'rows', /must contain one term type/],
		[
			'mixed term types in one section',
			{ A: [tw('categorical'), tw('geneExpression')] },
			'columns',
			/must contain one term type/
		],
		[
			'several dictionary terms in one section',
			{ A: [tw('categorical', 'sex'), tw('categorical', 'diaggrp')] },
			'columns',
			/dictionary section 'A' must contain one term/
		],
		['an unsupported dictionary type', { A: [tw('survival')] }, 'rows', /unsupported term type 'survival'/],
		['an unsupported non-dictionary type', { A: [tw('snp')] }, 'columns', /unsupported term type 'snp'/],
		['pseudobulk rows', { A: [pseudobulkTw('B')] }, 'rows', /unsupported term type 'pseudobulk'/]
	]
	for (const [name, axis, axisName, expected] of cases) {
		const error = message(() => validateAggMatrixAxis(axis, axisName))
		test.ok(error && expected.test(error), `should reject ${name}: ${error}`)
	}
	test.end()
})

tape('validateAggMatrixAxes(): combinations of rows and columns', test => {
	const types = ['categorical', 'float', 'geneExpression', 'ssGSEA', 'geneVariant']
	for (const rowType of types) {
		for (const columnType of types) {
			test.equal(
				message(() => validateAggMatrixAxes({ R: [tw(rowType)] }, { C: [tw(columnType)] })),
				undefined,
				`should accept ${rowType} rows x ${columnType} columns`
			)
		}
	}

	test.equal(
		message(() =>
			validateAggMatrixAxes(
				{ R: [geneTw('TP53'), geneTw('KRAS')] },
				{ C: [pseudobulkTw('B')], D: [pseudobulkTw('CD4')] }
			)
		),
		undefined,
		'should accept geneExpression rows x pseudobulk columns'
	)

	let error = message(() =>
		validateAggMatrixAxes({ R: [geneTw('TP53')] }, { C: [pseudobulkTw('B')], D: [tw('categorical')] })
	)
	test.ok(/cannot be combined/.test(error), `should reject pseudobulk columns with other columns: ${error}`)

	error = message(() => validateAggMatrixAxes({ R: [tw('categorical')] }, { C: [pseudobulkTw('B')] }))
	test.ok(/require geneExpression rows/.test(error), `should reject pseudobulk columns with dictionary rows: ${error}`)

	error = message(() => validateAggMatrixAxes({ R: [tw('geneVariant', 'KRAS')] }, { C: [pseudobulkTw('B')] }))
	test.ok(/require geneExpression rows/.test(error), `should reject pseudobulk columns with geneVariant rows: ${error}`)

	error = message(() => validateAggMatrixAxes(undefined, { C: [tw('categorical')] }))
	test.ok(/invalid \.rows/.test(error), `should reject missing rows: ${error}`)
	test.end()
})
