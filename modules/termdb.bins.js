const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')



function validate_bins(binconfig) {
  const bc = binconfig
  if (!bc || typeof bc !== "object" ) throw 'bin schema must be an object'
  
  // required custom_bin parameter
  if (!('bin_size' in bc)) throw 'missing custom_bin.bin_size'
  if (!isNumeric(bc.bin_size)) throw 'non-numeric bin_size'
  if (bc.bin_size <= 0) throw 'bin_size must be greater than 0'
  
  if (!bc.startinclusive && !bc.stopinclusive) {
    bc.startinclusive = 1
    bc.stopinclusive = 0
  }

  if (!bc.first_bin) throw 'first_bin missing'
  if (typeof bc.first_bin != 'object') throw 'first_bin is not an object'
  if (!Object.keys(bc.first_bin).length) throw 'first_bin is an empty object'

  if ((bc.first_bin.startunbounded && !isNumeric(bc.first_bin.stop_percentile) && !isNumeric(bc.first_bin.stop))
    && !bc.first_bin.start_percentile
    && !isNumeric(bc.first_bin.start)
  ) throw 'must set first_bin.start, or start_percentile, or startunbounded + stop'
  
  if (!bc.last_bin || typeof bc.last_bin != 'object') bc.last_bin = {}
  if ((bc.last_bin.stopunbounded && !isNumeric(bc.last_bin.start_percentile) && !isNumeric(bc.last_bin.start))
    && !bc.last_bin.stop_percentile
    && !isNumeric(bc.last_bin.stop)
  ) throw 'must set last_bin.stop, or stop_percentile, or stopunbounded + start'
}

exports.validate_bins = validate_bins




function get_bins(binconfig, summaryfxn) {
/*
  Bins generator

binconfig   
  configuration of bins per the Numerical Binning Scheme
  https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.arwagpbhlgr3
  
  .term_id optional if using percentiles
  .tvslst optional if using percentiles

summary{}
  .min
  .max
  .values needed for percentiles
*/
  const bc = binconfig
  validate_bins(bc)
  //if (!summary) throw 'must provide summary to get_bins'
  const percentiles = get_percentiles(bc)
  const summary = summaryfxn(percentiles)

  const orderedLabels = []
  const min = bc.first_bin.startunbounded 
    ? summary.min  
    : bc.first_bin.start_percentile
    ? summary['p' + bc.first_bin.start_percentile]
    : bc.first_bin.start
  const max = bc.last_bin.stopunbounded 
    ? summary.max
    : bc.last_bin.stop_percentile
    ? summary['p' + bc.last_bin.stop_percentile]
    : bc.last_bin.stop <= summary.max
    ? bc.last_bin.stop
    : summary.max
  const last_start = isNumeric(bc.last_bin.start_percentile)
    ? summary['p' + bc.last_bin.start_percentile]
    : isNumeric(bc.last_bin.start)
    ? bc.last_bin.start
    : null
  const last_stop = bc.last_bin.stopunbounded
    ? null 
    : bc.last_bin.stop_percentile
    ? summary['p' + bc.last_bin.stop_percentile]
    : isNumeric(bc.last_bin.stop)
    ? bc.last_bin.stop
    : null

  const bins = [{
    startunbounded: bc.first_bin.startunbounded,
    start: bc.first_bin.startunbounded ? undefined : min,
    stop: isNumeric(bc.first_bin.stop_percentile) 
      ? summary['p' + bc.first_bin.stop_percentile]
      : isNumeric(bc.first_bin.stop) 
      ? bc.first_bin.stop 
      : min + bc.bin_size,
    startinclusive: bc.startinclusive,
    stopinclusive: bc.stopinclusive
  }]

  if (!isNumeric(bins[0].stop)) throw "the computed first_bin.stop is non-numeric"
  
  let currBin = bins[0]
  while( currBin.stop <= max ) {
    if (last_start !== null && currBin.start < last_start && currBin.stop > last_start) {
      currBin.stop = last_start
    } else if (currBin.stop >= summary.max) {
      if (last_stop === null) currBin.stopunbounded = 1
      else currBin.stopinclusive = 1
    }
    currBin.label = get_bin_label(currBin, bc)
    if (currBin.start >= currBin.stop) break
    if (currBin.stop >= max || bins.length > 50) break

    const upper = currBin.stop + bc.bin_size;
    const bin = {
      startinclusive: bc.startinclusive,
      stopinclusive: bc.stopinclusive,
      start: currBin.stop,
      stop: upper >= max ? max : upper,
    }
    bins.push( bin )
    currBin = bin
  }

  return bins
}

exports.get_bins = get_bins




function get_bin_label(bin, binconfig) {
/*
  Generate a numeric bin label given a bin configuration

*/
  const bc = binconfig
  if (bin.startunbounded) {
    const oper = bin.stopinclusive ? "\u2264" : "<"
    const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
    return oper + v1;
  } else if (bin.stopunbounded) {
    const oper = bin.startinclusive ? "\u2265" : ">"
    const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
    return oper + v0
  } else if( Number.isInteger( bc.bin_size )) {
    // bin size is integer, make nicer label
    if( bc.bin_size == 1 ) {
      // bin size is 1; use just start value as label, not a range
      return bin.start //binLabelFormatter(start)
    } else {
      const oper0 = bc.startinclusive ? "" : ">"
      const oper1 = bc.stopinclusive ? "" : "<"
      const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
      const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
      return oper0 + v0 +' to '+ oper1 + v1
    }
  } else {
    const oper0 = bc.startinclusive ? "" : ">"
    const oper1 = bc.stopinclusive ? "" : "<"
    const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
    const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
    return oper0 + v0 +' to '+ oper1 + v1
  }
}

exports.get_bin_label = get_bin_label



function get_percentiles(binconfig) {
  const percentiles = []
  const f = binconfig.first_bin
  if (f && isNumeric(f.start_percentile)) percentiles.push(f.start_percentile)
  if (f && isNumeric(f.stop_percentile)) percentiles.push(f.stop_percentile)
  const l = binconfig.last_bin
  if (l && isNumeric(l.start_percentile)) percentiles.push(l.start_percentile)
  if (l && isNumeric(l.stop_percentile)) percentiles.push(l.stop_percentile)
  return percentiles
}

exports.get_percentiles = get_percentiles



function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

