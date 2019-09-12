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
	test.timeoutAfter(2000)
	test.plan(1)

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
					currViews: [],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: checkDisplayInAnyView
				}
			},
			serverData: helpers.serverData
		}
	})

	function checkDisplayInAnyView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Overlay with") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}
})

tape("orientation input", function(test) {
	test.timeoutAfter(3000)
	test.plan(2)

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
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayInBarchartView(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayInNonBarchartView(plot)
						resolve()
					})
					triggerNonBarchartView(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
	}
	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Orientation") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerNonBarchartView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInNonBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Orientation") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in non-barchart view")
		})
	}
})

tape("scale input", function(test) {
	test.timeoutAfter(5000)
	test.plan(2)

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
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayInBarchartView(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayInNonBarchartView(plot)
						resolve()
					})
					triggerNonBarchartView(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
	}

	function checkDisplayInBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Scale") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible in barchart view")
		})
	}

	function triggerNonBarchartView(plot) {
		plot.main({
			term2: { term: termjson["agedx"] },
			settings: { currViews: ["table"] }
		})
	}

	function checkDisplayInNonBarchartView(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Scale") return
			test.equal(this.parentNode.style.display, "none", "should be hidden in non-barchart view")
		})
	}
})

tape("divide by input", function(test) {
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
				term: termjson["aaclassic_5"],
				settings: {
					currViews: ["barchart"],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayInBarchartView(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayInTableView(plot)
						resolve()
					})
					triggerTableView(plot)
				})
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayInBoxplotView(plot)
						resolve()
					})
					triggerBoxplotView(plot)
				})
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayInScatterView(plot)
						resolve()
					})
					triggerScatterView(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
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
	test.plan(2)

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
					currViews: [],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayWithNumericTerm(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayWithCategoricalTerm(plot)
						resolve()
					})
					triggerCategoricalTerm(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
	}

	function checkDisplayWithNumericTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Primary Bins") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible with numeric term")
		})
	}

	function triggerCategoricalTerm(plot) {
		plot.obj.expanded_term_ids.push("diaggrp")
		plot.main({
			term: { term: termjson["diaggrp"] }
		})
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
	test.plan(2)

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
					currViews: [],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayWithNumericTerm(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayWithCategoricalTerm(plot)
						resolve()
					})
					triggerCategoricalTerm(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
	}

	function checkDisplayWithNumericTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Bars as") return
			test.equal(this.parentNode.style.display, "table-row", "should be visible with condition term")
		})
	}

	function triggerCategoricalTerm(plot) {
		plot.obj.expanded_term_ids.push("diaggrp")
		plot.main({
			term: { term: termjson["diaggrp"] }
		})
	}

	function checkDisplayWithCategoricalTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Bars as") return
			test.equal(this.parentNode.style.display, "none", "should be hidden with non-condition term")
		})
	}
})

tape("Display mode input", function(test) {
	test.timeoutAfter(5000)
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
					currViews: [],
					controls: { isVisible: true }
				}
			},
			callbacks: {
				controls: {
					postRender: runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(plot) {
		Promise.resolve()
			.then(() => {
				checkDisplayWithCategoricalTerm(plot)
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayWithNonNumericOverlay(plot)
						resolve()
					})
					triggerNonNumericOverlay(plot)
				})
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayWithNumericOverlay(plot)
						resolve()
					})
					triggerNumericOverlay(plot)
				})
			})
			.then(() => {
				return new Promise((resolve, reject) => {
					plot.components.controls.bus.on("postRender", () => {
						checkDisplayWithNumericBarAndOverlay(plot)
						resolve()
					})
					triggerNumericBarAndOverlay(plot)
				})
			})
			.then(() => {
				plot.components.controls.bus.on("postRender", null)
				test.end()
			})
			.catch(e => console.log(e))
	}

	function checkDisplayWithCategoricalTerm(plot) {
		plot.dom.controls.selectAll(".sja-termdb-config-row-label").each(function() {
			if (this.innerHTML !== "Display mode") return
			test.equal(this.parentNode.style.display, "none", "should be hidden when there is no overlay")
		})
	}

	function triggerNonNumericOverlay(plot) {
		plot.main({
			term2: { term: termjson["sex"] }
		})
	}

	function checkDisplayWithNonNumericOverlay(plot, prom) {
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
