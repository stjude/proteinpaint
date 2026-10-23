import tape from 'tape'
import { validTermdbAggregateMatrixRequest } from '../AggMatrixRoute.ts'

/* test sections
	- Should validate standard data requests
	- Should validate available method requests
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
