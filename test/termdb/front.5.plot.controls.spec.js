const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- mds.termdb.plot.controls -***-")
	test.end()
})

tape("overlay input", function(test) {
	test.timeoutAfter(3000)
	test.plan(2)
	const div0 = d3s.select("body").append("div")

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests
				}
			}
		}
	})

	function runTests(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayInBarchartView, { timeout: 200 })
				.add(triggerTableView, { timeout: 400 })
				.add(checkDisplayInTableView, { timeout: 200 })
				.add(() => test.end())
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Overlay with") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerTableView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInTableView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Overlay with") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible even in table view")
		})
	}
})

tape("orientation input", function(test) {
	test.timeoutAfter(3000)
	test.plan(2)
	const div0 = d3s.select("body").append("div")

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests
				}
			}
		}
	})

	function runTests(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayInBarchartView, { timeout: 200 })
				.add(triggerTableView, { timeout: 1000 })
				.add(checkDisplayInTableView, { timeout: 500 })
				.add(() => test.end())
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}
	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Orientation") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerTableView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInTableView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Orientation") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in table view")
		})
	}
})

tape("scale input", function(test) {
	test.timeoutAfter(5000)
	test.plan(3)
	const div0 = d3s.select("body").append("div")

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests
				}
			}
		}
	})

	function runTests(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayInBarchartView, { timeout: 200 })
				.add(triggerTableView, { timeout: 1000 })
				.add(checkDisplayInTableView, { timeout: 500 })
				.add(triggerBoxplotView, { timeout: 1000 })
				.add(checkDisplayInBoxplotView, { timeout: 500 })
				.add(() => test.end())
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}
	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Scale") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerTableView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInTableView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Scale") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in table view")
		})
	}

	function triggerBoxplotView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["boxplot"] }
		})
	}

	function checkDisplayInBoxplotView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Scale") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in boxplot view")
		})
	}
})

tape("divide by input", function(test) {
	test.timeoutAfter(7000)
	test.plan(4)
	const div0 = d3s.select("body").append("div")

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["aaclassic_5"],
				settings: {
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests
				}
			}
		}
	})

	function runTests(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayInBarchartView, { timeout: 200 })
				.add(triggerTableView, { timeout: 1000 })
				.add(checkDisplayInTableView, { timeout: 500 })
				.add(triggerBoxplotView, { timeout: 300 })
				.add(checkDisplayInBoxplotView, { timeout: 300 })
				.add(triggerScatterView, { timeout: 300 })
				.add(checkDisplayInScatterView, { timeout: 300 })
				.add(() => test.end())
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}
	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Divide by") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerTableView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInTableView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Divide by") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in table view")
		})
	}

	function triggerBoxplotView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["boxplot"] }
		})
	}

	function checkDisplayInBoxplotView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Divide by") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in boxplot view")
		})
	}

	function triggerScatterView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["scatter"] }
		})
	}

	function checkDisplayInScatterView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Divide by") return
			test.equal(this.parentNode.style.display, "table-row", "should be hidden in scatter plot view")
		})
	}
})

tape("Primary bins input", function(test) {
	test.timeoutAfter(3000)
	const expectedNumTests = 2
	test.plan(expectedNumTests)
	let testCount = 0
	function trackTests() {
		testCount++
		if (testCount >= expectedNumTests) test.end()
	}

	runproteinpaint({
		host,
		holder: d3s
			.select("body")
			.append("div")
			.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["agedx"],
				settings: {
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests0
				}
			}
		}
	})

	function runTests0(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayWithNumericTerm, { timeout: 300 })
				.add(trackTests)
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayWithNumericTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Primary Bins") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible with numeric term")
		})
	}

	runproteinpaint({
		host,
		holder: d3s
			.select("body")
			.append("div")
			.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"]
			},
			callbacks: {
				plot: {
					postRender: runTests1
				}
			}
		}
	})

	function runTests1(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayWithCategoricalTerm, { timeout: 300 })
				.add(trackTests)
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayWithCategoricalTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Primary Bins") return
			test.equal(this.parentNode.style.display, "none", "should be hidden with non-numeric term")
		})
	}
})

