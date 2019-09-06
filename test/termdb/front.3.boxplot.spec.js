const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
	test.pass("-***- mds.termdb.table -***-")
	test.end()
})

tape("overlay-dependent display", function(test) {
	const div0 = d3s.select("body").append("div")
	const termfilter = { show_top_ui: true, callbacks: [] }

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
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["boxplot"]
				}
			},
			callbacks: {
				plot: {
					postRender: [testHiddenNoOverlay, triggerViewBoxplot]
				}
			}
		}
	})

	function testHiddenNoOverlay(plot) {
		test.equal(plot.components.boxplot.dom.svg.style("display"), "none", "should be HIDDEN when there is no overlay")
	}

	function triggerViewBoxplot(plot) {
		plot.bus.on("postRender", [testVisibleBoxplot, triggerNonNumericOverlay])
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: {
				currViews: ["boxplot"]
			}
		})
	}

	function testVisibleBoxplot(plot) {
		test.equal(
			plot.components.boxplot.dom.svg.style("display"),
			"inline-block",
			"should be visible when there is a numeric overlay"
		)
	}

	function triggerNonNumericOverlay(plot) {
		plot.bus.on("postRender", testHiddenNonNumericOverlay)
		plot.main({
			term2: { term: termjson["Arrhythmias"] },
			settings: {
				currViews: ["boxplot"]
			}
		})
	}

	function testHiddenNonNumericOverlay(plot) {
		test.equal(
			plot.components.boxplot.dom.svg.style("display"),
			"none",
			"should be HIDDEN when the overlay is not numeric"
		)
		test.end()
	}
})
