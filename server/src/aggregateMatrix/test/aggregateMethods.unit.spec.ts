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
							enabledMethods: new Set(['mean', 'percent']),
							categories: {
								B: {
									meanFile: 'mean.h5',
									percentFile: 'percent.h5'
								}
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
		'Should expose only methods backed by this numeric dataset'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([
			{ type: 'pseudobulk', assay: 'geneExpression', memberId: 'cellType', id: 'B' }
		]).map(method => method.id),
		['mean', 'percent'],
		'Should expose file-backed methods for pseudobulk terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'geneExpression' }]).map(method => method.id),
		['mean', 'percent', 'count'],
		'Should expose calculated descriptive methods for standard numeric terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'categorical' }]).map(method => method.id),
		['percent', 'count'],
		'Should expose intersection methods for selected nonnumeric terms'
	)

	ds.cohort.termdb.termtypeByCohort.nested = { all: { categorical: 2 } }
	initAggregateMethods(ds)
	test.deepEqual(
		ds.getAvailableAggregateMethods().map(method => method.id),
		['mean', 'percent', 'count'],
		'Should expose dataset-wide methods when no term context is supplied'
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
	test.deepEqual(result.get('count'), { rowA: 1, rowB: 1 }, 'Should return the matching observation "count" for each row.')
	test.deepEqual(result.get('mean'), { rowA: 10, rowB: 20 }, 'Should calculate mean for non-numeric rows.')
	test.deepEqual(result.get('percent'), { rowA: (1 / 3) * 100, rowB: (1 / 3) * 100 }, 'Should calculate "percent" of the full cohort.')
	test.end()
})

tape('numeric methods ignore uncomputable column values', test => {
	const samples = {
		one: { row: { key: '<5', value: '<5' }, column: { key: 'exposed, dose unknown', value: -8888 } },
		two: { row: { key: '<5', value: '<5' }, column: { key: '5000 to <10000', value: 7000 } }
	}
	const columnTerm = {
		values: {
			'-8888': { label: 'exposed, dose unknown', uncomputable: true }
		}
	}
	const result = calculateSampleBasedMethods(['count', 'mean', 'percent'], samples, ['row'], 'column', columnTerm)

	test.equal(result.get('count')!.row, 2, 'Count should include uncomputable values.')
	test.equal(result.get('percent')!.row, (2 / 2) * 100, 'Percent should include uncomputable values.')
	test.equal(result.get('mean')!.row, 7000, 'Mean should ignore uncomputable values.')
	test.end()
})
