import tape from 'tape'
import { getMockSCApp } from './getMockSCApp.ts'
import { SCModel } from '../model/SCModel.ts'

/**
 * Tests
 *   - SCModel constructor should set app, id, and state
 *   - getDataRequestOpts() should return correct request body
 *   - getDataRequestOpts() should return undefined when item is not set
 *   - getDataRequestOpts() should throw when singleCell.data is not configured
 *   - hasSpatialImage() should return cached probe results without refetching
 *   - hasSpatialImage() should skip the probe when the ds does not support wsi
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/model/SCModel -***-')
	test.end()
})

tape('constructor should set app, id, and state', test => {
	const app = getMockSCApp()
	const model = new SCModel(app)

	test.equal(model.app, app.app, 'Should set app reference')
	test.equal(model.id, 'testApp', 'Should set id')
	test.deepEqual(
		model.state.vocab,
		{ genome: 'hg38-test', dslabel: 'TermdbTest' },
		'Should set state from app.getState()'
	)
	test.end()
})

tape('getDataRequestOpts() should return correct request body', test => {
	const app = getMockSCApp({
		plots: [{ id: 'testApp', settings: { sc: { item: { sID: 'S1', eID: 'EXP1' } } } }]
	})
	const model = new SCModel(app)
	const opts = model.getDataRequestOpts()

	test.equal(opts!.genome, 'hg38-test', 'Should include genome')
	test.equal(opts!.dslabel, 'TermdbTest', 'Should include dslabel')
	test.equal(opts!.checkPlotAvailability, true, 'Should default checkPlotAvailability to true')
	test.deepEqual(opts!.plots, ['umap', 'tsne'], 'Should map plot names')
	test.deepEqual(opts!.sample, { eID: 'EXP1', sID: 'S1' }, 'Should include sample with eID and sID')
	test.end()
})

tape('getDataRequestOpts() should use provided plots and checkPlotAvailability value', test => {
	const app = getMockSCApp({
		plots: [{ id: 'testApp', settings: { sc: { item: { sID: 'S1', eID: 'EXP1' } } } }]
	})
	const model = new SCModel(app)
	const opts = model.getDataRequestOpts(['violin'], false)

	test.equal(opts!.checkPlotAvailability, false, 'Should pass through checkPlotAvailability argument')
	test.deepEqual(opts!.plots, ['violin'], 'Should use explicitly provided plots')
	test.end()
})

tape('getDataRequestOpts() should return undefined when item is not set', test => {
	const app = getMockSCApp({
		plots: [{ id: 'testApp', settings: { sc: { item: undefined } } }]
	})
	const model = new SCModel(app)
	const opts = model.getDataRequestOpts()

	test.equal(opts, undefined, 'Should return undefined when no item is selected')
	test.end()
})

tape('getDataRequestOpts() should throw when singleCell.data is not configured', test => {
	const app = getMockSCApp({
		termdbConfig: { queries: { singleCell: {} } }
	})
	const model = new SCModel(app)

	test.throws(
		() => model.getDataRequestOpts(),
		/No singleCell\.data defined in termdbConfig\.queries/,
		'Should throw when singleCell.data is missing'
	)
	test.end()
})

tape('hasSpatialImage() should return cached probe results without refetching', async test => {
	const app = getMockSCApp()
	const model = new SCModel(app)

	// the cache short-circuits the wsiBySample probe: seeded values come back
	// as-is with no request (live probes are covered by the integration spec)
	model.sampleHasSpatial['with-spatial'] = true
	model.sampleHasSpatial['without-spatial'] = false
	test.equal(await model.hasSpatialImage('with-spatial'), true, 'Should return a cached true without probing')
	test.equal(await model.hasSpatialImage('without-spatial'), false, 'Should return a cached false without probing')
	test.end()
})

tape('hasSpatialImage() should skip the probe when the ds does not support wsi', async test => {
	// no supportedChartTypes advertising 'wsi' (ds without queries.w2): the
	// wsiBySample route could only 500, so no request is made at all
	const app = getMockSCApp()
	const model = new SCModel(app)

	test.equal(await model.hasSpatialImage('AnySample'), false, 'Should be false without a request')
	test.notOk('AnySample' in model.sampleHasSpatial, 'Should not pollute the cache')
	test.end()
})
