import tape from 'tape'
import { calculateSampleBasedMethods, initAggregateMethods } from '../aggregateMethods.ts'

function getDs() {
	return {
		cohort: {
			termdb: {
				allowedTermTypes: [],
				termtypeByCohort: { nested: {} }
			}
		},
		queries: {
			singleCell: {
				pseudobulk: {
					geneExpression: {
						cellType: {
							categories: {
								B: { meanFile: 'mean.h5', percentFile: 'percent.h5' }
							}
						}
					}
				}
			}
		}
	}
}

tape('aggregate method availability follows dataset data and term kind', test => {
	const ds: any = getDs()
	initAggregateMethods(ds)

	test.deepEqual(
		ds.getAvailableAggregateMethods().map(method => method.id),
		['mean', 'percent'],
		'exposes only methods backed by this numeric dataset'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([
			{ type: 'pseudobulk', assay: 'geneExpression', memberId: 'cellType', id: 'B' }
		]).map(method => method.id),
		['mean', 'percent'],
		'exposes file-backed methods for pseudobulk terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'geneExpression' }]).map(method => method.id),
		['mean', 'percent', 'count'],
		'exposes calculated descriptive methods for standard numeric terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'categorical' }]).map(method => method.id),
		['percent', 'count'],
		'exposes intersection methods for selected nonnumeric terms'
	)

	ds.cohort.termdb.termtypeByCohort.nested = { all: { categorical: 2 } }
	initAggregateMethods(ds)
	test.deepEqual(
		ds.getAvailableAggregateMethods().map(method => method.id),
		['mean', 'percent', 'count'],
		'exposes dataset-wide methods when no term context is supplied'
	)
	test.end()
})

tape('sample-based aggregate methods share one set of counts', test => {
	const samples = {
		one: { sample: 'one', rowA: { key: 'x', value: 'x' }, column: { key: 10, value: 10 } },
		two: { sample: 'two', rowB: { key: 'y', value: 'y' }, column: { key: 20, value: 20 } },
		three: { sample: 'three', rowA: { key: 'x', value: 'x' } }
	}
	const result = calculateSampleBasedMethods(['count', 'mean', 'percent'], samples, ['rowA', 'rowB'], 'column')
	test.deepEqual(result.get('count'), { rowA: 1, rowB: 1 }, 'returns the matching observation count for each row')
	test.deepEqual(result.get('mean'), { rowA: 10, rowB: 20 }, 'uses exact numeric values for means')
	test.deepEqual(result.get('percent'), { rowA: 50, rowB: 50 }, 'calculates percent of the column cohort')
	test.end()
})
