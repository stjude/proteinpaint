import * as d3format from 'd3-format'

export function validate_bins(binconfig) {
	// Number.isFinite('1') returns false, which is desired

	const bc = binconfig
	if (!bc || typeof bc !== 'object') throw 'bin schema must be an object'
	// assign default type
	if (!('type' in bc)) bc.type = 'regular'

	if (bc.type == 'custom') {
		if (!Array.isArray(bc.lst)) throw 'binconfig.lst must be an array'
		if (!bc.lst.length) throw 'binconfig.lst must have entries'
		const first_bin = bc.lst[0]
		const last_bin = bc.lst[bc.lst.length - 1]

		for (const bin of bc.lst) {
			if (!('startinclusive' in bin) && !('stopinclusive' in bin)) {
				throw 'custom bin.startinclusive and/or bin.stopinclusive must be defined'
			}

			if (bin == first_bin) {
				if (!('startunbounded' in bin) && !('start' in bin)) {
					throw `the first bin must define either startunbounded or start`
				}
				if (!bin.startunbounded) {
					if (!isNumeric(bin.start)) throw 'bin.start must be numeric for a bounded first bin'
				}
			} else {
				if (!isNumeric(bin.start)) throw 'bin.start must be numeric for a non-first bin'
			}

			if (bin == last_bin) {
				if (!('stopunbounded' in bin) && !('stop' in bin)) {
					throw `the last bin must define either stopunbounded or stop`
				}
				if (!bin.stopunbounded) {
					if (!isNumeric(bin.stop)) throw 'bin.stop must be numeric for a bounded last bin'
				}
			} else {
				if (!isNumeric(bin.stop)) throw 'bin.stop must be numeric for a non-last bin'
			}
		}
	} else if (bc.type == 'regular') {
		// required custom_bin parameter
		if (!Number.isFinite(bc.bin_size)) throw 'non-numeric bin_size'
		if (bc.bin_size <= 0) throw 'bin_size must be greater than 0'

		if (!bc.startinclusive && !bc.stopinclusive) {
			bc.startinclusive = 1
			bc.stopinclusive = 0
		}

		if (!bc.first_bin) throw 'first_bin{} missing'
		if (typeof bc.first_bin != 'object') throw 'first_bin{} is not an object'
		if (!Object.keys(bc.first_bin).length) throw 'first_bin is an empty object'

		{
			const b = bc.first_bin
			if (b.startunbounded) {
				// requires stop_percentile, or stop
				if (b.stop_percentile) {
					if (!Number.isInteger(b.stop_percentile)) throw 'first_bin.stop_percentile should be integer'
					if (b.stop_percentile <= 0 || b.stop_percentile >= 100) throw 'first_bin.stop_percentile out of bound (0-100)'
				} else {
					if (!Number.isFinite(b.stop))
						throw 'first_bin.stop should be a number when startunbounded and stop_percentile is not set'
				}
			} else {
				if (b.start_percentile) {
					if (!Number.isInteger(b.start_percentile)) throw 'first_bin.start_percentile should be integer'
					if (b.start_percentile <= 0 || b.start_percentile >= 100)
						throw 'first_bin.start_percentile out of bound (0-100)'
				} else {
					if (!Number.isFinite(b.start))
						throw 'first_bin.start not a number when neither startunbounded or start_percentile'
				}
				// stop is not required
			}
		}

		if (bc.last_bin) {
			const b = bc.last_bin
			if (b.stopunbounded) {
				// requires start_percentile or start
				if (b.start_percentile) {
					if (!Number.isInteger(b.start_percentile)) throw 'last_bin.start_percentile should be integer'
					if (b.start_percentile <= 0 || b.start_percentile >= 100)
						throw 'last_bin.start_percentile out of bound (0-100)'
				} else {
					if (!Number.isFinite(b.start))
						throw 'last_bin.start not a number when is stopunbounded and start_percentile is not set'
				}
			} else {
				// requires stop
				if (b.stop_percentile) {
					if (!Number.isInteger(b.stop_percentile)) throw 'last_bin.stop_percentile should be integer'
					if (b.stop_percentile <= 0 || b.stop_percentile >= 100) throw 'last_bin.stop_percentile out of bound (0-100)'
				} else {
					if (!Number.isFinite(b.stop))
						throw 'last_bin.stop not a number when neither startunbounded or stop_percentile'
				}
			}
		}
	} else {
		throw `invalid binconfig.type="${bc.type}"`
	}
}

