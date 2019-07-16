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
  const pj = getPj(q, rows, tdb)
  if (pj.tree.results) {
    pj.tree.results.times = {
      sql: sqlDone - startTime,
      pj: pj.times,
    }
  }
  res.send(pj.tree.results)
}

// template for partjson, already stringified so that it does not 
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
  "@errmode": ["","","",""],
  "@before()": "=prep()",
  results: {
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      chartId: "@key",
      "~samples": ["$sample", "set"],
      "__:total": "=sampleCount()",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        seriesId: "@key",
        "~samples": ["$sample", "set"],
        data: [{
          dataId: "@key",
          "~samples": ["$sample", "set"],
          "__:total": "=sampleCount()",
        }, "$key2"],
        "_:_max": "$val2", // needed by client-side boxplot renderer 
        "~_:_values": ["$nval2",0],
        "~_:_sum": "+$nval2",
        "__:total": "=sampleCount()",
        "__:boxplot": "=boxplot()"
      }, "$key1"],
      "@done()": "=filterEmptySeries()"
    }, "$key0"],
    "~sum": "+$nval1",
    "~values": ["$nval1",0],
    "__:boxplot": "=boxplot()"
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

function getPj(q, data, tdb) { 
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
  const joinAliases = ["chart", "series", "data"]
  const term0isAnnoVal = getIsAnnoValFxn(q, tdb, 0) 
  const term1isAnnoVal = getIsAnnoValFxn(q, tdb, 1)
  const term2isAnnoVal = getIsAnnoValFxn(q, tdb, 2)

  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        if (term0isAnnoVal(row.val0)) row.nval0 = row.val0 
        if (term1isAnnoVal(row.val1)) row.nval1 = row.val1
        if (term2isAnnoVal(row.val2)) row.nval2 = row.val2
        return true
      },
      sampleCount(row, context) {
        return context.self.samples ? context.self.samples.size : undefined
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
      boxplot(row, context) {
        const values = context.self.values
        if (!values || !values.length) return
        values.sort((i,j)=> i - j );  //console.log(values.slice(0,5), values.slice(-5), context.self.values.sort((i,j)=> i - j ).slice(0,5))
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

function getIsAnnoValFxn(q, tdb, index) {
  const termnum_id = 'term'+ index + '_id'
  const termid = q[termnum_id]
  const term = termid ? tdb.termjson.map.get(termid) : {}
  const termIsNumeric = term.isinteger || term.isfloat
  const nb = term.graph && term.graph.barchart && term.graph.barchart.numeric_bin 
    ? term.graph.barchart.numeric_bin
    : {}
  const unannotatedValues = nb.unannotated
    ? Object.keys(nb.unannotated).filter(key=>key.startsWith('value')).map(key=>nb.unannotated[key]) 
    : []
  return val => termIsNumeric && !unannotatedValues.includes(val)
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
