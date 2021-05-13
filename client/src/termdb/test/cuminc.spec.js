const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/cuminc -***-')
	test.end()
})

tape.only('cumulative incidence', function(test) {
	test.timeoutAfter(1100)
	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias',
					'Cardiac dysrhythmia'
				],
				visibleCumIncIds: ['Cardiac dysrhythmia'],
				cuminc: {
					'Cardiac dysrhythmia': {
						term: {
							id: 'Cardiac dysrhythmia',
							term: termjson['Cardiac dysrhythmia'],
							q: { bar_by_grade: true, value_by_max_grade: true }
						}
					}
				}
			}
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(cuminc) {
		test.fail('63 cuminc')
		test.end()
	}
})
