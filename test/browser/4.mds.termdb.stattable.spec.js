const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson

tape("\n", function(test) {
  test.pass("-***- mds.termdb.stattable -***-")
  test.end()
})

tape("barchart-dependent display", function (test) {
  const div0 = d3s.select('body').append('div')
  const termfilter = {show_top_ui:true, callbacks:[]}
  
  runproteinpaint({
    holder: div0.node(),
    noheader:1,
    nobox:true,
    display_termdb:{
      dslabel:'SJLife',
      genome:'hg38',
      default_rootterm:{},
      termfilter,
      params2restore: {
        term: termjson["agedx"],
        term2: termjson["diaggrp"],
        settings: {
          currViews: ['table']
        }
      },
      callbacks: {
        plot: {
          postRender: [postRender1]
        }
      }
    }
  })

  function postRender1(plot) {
    test.equal(
      plot.views.stattable.dom.div.style('display'), 
      'none', 
      "should have a HIDDEN stattable when the barchart is not in the settings.currViews array"
    )
    plot.callbacks.postRender = [postRender2]
    plot.dispatch({
      settings: {currViews: ["barchart"]}
    })
  }

  function postRender2(plot) {
    test.equal(
      plot.views.stattable.dom.div.style('display'), 
      'block', 
      "should have a visible stattable when the barchart is not in the settings.currViews array"
    )
    test.end()
  }
})

tape("term.isfloat-dependent display", function (test) {
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
    test.equal(
      plot.views.stattable.dom.div.style('display'), 
      'none', 
      "should have a HIDDEN stattable when plot.term.iscategorical"
    )
    plot.callbacks.postRender = [postRender2]
    plot.dispatch({
      term: {term: termjson["agedx"]}
    })
  }

  function postRender2(plot) {
    test.equal(
      plot.views.stattable.dom.div.style('display'), 
      'block', 
      "should have a visible stattable when plot.term is numeric"
    )
    plot.callbacks.postRender = [postRender3]
    plot.dispatch({
      term: {term: termjson["Arrhythmias"]}
    })
  }

  function postRender3(plot) {
    test.equal(
      plot.views.stattable.dom.div.style('display'), 
      'none', 
      "should have a HIDDEN stattable when plot.term.iscondition"
    )
    test.end()
  }
})


