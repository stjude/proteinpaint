const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38',
		termfilter: { show_top_ui: true }
	},
	app: {
		standalone: true
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
	test.pass('-***- termdb/nav -***-')
	test.end()
})

tape('default behavior', function(test) {
	runpp({
		state: {},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests() {}
	test.end()
})
