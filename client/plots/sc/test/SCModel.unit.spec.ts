import tape from 'tape'
import { getMockSCApp } from './getMockSCApp.ts'
import { SCModel } from '../model/SCModel.ts'

/**
 * Tests
 *   - SCModel constructor should set app, id, and state
 *   - getDataRequestOpts() should return correct request body
 *   - getDataRequestOpts() should return undefined when item is not set
 *   - getDataRequestOpts() should throw when singleCell.data is not configured
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