export function compute_bins(binconfig, summaryfxn) {
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
	if (bc.type == 'custom') return JSON.parse(JSON.stringify(bc.lst))
	if (typeof summaryfxn != 'function') throw 'summaryfxn required for modules/termdb.bins.js compute_bins()'
	const percentiles = target_percentiles(bc)
	const summary = summaryfxn(percentiles)
	if (!summary || typeof summary !== 'object') throw 'invalid returned value by summaryfxn'
	bc.results = { summary }
	if (!bc.binLabelFormatter) bc.binLabelFormatter = getNumDecimalsFormatter(bc)

	const orderedLabels = []
	const min = bc.first_bin.startunbounded
		? summary.min
		: bc.first_bin.start_percentile
		? summary['p' + bc.first_bin.start_percentile]
		: bc.first_bin.start

	// following about last_bin are quick-fix
	let max = summary.max,
		last_start,
		last_stop
	if (bc.last_bin) {
		max = bc.last_bin.stopunbounded
			? summary.max
			: bc.last_bin.stop_percentile
			? summary['p' + bc.last_bin.stop_percentile]
			: isNumeric(bc.last_bin.stop) && bc.last_bin.stop <= summary.max
			? bc.last_bin.stop
			: summary.max
		last_start = isNumeric(bc.last_bin.start_percentile)
			? summary['p' + bc.last_bin.start_percentile]
			: isNumeric(bc.last_bin.start)
			? bc.last_bin.start
			: undefined
		last_stop = bc.last_bin.stopunbounded
			? null
			: bc.last_bin.stop_percentile
			? summary['p' + bc.last_bin.stop_percentile]
			: isNumeric(bc.last_bin.stop)
			? bc.last_bin.stop
			: null
	} else if (bc.lst) {
		const last_bin = bc.lst[bc.lst.length - 1]
		last_start = last_bin.start
		last_stop = 'stop' in last_bin && !last_bin.stopunbounded ? last_bin.stop : summary.max
		max = last_stop
	} else {
		last_start = summary.max
		last_stop = summary.max
	}
	const numericMax = isNumeric(max)
	const numericLastStart = isNumeric(last_start)
	const numericLastStop = isNumeric(last_stop)

	if (!numericMax && !numericLastStart) return [] //throw 'unable to compute the last bin start or stop'

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

	if (!isNumeric(currBin.stop)) throw 'the computed first_bin.stop is non-numeric' + currBin.stop
	const maxNumBins = 100 // harcoded limit for now to not stress sqlite

	while ((numericMax && currBin.stop <= max) || (currBin.startunbounded && !bins.length) || currBin.stopunbounded) {
		currBin.label = get_bin_label(currBin, bc)
		bins.push(currBin)
		if (currBin.stopunbounded || currBin.stop >= max) break

		const upper = currBin.stop + bc.bin_size
		const previousStop = currBin.stop
		currBin = {
			startinclusive: bc.startinclusive,
			stopinclusive: bc.stopinclusive,
			start: previousStop,
			stop:
				numericLastStop && (previousStop == last_start || upper > last_stop)
					? last_stop
					: numericLastStart && upper > last_start && previousStop != last_start
					? last_start
					: upper
		}

		if (currBin.stop >= max) {
			currBin.stop = max
			if (bc.last_bin && bc.last_bin.stopunbounded) currBin.stopunbounded = 1
			if (bc.last_bin && bc.last_bin.stopinclusive) currBin.stopinclusive = 1
		}
		if (numericLastStart && currBin.start == last_start) {
			if (bc.last_bin && bc.last_bin.stopunbounded) currBin.stopunbounded = 1
		}
		if (currBin.start > currBin.stop) {
			if (numericLastStart && currBin.stop == last_start && bc.last_bin && bc.last_bin.stopunbounded)
				currBin.stopunbounded = true
			else break
		}
		if (bins.length + 1 >= maxNumBins) {
			bc.error = 'max_num_bins_reached'
			break
		}
	}
	delete bc.binLabelFormatter
	return bins
}

