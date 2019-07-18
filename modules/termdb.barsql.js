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

  if (q.ssid) {
    const [genotypeBySample, genotype2sample] = await load_genotype_by_sample(q.ssid)
    q.genotypeBySample = genotypeBySample
    q.genotype2sample = genotype2sample
  }

  // if(!ds.cohort.annorows) throw `cohort.annorows is missing`
  // request-specific variables
  const startTime = +(new Date())
  const rows = get_rows(q)
  const sqlDone = +(new Date())
  const pj = getPj(q, rows, tdb, ds)
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
        data: [{
          dataId: "@key",
          "~samples": ["$sample", "set"],
          "__:total": "=sampleCount()",
        }, "$key2"],
        "_:_max": "$val2", // needed by client-side boxplot renderer 
        "~values": ["$nval2",0],
        "~sum": "+$nval2",
        "~samples": ["$sample", "set"],
        "__:total": "=sampleCount()",
        "__:boxplot": "=boxplot()",
        "__:AF": "=getAF()",
      }, "$key1"],
      //"@done()": "=filterEmptySeries()"
    }, "$key0"],
    "~sum": "+$nval1",
    "~values": ["$nval1",0],
    "__:boxplot": "=boxplot()",
    /*"_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    },*/
    "_:_refs": {
      cols: ["$key1"],
      colgrps: ["-"], 
      rows: ["$key2"],
      rowgrps: ["-"],
      col2name: {
        "$key1": {
          name: "@branch",
          grp: "-"
        }
      },
      row2name: {
        "$key2": {
          name: "@branch",
          grp: "-"
        }
      },
      "__:unannotatedLabels": "=unannotatedLabels()", 
      /*
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:bins": "=bins()",
      "__:grade_labels": "=grade_labels()",
      "@done()": "=sortColsRows()" */
    }
  }
})

function getPj(q, data, tdb, ds) { 
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
  const joinAliases = ["chart", "series", "data"]
  const kva = [0,1,2].map(i=>{
    return {
      key: 'key'+i, 
      val: 'val'+i,
      nval: 'nval'+i,
      isGenotype: 'term' + i + '_is_genotype',
      isAnnoVal: getIsAnnoValFxn(q, tdb, i)
    }
  })

  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        // mutates the data row, ok since
        // rows from db query are unique to request;
        // do not do this with ds.cohort.annorows, 
        // use partjson @join() instead 
        for(const d of kva) {
          if (q[d.isGenotype]) {
            if (!(row.sample in q.genotypeBySample)) return
            row[d.key] = q.genotypeBySample[row.sample]
            row[d.val] = q.genotypeBySample[row.sample]
          } else if (d.isAnnoVal(row[d.val])) {
            row[d.nval] = row[d.val]
          }
        }
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
        values.sort((i,j)=> i - j ); //console.log(context.self.seriesId, values.slice(0,5), values.slice(-5), context.self.values.sort((i,j)=> i - j ).slice(0,5))
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.self.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      getAF(row, context) {
        // only get AF when termdb_bygenotype.getAF is true
        if ( !ds.track
          || !ds.track.vcf
          || !ds.track.vcf.termdb_bygenotype
          || !ds.track.vcf.termdb_bygenotype.getAF
        ) return
        if (!q.term2_is_genotype) return
        if (!q.chr) throw 'chr missing for getting AF'
        if (!q.pos) throw 'pos missing for getting AF'
        
        return get_AF(
          context.self.samples ? [...context.self.samples] : [],
          q.chr,
          Number(q.pos),
          q.genotype2sample,
          ds
        )
      },
      unannotatedLabels() {
        const unannotated = {}
        kva.forEach((kv,i)=>{
          unannotated['term' + i] = kv.isAnnoVal.unannotatedLabels
            ? kv.isAnnoVal.unannotatedLabels
            : []
        })
        return unannotated
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
  const fxn = val => termIsNumeric && !unannotatedValues.includes(val)
  fxn.unannotatedLabels = nb.unannotated
    ? Object.keys(nb.unannotated).filter(key=>key.startsWith('label') && key != 'label_annotated').map(key=>nb.unannotated[key])
    : []
  return fxn
}


async function load_genotype_by_sample ( id ) { console.log(id)
/* id is the file name under cache/samples-by-genotype/
*/
  const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
  const bySample = Object.create(null)
  const genotype2sample = new Map()
  for(const line of text.split('\n')) {
    if (!line) continue
    const [type, samplesStr] = line.split('\t')
    if (!samplesStr) continue
    const samples = samplesStr.split(",")
    for(const sample of samples) {
      bySample[sample] = type
    }

    if(!genotype_type_set.has(type)) throw 'unknown hardcoded genotype label: '+type
    genotype2sample.set(type, new Set(samples))
  }
  return [bySample, genotype2sample]
}

const genotype_type_set = new Set(["Homozygous reference","Homozygous alternative","Heterozygous"])
const genotype_types = {
  href: "Homozygous reference",
  halt: "Homozygous alternative",
  het: "Heterozygous"
}

function get_AF ( samples, chr, pos, genotype2sample, ds ) {
/*
as configured by ds.track.vcf.termdb_bygenotype,
at genotype overlay of a barchart,
to show AF=? for each bar, based on the current variant

arguments:
- samples[]
  list of sample names from a bar
- chr
  chromosome of the variant
- genotype2sample Map
    returned by load_genotype_by_sample()
- ds{}
*/
  const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations
  const href = genotype2sample.has(genotype_types.href) ? genotype2sample.get(genotype_types.href) : new Set()
  const halt = genotype2sample.has(genotype_types.halt) ? genotype2sample.get(genotype_types.halt) : new Set()
  const het = genotype2sample.has(genotype_types.het) ? genotype2sample.get(genotype_types.het) : new Set()
  let AC=0, AN=0
  for(const sample of samples) {
    let isdiploid = false
    if( afconfig.sex_chrs.has( chr ) ) {
      if( afconfig.male_samples.has( sample ) ) {
        if( afconfig.chr2par && afconfig.chr2par[chr] ) {
          for(const par of afconfig.chr2par[chr]) {
            if(pos>=par.start && pos<=par.stop) {
              isdiploid=true
              break
            }
          }
        }
      } else {
        isdiploid=true
      }
    } else {
      isdiploid=true
    }
    if( isdiploid ) {
      AN+=2
      if(halt.has( sample ) ) {
        AC+=2
      } else if(het.has( sample )) {
        AC++
      }
    } else {
      AN++
      if(!href.has(sample)) AC++
    }
  }
  return (AN==0 || AC==0) ? 0 : (AC/AN).toFixed(3)
}
