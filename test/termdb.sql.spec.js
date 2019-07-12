/*
  requires a running pp server
*/
const serverconfig = require("../serverconfig")
const Partjson = require('../modules/partjson')
const request = require("request")
const tape = require("tape")

/* helper functions are found below after the tests */

tape("\n", function(test) {
  test.pass("-***- termdb.sql specs -***-")
  test.end()
})

tape("filters", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(8)

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Male"}]
      }]
    }, 
    "categorically filtered results"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:5}]
      }]
    }, 
    "numerically filtered results"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:3, label: "3"}],
        value_by_max_grade: true
      }]
    }, 
    "leaf condition filtered results, by maximum grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_most_recent: true
      }]
    }, 
    "leaf condition filtered results, by most recent grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_max_grade: true
      }],
    }, 
    "non-leaf condition filtered results, by maximum grade",
    results => results.forEach(result => delete result.total)
  )
 
  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_most_recent: true
      }],
    }, 
    "non-leaf condition filtered results, by most recent grade",
    results => results.forEach(result => delete result.total)
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_children: true,
        values: [{key:'Cardiac dysrhythmia', label: "Cardiac dysrhythmia"}]
      }],
    }, 
    "non-leaf condition filtered results by child",
    results => results.forEach(result => delete result.total)
  )
 
  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      filter: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:8}]
      },{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:3, label: "3"}],
        value_by_max_grade: true
      }]
    }, 
    "combined filtered results"
  )
})

tape("categorical term1", function (test) {
  test.plan(3)

  compareResponseData(
    test, 
    {term1: 'diaggrp'}, 
    "sample counts by diagnosis groups, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'sex'
    },
    "sample counts by diagnosis groups, categorical overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'agedx'
    },
    "sample counts by diagnosis groups, numerical overlay",
    results => results.forEach(result => {
      delete result.total
      result.serieses.forEach(series=>delete series.boxplot)
    })
  )
  /*
  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      conditionUnits: ["","","max_grade_perperson"],
      term2_q: {value_by_max_grade:1},
    },
    "sample counts by diagnosis groups, leaf condition overlay",
    results => results.forEach(result => delete result.total)
  )*/
})


tape("single, numerical", function (test) {
  test.plan(2)
  compareResponseData(
    test, 
    {term1: 'agedx'},
    "unfiltered sample counts by age of diagnosis"
  )
  
  compareResponseData(
    test,
    {
      term1: 'agedx', 
      filter: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Female', label: 'Female'}]
      }]
    },
    "filtered sample counts by age of diagnosis"
  )
})

tape("single, condition isleaf", function (test) {
  test.plan(3) 
  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "unfiltered sample counts by Asthma condition max-grade"
  )

  compareResponseData(
    test,
    { 
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1},
      filter: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Asthma condition max-grade"
  )

  compareResponseData(
    test, 
    {term1: 'Asthma', conditionUnits: ["","most_recent_grade",""], term1_q: {value_by_most_recent:1}},
    "unfiltered sample counts by Asthma condition most recent grade",
    // TO-DO: SQL results must also give unique samplecount across all bars 
    results => results.forEach(result => delete result.total) 
  )
})

tape("single, condition non-leaf", function (test) {
  test.plan(5)
  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System', 
      conditionParents: ["","Cardiovascular System",""],
      conditionUnits: ["","max_grade_perperson",""],
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "unfiltered sample counts by Cardiovascular System condition max-grade"
  )

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System',
      conditionParents: ["","Cardiovascular System",""],
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      filter: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Cardiovascular System condition max-grade"
  )

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System', 
      conditionParents: ["","Cardiovascular System",""],
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
    },
    "unfiltered sample counts by Cardiovascular System condition most recent grade",
    // TO-DO: SQL results must also give unique samplecount across all bars 
    results => results.forEach(result => delete result.total)
  )

  compareResponseData(
    test,
    {
      term1: 'Arrhythmias', 
      conditionParents: ["","Arrhythmias",""],
      conditionUnits: ["","by_children",""], 
      term1_q: {value_by_max_grade:1, bar_by_children:1},
    },
    "unfiltered sample counts by Arrhythmias condition by children",
    // TO-DO: SQL results must also give unique samplecount across all bars 
    results => results.forEach(result => delete result.total)
  )

  compareResponseData(
    test,
    {
      term1: 'Arrhythmias', 
      conditionParents: ["","Arrhythmias",""],
      conditionUnits: ["","by_children",""], 
      term1_q: {value_by_max_grade:1, bar_by_children:1},
      filter: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Arrhythmias condition by children",
    // TO-DO: SQL results must also give unique samplecount across all bars 
    results => results.forEach(result => delete result.total)
  )
})


