const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape.only("cart button", function (test) {
  const div0 = d3s.select('body').append('div')
  const termfilter = {show_top_ui:true}
  
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
      selected_groups: [{
        term: {id:'diaggrp', iscategorical:true},
        values: [{key: "Wilms tumor", label: "Wilms tumor"}]
      }],
      bar_click_menu:{
        add_filter:true
      },
      callbacks: {
        tree: {
          postRender: [testDisplay/*, triggerClick, testSelectedGroupTipDisplay, triggerEmpty, testEmpty*/]
        }
      },
    }
  })

  function testDisplay(obj) {
    setTimeout(()=>{
      test.equal(obj.dom.cartdiv.html(), "Selected 1 Group", "should display a cart button")
      test.end()
    },300)
  }
})

tape("cart selected group tip", function (test) {
  test.fail("to-do")
  // click 
  // add, remove a filter to/from a group
})
