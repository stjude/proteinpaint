const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')
const vocabInit = require('../vocabulary').vocabInit
const appInit = require('../app').appInit

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/vocabulary -***-')
	test.end()
})

tape('vocabInit(), default', test => {
	const app = {
		opts: {
			state: {
				genome: 'xxx',
				dslabel: 'yyy'
			}
		}
	}
	const vocabApi = vocabInit(app, app.opts)

	test.equal(typeof vocabApi, 'object', 'should return a vocab object')
	test.equal(typeof vocabApi.getTermdbConfig, 'function', 'should have a vocab.getTermdbConfig function')
	test.equal(typeof vocabApi.getTermChildren, 'function', 'should have a vocab.getTermChildren function')
	test.equal(typeof vocabApi.getPlotData, 'function', 'should have a vocab.getPlotData function')
	test.equal(typeof vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
	test.equal(typeof vocabApi.getCohortSampleCount, 'function', 'should have a vocab.getCohortSampleCount function')
	test.equal(typeof vocabApi.getFilteredSampleCount, 'function', 'should have a vocab.getFilteredSampleCount function')
	test.end()
})

tape('getVocab(), custom', async test => {
	runpp({
		state: {
			vocab: {
				terms: [
					{
						id: 'a',
						name: 'AAA',
						parent_id: null
					},
					{
						id: 'b',
						name: 'BBB',
						parent_id: null
					},
					{
						type: 'categorical',
						id: 'c',
						name: 'CCC',
						parent_id: 'a',
						isleaf: true,
						groupsetting: {
							disabled: true
						}
					},
					{
						type: 'integer',
						id: 'd',
						name: 'DDD',
						parent_id: 'a',
						isleaf: true,
						groupsetting: {
							disabled: true
						}
					},
					{
						type: 'condition',
						id: 'e',
						name: 'EEE',
						parent_id: 'a',
						isleaf: true,
						groupsetting: {
							disabled: true
						}
					},
					{
						type: 'categorical',
						id: 'f',
						name: 'FFF',
						parent_id: 'b',
						isleaf: true,
						groupsetting: {
							disabled: true
						}
					},
					{
						type: 'categorical',
						id: 'g',
						name: 'CCC',
						parent_id: 'ab',
						isleaf: true,
						groupsetting: {
							disabled: true
						}
					}
				]
			}
		},
		app: {
			callbacks: {
				'postInit.test': runTests1
			}
		}
	})

	function runTests1(app) {
		test.equal(typeof app.vocabApi, 'object', 'should return a vocab object')
		test.equal(typeof app.vocabApi.getTermdbConfig, 'function', 'should have a vocab.getTermdbConfig function')
		test.equal(typeof app.vocabApi.getTermChildren, 'function', 'should have a vocab.getTermChildren function')
		test.equal(typeof app.vocabApi.getPlotData, 'function', 'should have a vocab.getPlotData function')
		test.equal(typeof app.vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
		test.equal(
			typeof app.vocabApi.getCohortSampleCount,
			'function',
			'should have a vocab.getCohortSampleCount function'
		)
		test.equal(
			typeof app.vocabApi.getFilteredSampleCount,
			'function',
			'should have a vocab.getFilteredSampleCount function'
		)
		test.end()
	}
})
