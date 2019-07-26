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




function compute_bins(binconfig, summaryfxn) {
/*
  Bins generator
  
binconfig   
  configuration of bins per the Numerical Binning Scheme
  https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.arwagpbhlgr3

summaryfxn (percentiles)=> return {min, max, pX, pY, ...}
  - required function

  - must accept an array of desired percentile values
  and returns an object of computed properties
  {
    min: minimum value
    max: maximum value
    pX: percentile at X value, so p10 will be 10th percentile value
    pY: .. corresponding to the desired percentile values 
  }
*/
  const bc = binconfig
  validate_bins(bc)

  if (typeof summaryfxn != "function") throw "summaryfxn required for modules/termdb.bins.js get_bins()"
  const percentiles = target_percentiles(bc)
  const summary = summaryfxn(percentiles)
  if (!summary || typeof summary !== 'object') throw "invalid returned value by summaryfxn"

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
    : isNumeric(bc.last_bin.stop) && bc.last_bin.stop <= summary.max
    ? bc.last_bin.stop
    : summary.max
  const numericMax = isNumeric(max)
  const last_start = isNumeric(bc.last_bin.start_percentile)
    ? summary['p' + bc.last_bin.start_percentile]
    : isNumeric(bc.last_bin.start)
    ? bc.last_bin.start
    : undefined
  const numericLastStart = isNumeric(last_start)
  const last_stop = bc.last_bin.stopunbounded
    ? null 
    : bc.last_bin.stop_percentile
    ? summary['p' + bc.last_bin.stop_percentile]
    : isNumeric(bc.last_bin.stop)
    ? bc.last_bin.stop
    : null
  const numericLastStop = isNumeric(last_stop)

  if (!numericMax && !numericLastStart) throw "unable to compute the last bin start or stop"

  const bins = []
  let currBin = {
    startunbounded: bc.first_bin.startunbounded,
    start: bc.first_bin.startunbounded ? undefined : min,
    stop: isNumeric(bc.first_bin.stop_percentile) 
      ? +summary['p' + bc.first_bin.stop_percentile]
      : isNumeric(bc.first_bin.stop) 
      ? +bc.first_bin.stop 
      : min + bc.bin_size,
    startinclusive: bc.startinclusive,
    stopinclusive: bc.stopinclusive
  }
  
  if (!isNumeric(currBin.stop)) throw "the computed first_bin.stop is non-numeric" + currBin.stop
  const maxNumBins = 50 // harcoded limit for now to not stress sqlite

  while( (numericMax && currBin.stop <= max)
    || currBin.stopunbounded
  ) { 
    currBin.label = get_bin_label(currBin, bc)
    bins.push( currBin )
    if (currBin.stopunbounded || currBin.stop >= max) break

    const upper = currBin.stop + bc.bin_size;
    const previousStop = currBin.stop
    currBin = {
      startinclusive: bc.startinclusive,
      stopinclusive: bc.stopinclusive,
      start: previousStop,
      stop: numericLastStop && (previousStop == last_start || upper > last_stop)
        ? last_stop 
        : numericLastStart && upper > last_start && previousStop != last_start
        ? last_start
        : upper
    }

    if (currBin.stop >= max) {
      currBin.stop = max
      if (bc.last_bin.stopunbounded) currBin.stopunbounded = 1
      if (bc.last_bin.stopinclusive) currBin.stopinclusive = 1
    }
    if (numericLastStart && currBin.start == last_start) {
      if (bc.last_bin.stopunbounded) currBin.stopunbounded = 1
    }
    if (currBin.start > currBin.stop) {
      if (numericLastStart && currBin.stop == last_start && bc.last_bin.stopunbounded) currBin.stopunbounded = true
      else break
    }
    if (bins.length + 1 >= maxNumBins) {
      bc.error = "max_num_bins_reached"
      break
    }
  }
  bc.results = {summary}
  return bins
}

exports.compute_bins = compute_bins




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



function target_percentiles(binconfig) {
  const percentiles = []
  const f = binconfig.first_bin
  if (f && isNumeric(f.start_percentile)) percentiles.push(f.start_percentile)
  if (f && isNumeric(f.stop_percentile)) percentiles.push(f.stop_percentile)
  const l = binconfig.last_bin
  if (l && isNumeric(l.start_percentile)) percentiles.push(l.start_percentile)
  if (l && isNumeric(l.stop_percentile)) percentiles.push(l.stop_percentile)
  return percentiles
}

exports.target_percentiles = target_percentiles



function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

