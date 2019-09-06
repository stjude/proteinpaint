const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
	test.pass("-***- mds.termdb.controls filter -***-")
	test.end()
})

tape("filter term-value button", function(test) {
	test.timeoutAfter(2000)
	test.plan(6)
	const div0 = d3s.select("body").append("div")
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
				values: [{ key: "Wilms tumor", label: "Wilms tumor" }]
			}
		]
	}

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
			bar_click_menu: {
				add_filter: true
			},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"]
				}
			},
			callbacks: {
				plot: {
					postRender: [testFilterDisplay, triggerFilterRemove]
				}
			}
		}
	})

	function testFilterDisplay(obj) {
		test.equal(
			obj.obj.dom.termfilterdiv.selectAll(".term_name_btn").html(),
			termfilter.terms[0].term.name,
			"should Filter term-name and plot clicked from runpp() be same"
		)
		test.equal(
			obj.obj.dom.termfilterdiv
				.selectAll(".value_btn")
				.html()
				.slice(0, -2),
			termfilter.terms[0].values[0].label,
			"should Filter value and value supplied from runpp() be same"
		)
		test.true(
			obj.obj.dom.termfilterdiv.selectAll(".term_remove_btn").size() >= 1,
			"should have 'x' button to remove filter"
    )
    test.true(
			obj.obj.dom.termfilterdiv.selectAll(".add_term_btn").size() >= 1,
			"should have '+' button to add new term filter"
		)
	}

	function triggerFilterRemove(obj) {
		obj.bus.on("postRender", [testFilterRemove,triggerFilterAdd])
		setTimeout(() => obj.obj.dom.termfilterdiv
			.selectAll(".term_remove_btn")
			.node()
			.click(), 100)
	}

	function testFilterRemove(obj) {
		test.equal(obj.obj.dom.termfilterdiv.selectAll(".term_name_btn").size(), 0, "should remove tvs filter after clicking 'x'")
  }
  
  function triggerFilterAdd(obj){
    obj.bus.on("postRender", null)
    setTimeout(() => obj.obj.dom.termfilterdiv.selectAll('.add_term_btn').node().click(), 200)
    setTimeout(() => obj.obj.tvstip.d.selectAll(".sja_menuoption").node().click(), 250)
		setTimeout(() => obj.obj.tvstip.d.selectAll(".sja_menuoption")._groups[0][1].click(), 350)
		setTimeout(() => obj.obj.tvstip.d.selectAll(".sja_menuoption")._groups[0][2].click(), 450)
		setTimeout(() => {
			const elem = obj.obj.tvstip.d.select(".bars-cell").select("rect")
      elem.node().dispatchEvent(new Event("click", { bubbles: true }))
      testAddTerm(obj)
		}, 1200)
  }

  function testAddTerm(obj) {
		test.equal(obj.obj.dom.termfilterdiv.selectAll(".term_name_btn").size(), 1, "should add term value filter for clicked term")
		obj.tip.hide()
		test.end()
	}
})

tape("filter term-value button: categorical term", function(test) {
	test.timeoutAfter(2000)
	test.plan(2)
	const div0 = d3s.select("body").append("div")
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
				values: [{ key: "Wilms tumor", label: "Wilms tumor" }]
			}
		]
	}

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
			bar_click_menu: {
				add_filter: true
			},
			plot2restore: {
				term: termjson["diaggrp"],
				settings: {
					currViews: ["barchart"]
				}
			},
			callbacks: {
				plot: {
					postRender: [testFilterDisplay/*,triggerChangeCategory ,triggerAddCategory */]
				}
			}
		}
  })

  function testFilterDisplay(obj) {
    obj.bus.on("postRender", null)
    setTimeout(() => {
      test.equal(
        obj.obj.dom.termfilterdiv.selectAll(".condition_btn").size(), 1,
        "should have 'IS' button for categorical filter"
      )
      test.equal(
        obj.obj.dom.termfilterdiv.selectAll(".add_value_btn").size(), 1,
        "should have '+' button to add category to filter"
      )
      test.end()
    },100)
  }
})