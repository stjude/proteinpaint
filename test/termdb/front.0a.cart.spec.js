const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port
const helpers = require("../front.helpers.js")

tape("\n", function(test) {
	test.pass("-***- mds.termdb.controls cart -***-")
	test.end()
})

tape("cart button", function(test) {
	test.timeoutAfter(1000)
	test.plan(3)
	const div0 = d3s.select("body").append("div")
	const termfilter = { show_top_ui: true }
	const selected_groups = [
		{
			terms: [
				{
					term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
					values: [{ key: "Wilms tumor", label: "Wilms tumor" }]
				}
			]
		}
	]

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
			selected_groups,
			bar_click_menu: {
				add_filter: true
			},
			callbacks: {
				cart: {
					"postRender.test": runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.ride(obj.components.cart.bus, "postRender.test", obj, 300)
			.do(testDisplay)
			.do(testSelectedGroupTipDisplay, triggerClick)
			.do(testEmpty, triggerEmpty)
			.off(() => test.end())
	}

	function testDisplay(obj) {
		test.equal(obj.dom.cartdiv.html(), "Selected 1 Group", "should display a cart button")
	}

	function triggerClick(obj) {
		obj.dom.cartdiv.node().dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testSelectedGroupTipDisplay(obj) {
		test.true(obj.tip.d.selectAll(".sja_filter_tag_btn").size() > 1, "should show blue-pill for selected group")
	}

	function triggerEmpty(obj) {
		obj.tip.d
			.select(".remove_group_btn")
			.node()
			.dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testEmpty(obj) {
		test.equal(obj.dom.cartdiv.style("display"), "none", "Should remove the cart button")
	}
})

tape("cart selected group tip", function(test) {
	test.timeoutAfter(1500)
	test.plan(2)
	const div0 = d3s.select("body").append("div")
	const termfilter = { show_top_ui: true }
	const selected_groups = [
		{
			terms: [
				{
					term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
					values: [{ key: "Wilms tumor", label: "Wilms tumor" }]
				}
			]
		}
	]

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
			selected_groups,
			bar_click_menu: {
				add_filter: true
			},
			callbacks: {
				cart: {
					"postRender.test": runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.ride(obj.components.cart.bus, "postRender.test", obj, 300)
			.do(testSelectedGroupTipDisplay, triggerClick)
			.do(testRemoveTerm, triggerRemoveTerm)
			.off(() => test.end())
	}

	function triggerClick(obj) {
		obj.dom.cartdiv.node().dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testSelectedGroupTipDisplay(obj) {
		test.equal(obj.tip.d.selectAll(".term_name_btn").size(), 1, "should show 1 blue-pill for selected group")
	}

	function triggerRemoveTerm(obj) {
		obj.tip.d
			.select(".term_remove_btn")
			.node()
			.dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testRemoveTerm(obj) {
		test.equal(obj.tip.d.selectAll(".term_name_btn").size(), 0, "should remove blue-pill from the group")
		obj.tip.hide()
	}
})

tape("cart with 2 groups", function(test) {
	test.timeoutAfter(5000)
	test.plan(6)
	const div0 = d3s.select("body").append("div")
	const termfilter = { show_top_ui: true }
	const selected_groups = [
		{
			is_termdb: true,
			terms: [
				{
					term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
					values: [{ key: "Acute lymphoblastic leukemia", label: "Acute lymphoblastic leukemia" }]
				}
			]
		},
		{
			is_termdb: true,
			terms: [
				{
					term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
					values: [{ key: "Acute lymphoblastic leukemia", label: "Acute lymphoblastic leukemia" }],
					isnot: true
				}
			]
		}
	]

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
			selected_groups,
			bar_click_menu: {
				add_filter: true
			},
			callbacks: {
				cart: {
					"postRender.test": runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.ride(obj.components.cart.bus, "postRender.test", obj, 300)
			.do(testSelectedGroupTipDisplay, triggerCartClick)
			.do(triggerLaunchGenomePaint)
			.do(testRemoveGroup, triggerRemoveGroup)
			.off(() => test.end())
	}

	function triggerCartClick(obj) {
		obj.dom.cartdiv.node().dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testSelectedGroupTipDisplay(obj) {
		test.equal(obj.tip.d.selectAll(".remove_group_btn").size(), 2, "should show 2 blue-pill for selected groups")
		test.equal(obj.tip.d.selectAll(".launch_gp_btn").size(), 1, "should show 'test in genome paint' button")
	}

	function triggerLaunchGenomePaint(obj) {
		obj.tip.d
			.selectAll(".launch_gp_btn")
			.node()
			.click()
		setTimeout(checkLaunchGenomePaint, 500)
	}

	function checkLaunchGenomePaint() {
		// Should check 'SJLife' button in GenomePaint pop-up window
		test.equal(
			d3s
				.select("body")
				.selectAll(".sja_pane")
				.selectAll(".sja_handle_green")
				.html(),
			"SJLife",
			"should lauch GenomePaint"
		)

		d3s
			.select("body")
			.selectAll(".sja_pane")
			.selectAll(".sja_menuoption")
			.node()
			.click()
	}

	function triggerRemoveGroup(obj) {
		obj.dom.cartdiv.node().dispatchEvent(new Event("click", { bubbles: true }))
		obj.tip.d
			.select(".remove_group_btn")
			.node()
			.dispatchEvent(new Event("click", { bubbles: true }))
	}

	function testRemoveGroup(obj) {
		test.equal(obj.tip.d.selectAll(".remove_group_btn").size(), 1, "should show only 1 blue-pill after group remove")
		test.equal(
			obj.tip.d.selectAll(".launch_gp_btn").size(),
			0,
			"should remove 'test in genome paint' button if only 1 group"
		)
		test.equal(obj.dom.cartdiv.html(), "Selected 1 Group", "should update a cart button")
		obj.tip.hide()
	}
})
