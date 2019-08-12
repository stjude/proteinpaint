const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson

tape("\n", function(test) {
  test.pass("-***- mds.termdb.barchart -***-")
  test.end()
})

tape("single barchart, no overlay", function (test) {
  const div0 = d3s.select('body').append('div')
  
  runproteinpaint({
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
        settings: {
          currViews: ['barchart']
        }
      },
      callbacks: {
        plot: {
          postRender: [postRender1]
        }
      },
    }
  })
  
  function postRender1(plot) {
    const numBars = plot.views.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
    const numOverlays = plot.views.barchart.dom.barDiv.selectAll('.bars-cell').size()
    test.true(numBars > 5,  "should have more than 10 Diagnosis Group bars")
    test.equal(numBars, numOverlays,  "should have equal numbers of bars and overlays")
    test.end()
  }
})

tape("single chart, with overlay", function (test) {
  const div0 = d3s.select('body').append('div')
  
  runproteinpaint({
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
        term2: termjson["agedx"],
        settings: {
          currViews: ['barchart']
        }
      },
      callbacks: {
        plot: {
          postRender: [postRender1]
        }
      },
    }
  })
  
  function postRender1(plot) {
    const numBars = plot.views.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
    const numOverlays = plot.views.barchart.dom.barDiv.selectAll('.bars-cell').size()
    const bars_grp = div0.selectAll('.bars-cell-grp')
    const legend_rows = div0.selectAll('.legend-row')
    let legend_color = []
    //get array of legend colors
    legend_rows.each((d)=>{
      legend_color.push(d.color)
    })

    //flag to indicate unordred bars
    let overlay_ordered = true

    //check if each stacked bar is in same order as legend
    bars_grp.each((d)=>{
      const bars_color = d.visibleData.map((d) => d.color)
      if(!comapare_arrays_order(legend_color, bars_color)){
        overlay_ordered = false
      }
    })

    test.true(numBars > 5,  "should have more than 10 Diagnosis Group bars")
    test.true(numOverlays > numBars,  "#overlays should be greater than #bars")
    // test the order of the overlay
    test.true(overlay_ordered,  "#overlays order is same as legend")
    test.end()
  }
})

function comapare_arrays_order(master,sub){
 const start_i = master.indexOf(master.find(e=>e==sub[0]))
 let same_order = undefined
 for(let [i,element] of sub.entries()){
   if(element != master[i+start_i]) {
     same_order = false
    break
   }else  same_order = true
 }
 return same_order
}