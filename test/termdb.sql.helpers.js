const serverconfig = require("../serverconfig")
const Partjson = require('../modules/partjson')
const request = require("request")
const tape = require("tape")

function compareResponseData(test, params, mssg) {
  // i=series start, j=series end, k=chart index
  // for debugging result data, set i < j to slice chart.serieses
  const i=0, j=0, k=0, l=0, refkey='';
  const url0 = getSqlUrl(params); //console.log(url0)

  request(url0, (error,response,body)=>{
    if(error) {
      console.log(url0)
      test.fail(error)
    }
    if (!body) test.fail("empty response for barsql at :" + url0)
    else if (body.includes("error")) test.fail(body)
    else {
      switch(response.statusCode) {
        case 200:
          const data0 = JSON.parse(body);
          // reshape sql results in order to match
          // the compared results
          let dataCharts
          if (process.argv[3]) {
            dataCharts = data0
          } else {
            const pj = new Partjson({
              data: data0.lst,
              seed: `{"values": []}`, // result seed 
              template,
              "=": externals
            })
            dataCharts = pj.tree.results
          } 
          const summary0 = normalizeCharts(data0)
          
          // get an alternatively computed results
          // for comparing against sql results
          const url1 = getBarUrl(params); //console.log(url1)

          request(url1, (error,response,body1)=>{
            if(error) {
              console.log(url1)
              test.fail(error)
              return
            }
            if (!body) test.fail("empty response for barchart at :" + url1)
            else if (body.includes("error")) test.fail(body)
            else {
              const data1 = JSON.parse(body1)
              const summary1 = normalizeCharts(data1, data0.refs)
              const sqlSummary = refkey == '*' 
                ? summary0.refs
                : refkey
                ? summary0.refs[refkey]
                : k == -1
                ? summary0
                ? k !== l
                : summary0.charts.slice(k,l)
                : i !== j 
                ? summary0.charts[k].serieses.slice(i,j) 
                : summary0
              const barSummary = refkey == '*' 
                ? summary1.refs
                : refkey
                ? summary1.refs[refkey]
                : k == -1
                ? summary1
                ? k !== l
                : summary1.charts.slice(k,l)
                : i !== j 
                ? summary1.charts[k].serieses.slice(i,j) 
                : summary1

              switch(response.statusCode) {
              case 200:
                const extra = k == -1 || i!==j || refkey
                  ? '\n\n' + url0 +'\n----\n' + url1 + '\n' + JSON.stringify(sqlSummary) + '\n-----\n' + JSON.stringify(barSummary) 
                  : ''
                test.deepEqual(
                  sqlSummary,
                  barSummary,
                  mssg + extra
                )
              break;
              default:
                console.log(url1)
                test.fail("invalid status")
              }
            }
          })
          break;
        default:
          console.log(url0)
          test.fail("invalid status")
      }
    }
  })
}

exports.compareResponseData = compareResponseData

const sqlBasePath = process.argv[3] ? process.argv[3] : '/termdb?&testplot=1'
const sqlParamsReformat = {
  rename: {
    term0: 'term0_id',
    term1: 'term1_id',
    term2: 'term2_id'
  },
  asis: [
    'term0_id', 'term0_is_genotype',
    'term1_id', 'term1_is_genotype',
    'term2_id', 'term2_is_genotype',
    'ssid', 'chr', 'pos', 'mname'
  ],
  json: ['term0_q', 'term1_q', 'term2_q', 'tvslst']
}

function getSqlUrl(_params={}) {
  const params = Object.assign({},_params)
  let url = "http://localhost:" + serverconfig.port
    + sqlBasePath
    + "&genome=hg38"
    + "&dslabel=SJLife"

  for(const key in params) {
    if(key in sqlParamsReformat.rename) {
      params[sqlParamsReformat.rename[key]] = params[key]
      delete params[key]
    }
  }
  for(const key in params) {
    if (sqlParamsReformat.json.includes(key)) {
      url += `&${key}=${encodeURIComponent(JSON.stringify(params[key]))}`
    } else if (sqlParamsReformat.asis.includes(key)) {
      url += `&${key}=${params[key]}`
    }
  }

  return url
}

const barParamsReformat = {
  asis: [
    'term0', 'term0_is_genotype',
    'term1', 'term1_is_genotype',
    'term2', 'term2_is_genotype',
    'ssid', 'chr', 'pos', 'mname'
  ],
  json: ['term0_q', 'term1_q', 'term2_q', 'tvslst']
}

function getBarUrl(_params) {
  const params = Object.assign({}, _params)
  let url = "http://localhost:" + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
  
  for(const key in params) {
    if (barParamsReformat.json.includes(key)) {
      url += `&${key}=${encodeURIComponent(JSON.stringify(params[key]))}`
    } else if (barParamsReformat.asis.includes(key)) {
      url += `&${key}=${params[key]}`
    }
  }
  return url
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

function normalizeCharts(data, comparedRefs=null) {
  const charts = data.charts
  if (!charts) {
    return {charts: [{serieses:[]}]}
  }

  charts.forEach(onlyComparableChartKeys)
  sortResults(charts)
  const reformattedRefs = normalizeRefs(data.refs, comparedRefs)
  if (reformattedRefs) data.refs = reformattedRefs
  const summary = {charts, refs: data.refs}
  
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

function normalizeRefs(refs, comparedRefs) {
  delete refs['@errors']
  delete refs.row2name['@errors']
  if (!refs.useColOrder) refs.cols.sort(valueSort)
  if (!refs.useRowOrder) refs.rows.sort(valueSort)

  // normalize the minor differences
  if (refs.bins) {
    for(const i in refs.bins) {
      refs.bins[i].forEach(bin => {
        if (bin.name) {
          if (!('label' in bin)) bin.label = bin.name
          delete bin.name
        }
        for(const key in bin) {
          if (bin[key] === true) {
            bin[key] = 1
          }
          if (bin[key] === false) {
            bin[key] = 0
          }
        }
      })
    }
  }

  // make it easier to manually inspect results by
  // matching the result key ordering in the json printout
  let obj
  if (comparedRefs) {
    obj = {}
    for(const key in comparedRefs) {
      if (!refs[key] || !comparedRefs[key]) {
        obj[key] = refs[key]
      } else if (Array.isArray(refs[key]) && Array.isArray(comparedRefs[key])) {
        obj[key] = refs[key]
        obj[key].sort(valueSort)
        comparedRefs[key].sort(valueSort)
      }
      else if (typeof refs[key] == 'object' && typeof comparedRefs[key] == 'object') {
        obj[key] = {}
        for(const subkey in comparedRefs[key]) { 
          obj[key][subkey] = refs[key][subkey]
        }
        for(const subkey in refs[key]) {
          if (!(key in obj[key])) obj[key][subkey] = refs[key][subkey]
        }
      } else {
        obj[key] = refs[key]
      }
    }
    for(const key in refs) {
      if (!(key in obj)) obj[key] = refs[key]
    }
  }
  return obj
}

function valueSort(a,b) {
  return a < b ? -1 : 1
}
