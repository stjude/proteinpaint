import tape from 'tape'
import { getMockSCApp } from './getMockSCApp.ts'
import { SCModel } from '../model/SCModel.ts'

/**
 * Tests
 *   - SCModel constructor should set app, id, and state
 *   - getSampleRequestOpts() should return genome, dslabel, and filter0
 *   - getSampleRequestOpts() should pass through filter0 when present
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
	const model = new SCModel(app, 'plot1')

	test.equal(model.app, app, 'Should set app reference')
	test.equal(model.id, 'plot1', 'Should set id')
	test.deepEqual(
		model.state.vocab,
		{ genome: 'hg38-test', dslabel: 'TermdbTest' },
		'Should set state from app.getState()'
	)
	test.end()
})

tape('getSampleRequestOpts() should return genome, dslabel, and filter0', test => {
	const app = getMockSCApp()
	const model = new SCModel(app, 'plot1')
	const opts = model.getSampleRequestOpts()

	test.equal(opts.genome, 'hg38-test', 'Should include genome')
	test.equal(opts.dslabel, 'TermdbTest', 'Should include dslabel')
	test.equal(opts.filter0, null, 'Should include filter0')
	test.end()
})

tape('getSampleRequestOpts() should pass through filter0 when present', test => {
	const filter0 = { type: 'tvslst', lst: [{ tag: 'cohortFilter' }] }
	const app = getMockSCApp({ termfilter: { filter0 } })
	const model = new SCModel(app, 'plot1')
	const opts = model.getSampleRequestOpts()

	test.deepEqual(opts.filter0, filter0, 'Should pass filter0 from state')
	test.end()
})

tape('getDataRequestOpts() should return correct request body', test => {
	const app = getMockSCApp()
	const model = new SCModel(app, 'plot1')
	const opts = model.getDataRequestOpts()

	test.equal(opts!.genome, 'hg38-test', 'Should include genome')
	test.equal(opts!.dslabel, 'TermdbTest', 'Should include dslabel')
	test.deepEqual(opts!.plots, ['umap', 'tsne'], 'Should map plot names')
	test.deepEqual(opts!.sample, { eID: 'EXP1', sID: 'S1' }, 'Should include sample with eID and sID')
	test.end()
})

tape('getDataRequestOpts() should return undefined when item is not set', test => {
	const app = getMockSCApp({
		plots: [{ id: 'plot1', settings: { sc: { item: undefined } } }]
	})
	const model = new SCModel(app, 'plot1')
	const opts = model.getDataRequestOpts()

	test.equal(opts, undefined, 'Should return undefined when no item is selected')
	test.end()
})

tape('getDataRequestOpts() should throw when singleCell.data is not configured', test => {
	const app = getMockSCApp({
		termdbConfig: { queries: { singleCell: {} } }
	})
	const model = new SCModel(app, 'plot1')

	test.throws(
		() => model.getDataRequestOpts(),
		/No singleCell\.data defined in termdbConfig\.queries/,
		'Should throw when singleCell.data is missing'
	)
	test.end()
})
