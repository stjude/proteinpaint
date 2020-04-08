const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('toy', {
	dslabel: 'SJLife',
	genome: 'hg38',
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- toy.search -***-')
	test.end()
})

tape('instance', function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runpp({
		search: {
			callbacks: {
				'postInit.test': testDom
			}
		}
	})

	function testDom(search) {
		test.equal(search.Inner.dom.tip && search.Inner.dom.tip.d && search.Inner.dom.tip.d.size(), 1, 'should have a tip')
	}
})

tape('text input', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		search: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(search) {
		search.on('postInit.test', null)
		// more reliable test promise chain format
		// that is less likely to need timeouts
		helpers
			.rideInit({
				bus: search,
				eventType: 'postRender.test',
				arg: search
			})
			.run(triggerExactTermMenu)
			.run(testExactSuggestedTerm, 100)
			.run(triggerLooseTermMenu)
			.run(testLooseSuggestedTerm, 100)
			.done(test)
	}

	function triggerExactTermMenu(search) {
		// simulate text input
		search.Inner.input.property('value', 'sex')
		search.Inner.input.on('keyup')()
	}

	function testExactSuggestedTerm(search) {
		test.equal(
			search.Inner.dom.tip.d.selectAll('.sja_menuoption').size(),
			3,
			"should render 3 search suggestion for 'sex' term"
		)
	}

	function triggerLooseTermMenu(search) {
		// simulate text input
		search.Inner.input.property('value', 'cardio')
		search.Inner.input.on('keyup')()
	}

	function testLooseSuggestedTerm(search) {
		test.equal(
			search.Inner.dom.tip.d.selectAll('.sja_menuoption').size(),
			4,
			"should render 4 search suggestions for 'cardio' term"
		)
	}
})

tape.skip('search menu click', function(test) {})