function getNumDecimalsFormatter(bc) {
	return d3format.format('rounding' in bc ? bc.rounding : 'd')
}

export function get_bin_label(bin, binconfig) {
	/*
  Generate a numeric bin label given a bin configuration
*/
	const bc = binconfig
	if (!bc.binLabelFormatter) bc.binLabelFormatter = getNumDecimalsFormatter(bc)
	if (!bin.startunbounded && !bin.stopunbounded && !('startinclusive' in bin) && !('stopinclusive' in bin)) {
		if (bc.startinclusive) bin.startinclusive = true
		else if (bc.stopinclusive) bin.stopinclusive = true
	}

	const label_offset = 'label_offset' in bc ? bc.label_offset : 0
	/*
	  NOTE: The first_bin and last_bin are assigned in compute_bins,
	  so these min and max values are not needed for generating
	  labels. Will keep this code here for now for reference.

	const min = !bc.first_bin
		? bc.results.summary.min
		: 'start' in bc.first_bin
		? bc.first_bin.start
		: 'start_percentile' in bc.first_bin
		? bc.results.summary['p' + bc.first_bin.start_percentile]
		: bc.results.summary.min
	const max = !bc.last_bin
		? bc.results.summary.max
		: 'stop' in bc.last_bin
		? bc.last_bin.stop
		: 'stop_percentile' in bc.last_bin
		? bc.results.summary['p' + bc.last_bin.stop_percentile]
		: bc.results.summary.max
	*/

	// one side-unbounded bins
	// label will be ">v" or "<v"
	if (bin.startunbounded) {
		const oper = bin.stopinclusive ? '≤' : '<' // \u2264
		const v1 = bc.binLabelFormatter(bin.stop) //bin.startinclusive && label_offset ? bin.stop - label_offset : bin.stop)
		return oper + v1
	}
	if (bin.stopunbounded) {
		const oper = bin.startinclusive /*|| label_offset*/ ? '≥' : '>' // \u2265
		const v0 = bc.binLabelFormatter(bin.start) //bin.startinclusive || bin.start == min ? bin.start : bin.start + label_offset)
		return oper + v0
	}

	// two-sided bins
	if (label_offset && bin.startinclusive && !bin.stopinclusive) {
		if (Math.abs(bin.start - bin.stop) === label_offset) {
			// make a simpler label when the range simply spans the bin_size
			return '' + bin.start
		} else {
			const v0 = bc.binLabelFormatter(bin.start)
			const v1 = bc.binLabelFormatter(bin.stop - label_offset)
			// ensure that last two bin labels make sense (the last is stopunbounded)
			return +v0 >= +v1 ? v0.toString() : v0 + ' to ' + v1
		}
	} else {
		// stop_inclusive || label_offset == 0
		const oper0 = bin.startinclusive ? '' : '>'
		const oper1 = bin.stopinclusive ? '' : '<'
		const v0 = Number.isInteger(bin.start) ? bin.start : bc.binLabelFormatter(bin.start)
		const v1 = Number.isInteger(bin.stop) ? bin.stop : bc.binLabelFormatter(bin.stop)
		return oper0 + v0 + ' to ' + oper1 + v1
	}
}

export function target_percentiles(binconfig) {
	const percentiles = []
	const f = binconfig.first_bin
	if (f && isNumeric(f.start_percentile)) percentiles.push(f.start_percentile)
	if (f && isNumeric(f.stop_percentile)) percentiles.push(f.stop_percentile)
	const l = binconfig.last_bin
	if (l && isNumeric(l.start_percentile)) percentiles.push(l.start_percentile)
	if (l && isNumeric(l.stop_percentile)) percentiles.push(l.stop_percentile)
	return percentiles
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}
