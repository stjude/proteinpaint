const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../../test/front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- toy.search -***-")
	test.end()
})

tape("instance", function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		toy: {
			dslabel: "SJLife",
			genome: "hg38",
			callbacks: {
				search: {
					"postInit.test": runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
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
				eventType: "postMain.test",
				arg: search
			})
			.run(testDom, 100)
			.done(() => test.end())
	}

	function testDom(search) {
		test.equal(
			search.Inner.dom.tip 
			&& search.Inner.dom.tip.d 
			&& search.Inner.dom.tip.d.size(), 
			1,
			"should have a tip"
		)
	}
})

tape("text input", function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		toy: {
			dslabel: "SJLife",
			genome: "hg38",
			callbacks: {
				search: {
					"postInit.test": runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
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
				eventType: "postMain.test",
				arg: search
			})
			.run(triggerExactTermMenu)
			.run(testExactSuggestedTerm, 100)
			.run(triggerLooseTermMenu)
			.run(testLooseSuggestedTerm, 100)
			.done(() => test.end())
	}

	function triggerExactTermMenu(search) {
		// simulate text input
		search.Inner.input.property('value', 'sex')
		search.Inner.input.on('keyup')()
	}

	function testExactSuggestedTerm(search) {
		test.equal(
			search.Inner.dom.tip.d.selectAll('.sja_menuoption').size(), 
			1,
			"should render 1 search suggestion for 'sex' term"
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
			3,
			"should render 3 search suggestions for 'cardio' term"
		)
	}
})

tape.skip("search menu click", function(test) {
	
})

