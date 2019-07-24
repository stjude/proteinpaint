const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')



function set_term_bins(q, ds) {
/*
  Wrapper function to set numeric bins for terms
*/

  let bin_size
  let bins = []
  if( q.custom_bins ) {
    // work in progress 
    const term = ds.cohort.termdb.q.termjsonByOneid( q.term_id )
    const summary = termdbsql.get_numericsummary(q, term, ds, [], true)
    q.custom_bins = get_bins(q.custom_bins, summary)
  } else if (term.graph && term.graph.barchart && term.graph.barchart.numeric_bin) {
    // work in progress - should use get_bins()
    /*
    const nb = term.graph.barchart.numeric_bin
    if( (q.isterm0 || q.isterm2) && nb.bins_less ) {
      bins = JSON.parse(JSON.stringify(nb.bins_less))
    } else if ( nb.fixed_bins ) {
      bins = JSON.parse(JSON.stringify(nb.fixed_bins))
    } else if( nb.auto_bins ) {
      const max = ds.cohort.termdb.q.findTermMaxvalue(term.id, term.isinteger)
      let v = nb.auto_bins.start_value
      bin_size = nb.bin_size
      while( v < max ) {
        bins.push({
          start: v,
          stop: Math.min( v+bin_size, max ),
          startinclusive:true
        })
        v+=bin_size
      }
      bins[bins.length-1].stopinclusive = true
    } else {
      throw 'no predefined binning scheme'
    }*/
  }
}

exports.set_term_bins = set_term_bins


function get_bins(cb, summary) {
/*
    Generic bins generator

cb    configuration of bins per the Numerical Binning Scheme
https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.arwagpbhlgr3

summary{}
  .min
  .max
  .values needed for percentiles
*/
  if (!cb || typeof cb !== "object" ) throw 'bin schema must be an object'
  if (!summary) throw 'must provide summary to get_bins'
  
  // required custom_bin parameter
  if (!('bin_size' in cb)) throw 'missing custom_bin.bin_size'
  if (!isNumeric(cb.bin_size)) throw 'non-numeric custom.bin_size'
  if (cb.bin_size <= 0) throw 'custom.bin_size must be greater than 0'
  
  if (!cb.startinclusive && !cb.stopinclusive) {
    cb.startinclusive = 1
    cb.stopinclusive = 0
  }

  if (typeof cb.first_bin != 'object') throw 'custom_bins.first bin missing or not an object'
  if (!cb.first_bin.startunbounded 
    && !cb.first_bin.start_percentile
    && !isNumeric(cb.first_bin.start)
  ) throw 'must set one of custom.first_bin.startunbounded, start_percentile, or start'
  
  if (!cb.last_bin || typeof cb.last_bin != 'object') cb.last_bin = {stopunbounded: true}
  if (!cb.last_bin.stopunbounded 
    && !cb.last_bin.stop_percentile
    && !isNumeric(cb.last_bin.stop)
  ) throw 'must set one of custom.last_bin.stopunbounded, stop_percentile, or stop'

  const orderedLabels = []
  const min = cb.first_bin.startunbounded 
    ? summary.min 
    : cb.first_bin.start_percentile
    ? summary.values[ Math.floor((cb.first_bin.start_percentile / 100) * summaries.values.length) ]
    : cb.first_bin.start
  const max = cb.last_bin.stopunbounded 
    ? summary.max
    : cb.last_bin.stop_percentile
    ? summary.values[ Math.floor((cb.last_bin.stop_percentile / 100) * summary.values.length) ]
    : cb.last_bin.stop <= summary.max
    ? cb.last_bin.stop
    : summary.max
  const last_start = isNumeric(cb.last_bin.start_percentile)
    ? cb.last_bin.start_percentile
    : isNumeric(cb.last_bin.start)
    ? cb.last_bin.start
    : null
  const last_stop = cb.last_bin.stopunbounded
    ? null 
    : isNumeric(cb.last_bin.stop_percentile)
    ? cb.last_bin.stop_percentile
    : isNumeric(cb.last_bin.stop)
    ? cb.last_bin.stop
    : null

  const bins = [{
    startunbounded: cb.first_bin.startunbounded,
    start: cb.first_bin.startunbounded ? undefined : min,
    stop: isNumeric(cb.first_bin.stop) ? cb.first_bin.stop : min + cb.bin_size,
    startinclusive: cb.startinclusive,
    stopinclusive: cb.stopinclusive
  }]
  
  let currBin = bins[0]
  while( currBin.stop <= max ) {
    if (last_start !== null && currBin.start < last_start && currBin.stop > last_start) {
      currBin.stop = last_start
    } else if (currBin.stop >= summary.max) {
      if (last_stop === null) currBin.stopunbounded = 1
      else currBin.stopinclusive = 1
    }
    currBin.label = get_bin_label(currBin, cb)
    if (currBin.start >= currBin.stop) break
    if (currBin.stop >= max || bins.length > 50) break

    const upper = currBin.stop + cb.bin_size;
    const bin = {
      startinclusive: cb.startinclusive,
      stopinclusive: cb.stopinclusive,
      start: currBin.stop,
      stop: upper >= max ? max : upper,
    }
    bins.push( bin )
    currBin = bin
  }

  return bins
}

exports.get_bins = get_bins

function get_bin_label(bin, cb) {
/*
  Generate a numeric bin label given a bin configuration

*/
  if (bin.startunbounded) { 
    const oper = bin.stopinclusive ? "\u2264" : "<"
    const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
    return oper + binLabelFormatter(bin.stop);
  } else if (bin.stopunbounded) {
    const oper = bin.startinclusive ? "\u2265" : ">"
    const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
    return oper + v0
  } else if( Number.isInteger( cb.bin_size )) {
    // bin size is integer, make nicer label
    if( cb.bin_size == 1 ) {
      // bin size is 1; use just start value as label, not a range
      return bin.start //binLabelFormatter(start)
    } else {
      const oper0 = cb.startinclusive ? "" : ">"
      const oper1 = cb.stopinclusive ? "" : "<"
      const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
      const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
      return oper0 + v0 +' to '+ oper1 + v1
    }
  } else {
    const oper0 = cb.startinclusive ? "" : ">"
    const oper1 = cb.stopinclusive ? "" : "<"
    return oper0 + binLabelFormatter(bin.start) +' to '+ oper1 + binLabelFormatter(bin.stop)
  }
}

exports.get_bin_label = get_bin_label

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

