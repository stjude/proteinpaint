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
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/scatter -***-')
	test.end()
})

tape('numeric term + overlay', function(test) {
	test.timeoutAfter(1000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						settings: { currViews: ['scatter'] },
						term: { id: 'aaclassic_5' },
						term2: { id: 'agedx' }
					}
				}
			}
		},
		scatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		testVisibleScatter(scatter)
		test.end()
	}

	function testVisibleScatter(scatter) {
		const div = scatter.Inner.dom.div
		test.equal(div.style('display'), 'block', 'should be visible when term and term2 are both numeric')
	}
})
