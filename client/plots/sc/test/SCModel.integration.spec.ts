import tape from 'tape'
import { getMockSCApp } from './getMockSCApp.ts'
import { SCModel } from '../model/SCModel.ts'

/**
 * Tests (live termdb/wsiBySample requests against the TermdbTest fixture —
 * needs the dev/test server, so integration rather than unit)
 *   - hasSpatialImage() should probe wsiBySample and cache per sample
 *   - hasSpatialImage() should return false on a failed probe
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/model/SCModel integration -***-')
	test.end()
})

// the probe is gated on the ds advertising wsi support (ds.queries.w2 →
// supportedChartTypes), so the mock config must declare it to reach the fetch
const wsiSupport = { termdbConfig: { supportedChartTypes: { ABC: ['wsi'] } } }

tape('hasSpatialImage() should probe wsiBySample and cache per sample', async test => {
	test.timeoutAfter(10000) // live termdb/wsiBySample probes against the TermdbTest fixture
	const app = getMockSCApp(wsiSupport)
	const model = new SCModel(app)

	// TCGA-22-1017 has a spatial image + spatial.h5ad on disk; 2646 has neither
	test.equal(await model.hasSpatialImage('TCGA-22-1017'), true, 'Should be true for the sample with spatial data')
	test.equal(model.sampleHasSpatial['TCGA-22-1017'], true, 'Should cache the successful probe')
	test.equal(await model.hasSpatialImage('2646'), false, 'Should be false for a sample without spatial data')
	test.end()
})

tape('hasSpatialImage() should return false on a failed probe', async test => {
	test.timeoutAfter(10000)
	const app = getMockSCApp({ vocab: { genome: 'hg38-test', dslabel: 'NotADataset' }, ...wsiSupport })
	const model = new SCModel(app)

	test.equal(await model.hasSpatialImage('TCGA-22-1017'), false, 'Should be false when the request fails')
	// dofetch3 resolves the error payload; it must not be cached as "no
	// spatial image" — a later render may retry
	test.notOk('TCGA-22-1017' in model.sampleHasSpatial, 'Should not cache the failed probe')
	test.end()
})
