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
		state: {
			nav: { show_tabs: false }
		},
		nav: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})
	function runTests(nav) {
		test.equal(nav.Inner.dom.tabDiv.style('display'), 'none', 'should hide the tabs by default')
		test.equal(nav.Inner.dom.holder.style('margin-bottom'), '0px', 'should not set a margin-bottom')
		test.equal(nav.Inner.dom.holder.style('border-bottom'), '0px none rgb(0, 0, 0)', 'should not show a border-bottom')
		test.notEqual(nav.Inner.dom.searchDiv.style('display'), 'none', 'should show the search input')
		test.end()
	}
})

tape('visible tabs', function(test) {
	runpp({
		state: {
			nav: {
				show_tabs: true,
				activeCohort: -1
			}
		},
		nav: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})
	function runTests(nav) {
		const tds = nav.Inner.dom.tabDiv.node().querySelectorAll('td')
		const trs = nav.Inner.dom.tabDiv.node().querySelectorAll('tr')
		test.equal(tds.length / trs.length, 3, 'should show 3 tabs')
		test.end()
	}
})
