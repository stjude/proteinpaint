import tape from 'tape'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { mayValidatePseudobulk, validate_query_singleCell } from '../samplesRoute.ts'
import serverconfig from '#src/serverconfig.js'

/**
 * Tests
 *  - a ds supplying its own getters is validated without plot folders (the GDC shape)
 *  - sample2gene2expressionBins is seeded even for a ds-supplied geneExpression getter
 *  - missing plots[] is rejected for every ds, including one supplying every getter
 *  - missing plot.folder is rejected whenever a built-in file-based path will read it
 *  - missing geneExpression.folder is rejected when no geneExpression.get is supplied
 *  - the built-in file-based getters reject a sample id that would traverse out of tpmasterdir
 *  - pseudobulk whose h5 files cannot be read without a child process is removed, with only its terms
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
		new Map(),
		'should seed sample2gene2expressionBins as an empty Map for a ds-supplied getter, since getDefaultBins reads it'
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

tape('validate_query_singleCell: native sample list includes plot and spatial-only samples once', async test => {
	const oldTpMasterDir = serverconfig.tpmasterdir
	const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'pp-sc-samples-'))
	serverconfig.tpmasterdir = tmpdir

	try {
		await fs.mkdir(path.join(tmpdir, 'sc'))
		await fs.mkdir(path.join(tmpdir, 'spatial'))
		await fs.writeFile(path.join(tmpdir, 'sc', 'plot-only.tsv'), 'cell\tx\ty\n')
		await fs.writeFile(path.join(tmpdir, 'sc', 'plot-and-spatial.tsv'), 'cell\tx\ty\n')
		await fs.mkdir(path.join(tmpdir, 'spatial', 'plot-and-spatial'))
		await fs.mkdir(path.join(tmpdir, 'spatial', 'spatial-only'))

		const sample2id = new Map([
			['plot-only', 1],
			['plot-and-spatial', 2],
			['spatial-only', 3]
		])
		const ds = {
			queries: {
				w2: {
					folder: 'spatial'
				},
				singleCell: {
					samples: {},
					data: {
						get: async () => ({}),
						plots: [{ ...apiPlots[0], folder: 'sc', fileSuffix: '.tsv' }]
					}
				}
			},
			cohort: {
				termdb: {
					q: {
						sampleName2id: name => sample2id.get(name)
					}
				}
			}
		} as any

		await validate_query_singleCell(ds, {})
		const re = await ds.queries.singleCell.samples.get({})
		const sampleNames = re.samples.map(s => s.sample).sort()

		test.deepEqual(
			sampleNames,
			['plot-and-spatial', 'plot-only', 'spatial-only'],
			'should include plot-only, plot+spatial, and spatial-only samples'
		)
		test.equal(
			re.samples.filter(s => s.sample == 'plot-and-spatial').length,
			1,
			'should not duplicate a sample that has both plot data and spatial data'
		)
		test.deepEqual(
			[...ds.queries.singleCell.samples.sampleMappingCache.sampleIntIds].sort(),
			[1, 2, 3],
			'should register plot and spatial samples in the sample mapping cache'
		)
	} finally {
		serverconfig.tpmasterdir = oldTpMasterDir
		await fs.rm(tmpdir, { recursive: true, force: true })
	}

	test.end()
})

tape(
	'mayValidatePseudobulk: pseudobulk that cannot be read without a child process is removed, with only its terms',
	async test => {
		// the permission model of a server that cannot start a child process
		const noChildProcess: any = { has: (scope: string) => scope != 'child' }
		const colorTerm = { id: 'Cluster', type: 'singleCellCellType' }
		// adds a term before it reads an h5 file, as validatePseudobulk() does
		const addTermThen = (err?: any) => async (ds: any) => {
			const q = ds.queries.singleCell
			if (!q.terms) q.terms = []
			q.terms.push({ id: 'T cell', type: 'pseudobulk' })
			if (err) throw err
		}
		const denied = 'this server build does not support this data computation request'
		const { warn } = console
		console.warn = () => {}
		try {
			const ds = makeDs({ samples: {}, data: {}, terms: [colorTerm], pseudobulk: {} })
			await mayValidatePseudobulk(ds, noChildProcess, addTermThen(denied))
			const q = ds.queries.singleCell
			test.notOk(q.pseudobulk, 'should remove pseudobulk')
			test.deepEqual(q.terms, [colorTerm], 'should remove only the terms that pseudobulk added')
			test.ok(q.samples && q.data, 'should keep the other single-cell settings')

			const noTerms = makeDs({ samples: {}, data: {}, pseudobulk: {} })
			await mayValidatePseudobulk(noTerms, noChildProcess, addTermThen(denied))
			test.notOk('terms' in noTerms.queries.singleCell, 'should remove a terms[] that only pseudobulk created')

			const kept = makeDs({ samples: {}, data: {}, terms: [colorTerm], pseudobulk: {} })
			await mayValidatePseudobulk(kept, noChildProcess, addTermThen())
			test.ok(kept.queries.singleCell.pseudobulk, 'should keep pseudobulk whose validation succeeds')
			test.equal(kept.queries.singleCell.terms.length, 2, 'should keep the pseudobulk terms')

			for (const [label, permission, err] of [
				['an unrelated validation error', noChildProcess, new Error('member.folder must be a non-empty string')],
				['a denied tool when a child process is allowed', { has: () => true }, denied]
			] as any[]) {
				const other = makeDs({ samples: {}, data: {}, terms: [colorTerm], pseudobulk: {} })
				let message = ''
				try {
					await mayValidatePseudobulk(other, permission, addTermThen(err))
				} catch (e: any) {
					message = `${e?.message || e}`
				}
				test.equal(message, `${err?.message || err}`, `should fail the init for ${label}`)
				test.ok(other.queries.singleCell.pseudobulk, `should not remove pseudobulk for ${label}`)
			}
		} finally {
			console.warn = warn
		}
		test.end()
	}
)
