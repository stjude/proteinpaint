const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../../test/front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- tdb.tree -***-")
	test.end()
})

tape("default view", function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			callbacks: {
				tree: {
					"postInit.test": runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})

	function runTests(tree) {
		tree.on('postInit.test', null)
		helpers.rideInit({arg: tree})
			.run(testDom, 300)
			.done(()=>test.end())
	}

	function testDom(tree) {
		test.equal(
			tree.Inner.dom.holder.selectAll('.termbtn').size(), 
			4,
			"should have 4 root term buttons"
		)
	}
})
