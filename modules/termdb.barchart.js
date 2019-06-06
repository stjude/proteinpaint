const app = require('../app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')

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
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    } 
    if (q.filter) {
      try {
        q.filter = JSON.parse(decodeURIComponent(q.filter))
      } catch(e) {
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    }
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
  if(!ds.cohort.annorows) throw `cohort.annorows is missing`
  // request-specific variables
  const inReq = {
    filterFxn: ()=>1, // default allow all rows, may be replaced via q.termfilter
    joinFxns: {"": () => ""}, // keys are term0, term1, term2 names; ...
    numValFxns: {"": () => {}}, // ... if key == empty string then the term is not specified
    unannotated: {},
    orderedLabels: {},
    unannotatedLabels: {},
    bins: {}
  }
  await setValFxns(q, inReq, ds, tdb)
  const pj = getPj(q, inReq, ds.cohort.annorows)
  res.send(pj.tree.results)
}

// template for partjson, already stringified so that it does not 
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
  "@errmode": ["","","",""],
  "@join()": {
    vals: "=vals()"
  },
  sum: "+&vals.value1",
  values: ["&vals.value1"],
  results: {
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      chartId: "&vals.chartId",
      total: "+1",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        total: "+1",
        seriesId: "&vals.seriesId",
        data: [{
          dataId: "&vals.dataId",
          total: "+1",
        }, "&vals.dataId"],
        max: "<&vals.value2",
        tempValues: ["&vals.value2"],
        tempSum: "+&vals.value2",
        "__:boxplot": "=boxplot2()"
      }, "&vals.seriesId"]
    }, "&vals.chartId"],
    "__:boxplot": "=boxplot1()",
    unannotated: {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    },
    refs: {
      //chartkey: "&vals.term0",
      cols: ["&vals.seriesId"],
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
      },
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:unannotatedLabels": "=unannotatedLabels()",
      "__:bins": "=bins()",
      "@done()": "=sortColsRows()"
    }
  }
})

function getPj(q, inReq, data) {
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      vals(row) {
        // vals() is used as a @join function in the partjson 
        // template above. A join function that returns
        // a falsy value for a data row will cause the
        // exclusion of that row from farther processing
        if (!inReq.filterFxn(row)) return undefined

        const chartId = inReq.joinFxns[q.term0](row)
        const seriesId = inReq.joinFxns[q.term1](row)
        const dataId = inReq.joinFxns[q.term2](row)
        if (chartId !== undefined && seriesId !== undefined && dataId !== undefined) {
          return {
            chartId,
            seriesId,
            dataId,
            value1: typeof inReq.numValFxns[q.term1] == 'function'
              ? inReq.numValFxns[q.term1](row)
              : undefined,
            value2: typeof inReq.numValFxns[q.term2] == 'function'
              ? inReq.numValFxns[q.term2](row)
              : undefined,
          }
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
        if (!context.root.values.length) return;
        context.root.values.sort((i,j)=> i - j )
        const stat = app.boxplot_getvalue( context.root.values.map(v => {return {value: v}}) )
        stat.mean = context.root.sum / context.root.values.length
        let s = 0
        for(const v of context.root.values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (context.root.values.length-1) )
        return stat
      },
      boxplot2(row, context) {
        if (!context.self.tempValues || !context.self.tempValues.length) return;
        context.self.tempValues.sort((i,j)=> i - j )
        const stat = app.boxplot_getvalue( context.self.tempValues.map(v => {return {value: v}}) )
        stat.mean = context.self.tempSum / context.self.tempValues.length
        let s = 0
        for(const v of context.self.tempValues) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (context.self.tempValues.length-1) )
        delete context.self.tempSum
        delete context.self.tempValues
        return stat
      },
      unannotated(row, context) {
        const vals = context.joins.get('vals')
        return vals.seriesId === inReq.unannotated.label ? 1 : 0
      },
      annotated(row, context) {
        const vals = context.joins.get('vals')
        return vals.seriesId === inReq.unannotated.label ? 0 : 1
      },
      sortColsRows(result) {
        if (inReq.orderedLabels[q.term1].length) {
          result.cols.sort((a,b) => inReq.orderedLabels[q.term1].indexOf(a) - inReq.orderedLabels[q.term1].indexOf(b))
        }
        if (inReq.orderedLabels[q.term2].length) {
          result.rows.sort((a,b) => inReq.orderedLabels[q.term2].indexOf(a) - inReq.orderedLabels[q.term2].indexOf(b))
        }
      },
      useColOrder() {
        return inReq.orderedLabels[q.term1].length > 0
      },
      useRowOrder() {
        return inReq.orderedLabels[q.term2].length > 0
      },
      unannotatedLabels() {
        return {
          term1: inReq.unannotatedLabels[q.term1], 
          term2: inReq.unannotatedLabels[q.term2]
        }
      },
      bins() {
        return inReq.bins
      }
    }
  })
}

