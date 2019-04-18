const app = require('../app')
const Partjson = require('./partjson')

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
  const pj = getPj(q)
  pj.refresh({data: ds.cohort['parsed-' + filename]})
  res.send(pj.tree.results.charts)
}

function getPj(settings) {
  return new Partjson({
    template: {
      "@join()": {
        vals: "=vals()"
      },
      results: {
        "_5:maxAcrossCharts": "=maxAcrossCharts()",
        "_4:charts": "@root.byTerm0.@values"
      },
      term1vals: ["&vals.term1"],
      byTerm0: {
        "&vals.term0": {
          chartId: "&vals.term0",
          count: "+1",
          "_6:maxAcrossCharts": "@root.results.maxAcrossCharts",
          "_3:maxGroupTotal": "=maxGroupTotal()",
          "_2:seriesgrps": "=seriesgrps()",
          byTerm1: {
            "&vals.term1": {
              count: "+1",
              "_1:serieses": "@.byTerm2.@values",
              byTerm2: {
                "&vals.term2": {
                  term1: "&vals.term1",
                  term2: "&vals.term2",
                  count: "+1",
                  total: "+1",
                  seriesId: "=seriesId()",
                  "__:groupTotal": "@parent.@parent.count",
                  "_4:maxGroupTotal": "@parent.@parent.maxGroupTotal",
                  scaleId: "&vals.term1",
                  chartId: "&vals.term0"
                }
              }
            },
          },
          settings: {
            //chartkey: "&vals.term0",
            scale: "byChart",
            serieskey: "seriesId",
            colkey: "term1",
            rowkey: "term2",
            "__:cols": "@root.term1vals",
            colgrps: ["-"], 
            rows: ["&vals.term2"],
            rowgrps: ["-"],
            col2name: {
              "&vals.term1": {
                name: "&vals.term1",
                grp: "-"
              }
            },
            row2name: {
              "&vals.term2": {
                name: "&vals.term2",
                grp: "-"
              }
            },
            h: {},
            legendpadleft: 170,
            hidelegend: false,
            //"@done()": "=extendSettings()"
          }
        }
      }
    },
    "=": {
      seriesId(row) {
        return row[settings.term1] + ";;" + row[settings.term2]
      },
      vals(row) {
        return {
          term0: "" + settings.term0 ? row[settings.term0] : "",
          term1: row[settings.term1],
          term2: "" + settings.term2 ? row[settings.term2] : ""
        }
      },
      seriesgrps(row, context) {
        const grps = Object.values(context.self.byTerm1).map(d=>d.serieses)
        for(const series of grps) {
          const subarr = []
          let cumulative = 0
          for(const result of series) {
            subarr.push(result)
            cumulative += result.total
            result.lastTotal = cumulative
          }
        }
        const orderedGrps = [];
        context.root.term1vals.forEach(term1 => {
          const grp = grps.find(d => d[0].term1 == term1); 
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
      }
    }
  })
}
