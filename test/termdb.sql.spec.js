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
    "non-leaf condition filtered results, by maximum grade"
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
    "non-leaf condition filtered results, by most recent grade"
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
    "non-leaf condition filtered results by child"
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
  test.plan(6)

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
    "sample counts by diagnosis groups, numerical overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      conditionUnits: ["","","max_grade_perperson"],
      term2_q: {value_by_max_grade:1},
    },
    "sample counts by diagnosis groups, leaf condition overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      conditionUnits: ["","","most_recent_grade"],
      term2_q: {value_by_most_recent:1},
    },
    "sample counts by diagnosis groups, leaf condition overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      conditionUnits: ["","","most_recent_grade"],
      term2_q: {value_by_most_recent:1},
      filter: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"aaclassic_5", name:"alkaline dosage", isfloat:true},
        ranges: [{start:1000,stop:5000}]
      }]
    },
    "filtered sample counts by diagnosis groups, leaf condition overlay"
  )
})


tape("numerical term1", function (test) {
  test.plan(7)
  compareResponseData(
    test, 
    {term1: 'agedx'},
    "sample counts by age of diagnosis, no overlay"
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
    "filtered sample counts by age of diagnosis, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'diaggrp'
    },
    "sample counts by age of diagnosis, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'aaclassic_5'
    },
    "sample counts by age of diagnosis, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      conditionUnits: ["","","max_grade_perperson"],
      term2_q: {value_by_max_grade:1},
    },
    "sample counts by age of diagnosis, condition overlay by max grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      conditionUnits: ["","","most_recent_grade"],
      term2_q: {value_by_most_recent:1},
    },
    "sample counts by age of diagnosis, condition overlay by most recent grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      conditionUnits: ["","","most_recent_grade"],
      term2_q: {value_by_most_recent:1},
      filter: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"aaclassic_5", name:"alkaline dosage", isfloat:true},
        ranges: [{start:1000,stop:5000}]
      }]
    },
    "sample counts by age of diagnosis, condition overlay by most recent grade"
  )
})

tape("leaf condition term1", function (test) {
  test.plan(10) 
  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Asthma condition max-grade, no overlay"
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
    "filtered sample counts by Asthma condition max-grade, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1}
    },
    "sample counts by Asthma condition most recent grade, no overlay"
  )
 
  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1},
      term2: 'sex'
    },
    "sample counts by Asthma condition max grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1},
      term2: 'diaggrp'
    },
    "sample counts by Asthma condition most recent grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1},
      term2: 'agedx'
    },
    "sample counts by Asthma condition max grade, numerical overlay" 
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1},
      term2: 'aaclassic_5'
    },
    "sample counts by Asthma condition most recent grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","max_grade_perperson","max_grade_perperson"], 
      term1_q: {value_by_max_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1}
    },
    "sample counts by Asthma condition max grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","most_recent_grade","max_grade_perperson"], 
      term1_q: {value_by_most_recent:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1}
    },
    "sample counts by Asthma condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      conditionUnits: ["","most_recent_grade","max_grade_perperson"], 
      term1_q: {value_by_most_recent:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1},
      filter: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:8}]
      }]
    },
    "filtered sample counts by Asthma condition most recent grade, condition overlay by max-grade"
  )
})

tape("non-leaf condition term1", function (test) {
  test.plan(12) 

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System', 
      conditionParents: ["","Cardiovascular System",""],
      conditionUnits: ["","max_grade_perperson",""],
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Cardiovascular System condition max-grade, no overlay"
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
    "filtered sample counts by Cardiovascular System condition max-grade, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System', 
      conditionParents: ["","Cardiovascular System",""],
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
    },
    "sample counts by Cardiovascular System condition most recent grade, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Arrhythmias', 
      conditionParents: ["","Arrhythmias",""],
      conditionUnits: ["","by_children",""], 
      term1_q: {value_by_max_grade:1, bar_by_children:1},
    },
    "sample counts by Arrhythmias condition by children, no overlay"
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
    "sample counts by Arrhythmias condition by children, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'sex'
    },
    "sample counts by Arrhythmias condition max grade, categorical overlay",
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'diaggrp'
    },
    "sample counts by Arrhythmias condition most recent grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","max_grade_perperson",""], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'agedx'
    },
    "sample counts by Arrhythmias condition max grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","most_recent_grade",""], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'aaclassic_5'
    },
    "sample counts by Arrhythmias condition most recent grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","max_grade_perperson","max_grade_perperson"], 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1}
    },
    "sample counts by Arrhythmias condition max grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","most_recent_grade","max_grade_perperson"], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1}
    },
    "sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      conditionUnits: ["","most_recent_grade","max_grade_perperson"], 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1},
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
    "filtered sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade"
  )
})


