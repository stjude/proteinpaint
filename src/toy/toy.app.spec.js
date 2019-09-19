const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../../test/front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- toy.app -***-")
	test.end()
})

tape("default view", function(test) {
	test.timeoutAfter(1000)
	test.plan(4)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		toy: {
			dslabel: "SJLife",
			genome: "hg38",
			callbacks: {
				app: {
					"postInit.test": runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})

	function runTests(app) {
		app.on('postInit.test', null)
		// more reliable test promise chain format
		// that is less likely to need timeouts
		helpers
			.rideInit({
				bus: app,
				eventType: "postMain.test",
				arg: app
			})
			.run(testSearchDisplay, 100)
			.run(testTableWrapper, 100)
			.run(triggerTermAdd)
			.run(testTermAdd, 100)
			.run(triggerTermRemove)
			.run(testTermRemove, 100)
			.done(() => test.end())
	}

	function testSearchDisplay(app) {
		test.equal(
			app.Inner.dom.holder.selectAll("input").size(),
			1,
			"should have one search input"
		)
	}

	function testTableWrapper(app) {
		test.equal(
			app.Inner.dom.holder.selectAll(".table-wrapper").size(),
			0,
			"should have no tables displayed"
		)
	}

	function testTableWrapper(app) {
		test.equal(
			app.Inner.dom.holder.selectAll(".table-wrapper").size(),
			0,
			"should have no tables displayed"
		)
	}

	function triggerTermAdd(app) {
		// !!! test against action when possible !!!
		// simpler than sequencing clicks, UI events
		app.dispatch({type: "term_add", termid: "agedx"})
		app.dispatch({type: "term_add", termid: "sex"})
	}

	function testTermAdd(app) {
		test.equal(
			app.Inner.dom.holder.selectAll(".table-wrapper").size(),
			2,
			"should have 1 table displayed"
		)
	}

	function triggerTermRemove(app) {
		// !!! test against action when possible !!!
		// simpler than sequencing clicks, UI events
		app.dispatch({type: "term_rm", termid: "agedx"})
	}

	function testTermRemove(app) {
		test.equal(
			app.Inner.dom.holder.selectAll(".table-wrapper").size(),
			1,
			"should have no tables displayed"
		)
	}
})