tape("'Bars as' input", function(test) {
	test.timeoutAfter(3000)

	const expectedNumTests = 2
	test.plan(expectedNumTests)
	let testCount = 0
	function trackTests() {
		testCount++
		if (testCount >= expectedNumTests) test.end()
	}

	runproteinpaint({
		host,
		holder: d3s
			.select("body")
			.append("div")
			.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["Arrhythmias"],
				settings: {
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests0
				}
			}
		}
	})

	function runTests0(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayWithNumericTerm, { timeout: 300 })
				.add(trackTests)
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayWithNumericTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Bars as") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible with condition term")
		})
	}

	runproteinpaint({
		host,
		holder: d3s
			.select("body")
			.append("div")
			.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"]
			},
			callbacks: {
				plot: {
					postRender: runTests1
				}
			}
		}
	})

	function runTests1(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayWithCategoricalTerm, { timeout: 300 })
				.add(trackTests)
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayWithCategoricalTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Bars as") return
			test.equal(this.parentNode.style.display, "none", "should be hidden with non-condition term")
		})
	}
})

tape("Display mode input", function(test) {
	test.timeoutAfter(7000)
	test.plan(4)

	runproteinpaint({
		host,
		holder: d3s
			.select("body")
			.append("div")
			.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: "SJLife",
			genome: "hg38",
			default_rootterm: {},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					controls: { isVisible: true }
				}
			},
			callbacks: {
				plot: {
					postRender: runTests0
				}
			}
		}
	})

	function runTests0(plot) {
		try {
			plot.bus.on("postRender", null)
			helpers
				.getChain()
				.add(checkDisplayWithCategoricalTerm, { timeout: 300 })
				.add(triggerNonNumericOverlay, { timeout: 1000 })
				.add(checkDisplayWithNonNumericOverlay, { timeout: 500 })
				.add(triggerNumericOverlay, { timeout: 500 })
				.add(checkDisplayWithNumericOverlay, { timeout: 500 })
				.add(triggerNumericBarAndOverlay, { timeout: 500 })
				.add(checkDisplayWithNumericBarAndOverlay, { timeout: 1500 })
				.add(() => test.end())
				.next(plot)
		} catch (e) {
			console.log(e)
		}
	}

	function checkDisplayWithCategoricalTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Display mode") return
			test.equal(this.parentNode.style.display, "none", "should be hidden when there is no overlay")
		})
	}

	function triggerNonNumericOverlay(plot) {
		plot.main({
			term2: { term: termjson["sex"] } //, q:{bar_by_children: 1, value_by_max_grade: 1}}
		})
	}

	function checkDisplayWithNonNumericOverlay(plot) {
		const visibleOptions = ["barchart", "table"]
		test.equal(
			plot.components.controls.components.view.radio.dom.divs
				.filter(function(d) {
					return (
						(visibleOptions.includes(d.value) && this.style.display == "inline-block") ||
						(!visibleOptions.includes(d.value) && this.style.display == "none")
					)
				})
				.size(),
			4,
			"should show barchart and table view options with non-numeric bar and non-numeric overlay"
		)
	}

	function triggerNumericOverlay(plot) {
		plot.main({
			term2: { term: termjson["agedx"] }
		})
	}

	function checkDisplayWithNumericOverlay(plot) {
		const visibleOptions = ["barchart", "table", "boxplot"]
		test.equal(
			plot.components.controls.components.view.radio.dom.divs
				.filter(function(d) {
					return (
						(visibleOptions.includes(d.value) && this.style.display == "inline-block") ||
						(!visibleOptions.includes(d.value) && this.style.display == "none")
					)
				})
				.size(),
			4,
			"should show barchart, table, and boxplot view options with non-numeric bar and numeric overlay"
		)
	}

	function triggerNumericBarAndOverlay(plot) {
		plot.obj.expanded_term_ids.push("aaclassic_5")
		plot.main({
			term: { term: termjson["aaclassic_5"] },
			term2: { term: termjson["agedx"] }
		})
	}

	function checkDisplayWithNumericBarAndOverlay(plot) {
		const visibleOptions = ["barchart", "table", "boxplot", "scatter"]
		test.equal(
			plot.components.controls.components.view.radio.dom.divs
				.filter(function(d) {
					return (
						(visibleOptions.includes(d.value) && this.style.display == "inline-block") ||
						(!visibleOptions.includes(d.value) && this.style.display == "none")
					)
				})
				.size(),
			4,
			"should show all view options with numeric bar and numeric overlay"
		)
	}
})
