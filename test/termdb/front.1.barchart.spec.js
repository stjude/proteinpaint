const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
  test.pass("-***- mds.termdb.barchart -***-")
  test.end()
})

tape("single barchart, no overlay", function (test) {
  const div0 = d3s.select('body').append('div')
  const termfilter = {show_top_ui:true, callbacks:[]}
  
  runproteinpaint({
    host,
    holder: div0.node(),
    noheader:1,
    nobox:true,
    display_termdb:{
      dslabel:'SJLife',
      genome:'hg38',
      default_rootterm:{},
      termfilter,
      params2restore: {
        term: termjson["diaggrp"],
        settings: {
          currViews: ['barchart']
        }
      },
      callbacks: {
        plot: {
          postRender: [testBarCount, triggerBarClick]
        }
      },
      bar_click_menu:{
        add_filter:true
      },
    }
  })

  function testBarCount(plot) {
    const numBars = plot.views.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
    const numOverlays = plot.views.barchart.dom.barDiv.selectAll('.bars-cell').size()
    test.true(numBars > 5,  "should have more than 10 Diagnosis Group bars")
    test.equal(numBars, numOverlays,  "should have equal numbers of bars and overlays")
  }

  function triggerBarClick(plot) {
    plot.callbacks.postRender = [testCategoricalTermValue]
    plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').node().dispatchEvent(new Event('click', {bubbles: true}));
    setTimeout(()=>{
      plot.obj.tip.d.select('.sja_menuoption').node().dispatchEvent(new Event('click', {bubbles: true}))
    },500);
  }

  function testCategoricalTermValue(plot) {
    test.equal(termfilter.terms && termfilter.terms.length, 1, "should create a tvslst filter when a bar is clicked")
    const data = plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').datum()
    test.deepEqual(
      termfilter.terms, 
      [{
        term: plot.term,
        values: [{
          key: data.seriesId,
          label: data.seriesId
        }]
      }], 
      "should assign the correct clicked bar {key, label} as a categorical filter term-value"
    )
    termfilter.terms.length = 0
    test.end()
  }
})

tape("single chart, with overlay", function (test) {
  const div0 = d3s.select('body').append('div')
  const termfilter = {show_top_ui:true, callbacks:[]}
  
  runproteinpaint({
    host,
    holder: div0.node(),
    noheader:1,
    nobox:true,
    display_termdb:{
      dslabel:'SJLife',
      genome:'hg38',
      default_rootterm:{},
      termfilter,
      params2restore: {
        term: termjson["diaggrp"],
        term2: termjson["agedx"],
        settings: {
          currViews: ['barchart']
        }
      },
      callbacks: {
        plot: {
          postRender: [testBarCount, testOverlayOrder, triggerNumericTermClick]
        }
      },
      bar_click_menu:{
        add_filter:true
      },
    }
  })
  
  function testBarCount(plot) {
    const numBars = plot.views.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
    const numOverlays = plot.views.barchart.dom.barDiv.selectAll('.bars-cell').size()
    test.true(numBars > 10, "should have more than 10 Diagnosis Group bars")
    test.true(numOverlays > numBars,  "number of overlays should be greater than bars")
  }

  function testOverlayOrder(plot) {
    const bars_grp = plot.views.barchart.dom.barDiv.selectAll('.bars-cell-grp')
    const legend_rows = plot.views.barchart.dom.barDiv.selectAll('.legend-row')
    //flag to indicate unordered bars
    let overlay_ordered = true
    const legend_ids = []
    legend_rows.each((d)=>legend_ids.push(d.dataId))
    //check if each stacked bar is in same order as legend
    bars_grp.each((d)=>{
      if (!overlay_ordered) return
      const bar_ids = d.visibleData.map((d) => d.dataId)
      overlay_ordered = legend_ids
        .filter(id=>bar_ids.includes(id))
        .reduce((bool,id,i)=>bool && bar_ids[i] === id, overlay_ordered)
    })
    test.true(overlay_ordered,  "overlays order is same as legend")
  }

  function triggerNumericTermClick(plot) {
    plot.callbacks.postRender = [testNumericTermValue, triggerConditionTermOverlay]
    plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').node().dispatchEvent(new Event('click', {bubbles: true}));
    setTimeout(()=>{
      plot.obj.tip.d.select('.sja_menuoption').node().dispatchEvent(new Event('click', {bubbles: true}))
    },500);
  }

  function testNumericTermValue(plot) {
    test.equal(termfilter.terms && termfilter.terms.length, 2, "should create two tvslst filters when a numeric term overlay is clicked")
    const data = plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').datum()
    test.deepEqual(
      termfilter.terms, 
      [{
        term: plot.term,
        values: [{
          key: data.seriesId,
          label: data.seriesId
        }]
      },{
        term: plot.term2,
        ranges: [plot.term2.bins.find(d=>d.label == data.dataId)]
      }], 
      "should assign the correct clicked bar {key, label} as a numeric term-value filter term-value"
    )
  }

  function triggerConditionTermOverlay(plot) {
    termfilter.terms.length = 0
    plot.callbacks.postRender = [triggerConditionTermClick]
    plot.dispatch({
      term2: {term: termjson["Arrhythmias"]}
    })
  }

  function triggerConditionTermClick(plot) {
    plot.callbacks.postRender = [conditionTermValue]
    plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').node().dispatchEvent(new Event('click', {bubbles: true}));
    setTimeout(()=>{
      plot.obj.tip.d.select('.sja_menuoption').node().dispatchEvent(new Event('click', {bubbles: true}))
    },500);
  }

  function conditionTermValue(plot) {
    test.equal(termfilter.terms && termfilter.terms.length, 2, "should create two tvslst filters when an overlay is clicked")
    const data = plot.views.barchart.dom.barDiv.select('.bars-cell').select('rect').datum()
    test.deepEqual(
      termfilter.terms, 
      [{
        term: plot.term,
        values: [{
          key: data.seriesId,
          label: data.seriesId
        }]
      },Object.assign({
        term: plot.term2,
        values: [{ key: 1, label: '1: Mild' }]
      }, plot.term2.q)], 
      "should assign the correct clicked bar {key, label} as a condition term-value filter term-value"
    )
    termfilter.terms.length = 0
    test.end()
  }
})

tape("multiple charts", function (test) {
  const div0 = d3s.select('body').append('div')
  
  runproteinpaint({
    host,
    holder: div0.node(),
    noheader:1,
    nobox:true,
    display_termdb:{
      dslabel:'SJLife',
      genome:'hg38',
      default_rootterm:{},
      termfilter:{show_top_ui:false},
      params2restore: {
        term: termjson["diaggrp"],
        term0: termjson["agedx"],
        settings: {
          currViews: ['barchart']
        }
      },
      callbacks: {
        plot: {
          postRender: [countCharts]
        }
      },
    }
  })
  
  function countCharts(plot) {
    const numCharts = plot.views.barchart.dom.barDiv.selectAll('.pp-sbar-div').size()
    test.true(numCharts > 2, "should have more than 2 charts by Age at Cancer Diagnosis")
    test.end()
  }
})
