import tape from 'tape'
import { validate_query_singleCell } from '../samplesRoute.ts'

/**
 * Tests
 *  - a ds supplying its own getters is validated without plot folders (the GDC shape)
 *  - sample2gene2expressionBins is seeded even for a ds-supplied geneExpression getter
 *  - missing plots[] is rejected for every ds, including one supplying every getter
 *  - missing plot.folder is rejected whenever a built-in file-based path will read it
 *  - missing geneExpression.folder is rejected when no geneExpression.get is supplied
 *  - the built-in file-based getters reject a sample id that would traverse out of tpmasterdir
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

tape('built-in getters screen the sample id for path traversal', async test => {
	// no data.get / geneExpression.get, so the built-in file-based getters are installed
	const ds = makeDs({
		samples: { get: async () => ({}) },
		data: { plots: [{ ...apiPlots[0], folder: 'files/sc' }] },
		geneExpression: { folder: 'files/sc/geneExp' }
	})
	await validate_query_singleCell(ds, {})
	const { data, geneExpression } = ds.queries.singleCell

	// checkPlotAvailability is the worst case: it reports back which files are readable, so an
	// unscreened id is a file-existence oracle for any path outside tpmasterdir
	const escaping = { sID: '../../../../etc/passwd' }
	for (const [label, fn] of [
		['data.get', () => data.get({ sample: escaping, plots: ['UMAP'], checkPlotAvailability: true })],
		['geneExpression.get', () => geneExpression.get({}, escaping, 'TP53')]
	] as [string, () => Promise<any>][]) {
		try {
			await fn()
			test.fail(`${label} did not reject a traversing sample id`)
		} catch (e: any) {
			test.equal(e.message || e, 'invalid sample id', `${label} should reject a traversing sample id`)
		}
	}

	// a native sample name (derived from a file name in plot.folder) must still pass the screen;
	// its missing data file is reported as an unavailable plot, not as an invalid id
	const re = await data.get({ sample: { sID: 'SJALL040053_D1' }, plots: ['UMAP'], checkPlotAvailability: true })
	test.deepEqual(re, { plots: [] }, 'should accept a legitimate sample name')

	test.end()
})
