const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
  test.pass("-***- mds.termdb.controls filter -***-")
  test.end()
})

tape("filter term-value button", function (test) {
    test.timeoutAfter(1000)
    test.plan(4)
    const div0 = d3s.select('body').append('div')
    const termfilter = {
        show_top_ui:true,
        terms: [{
            term: {id:'diaggrp', name: 'Diagnosis Group', iscategorical:true},
            values: [{key: 'Wilms tumor', label: 'Wilms tumor'}]
        }]
    }
    
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
        bar_click_menu:{
          add_filter:true
        },
        callbacks: {
          tree: {
            postRender: [testDisplay]
          }
        },
      }
    })
  
    function testDisplay(obj) {
        setTimeout(()=>{
            test.equal(obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),termfilter.terms[0].term.name, "should Filter term-name and plot clicked from be same")
            test.equal(obj.dom.termfilterdiv.selectAll('.value_btn').html().slice(0, -2),termfilter.terms[0].values[0].label, "should Filter value and label of bar clicked be same")
            test.true(obj.dom.termfilterdiv.selectAll('.add_value_btn').size()>=1,'should have \'+\' button to add category to filter')
            test.true(obj.dom.termfilterdiv.selectAll('.term_remove_btn').size()>=1,'should have \'x\' button to remove filter')
            test.end()
        }, 100)   
    }
})