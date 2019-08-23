const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("cart button", function (test) {
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
        terms: [
          {
            term: {id:'diaggrp', name: "Diagnosis Group", iscategorical:true},
            values: [{key: "Wilms tumor", label: "Wilms tumor"}]
          }
        ]
      }],
      bar_click_menu:{
        add_filter:true
      },
      callbacks: {
        tree: {
          postRender: [testDisplay, triggerClick, triggerEmpty]
        }
      },
    }
  })

  function testDisplay(obj) {
    setTimeout(()=>{
      test.equal(obj.dom.cartdiv.html(), "Selected 1 Group", "should display a cart button")
    },100)
  }

  function triggerClick(obj){
    obj.bus.on('postRender', null)
    obj.dom.cartdiv.node().dispatchEvent(new Event('click', {bubbles: true}))
    setTimeout(()=>testSelectedGroupTipDisplay(obj), 200)
  }

  function testSelectedGroupTipDisplay(obj){
    test.true(obj.tip.d.selectAll('.sja_filter_tag_btn').size()>1, "should show blue-pill for selected group")
  }

  function triggerEmpty(obj){
    setTimeout(()=>{
      obj.tip.d.select('.remove_group_btn').node().dispatchEvent(new Event('click', {bubbles: true}))
      testEmpty(obj)
    },300)
  }

  function testEmpty(obj){
    test.equal(obj.dom.cartdiv.style('display'), 'none', 'Should remove the cart button')
    test.end()
  }
})

tape("cart selected group tip", function (test) {
  // click 
  // add, remove a filter to/from a group
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
        terms: [
          {
            term: {id:'diaggrp', name: "Diagnosis Group", iscategorical:true},
            values: [{key: "Wilms tumor", label: "Wilms tumor"}]
          }
        ]
      }],
      bar_click_menu:{
        add_filter:true
      },
      callbacks: {
        tree: {
          postRender: [triggerClick, triggerAddTerm]
        }
      },
    }
  })

  function triggerClick(obj){
    obj.bus.on('postRender', null)
    obj.dom.cartdiv.node().dispatchEvent(new Event('click', {bubbles: true}))
    setTimeout(()=>testSelectedGroupTipDisplay(obj), 100)
  }

  function testSelectedGroupTipDisplay(obj){
    test.equal(obj.tip.d.selectAll('.term_name_btn').size(),1, "should show 1 blue-pill for selected group")
    setTimeout(()=>{
      obj.tip.d.selectAll('.term_remove_btn').node().dispatchEvent(new Event('click', {bubbles: true}))
      testRemoveTerm(obj)
    }, 200)
  }

  function testRemoveTerm(obj){
    test.equal(obj.tip.d.selectAll('.term_name_btn').size(),0, "should remove blue-pill from the group")
  }

  function triggerAddTerm(obj){
    obj.bus.on('postRender', null)
    setTimeout(()=>obj.tip.d.selectAll('.add_term_btn').node().click(), 400)
    setTimeout(()=>obj.tvstip.d.selectAll('.sja_menuoption').node().click(), 450)
    setTimeout(()=>obj.tvstip.d.selectAll('.sja_menuoption')._groups[0][1].click(), 500)
    setTimeout(()=>obj.tvstip.d.selectAll('.sja_menuoption')._groups[0][2].click(), 550)
    setTimeout(()=>{
      const elem = obj.tvstip.d.select('.bars-cell').select('rect')
      elem.node().dispatchEvent(new Event('click', {bubbles: true}))
      testAddTerm(obj)
    }, 800)
  }

  function testAddTerm(obj){
    setTimeout(()=>{
      test.equal(obj.tip.d.selectAll('.term_name_btn').size(),1, "should add term button to cart")
      obj.tip.hide()
      test.end()
    },900)
  }
})
