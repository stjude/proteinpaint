const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
	test.pass("-***- mds.termdb.stattable -***-")
	test.end()
})

tape("barchart-dependent display", function(test) {
	const div0 = d3s.select("body").append("div")
	const termfilter = { show_top_ui: true }

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			termfilter,
			params2restore: {
				term: termjson["agedx"],
				term2: termjson["diaggrp"],
				settings: {
					currViews: ["table"]
				}
			},
			callbacks: {
				plot: {
					postRender: [testHiddenWithNoBarchart, triggerViewBarchart]
				}
			}
		}
	})

	function testHiddenWithNoBarchart(plot) {
		test.equal(
			plot.components.stattable.dom.div.style("display"),
			"none",
			"should have a HIDDEN stattable when the barchart is not in the settings.currViews array"
		)
	}

	function triggerViewBarchart(plot) {
		plot.bus.on("postRender", testVisibleWithBarchart)
		plot.main({
			settings: { currViews: ["barchart"] }
		})
	}

	function testVisibleWithBarchart(plot) {
		test.equal(
			plot.components.stattable.dom.div.style("display"),
			"block",
			"should have a visible stattable when the barchart is in the settings.currViews array"
		)
		test.end()
	}
})

tape("term.isfloat-dependent display", function(test) {
	const div0 = d3s.select("body").append("div")

	runproteinpaint({
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			termfilter: { show_top_ui: false },
			params2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"]
				}
			},
			callbacks: {
				plot: {
					postRender: [testHiddenIfCategoricalTerm, triggerNumericTerm]
				}
			}
		}
	})

	function testHiddenIfCategoricalTerm(plot) {
		test.equal(
			plot.components.stattable.dom.div.style("display"),
			"none",
			"should have a HIDDEN stattable when plot.term.iscategorical"
		)
	}

	function triggerNumericTerm(plot) {
		plot.bus.on("postRender", testVisibleWithNumericTerm)
		plot.main({
			term: { term: termjson["agedx"] }
		})
	}

	function testVisibleWithNumericTerm(plot) {
		test.equal(
			plot.components.stattable.dom.div.style("display"),
			"block",
			"should have a visible stattable when plot.term is numeric"
		)
	}

	const div1 = d3s.select("body").append("div")

	runproteinpaint({
		holder: div1.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			termfilter: { show_top_ui: false },
			params2restore: {
				term: termjson["Arrhythmias"],
				settings: {
					currViews: ["barchart"]
				}
			},
			callbacks: {
				plot: {
					postRender: testHiddenIfConditionTerm
				}
			}
		}
	})

	function testHiddenIfConditionTerm(plot) {
		test.equal(
			plot.components.stattable.dom.div.style("display"),
			"none",
			"should have a HIDDEN stattable when plot.term.iscondition"
		)
		test.end()
	}
})
