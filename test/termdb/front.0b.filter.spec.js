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
	test.timeoutAfter(3000)
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
			callbacks: {
				tree: {
					postRender: [testFilterDisplay, triggerFilterRemove]
				}
			}
		}
	})

	function testFilterDisplay(obj) {
    obj.bus.on("postRender", null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".term_name_btn").html(),
        termfilter.terms[0].term.name,
        "should Filter term-name and plot clicked from runpp() be same"
      )
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").html().slice(0, -2),
        termfilter.terms[0].values[0].label,
        "should Filter value and value supplied from runpp() be same"
      )
      test.true(
        obj.dom.termfilterdiv.selectAll(".term_remove_btn").size() >= 1,
        "should have 'x' button to remove filter"
      )
      test.true(
        obj.dom.termfilterdiv.selectAll(".add_term_btn").size() >= 1,
        "should have '+' button to add new term filter"
      )
    }, 100)
	}

	function triggerFilterRemove(obj) {
		obj.bus.on("postRender", [testFilterRemove,triggerFilterAdd])
		setTimeout(() => obj.dom.termfilterdiv
			.selectAll(".term_remove_btn")
			.node()
			.click(), 400)
	}

	function testFilterRemove(obj) {
		test.equal(obj.dom.termfilterdiv.selectAll(".term_name_btn").size(), termfilter.terms.length, "should remove tvs filter after clicking 'x'")
  }
  
  function triggerFilterAdd(obj){
    obj.bus.on("postRender", testAddTerm)
    termfilter.terms[0] = {
      term: { id: "diaggrp", name: "Diagnosis Group", iscategorical: true },
      values: [{ key: "Acute lymphoblastic leukemia", label: "Acute lymphoblastic leukemia" }]
    }
    setTimeout(() => obj.main(), 200)
  } 

  function testAddTerm(obj) {
		test.equal(obj.dom.termfilterdiv.selectAll(".term_name_btn").size(), termfilter.terms.length, "should add filter from data")
		obj.tip.hide()
		test.end()
	}
})

tape("filter term-value button: categorical term", function(test) {
	test.timeoutAfter(3000)
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
			callbacks: {
				tree: {
					postRender: [testFilterDisplay, triggerChangeNegation ,triggerAddCategory, triggerRemoveCategory]
				}
			}
		}
	})

  function testFilterDisplay(obj) {
    obj.bus.on("postRender", null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".condition_btn").size(), 1,
        "should have negation button for categorical filter"
      )
      test.equal(
        obj.dom.termfilterdiv.selectAll(".condition_btn").html(), "IS",
        "should have 'IS' for negation button for categorical filter"
      )
      test.equal(
        obj.dom.termfilterdiv.selectAll(".add_value_btn").size(), 1,
        "should have '+' button to add category to filter"
      )
    },100)
  }

  function triggerChangeNegation(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkNegationBtnVal)
      obj.termfilter.terms[0].isnot = true
      obj.main()
    }, 200)
  }

  function checkNegationBtnVal(obj){
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".condition_btn").html(), "IS NOT",
        "should have 'IS NOT' for negation button after change"
      )
    },300)
  }

  function triggerAddCategory(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkAddedCategory)
      obj.termfilter.terms[0].values[1] = { key: "Acute lymphoblastic leukemia", label: "Acute lymphoblastic leukemia" }
      obj.main()
    }, 400)
  }

  function checkAddedCategory(obj){
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").size(), 
        termfilter.terms[0].values.length, 
        "should add category from data"
      )
    },500)
  }

  function triggerRemoveCategory(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkRemovedCategory)
      obj.termfilter.terms[0].values.pop()
      obj.main()
    }, 600)
  }

  function checkRemovedCategory(obj){
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").size(), 
        termfilter.terms[0].values.length, 
        "should remove category from data"
      )
      test.end()
    },700)
  }
})

tape("filter term-value button: Numerical term", function(test) {
	test.timeoutAfter(4000)
	test.plan(6)
	const div0 = d3s.select("body").append("div")
	const termfilter = {
		show_top_ui: true,
		terms: [
      {
        term: { id: "aaclassic_5", name: "Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)", unit: "mg/m²", isfloat: true },
        ranges: [{ stopinclusive: true, start: 1000, stop: 2000}]
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
			callbacks: {
				tree: {
					postRender: [testFilterDisplay, triggerchangeRange ,triggerAddUnannotatedRange, triggerRemoveRange]
				}
			}
		}
  })

  function testFilterDisplay(obj){
    obj.bus.on("postRender", null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".term_name_btn").html(),
        termfilter.terms[0].term.name,
        "should Filter btn and term-name from runpp() be same"
      )
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").html().split(" ")[0],
        termfilter.terms[0].ranges[0].start.toString(),
        "should have value button same as data"
      )
      test.true(
        obj.dom.termfilterdiv.selectAll(".add_value_btn").size() >= 1,
        "should have '+' button to add unannoated value to filter"
      )
    },100)
  }

  function triggerchangeRange(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkRangeBtn)
      obj.termfilter.terms[0].ranges[0] = { stopinclusive: true, start: 3000, stop: 4000}
      obj.main()
    }, 200)
  }

  function checkRangeBtn(obj){
    obj.bus.on("postRender",null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").html().split(" ")[0],
        termfilter.terms[0].ranges[0].start.toString(),
        "should have value button changed from data"
      )
    },300)
  }
  
  function triggerAddUnannotatedRange(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkUnannotatedValBtn)
      obj.termfilter.terms[0].ranges[1] = { is_unannotated:true, value:"-9999", label:"Unknown treatment record"}
      obj.main()
    }, 400)
  }

  function checkUnannotatedValBtn(obj){
    obj.bus.on("postRender",null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn")._groups[0][1].innerText,
        termfilter.terms[0].ranges[1].label,
        "should have unannotated value button added from data"
      )
    },600)
  }

  function triggerRemoveRange(obj){
    setTimeout(() => {
      obj.bus.on("postRender", checkRemovedRange)
      obj.termfilter.terms[0].ranges.pop()
      obj.main()
    }, 1200)
  }

  function checkRemovedRange(obj){
    obj.bus.on("postRender",null)
    setTimeout(() => {
      test.equal(
        obj.dom.termfilterdiv.selectAll(".value_btn").size(),
        termfilter.terms[0].ranges.length,
        "should remove value button altered by data"
      )
      test.end()
    },1400)
  }
})
