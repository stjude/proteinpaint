const app = require('../app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const get_rows = require('./termdb.sql').get_rows

/*
********************** EXPORTED
handle_request_closure
**********************
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    const q = req.query
    if (q.custom_bins) {
      try {
        q.custom_bins = JSON.parse(decodeURIComponent(q.custom_bins))
      } catch(e) {
        app.log(req)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    } 
    if (q.filter) {
      try {
        q.filter = JSON.parse(decodeURIComponent(q.filter))
      } catch(e) {
        app.log(req)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    }
    app.log(req)
    if (!q.term0) q.term0 = ''
    if (!q.term2) q.term2 = ''
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'

      // process triggers
      await barchart_data( q, ds, res, tdb )
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

async function barchart_data ( q, ds, res, tdb ) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
*/
  if(!ds.cohort) throw 'cohort missing from ds'
  q.ds = ds
  // if(!ds.cohort.annorows) throw `cohort.annorows is missing`
  // request-specific variables
  const startTime = +(new Date())
  const rows = get_rows(q)
  const sqlDone = +(new Date())
  const inReqs = [getTrackers(), getTrackers(), getTrackers()]
  await setValFxns(q, inReqs, ds, tdb);
  const pj = getPj(q, inReqs, rows, tdb)
  if (pj.tree.results) {
    pj.tree.results.times = {
      sql: sqlDone - startTime,
      pj: pj.times,
    }
  }
  res.send(pj.tree.results)
}

function getTrackers() {
  return {
    joinFxns: {"": () => ""}, // keys are term0, term1, term2 names; ...
    numValFxns: {"": () => {}}, // ... if key == empty string then the term is not specified
    unannotated: "",
    orderedLabels: [],
    unannotatedLabels: [],
    bins: [],
    uncomputable_grades: {}
  }
}

// template for partjson, already stringified so that it does not 
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
  "@errmode": ["","","",""],
  "@before()": "=prep()",
  "_:_sum": "+$val1",
  "_:_values": ["$val1",0],
  results: {
    /*"@join()": {
      "chart": "=idVal()"
    },*/
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      /*"@join()": {
        "series": "=idVal()"
      },*/
      chartId: "@key",
      "~samples": ["$sample", "set"],
      "__:total": "=sampleCount()",
      count: "+1",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        /*"@join()": { 
          data: "=idVal()"
        },*/
        seriesId: "@key",
        "~samples": ["$sample", "set"],
        count: "+1",
        data: [{
          dataId: "@key",
          count: "+1",
          "~samples": ["$sample", "set"],
          "__:total": "=sampleCount()",
        }, "$key2"],
        "_:_max": "$val2", // needed by client-side boxplot renderer 
        "~values": ["$val2",0],
        "~sum": "+$val2",
        "__:total": "=sampleCount()",
        "__:boxplot": "=boxplot2()"
      }, "$key1"],
      "@done()": "=filterEmptySeries()"
    }, "$key0"],
    "__:boxplot": "=boxplot1()",
    /*"_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    },
    "_:_refs": {
      cols: ["&series.id[]"],
      colgrps: ["-"], 
      rows: ["&data.id[]"],
      rowgrps: ["-"],
      col2name: {
        "&series.id[]": {
          name: "@branch",
          grp: "-"
        }
      },
      row2name: {
        "&data.id[]": {
          name: "@branch",
          grp: "-"
        }
      },
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:unannotatedLabels": "=unannotatedLabels()",
      "__:bins": "=bins()",
      "__:grade_labels": "=grade_labels()",
      "@done()": "=sortColsRows()"
    }*/
  }
})