function compareResponseData(test, params, mssg) {
  // i=series start, j=series end, k=chart index
  // for debugging result data, set i < j to slice chart.serieses
  const i=0, j=0, k=0;
  const url0 = getSqlUrl(params);
  if (i!==j) console.log(url0)

  request(url0, (error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
      case 200:
        const data0 = JSON.parse(body);
        // reshape sql results in order to match
        // the compared results
        let charts
        if (process.argv[3]) {
          charts = data0.charts
        } else {
          const pj = new Partjson({
            data: data0.lst,
            seed: `{"values": []}`, // result seed 
            template,
            "=": externals
          })
          charts = pj.tree.results.charts
        } 
        const summary0 = normalizeCharts(charts, data0)
        
        // get an alternatively computed results
        // for comparing against sql results
        const url1 = getBarUrl(params);
        if (i!==j) console.log(url1)

        request(url1, (error,response,body1)=>{
          const data1 = JSON.parse(body1)
          const summary1 = normalizeCharts(data1.charts, data1)
          const sqlSummary = i !== j ? summary0.charts[k].serieses.slice(i,j) : summary0
          const barSummary = i !== j ? summary1.charts[k].serieses.slice(i,j) : summary1
          if (i!==j) console.log(JSON.stringify(sqlSummary),'\n','-----','\n',JSON.stringify(barSummary))

          if(error) {
            test.fail(error)
          }
          switch(response.statusCode) {
          case 200:
            test.deepEqual(
              sqlSummary,
              barSummary,
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

const sqlBasePath = process.argv[3] ? process.argv[3] : '/termdb?&testplot=1'

function getSqlUrl(params) {
  return "http://localhost:" + serverconfig.port
    + sqlBasePath
    + "&genome=hg38"
    + "&dslabel=SJLife"
    + '&term1_id=' + params.term1
    + (params.term1_q ? '&term1_q=' + encodeURIComponent(JSON.stringify(params.term1_q)) : '')
    + (params.term2 ? '&term2_id=' + params.term2 : '')
    + (params.term2_q ? '&term2_q=' + encodeURIComponent(JSON.stringify(params.term2_q)) : '')
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
        boxplot: "$summary_term2",
        data: [{
          dataId: "@key",
          total: "&data.value",
        }, "&data.id"],
      }, "&series.id"]
    }, "&chart.id"],
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

function normalizeCharts(charts, data) {
  charts.forEach(onlyComparableChartKeys)
  sortResults(charts)
  const summary = {charts}
  
  if (data.boxplot) {
    summary.boxplot = data.boxplot
    summary.boxplot.mean = summary.boxplot.mean.toPrecision(8)
    if (summary.boxplot.sd) {
      summary.boxplot.sd = summary.boxplot.sd.toPrecision(8)
    }
  }
  for(const chart of summary.charts) {
    for(const series of chart.serieses) {
      if (series.boxplot && series.boxplot.mean) {
        series.boxplot.mean = series.boxplot.mean.toPrecision(8)
        if (series.boxplot.sd) {
          series.boxplot.sd = series.boxplot.sd.toPrecision(8)
        }
      }
    }
  }

  if (data.summary_term1) {
    summary.boxplot = data.summary_term1
    summary.boxplot.mean = summary.boxplot.mean.toPrecision(8)
    if (summary.boxplot.sd) {
      summary.boxplot.sd = summary.boxplot.sd.toPrecision(8)
    }
  }
  if (data.summary_term2) {
    for(const chart of summary.charts) {
      for(const series of chart.serieses) {
        if (data.summary_term2[series.seriesId]) {
          series.boxplot = data.summary_term2[series.seriesId]
          series.boxplot.mean = series.boxplot.mean.toPrecision(8)
          if (series.boxplot.sd) {
            series.boxplot.sd = series.boxplot.sd.toPrecision(8)
          }
        }
      }
    }
  }

  return summary
}

function onlyComparableChartKeys(chart) {
  delete chart.total
  chart.serieses.forEach(onlyComparableSeriesKeys)
}

function onlyComparableSeriesKeys(series) {
  delete series.max
  delete series.summaryByDataId
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

function chartSorter(a,b) {
  return a.chartId < b.chartId ? -1 : 1
}

function seriesSorter(a,b) {
  return a.seriesId < b.seriesId ? -1 : 1
}

function dataSorter(a,b) {
  return a.dataId < b.dataId ? -1 : 1
}