async function setValFxns(q, inReq, ds, tdb) {
/*
  sets request-specific value and filter functions
  unannotated values will be processed but tracked separately
*/
  if(q.filter) {
    // for categorical terms, must convert values to valueset
    for(const t of q.filter) {
      if(t.term.iscategorical) {
        t.valueset = new Set( t.values.map(i=>i.key) )
      }
    }
    inReq.filterFxn = (row) => {
      return sample_match_termvaluesetting( row, q.filter )
    }
  }

  for(const term of ['term0', 'term1', 'term2']) {
    const key = q[term]
    if (!inReq.orderedLabels[key]) {
      inReq.orderedLabels[key] = []
      inReq.unannotatedLabels[key] = []
    }
    if (key == "genotype") {
      if (!q.ssid) `missing ssid for genotype`
      const bySample = await load_genotype_by_sample(q.ssid)
      const skey = ds.cohort.samplenamekey
      inReq.joinFxns[key] = row => bySample[row[skey]]
      continue
    }
    const t = tdb.termjson.map.get(key)
    if ((!key || t.iscategorical) && key in inReq.joinFxns) continue
    if (!t) throw `Unknown ${term}="${q[term]}"`
    if (!t.graph) throw `${term}.graph missing`
    if (!t.graph.barchart) throw `${term}.graph.barchart missing`
    if (t.iscategorical) {
      inReq.joinFxns[key] = row => row[key] 
    } else if (t.isinteger || t.isfloat) {
      get_numeric_bin_name(key, t, ds, term, q.custom_bins, inReq)
    } else if (t.iscondition) {
      set_condition_fxn(key, tdb, inReq)
    } else {
      throw "unsupported term binning"
    }
  }
}

function set_condition_fxn(key, tdb, inReq) {
  // default to number of events for now
  if (1) {
    inReq.joinFxns[key] = row => {
      let numEvents = 0
      for(const k in row) {
        const term = tdb.termjson.map.get(k)
        if (term && term.iscondition && term.conditionlineage && term.conditionlineage.includes(key) && row[k].conditionevents) {
          numEvents += row[k].conditionevents.length
        }
      }
      return numEvents 
    }
  } else {
    inReq.joinFxns[key] = row => {
      
    }
  }
}

function get_numeric_bin_name ( key, t, ds, termNum, custom_bins, inReq ) {
  const [ binconfig, values, _orderedLabels ] = termdb_get_numericbins( key, t, ds, termNum, custom_bins[termNum.slice(-1)] )
  inReq.bins[termNum.slice(-1)] = binconfig.bins

  inReq.orderedLabels[key] = _orderedLabels
  if (binconfig.unannotated) {
    inReq.unannotatedLabels[key] = Object.values(binconfig.unannotated._labels)
  }
  Object.assign(inReq.unannotated, binconfig.unannotated)

  inReq.joinFxns[key] = row => {
    const v = row[key]
    if( binconfig.unannotated && binconfig.unannotated._values.includes(v) ) {
      return binconfig.unannotated._labels[v]
    }

    for(const b of binconfig.bins) {
      if( b.startunbound ) {
        if( b.stopinclusive && v <= b.stop  ) {
          return b.label
        }
        if( !b.stopinclusive && v < b.stop ) {
          return b.label
        }
      }
      if( b.stopunbound ) {
        if( b.startinclusive && v >= b.start  ) {
          return b.label
        }
        if( !b.stopinclusive && v > b.start ) {
          return b.label
        }
      }
      if( b.startinclusive  && v <  b.start ) continue
      if( !b.startinclusive && v <= b.start ) continue
      if( b.stopinclusive   && v >  b.stop  ) continue
      if( !b.stopinclusive  && v >= b.stop  ) continue
      return b.label
    }
  }

  inReq.numValFxns[key] = row => {
    const v = row[key]
    if(!binconfig.unannotated || !binconfig.unannotated._values.includes(v) ) {
      return v
    }
  }
}

