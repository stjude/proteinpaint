const app = require('../app')
const Partjson = require('./partjson')
const settings = {}
const pj = getPj(settings)

/*
********************** EXPORTED
handle_request_closure
********************** 
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    //if( app.reqbodyisinvalidjson(req,res) ) return
    const q = req.query

    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'

      //const ds_filtered = may_filter_samples( q, tdb, ds )

      // process triggers
      await barchart_data( q, ds, res )
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

async function barchart_data ( q, ds, res ) {
/*
summarize numbers to create barchar based on server config

if is a numeric term, also get distribution

*/
  // validate
  //if(!q.barchart.id) throw 'barchart.id missing'
  //const term = tdb.termjson.map.get( q.barchart.id )
  //if(!term) throw 'barchart.id is invalid'
  //if(!term.graph) throw 'graph is not available for said term'
  //if(!term.graph.barchart) throw 'graph.barchart is not available for said term'
  if(!ds.cohort) throw 'cohort missing from ds'
  const filename = 'files/hg38/sjlife/clinical/matrix'
  if(!ds.cohort['parsed-'+filename]) throw `the parsed cohort matrix=${filename} is missing`
  Object.assign(settings, q)
  pj.refresh({data: ds.cohort['parsed-' + filename]})
  res.send(pj.tree.results)
}

function getPj(settings) {
  return new Partjson({
    template: {
      "@join()": {
        vals: "=vals()"
      },
      results: {
        "_5:maxAcrossCharts": "=maxAcrossCharts()",
        "_4:charts": "@root.byTerm0.@values",
        refs: {
          //chartkey: "&vals.term0",
          "__:cols": "@root.term1vals",
          colgrps: ["-"], 
          rows: ["&vals.dataId"],
          rowgrps: ["-"],
          col2name: {
            "&vals.seriesId": {
              name: "&vals.seriesId",
              grp: "-"
            }
          },
          row2name: {
            "&vals.dataId": {
              name: "&vals.dataId",
              grp: "-"
            }
          }
        }
      },
      term1vals: ["&vals.seriesId"],
      byTerm0: {
        "&vals.chartId": {
          chartId: "&vals.chartId",
          total: "+1",
          "_3:maxGroupTotal": "=maxGroupTotal()",
          "_2:seriesgrps": "=seriesgrps()",
          byTerm1: {
            "&vals.seriesId": {
              total: "+1",
              "_1:serieses": "@.byTerm2.@values",
              byTerm2: {
                "&vals.dataId": {
                  chartId: "&vals.chartId",
                  seriesId: "&vals.seriesId",
                  dataId: "&vals.dataId",
                  total: "+1",
                  "__:groupTotal": "@parent.@parent.total"
                }
              }
            },
          },
          "@done()": "=cleanChartData()"
        }
      }
    },
    "=": {
      vals(row) {
        return {
          chartId: "" + settings.term0 ? row[settings.term0] : "",
          seriesId: row[settings.term1],
          dataId: "" + settings.term2 ? row[settings.term2] : ""
        }
      },
      seriesgrps(row, context) {
        const grps = Object.values(context.self.byTerm1).map(d=>d.serieses)
        // stacking of serieses will be sorted on the client side
        const orderedGrps = [];
        context.root.term1vals.forEach(seriesId => {
          const grp = grps.find(d => d[0].seriesId == seriesId); 
          orderedGrps.push(grp ? grp : [])
        })
        return orderedGrps
      },
      maxGroupTotal(row, context) {
        let maxGroupTotal = 0
        for(const grp of context.self.seriesgrps) {
          if (grp[0] && grp[0].groupTotal > maxGroupTotal) {
            maxGroupTotal = grp[0].groupTotal
          }
        }
        return maxGroupTotal
      },
      maxAcrossCharts(row, context) {
        let maxAcrossCharts = 0
        for(const chart of context.self.charts) {
          if (chart.maxGroupTotal > maxAcrossCharts) {
            maxAcrossCharts = chart.maxGroupTotal
          }
        }
        return maxAcrossCharts
      },
      cleanChartData(result) {
        // byTerm1 values will be stored in seriesgrps
        delete result.byTerm1
      }
    }
  })
}
