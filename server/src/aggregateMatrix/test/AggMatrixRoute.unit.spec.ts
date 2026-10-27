import tape from 'tape'
import { validTermdbAggregateMatrixRequest } from '../AggMatrixRoute.ts'

/* test sections
	- Should validate standard data requests
	- Should validate available method requests
	- Should validate cell type terms
*/

const tw = (type: string, id = type) => ({ term: { id, name: id, type }, q: {} })
const base = {
	genome: 'hg38-test',
	dslabel: 'TermdbTest',
	rows: { Genes: [tw('geneVariant', 'KRAS'), tw('geneVariant', 'TP53')] },
	columns: { Sex: [tw('categorical', 'sex')] },
	gradientMethod: 'percent',
	sizeMethod: 'count'
}

function message(input: any) {
	try {
		validTermdbAggregateMatrixRequest(input)
	} catch (e: any) {
		return e.message || String(e)
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- src/aggregateMatrix/AggMatrixRoute request validation -***-')
	test.end()
})

tape('Should validate standard data requests', test => {
	test.equal(message(base), undefined, 'should accept geneVariant rows x categorical columns')
	const request = validTermdbAggregateMatrixRequest({ ...base, extra: 'ignored' }) as any
	test.deepEqual(
		Object.keys(request).sort(),
		['columns', 'dslabel', 'filter', 'filter0', 'genome', 'gradientMethod', 'rows', 'sizeMethod'],
		'should return only the validated request keys'
	)

	test.ok(/invalid \.rows/.test(message({ ...base, rows: undefined })!), 'should reject missing rows')
	test.ok(/invalid \.columns/.test(message({ ...base, columns: undefined })!), 'should reject missing columns')
	test.ok(
		/must contain term wrappers/.test(message({ ...base, columns: { A: [{ id: 'sex', type: 'categorical' }] } })!),
		'should reject bare terms'
	)
	test.ok(
		/unsupported term type/.test(message({ ...base, rows: { A: [tw('survival')] } })!),
		'should reject unsupported term types'
	)
	test.ok(
		/must be different/.test(message({ ...base, gradientMethod: 'percent', sizeMethod: 'percent' })!),
		'should reject identical methods'
	)
	test.ok(
		/invalid \.gradientMethod/.test(message({ ...base, gradientMethod: '' })!),
		'should reject a missing gradient method'
	)
	test.ok(
		/invalid \.sizeMethod/.test(message({ ...base, sizeMethod: undefined })!),
		'should reject a missing size method'
	)
	test.ok(/genome/.test(message({ ...base, genome: undefined })!), 'should reject a missing genome')
	test.end()
})

tape('Should validate available method requests', test => {
	const { ...methodsRequest } = base
	const request = { ...methodsRequest, getAvailableMethods: true }
	test.equal(message(request), undefined, 'should accept columns without rows or methods')
	test.deepEqual(
		validTermdbAggregateMatrixRequest({ ...request, columns: {} }),
		{ genome: base.genome, dslabel: base.dslabel, getAvailableMethods: true, columns: {} },
		'should accept an empty columns axis, to ask for dataset-wide methods'
	)
	test.ok(/invalid \.columns/.test(message({ ...request, columns: undefined })!), 'should reject missing columns')
	test.ok(
		/unsupported term type/.test(message({ ...request, columns: { A: [tw('survival')] } })!),
		'should reject unsupported column term types'
	)
	test.end()
})

tape('Should validate cell type terms', test => {
	const cellType = tw('singleCellCellType', 'CellType')
	const cellTypes = { 'Cell type': [cellType] }
	test.equal(
		message({ ...base, rows: cellTypes, columns: { 'Other cell type': [tw('singleCellCellType', 'Other')] } }),
		undefined,
		'should accept cell type terms on both axes, as they are all cells'
	)
	for (const [name, input] of [
		['gene variant rows and cell type columns', { ...base, columns: cellTypes }],
		['cell type rows and categorical columns', { ...base, rows: cellTypes }],
		[
			'cell type rows and gene expression columns',
			{ ...base, rows: cellTypes, columns: { G: [tw('geneExpression', 'TP53')] } }
		],
		[
			'cell type and gene variant sections in one axis',
			{ ...base, rows: { ...cellTypes, ...base.rows }, columns: { Cells: [tw('singleCellCellType', 'Other')] } }
		],
		[
			'cell type rows and pseudobulk columns',
			{ ...base, rows: cellTypes, columns: { P: [{ term: { type: 'pseudobulk', id: 'B' }, q: {} }] } }
		]
	] as const) {
		const error = message(input)!
		test.ok(
			/singleCellCellType terms are cells and cannot be combined with sample-level terms/.test(error),
			`should reject ${name}: ${error}`
		)
	}
	test.ok(
		/geneVariant/.test(message({ ...base, columns: cellTypes })!),
		'should name the sample-level term types in the error'
	)
	test.ok(
		/cell type section 'A' must contain one term/.test(
			message({ ...base, rows: cellTypes, columns: { A: [cellType, tw('singleCellCellType', 'Other')] } })!
		),
		'should allow one cell type term per section'
	)
	test.ok(
		/without an identifier/.test(
			message({ ...base, rows: cellTypes, columns: { A: [{ term: { type: 'singleCellCellType' }, q: {} }] } })!
		),
		'should require an identifier'
	)
	test.ok(
		/must contain one term type/.test(
			message({ ...base, rows: cellTypes, columns: { A: [cellType, tw('categorical', 'sex')] } })!
		),
		'should not mix cell type terms with other term types in a section'
	)
	test.end()
})