function termdb_get_numericbins ( id, term, ds, termNum, custom_bins ) {
/*
must return values from all samples, not to exclude unannotated values

do not count sample for any bin here, including annotated/unannotated
only initiate the bins without count
barchart or crosstab will do the counting in different ways

return an object for binning setting {}
rather than a list of bins
this is to accommondate settings where a valid value e.g. 0 is used for unannotated samples, and need to collect this count

.bins[{}]
  each element is one bin
  .start
  .stop
  etc
.unannotated{}
  .value
  .samplecount
  for counting unannotated samples if unannotated{} is set on server
*/

  // step 1, get values from all samples
  const values = []
  let observedMin, observedMax
  for(const s in ds.cohort.annotation) {
    const v = ds.cohort.annotation[ s ][ id ]

    if (!values.length) {
      observedMin = v
      observedMax = v
    }
    else if (v < observedMin) {
      observedMin = v
    }
    else if (v > observedMax) {
      observedMax = v
    }

    if(Number.isFinite(v)) {
      values.push(+v)
    }
  }
  if(values.length==0) {
    throw 'No numeric values found for any sample'
  }
  const nb = term.graph.barchart.numeric_bin
  const bins = []
  const orderedLabels = []

  // step 2, decide bins
  if(custom_bins) {
    if (custom_bins.first_bin_option == "percentile" || custom_bins.last_bin_option == "percentile") {
      values.sort((a,b) => a - b)
    }
    const min = custom_bins.first_bin_size == 'auto' 
      ? observedMin 
      : custom_bins.first_bin_option == 'percentile' 
      ? values[ Math.floor((custom_bins.first_bin_size / 100) * values.length) ]
      : custom_bins.first_bin_size
    const max = custom_bins.last_bin_size == 'auto' 
      ? observedMax 
      : custom_bins.last_bin_option == 'percentile'
      ? values[ Math.floor((custom_bins.last_bin_size / 100) * values.length) ]
      : custom_bins.last_bin_size
    let v = custom_bins.first_bin_size == 'auto' 
      ? observedMin 
      : custom_bins.first_bin_option == 'percentile'
      ? min
      : custom_bins.first_bin_size
    let startunbound = v <= min
    let afterFirst = false
    let beforeLast = false
    
    while( v <= observedMax ) {
      const upper = custom_bins.size == "auto" ? custom_bins.last_bin_size : v + custom_bins.size
      const v2 = upper > max ? max : upper
      beforeLast = upper < max && v2 + custom_bins.size > max

      const bin = {
        start: v >= max ? max : v,
        stop: startunbound ? min : v2,
        startunbound,
        stopunbound: v >= max,
        value: 0, // v2s
        startinclusive: !startunbound || custom_bins.first_bin_oper == "lteq",
        stopinclusive: v >= max && custom_bins.last_bin_oper == "gteq",
      }
      
      if (bin.startunbound) { 
        const oper = bin.startinclusive ? "\u2265" : "<"
        bin.label = oper + binLabelFormatter(min);
      } else if (bin.stopunbound) {
        const oper = bin.stopinclusive ? "\u2264" : ">"
        bin.label = oper + binLabelFormatter(max)
      } else if( Number.isInteger( custom_bins.size ) ) {
        // bin size is integer, make nicer label
        if( custom_bins.size == 1 ) {
          // bin size is 1; use just start value as label, not a range
          bin.label = v //binLabelFormatter(v)
        } else {
          // bin size bigger than 1, reduce right bound by 1, in label only!
          const oper0 = !afterFirst || custom_bins.first_bin_oper == "lt" ? "\u2265" : "<"
          const oper1 = "" //!beforeLast || custom_bins.last_bin_oper == "gteq" ? "<" : "\u2665"
          bin.label = oper0 + binLabelFormatter(v) +' to '+ oper1 + binLabelFormatter(v2)
        }
      } else {        
        // bin size is not integer
        const oper0 = !afterFirst || custom_bins.first_bin_oper == "lt" ? "\u2265" : "<"
        const oper1 = "" //!beforeLast || custom_bins.last_bin_oper == "gteq" ? "<" : "\u2665"
        bin.label = oper0 + binLabelFormatter(v) +' to '+ oper1 + binLabelFormatter(v2)
      }

      bins.push( bin )
      orderedLabels.push(bin.label)

      if (v >= max) break
      v += startunbound ? 0 : custom_bins.size;
      afterFirst = !afterFirst && startunbound ? true : false
      startunbound = 0
    }

    const binconfig = {
      bins: bins
    }

    if( nb.unannotated ) {
      // in case of using this numeric term as term2 in crosstab, 
      // this object can also work as a bin, to be put into the bins array
      binconfig.unannotated = {
        _values: [nb.unannotated.value],
        _labels: {[nb.unannotated.value]: nb.unannotated.label},
        label: nb.unannotated.label,
        label_annotated: nb.unannotated.label_annotated,
        // for unannotated samples
        value: 0, // v2s
        // for annotated samples
        value_annotated: 0, // v2s
      }

      if (nb.unannotated.value_positive) {
        binconfig.unannotated.value_positive = 0
        binconfig.unannotated._values.push(nb.unannotated.value_positive)
        binconfig.unannotated._labels[nb.unannotated.value_positive] = nb.unannotated.label_positive
      }
      if (nb.unannotated.value_negative) {
        binconfig.unannotated.value_negative = 0
        binconfig.unannotated._values.push(nb.unannotated.value_negative)
        binconfig.unannotated._labels[nb.unannotated.value_negative] = nb.unannotated.label_negative
      }
    }

    return [ binconfig, values, orderedLabels ]
  }
  else {
    const fixed_bins = (termNum=='term2' || termNum=='term0') && nb.crosstab_fixed_bins ? nb.crosstab_fixed_bins 
      : nb.fixed_bins ? nb.fixed_bins
      : undefined

    if( fixed_bins ) {
      // server predefined
      // return copy of the bin, not direct obj, as bins will be modified later

      for(const i of fixed_bins) {
        const copy = {
          value: 0 // v2s
        }
        for(const k in i) {
          copy[ k ] = i[ k ]
        }
        bins.push( copy )
        orderedLabels.push(i.label)
      }

    } else if( nb.auto_bins ) {

      /* auto bins
      given start and bin size, use max from value to decide how many bins there are

      if bin size is integer,
      to make nicer labels
      */

      const max = Math.max( ...values )
      let v = nb.auto_bins.start_value
      while( v < max ) {
        const v2 = v + nb.auto_bins.bin_size

        const bin = {
          start: v,
          stop: v2,
          value: 0, // v2s
          startinclusive:1,
        }

        if( Number.isInteger( nb.auto_bins.bin_size ) ) {
          // bin size is integer, make nicer label

          if( nb.auto_bins.bin_size == 1 ) {
            // bin size is 1; use just start value as label, not a range
            bin.label = v
          } else {
            // bin size bigger than 1, reduce right bound by 1, in label only!
            bin.label = v + ' to ' + (v2-1)
          }
        } else {
          
          // bin size is not integer
          bin.label = v+' to '+v2
        }

        bins.push( bin )
        orderedLabels.push(bin.label)

        v += nb.auto_bins.bin_size
      }
    } else {
      throw 'unknown ways to decide bins'
    }

    const binconfig = {
      bins: bins
    }

    if( nb.unannotated ) {
      // in case of using this numeric term as term2 in crosstab, 
      // this object can also work as a bin, to be put into the bins array
      binconfig.unannotated = {
        _values: [nb.unannotated.value],
        _labels: {[nb.unannotated.value]: nb.unannotated.label},
        label: nb.unannotated.label,
        label_annotated: nb.unannotated.label_annotated,
        // for unannotated samples
        value: 0, // v2s
        // for annotated samples
        value_annotated: 0, // v2s
      }

      if (nb.unannotated.value_positive) {
        binconfig.unannotated.value_positive = 0
        binconfig.unannotated._values.push(nb.unannotated.value_positive)
        binconfig.unannotated._labels[nb.unannotated.value_positive] = nb.unannotated.label_positive
      }
      if (nb.unannotated.value_negative) {
        binconfig.unannotated.value_negative = 0
        binconfig.unannotated._values.push(nb.unannotated.value_negative)
        binconfig.unannotated._labels[nb.unannotated.value_negative] = nb.unannotated.label_negative
      }
    }

    return [ binconfig, values, orderedLabels ]
  }
}

async function load_genotype_by_sample ( id ) {
/* id is the file name under cache/samples-by-genotype/
*/
  const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
  const bySample = Object.create(null)
  for(const line of text.split('\n')) {
    const [type, samplesStr] = line.split('\t')
    const samples = samplesStr.split(",")
    for(const sample of samples) {
      bySample[sample] = type
    }
  }
  return bySample
}
