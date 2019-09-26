const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require("../../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../../../test/front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- tdb.filter -***-")
	test.end()
})

tape("filter add", function(test) {
	test.timeoutAfter(2000)
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			dslabel: "SJLife",
            genome: "hg38",
            termfilter:{
                show_top_ui: true,
                terms:[]
            },
			callbacks: {
				filter: {
					"postInit.test": runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})

    function runTests(filter) {
		filter.on('postInit.test', null)
		helpers.rideInit({arg: filter})
            .run(triggerAddFilter)
            .run(testAddFilter, 100)
			.done(()=>test.end())
	}

	function triggerAddFilter(filter) {
		filter.Inner.app.dispatch({type: "filter_add", termId: "diaggrp"})
	}

	function testAddFilter(filter) {
		test.equal(
			filter.Inner.dom.holder.classed('filter_div'), 
			true,
			"should have 1 filter div"
		)
	}
})
