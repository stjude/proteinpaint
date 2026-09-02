import tape from 'tape'
import { initAggregateMethods } from '../aggregateMethods.ts'

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
		ds.getAvailableAggregateMethods([{ type: 'pseudobulk' }]).map(method => method.id),
		['mean', 'percent'],
		'exposes file-backed methods for pseudobulk terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'geneExpression' }]),
		[],
		'does not assign pseudobulk aggregation methods to gene-expression terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'categorical' }]),
		[],
		'does not expose numeric methods for nonnumeric terms'
	)

	ds.cohort.termdb.termtypeByCohort.nested = { all: { categorical: 2 } }
	initAggregateMethods(ds)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'categorical' }]).map(method => method.id),
		['count', 'total'],
		'exposes count-based methods only for nonnumeric terms'
	)
	test.end()
})
