import tape from 'tape'
import { validate_query_singleCell } from '../samplesRoute.ts'

/**
 * Tests
 *  - a ds supplying its own getters is validated without plot folders (the GDC shape)
 *  - sample2gene2expressionBins is seeded even for a ds-supplied geneExpression getter
 *  - missing plots[] is rejected for every ds, including one supplying every getter
 *  - missing plot.folder is rejected whenever a built-in file-based path will read it
 *  - missing geneExpression.folder is rejected when no geneExpression.get is supplied
 */

/** plots[] as GDC declares them: color/coords columns, but no folder, since data comes from an API */
const apiPlots = [{ name: 'UMAP', colorColumns: [{ name: 'Cluster' }], coordsColumns: { x: 4, y: 5 } }]

function makeDs(singleCell) {
	return { queries: { singleCell } } as any
}

async function rejects(test, ds, expected, msg) {
	try {
		await validate_query_singleCell(ds, {})
		test.fail(msg + ' (did not throw)')
	} catch (e: any) {
		test.equal(e.message || e, expected, msg)
	}
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #singleCell/samplesRoute -***-')
	test.end()
})

tape('validate_query_singleCell: ds-supplied getters need no folders', async test => {
	const ds = makeDs({
		samples: { get: async () => ({ samples: [] }) },
		data: { get: async () => ({}), plots: apiPlots },
		geneExpression: { get: async () => ({}) },
		DEgenes: { termId: 'Cluster', get: async () => [] }
	})

	await validate_query_singleCell(ds, {})

	test.pass('validated a ds whose plots have no folder')
	test.deepEqual(
		ds.queries.singleCell.geneExpression.sample2gene2expressionBins,
		{},
		'should seed sample2gene2expressionBins for a ds-supplied getter, since getDefaultBins reads it'
	)
	test.ok(Array.isArray(ds.queries.singleCell.terms), 'should build colorColumn terms')
	test.end()
})

tape('validate_query_singleCell: rejects an incomplete ds that supplies no getter', async test => {
	await rejects(
		test,
		makeDs({ samples: { get: async () => ({}) }, data: {} }),
		'singleCell.data.plots[] missing',
		'should reject missing plots[]'
	)

	// plots[] is required even when the ds supplies every getter, because colorColumn2terms() reads it
	await rejects(
		test,
		makeDs({ samples: { get: async () => ({}) }, data: { get: async () => ({}) } }),
		'singleCell.data.plots[] missing',
		'should reject missing plots[] even with a ds-supplied data.get'
	)

	await rejects(
		test,
		makeDs({ samples: { get: async () => ({}) }, data: { plots: apiPlots } }),
		'plot.folder missing',
		'should reject a plot without a folder when data.get is missing'
	)

	// validateSamples() reads plot.folder too, so a ds-supplied data.get does not excuse it when
	// samples.get is absent
	await rejects(
		test,
		makeDs({ samples: {}, data: { get: async () => ({}), plots: apiPlots } }),
		'plot.folder missing',
		'should reject a plot without a folder when samples.get is missing, even with data.get'
	)

	await rejects(
		test,
		makeDs({
			samples: { get: async () => ({}) },
			data: { get: async () => ({}), plots: apiPlots },
			geneExpression: {}
		}),
		'singleCell.geneExpression.folder missing',
		'should reject geneExpression without a folder'
	)

	test.end()
})