function getPj(q, inReqs, data, tdb) {
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
  const joinAliases = ["chart", "series", "data"]
  let j=0;
  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        if (isNaN(row.val0)) delete row.val0
        if (isNaN(row.val1)) delete row.val1
        if (isNaN(row.val2)) delete row.val2
        return true
      },
      sampleCount(row, context) {
        return context.self.count
      },
      // still needed to properly handle non-numeric values
      idVal(row, context, joinAlias) {
        const i = joinAliases.indexOf(joinAlias)
        const term = q['term' + i + '_id']
        const id = term && typeof inReqs[i].joinFxns[term] == 'function' 
          ? inReqs[i].joinFxns[term](row, context, joinAlias) 
          : row['key'+i]
        if (id === undefined) return
        const val = row['val' + i]
        return {
          id,
          value: isNaN(val) ? undefined : val
        }
      },
      hasIds(row, context) {
        const data = context.joins.get('data')
        if (!data || !data.id.length) return
        const series = context.joins.get('series')
        if (!series || !series.id.length) return
        const chart = context.joins.get('chart')
        if (!chart || !chart.id.length) return
        return 1
      },
      maxSeriesTotal(row, context) {
        let maxSeriesTotal = 0
        for(const grp of context.self.serieses) {
          if (grp && grp.total > maxSeriesTotal) {
            maxSeriesTotal = grp.total
          }
        }
        return maxSeriesTotal
      },
      maxAcrossCharts(row, context) {
        let maxAcrossCharts = 0
        for(const chart of context.self.charts) {
          if (chart.maxSeriesTotal > maxAcrossCharts) {
            maxAcrossCharts = chart.maxSeriesTotal
          }
        }
        return maxAcrossCharts
      },
      boxplot1(row, context) {
        if (!context.root.values) return;
        const values = context.root.values.filter(d => d !== null)
        if (!values.length) return
        values.sort((i,j)=> i - j )
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.root.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      boxplot2(row, context) {
        if (!context.self.values || !context.self.values.length) return;
        const values = context.self.values.filter(d => d !== null)
        if (!values.length) return
        values.sort((i,j)=> i - j )
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.self.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      filterEmptySeries(result) {
        const nonempty = result.serieses.filter(series=>series.total)
        result.serieses.splice(0, result.serieses.length, ...nonempty)
      },
      unannotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of series.id) {
          if (s === inReqs[1].unannotated.label) {
            total += 1
          }
        }
        return total
      },
      annotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of series.id) {
          if (s !== inReqs[1].unannotated.label) {
            total += 1
          }
        }
        return total
      },
      sortColsRows(result) {
        if (inReqs[1].orderedLabels.length) {
          const labels = inReqs[1].orderedLabels
          result.cols.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
        if (inReqs[2].orderedLabels.length) {
          const labels = inReqs[1].orderedLabels
          result.rows.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
      },
      useColOrder() {
        return inReqs[1].orderedLabels.length > 0
      },
      useRowOrder() {
        return inReqs[2].orderedLabels.length > 0
      },
      unannotatedLabels() {
        return {
          term1: inReqs[1].unannotatedLabels, 
          term2: inReqs[2].unannotatedLabels
        }
      },
      bins() {
        return {
          "0": inReqs[0].bins,
          "1": inReqs[1].bins,
          "2": inReqs[2].bins,
        }
      },
      grade_labels() {
        return q.conditionParents && tdb.patient_condition
          ? tdb.patient_condition.grade_labels
          : q.conditionUnits && (q.conditionUnits[0] || q.conditionUnits[1] || q.conditionUnits[2])
          ? tdb.patient_condition.grade_labels
          : undefined
      }
    }
  })
}


async function setValFxns(q, inReqs, ds, tdb) {
/*
  sets request-specific value and filter functions
  non-condition unannotated values will be processed but tracked separately
*/
  for(const i of [0, 1, 2]) {
    const inReq = inReqs[i]
    if (!inReq.orderedLabels) {
      inReq.orderedLabels = []
      inReq.unannotatedLabels = []
    }
    const termid = q['term' + i + '_id']
    if (termid == "genotype") {
      if (!q.ssid) throw `missing ssid for genotype`
      const [bySample, genotype2sample] = await load_genotype_by_sample(q.ssid)
      const skey = ds.cohort.samplenamekey
      inReq.joinFxns[key] = row => bySample[row[skey]]
    } else {
      const key = 'key' + i
      inReq.joinFxns[key] = row => row[key]
    }
  }
}


async function load_genotype_by_sample ( id ) {
/* id is the file name under cache/samples-by-genotype/
*/
  const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
  const bySample = Object.create(null)
  const genotype2sample = new Map()
  for(const line of text.split('\n')) {
    const [type, samplesStr] = line.split('\t')
    const samples = samplesStr.split(",")
    for(const sample of samples) {
      bySample[sample] = type
    }
  if( type=='Homozygous reference') {
      genotype2sample.set('href', new Set(samples))
  } else if( type=='Homozygous alternative') {
      genotype2sample.set('halt', new Set(samples))
  } else {
      genotype2sample.set('het', new Set(samples))
  }
  }
  return [bySample, genotype2sample]
}


function get_AF ( samples, chr, genotype2sample, ds ) {
/*
as configured by ds.track.vcf.termdb_bygenotype,
at genotype overlay of a barchart,
to show AF=? for each bar, based on the current variant

arguments:
- samples[]
  list of samples from a bar
- chr
  chromosome of the variant
- genotype2sample MAP
  k: het, href, halt
  v: set of samples
- ds{}
*/
  const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations

  let AC=0, AN=0

  if( afconfig.sex_chrs.has( chr ) ) {
    // sex chr
  for(const s of samples) {
    if( afconfig.male_samples.has( s )) {
      AN++
    if(!genotype2sample.href.has(s)) AC++
    } else {
      AN+=2
      if( genotype2sample.halt.has( s ) ) {
        AC+=2
      } else if(genotype2sample.het.has( s )) {
        AC++
        }
    }
  }
  } else {
    // autosome
  for(const s of samples) {
    AN+=2
    if( genotype2sample.halt.has( s ) ) {
      AC+=2
    } else if(genotype2sample.het.has( s )) {
      AC++
      }
  }
  }
  return AN==0 ? 0 : (AC/AN).toFixed(3)
}
