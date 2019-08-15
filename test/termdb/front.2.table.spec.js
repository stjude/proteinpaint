const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
  test.pass("-***- mds.termdb.table -***-")
  test.end()
})

tape("overlay-dependent display", function (test) {
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
        term: termjson["agedx"],
        settings: {
          currViews: ['table']
        }
      },
      callbacks: {
        plot: {
          postRender: [testHiddenTable, triggerViewTable]
        }
      },
    }
  })

  function testHiddenTable(plot) {
    test.equal(
      plot.views.table.dom.div.style('display'),
      'none', 
      "should be HIDDEN when there is no overlay"
    )
  }

  function triggerViewTable(plot) {
    plot.bus.on('postRender', testVisibleTable)
    plot.set({
      term2: {term: termjson["diaggrp"]},
      settings: {
        currViews: ['table']
      }
    })
  }

  function testVisibleTable(plot) {
    test.equal(
      plot.views.table.dom.div.style('display'), 
      'inline-block', 
      "should be visible when there is an overlay"
    )
    test.end()
  }
})


