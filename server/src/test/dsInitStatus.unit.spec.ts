/********************************************
Unit tests for dataset init failure reporting (server/src/health.ts getDsInitStatus())

A dataset that fails to load is deleted from genomes[].datasets{} by mayRetryInit(), so /healthcheck
must report it from the tracked datasets instead -- otherwise a failed dataset is missing from the
response and is indistinguishable from a dataset that was never configured.

The tracked list is populated directly here: loading a real dataset requires the full tp/ data dir and
the R/htslib binaries that CI does not have, the same reason src/test/omnisearch.unit.spec.ts hardcodes
its inputs instead of calling initGenomesDs().

Run with (must use tsx + the sjpp/dev condition):
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/dsInitStatus.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { trackedDatasets } from '#src/initGenomesDs.js'
import { getDsInitStatus } from '#src/health.ts'

/**************
 helper functions
***************/

// replace the tracked datasets for the duration of one test, then restore, so that
// these tests do not leak state into other specs that share the same process
function withTrackedDs(entries: any[], callback: () => void) {
	const saved = trackedDatasets.splice(0, trackedDatasets.length)
	trackedDatasets.push(...entries)
	try {
		callback()
	} finally {
		trackedDatasets.splice(0, trackedDatasets.length)
		trackedDatasets.push(...saved)
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/health getDsInitStatus() -***-')
	test.end()
})

tape('dsSummary counts by init status', function (test) {
	withTrackedDs(
		[
			{ genomename: 'hg38', label: 'ds1', init: { status: 'done' } },
			{ genomename: 'hg38', label: 'ds2', init: { status: 'nonblocking' } },
			{ genomename: 'hg38', label: 'ds3', init: { status: 'recoverableError', currentRetry: 2 } },
			{ genomename: 'hg38', label: 'ds4', init: { status: 'fatalError', fatalError: 'no' } },
			{ genomename: 'hg19', label: 'ds5', init: { status: 'zeroRetries', error: 'no' } }
		],
		() => {
			const { dsSummary } = getDsInitStatus()
			test.deepEqual(
				dsSummary,
				{ total: 5, done: 1, nonblocking: 1, retrying: 1, failed: 2 },
				'should count done, nonblocking, retrying, and failed datasets'
			)
			test.equal(
				dsSummary.done + dsSummary.nonblocking + dsSummary.retrying + dsSummary.failed,
				dsSummary.total,
				'should account for every tracked dataset'
			)
		}
	)
	test.end()
})

tape('failed dataset is reported', function (test) {
	// a dataset whose js file threw while being imported or constructed: it never became a ds object,
	// so initGenomesDs() tracks a stub for it and it is absent from genomes[].datasets{}
	const stub = {
		genomename: 'hg38',
		label: 'BrokenDs',
		init: { retryMax: 0, retryDelay: 300000, status: 'fatalError', fatalError: 'did not load ./dataset/broken.js: x' }
	}
	withTrackedDs([{ genomename: 'hg38', label: 'GoodDs', init: { status: 'done' } }, stub], () => {
		const { dsSummary, dsInitStatus } = getDsInitStatus()
		test.equal(dsSummary.failed, 1, 'should report one failed dataset')
		const entry = dsInitStatus.find(d => d.label == 'BrokenDs')
		test.ok(entry, 'should include the failed dataset that is not in genomes[].datasets{}')
		test.equal(entry?.genome, 'hg38', 'should report the genome of the failed dataset')
		test.equal(entry?.init.status, 'fatalError', 'should report the failed init status')
		test.equal(entry?.init.fatalError, stub.init.fatalError, 'should report the init error message')
		test.notEqual(entry?.init, stub.init, 'should not expose the mutable ds.init object')
	})
	test.end()
})

tape('non-serializable ds.init does not break the response', function (test) {
	const init: any = { status: 'fatalError' }
	init.self = init // circular reference, would throw in JSON.stringify()
	withTrackedDs([{ genomename: 'hg38', label: 'CircularDs', init }], () => {
		let result
		test.doesNotThrow(() => {
			result = getDsInitStatus()
		}, 'should not throw on a ds.init that cannot be serialized')
		test.equal(result?.dsSummary.failed, 1, 'should still count the dataset as failed')
		test.equal(result?.dsInitStatus[0].init.status, 'fatalError', 'should still report the init status')
	})
	test.end()
})
