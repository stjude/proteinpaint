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
		termfilter: { show_top_ui: true },
		nav: { show_tabs: true }
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
		nav: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})
	function runTests(nav) {
		const tds = nav.Inner.dom.tabDiv.node().querySelectorAll('td')
		const trs = nav.Inner.dom.tabDiv.node().querySelectorAll('tr')
		test.equal(tds.length / trs.length, 3, 'should have three tabs')
		test.end()
	}
})