function compareResponseData(test, params, mssg, postFxn=()=>{}) {
  const url0 = getSqlUrl(params); //console.log(url0)

  request(url0, (error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
      case 200:
        const data = JSON.parse(body);
        // reshape sql results in order to match
        // the compared results
        const pj = new Partjson({
          data: data.lst,
          seed: `{"values": []}`, // result seed 
          template,
          "=": externals
        })
        postFxn(pj.tree.results.charts)
        sortResults(pj.tree.results.charts)
        // get an alternatively computed results
        // for comparing against sql results
        const url1 = getBarUrl(params); //console.log(url1)
        request(url1, (error,response,body1)=>{
          const data1 = JSON.parse(body1)
          postFxn(data1.charts)
          sortResults(data1.charts)
          //console.log(JSON.stringify(data1.charts[0]));
          //console.log('----')
          //console.log(JSON.stringify(pj.tree.results.charts[0]));

          if(error) {
            test.fail(error)
          }
          switch(response.statusCode) {
          case 200:
            test.deepEqual(
              pj.tree.results.charts,
              data1.charts,
              mssg
            )
          break;
          default:
            test.fail("invalid status")
          }
        })
        break;
      default:
        test.fail("invalid status")
    }
  })
}

function getSqlUrl(params) {
  return "http://localhost:" + serverconfig.port
    + "/termdb?genome=hg38"
    + "&dslabel=SJLife"
    + "&testplot=1"
    + '&term1_id=' + params.term1
    + (params.term1_q ? '&term1_q=' + encodeURIComponent(JSON.stringify(params.term1_q)) : '')
    + (params.term2 ? '&term2_id=' + params.term2 : '')
    + (params.filter ? '&tvslst='+encodeURIComponent(JSON.stringify(params.filter)) : '')
}

function getBarUrl(params) {
  return "http://localhost:" + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
    + "&term1=" + params.term1
    + (params.term2 ? "&term2=" + params.term2 : '')
    + (params.conditionUnits ? "&conditionUnits=" + params.conditionUnits.join("-,-") : '')
    + (params.conditionParents ? "&conditionParents=" + params.conditionParents.join("-,-") : '')
    + "&filter=" + encodeURIComponent(JSON.stringify(params.filter ? params.filter : []))
    + "&custom_bins=" + encodeURIComponent(JSON.stringify(params.customBins ? params.customBins : {}))
}

const template = JSON.stringify({
  "@errmode": ["","","",""],
  results: {
    "@join()": {
      chart: "=chart()"
    },
    charts: [{
      "@join()": {
        series: "=series()"
      },
      chartId: "@key",
      total: "+&chart.value",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        "@join()": {
          data: "=data()"
        },
        total: "+&series.value",
        seriesId: "@key",
        data: [{
          dataId: "@key",
          total: "&data.value",
        }, "&data.id"],
      }, "&series.id"]
    }, "&chart.id"],
    "__:boxplot": "=boxplot1()",
    "_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    }
  }
})

const externals = {
  chart(row) {
    return {
      id: "",
      value: row.samplecount
    } 
  },
  series(row) {
    return {
      id: 'key1' in row ? row.key1 : row.key,
      value: row.samplecount
    } 
  },
  data(row) {
    return {
      id: 'key2' in row ? row.key2 : '',
      value: row.samplecount
    } 
  },
  maxSeriesTotal(row, context) {
    let maxSeriesTotal = 0
    for(const grp of context.self.serieses) {
      if (grp && grp.total > maxSeriesTotal) {
        maxSeriesTotal = grp.total
      }
    }
    return maxSeriesTotal
  }
}

function chartSorter(a,b) {
  return a.chartId < b.chartId ? -1 : 1
}

function seriesSorter(a,b) {
  return a.seriesId < b.seriesId ? -1 : 1
}

function dataSorter(a,b) {
  return a.dataId < b.dataId ? -1 : 1
}

function sortResults(charts) {
  charts.sort(chartSorter)
  for(const chart of charts) {
    chart.serieses.sort(seriesSorter)
    for(const series of chart.serieses) {
      series.data.sort(dataSorter)
    }
  }
}

