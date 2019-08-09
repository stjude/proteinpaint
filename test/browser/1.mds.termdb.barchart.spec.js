const tape = require("tape")
const d3s = require("d3-selection")

tape("\n", function(test) {
  test.pass("-***- mds.termdb.barchart -***-")
  test.end()
})

tape("one chart, no overlay", function (test) {
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
        view_type: 'barchart',
        term1: "Diagnosis Group",
        restoreDiv: div0
      }
    }
  })
  .then(() => {
    setTimeout(()=>{
      const numBars = div0.selectAll('.bars-cell-grp').size()
      const numOverlay = div0.selectAll('.bars-cell').size()
      test.true(numBars > 5,  "should have more than 5 Diagnosis Group bars")
      test.equal(numBars, numOverlay,  "should have equal number of bars and overlays")

      //test.equal(div0.selectAll('div').filter(function(){return this.innerHTML=="FILTER"}).size(), 1, "should have a FILTER input")
      //test.equal(div0.selectAll('.sja_menuoption').size(), 4, "should have the correct number of buttons")
      test.end()
    },1000)
  })
})


