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

tape('default hidden tabs, no filter', function(test) {
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
		test.equal(nav.Inner.dom.subheaderDiv.style('display'), 'none', 'should hide the subheader')
		test.end()
	}
})

tape('empty cohort, then selected', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				show_tabs: true,
				activeCohort: -1
			}
		},
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let tds, trs
	function runTests(nav) {
		tds = nav.Inner.dom.tabDiv.selectAll('td')
		trs = nav.Inner.dom.tabDiv.node().querySelectorAll('tr')
		helpers
			.rideInit({ arg: nav, bus: nav, eventType: 'postRender.test' })
			.run(testPreCohortSelection)
			.use(triggerCohortSelection)
			.to(testPostCohortSelection, 100)
			.use(triggerTabFold)
			.to(testTabFold, 100)
			.use(triggerTabUnfold)
			.to(testTabUnfold, 100)
			.done(test)
	}

	function testPreCohortSelection(nav) {
		test.equal(
			tds
				.filter(function() {
					return this.style.display !== 'none'
				})
				.size() / trs.length,
			1,
			'should show 1 tab when no cohort is selected'
		)
		test.notEqual(
			nav.Inner.dom.subheaderDiv.style('display'),
			'none',
			'should show the subheader when no cohort is selected'
		)
		test.notEqual(
			tds.filter((d, i) => i === 0).style('background-color'),
			'transparent',
			'should highlight the active cohort tab'
		)
	}

	function triggerCohortSelection(nav) {
		nav.Inner.dom.cohortOpts
			.selectAll('input')
			.filter((d, i) => i === 0)
			.node()
			.click()
	}

	function testPostCohortSelection(nav) {
		test.equal(
			tds
				.filter(function() {
					return this.style.display !== 'none'
				})
				.size() / trs.length,
			3,
			'should show 3 tabs after a cohort is selected'
		)
		test.notEqual(
			nav.Inner.dom.subheaderDiv.style('display'),
			'none',
			'should still show the subheader after a cohort is selected'
		)
		test.notEqual(
			tds.filter((d, i) => i === 0).style('background-color'),
			'transparent',
			'should highlight the active tab'
		)
	}

	function triggerTabFold(nav) {
		tds
			.filter((d, i) => i === 0)
			.node()
			.click()
	}

	function testTabFold(nav) {
		test.equal(
			nav.Inner.dom.subheaderDiv.style('display'),
			'none',
			'should hide the subheader when a tab is clicked again'
		)
		test.equal(
			tds
				.filter(function() {
					return this.style.backgroundColor === 'transparent'
				})
				.size() / trs.length,
			3,
			'should not highlight any active tab'
		)
	}

	function triggerTabUnfold(nav) {
		tds
			.filter((d, i) => i === 0)
			.node()
			.click()
	}

	function testTabUnfold(nav) {
		test.notEqual(
			nav.Inner.dom.subheaderDiv.style('display'),
			'none',
			'should unfold the subheader when a tab is clicked a third time'
		)
		test.notEqual(
			tds.filter((d, i) => i === 0).style('background-color'),
			'transparent',
			'should highlight the active tab'
		)
	}
})
