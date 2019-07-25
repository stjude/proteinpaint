const app = require('../app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const fs = require('fs')
const get_bins = require('./termdb.sql').get_bins

/*
********************** EXPORTED
handle_request_closure
**********************
get_AF
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    const q = req.query
    for(const i of [0,1,2]) {
      const termnum_q = 'term' + i +'_q'
      if (q[termnum_q]) {
        try {
          q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
        } catch(e) {
          app.log(req)
          res.send({error: (e.message || e)})
          if(e.stack) console.log(e.stack)
        }
      }
    }
    if (q.tvslst) {
      try {
        q.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
      } catch(e) {
        app.log(req)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    }
    app.log(req)
    // support legacy query parameter names
    if (q.term1_id) q.term1 = q.term1_id
    if (!q.term1_q) q.term1_q = {}
    if (!q.term0) q.term0 = ''
    if (q.term0_id) q.term0 = q.term0_id 
    if (!q.term0_q) q.term0_q = {}
    if (!q.term2) q.term2 = ''
    if (q.term2_id) q.term2 = q.term2_id
    if (!q.term2_q) q.term2_q = {}
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      if(!tdb.precomputed) throw 'tdb.precomputed not loaded'
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
  if(!ds.cohort.annorows) throw `cohort.annorows is missing`
  // request-specific variables
  const startTime = +(new Date())
  const inReqs = [getTrackers(), getTrackers(), getTrackers()]
  inReqs.filterFxn = ()=>1 // default allow all rows, may be replaced via q.termfilter
  await setValFxns(q, inReqs, ds, tdb);
  const pj = getPj(q, inReqs, ds.cohort.annorows, tdb, ds)
  if (pj.tree.results) pj.tree.results.pjtime = pj.times
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
  "@join()": {
    "idVal": "=idVal()"
  },
  results: {
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      chartId: "@key",
      total: "+1",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      "@done()": "=filterEmptySeries()",
      serieses: [{
        total: "+1",
        seriesId: "@key",
        max: "<&idVal.dataVal", // needed by client-side boxplot renderer 
        "~values": ["&idVal.dataVal",0],
        "~sum": "+&idVal.dataVal",
        "__:boxplot": "=boxplot()",
        "~samples": ["$sjlid", "set"],
        "__:AF": "=getAF()",
        data: [{
          dataId: "@key",
          total: "+1" 
        }, "&idVal.dataId[]"],
      }, "&idVal.seriesId[]"],
    }, "&idVal.chartId[]"],
    "~sum": "+&idVal.seriesVal",
    "~values": ["&idVal.seriesVal",0],
    "__:boxplot": "=boxplot()",
    refs: {
      cols: ["&idVal.seriesId[]"],
      colgrps: ["-"], 
      rows: ["&idVal.dataId[]"],
      rowgrps: ["-"],
      col2name: {
        "&idVal.seriesId[]": {
          name: "@branch",
          grp: "-"
        }
      },
      row2name: {
        "&idVal.dataId[]": {
          name: "@branch",
          grp: "-"
        }
      },
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:unannotatedLabels": "=unannotatedLabels()",
      "__:bins": "=bins()",
      '__:q': "=q()",
      "__:grade_labels": "=grade_labels()",
      "@done()": "=sortColsRows()"
    },
    "@done()": "=sortCharts()"
  }
})

function getPj(q, inReqs, data, tdb, ds) {
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/ 
  const kvs = [
    {i: 0, term: 'term0', key: 'chartId', val: 'chartVal', q: q.term0_q},
    {i: 1, term: 'term1', key: 'seriesId', val: 'seriesVal', q: q.term1_q},
    {i: 2, term: 'term2', key: 'dataId', val: 'dataVal', q: q.term2_q}
  ]

  inReqs[0].q = q.term0_q
  inReqs[1].q = q.term1_q
  inReqs[2].q = q.term2_q

  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        // a falsy filter return value for a data row will cause the
        // exclusion of that row from farther processing
        return inReqs.filterFxn(row)
      },
      idVal(row, context, joinAlias) {
        // chart, series, data
        const csd = Object.create(null)
        for(const kv of kvs) {
          const termid = q[kv.term]
          const id = inReqs[kv.i].joinFxns[termid](row, context, joinAlias)
          if (id===undefined || (Array.isArray(id) && !id.length)) return
          csd[kv.key] = Array.isArray(id) ? id : [id]
          const value = typeof inReqs[kv.i].numValFxns[termid] == 'function'
            ? inReqs[kv.i].numValFxns[termid](row)
            : undefined
          csd[kv.val] = 0 && inReqs[kv.i].unannotatedLabels.includes(value)
            ? undefined
            : value 
        };
        return csd
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
        if (!context.self.values || !context.self.values.length) return
        const values = context.self.values.filter(d => d !== null)
        if (!values.length) return
        values.sort((i,j)=> i - j ); //console.log(values.slice(0,5), values.slice(-5), context.self.values.sort((i,j)=> i - j ).slice(0,5))
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.self.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      numSamples(row, context) {
        return context.self.samples.size
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
          inReqs.genotype2sample,
          ds
        )
      },
      filterEmptySeries(result) {
        const nonempty = result.serieses.filter(series=>series.total)
        result.serieses.splice(0, result.serieses.length, ...nonempty)
      },
      unannotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of idVal.seriesId) {
          if (inReqs[1].unannotatedLabels.includes(s)) {
            total += 1
          }
        }
        return total
      },
      annotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of idVal.seriesId) {
          if (!inReqs[1].unannotatedLabels.includes(s)) {
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
          const labels = inReqs[2].orderedLabels
          result.rows.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
      },
      sortCharts(result) {
        for(const kv of kvs) {
          const termid = q[kv.term]
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
          term0: inReqs[0].unannotatedLabels,
          term1: inReqs[1].unannotatedLabels, 
          term2: inReqs[2].unannotatedLabels
        }
      },
      bins() {
        return inReqs.map(d=>d.bins)
      },
      q() {
        return inReqs.map(d=>d.q)
      },
      grade_labels() {
        let has_condition_term = false
        for(const kv of kvs) {
          if (kv.q.bar_by_grade || kv.q.bar_by_children) {
            has_condition_term = true
            break
          }
        }
        return tdb.patient_condition && has_condition_term
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
  if(q.tvslst) {
    // for categorical terms, must convert values to valueset
    for(const tv of q.tvslst) {
      if(tv.term.iscategorical) {
        tv.valueset = new Set( tv.values.map(i=>i.key) )
      }
    }
    inReqs.filterFxn = (row) => {
      return sample_match_termvaluesetting( row, q.tvslst, ds )
    }
  }

  for(const i of [0, 1, 2]) {
    const inReq = inReqs[i]
    const termnum = 'term' + i
    const termid = q[termnum]
    const term_q = q[termnum + "_q"]
    inReq.q = term_q
    term_q.index = i
    if (!inReq.orderedLabels) {
      inReq.orderedLabels = []
      inReq.unannotatedLabels = []
    }
    if (q[termnum + '_is_genotype']) {
      if (!q.ssid) throw `missing ssid for genotype`
      const [bySample, genotype2sample] = await load_genotype_by_sample(q.ssid)
      inReqs.genotype2sample = genotype2sample
      const skey = ds.cohort.samplenamekey
      inReq.joinFxns[termid] = row => bySample[row[skey]]
      continue
    }
    const term = termid ? tdb.termjson.map.get(termid) : null
    if ((!termid || term.iscategorical) && termid in inReq.joinFxns) continue
    if (!term) throw `Unknown ${termnum}="${q[termnum]}"`
    if (!term.graph) throw `${termnum}.graph missing`
    if (!term.graph.barchart) throw `${termnum}.graph.barchart missing`
    if (term.iscategorical) {
      inReq.joinFxns[termid] = row => row[termid] 
    } else if (term.isinteger || term.isfloat) {
      get_numeric_bin_name(term_q, termid, term, ds, termnum, inReq)
    } else if (term.iscondition) {
      // tdb.patient_condition
      if (!tdb.patient_condition) throw "missing termdb patient_condition"
      if (!tdb.patient_condition.events_key) throw "missing termdb patient_condition.events_key"
      inReq.orderedLabels = term.grades ? term.grades : [0,1,2,3,4,5,9] // hardcoded default order
      set_condition_fxn(termid, term.graph.barchart, tdb, inReq, i)
    } else {
      throw "unable to handle request, unknown term type"
    }
  }
}

function set_condition_fxn(termid, b, tdb, inReq, index) {
  const q = inReq.q
  const precomputedKey = q.bar_by_children && q.value_by_max_grade ? 'childrenAtMaxGrade'
    : q.bar_by_children && q.value_by_most_recent ? 'childrenAtMostRecent'
    : q.bar_by_children ? 'children'
    : q.bar_by_grade && q.value_by_max_grade ? 'maxGrade'
    : q.bar_by_grade && q.value_by_most_recent ? 'mostRecentGrades'
    : ''
  if (!precomputedKey) throw `unknown condition term unit='${unit}'`

  inReq.joinFxns[termid] = row => {
    if (!tdb.precomputed.bySample[row.sjlid]) return []
    const c = tdb.precomputed.bySample[row.sjlid].byCondition
    if (!(termid in c) || !(precomputedKey in c[termid])) return []
    const value = c[termid][precomputedKey]
    return Array.isArray(value) ? value : [value]
  }
}


function get_numeric_bin_name (term_q, termid, term, ds, termnum, inReq ) {
  const [bins, binconfig] = get_bins(term_q, term, ds)
  inReq.bins = bins
  inReq.orderedLabels = bins.map(d=>d.label); 
  if (binconfig.unannotated) {
    inReq.unannotatedLabels = Object.values(binconfig.unannotated._labels)
  }

  inReq.joinFxns[termid] = row => {
    const v = row[termid]
    if( binconfig.unannotated && binconfig.unannotated._values.includes(v) ) {
      return binconfig.unannotated._labels[v]
    }

    for(const b of bins) {
      if( b.startunbounded ) {
        if( v < b.stop  ) return b.label
        if( b.stopinclusive && v == b.stop ) return b.label
      }
      if( b.stopunbounded ) {
        if( v > b.start  ) return b.label
        if( b.stopinclusive && v == b.start ) return b.label
      }
      if( b.startinclusive  && v <  b.start ) continue
      if( !b.startinclusive && v <= b.start ) continue
      if( b.stopinclusive   && v >  b.stop  ) continue
      if( !b.stopinclusive  && v >= b.stop  ) continue
      return b.label
    }
  }

  inReq.numValFxns[termid] = row => {
    const v = row[termid]
    if(!binconfig.unannotated || !binconfig.unannotated._values.includes(v) ) {
      return v
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
