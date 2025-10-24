import { format } from 'd3-format'
import { getColors } from './common.js'
import { isStrictNumeric, convertUnits } from './helpers.js'

export default function validate_bins(binconfig) {
	// Number.isFinite('1') returns false, which is desired

	const bc = binconfig
	if (!bc || typeof bc !== 'object') throw 'bin schema must be an object'
	// assign default type
	if (!('type' in bc)) bc.type = 'regular-bin'

	if (bc.type == 'custom-bin') {
		if (!Array.isArray(bc.lst)) throw 'binconfig.lst must be an array'
		if (!bc.lst.length) throw 'binconfig.lst must have entries'
		const first_bin = bc.lst[0]
		const last_bin = bc.lst[bc.lst.length - 1]

		for (const bin of bc.lst) {
			if (!('startinclusive' in bin) && !('stopinclusive' in bin)) {
				throw 'custom bin.startinclusive and/or bin.stopinclusive must be defined'
			}

			if (bin == first_bin) {
				if ('startunbounded' in bin && !bin.startunbounded) {
					throw `a custom first bin must not set bin.startunbounded to false`
				}
				bin.startunbounded = true
				if ('start' in bin) {
					throw 'a custom first bin must not set a bin.start value'
				}
				if ('start_percentile' in bin) {
					throw 'the first bin must not set a bin.start_percentile value'
				}
				if (!('stop' in bin)) {
					throw `a custom first bin must define a bin.stop value`
				}
				if (!isStrictNumeric(bin.stop)) {
					throw `a custom first bin.stop value should be numeric`
				}
			} else if (bin == last_bin) {
				if (!('start' in bin)) {
					throw `a custom last bin must define a bin.start value`
				}
				if (!isStrictNumeric(bin.start)) {
					throw `a custom last bin.start must be numeric`
				}
				if ('stopunbounded' in bin && !bin.stopunbounded) {
					throw 'a custom last bin must not set bin.stopunbounded to false'
				}
				bin.stopunbounded = true
				if ('stop' in bin) {
					throw 'a custom last bin must not set a bin.stop value'
				}
			} else {
				if (bin.startunbounded || bin.stopunbounded) {
					throw 'bin.startunbounded and bin.stopunbounded must not be set for non-first/non-last bins'
				}
				if (!isStrictNumeric(bin.start)) throw 'bin.start must be numeric for a non-first bin'
				if (!isStrictNumeric(bin.stop)) throw 'bin.stop must be numeric for a non-last bin'
			}
		}
	} else if (bc.type == 'regular-bin') {
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
			b.startunbounded = true
			// requires stop_percentile, or stop
			if (b.stop_percentile) {
				if (!Number.isInteger(b.stop_percentile)) throw 'first_bin.stop_percentile should be integer'
				if (b.stop_percentile <= 0 || b.stop_percentile >= 100) throw 'first_bin.stop_percentile out of bound (0-100)'
			} else if (!Number.isFinite(b.stop)) {
				throw 'first_bin.stop not a number when stop_percentile is not set'
			}
		}

		if (bc.last_bin) {
			const b = bc.last_bin
			// requires start_percentile or start
			if (b.start_percentile) {
				if (!Number.isInteger(b.start_percentile)) throw 'last_bin.start_percentile should be integer'
				if (b.start_percentile <= 0 || b.start_percentile >= 100) throw 'last_bin.start_percentile out of bound (0-100)'
			} else if (!Number.isFinite(b.start)) {
				throw 'last_bin.start not a number when start_percentile is not set'
			}

			b.stopunbounded = true
			if ('stop' in b) {
				throw 'a regular last bin must not set a bin.stop value'
			}
		}
	} else {
		throw `invalid binconfig.type="${bc.type}"`
	}
}

export function compute_bins(binconfig, summaryfxn, valueConversion) {
	/*
  Bins generator
  
binconfig   
  configuration of bins per the Numerical Binning Scheme

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
	if (bc.lst) {
		const k2c = getColors(bc.lst.length) //to color bins
		for (const bin of bc.lst) bin.color = k2c(bin.label)
	}
	if (bc.type == 'custom-bin') return JSON.parse(JSON.stringify(bc.lst))
	if (typeof summaryfxn != 'function') throw 'summaryfxn required for modules/termdb.bins.js compute_bins()'
	const percentiles = target_percentiles(bc)
	const summary = summaryfxn(percentiles)
	if (!summary || typeof summary !== 'object') throw 'invalid returned value by summaryfxn'
	bc.results = { summary }
	if (!bc.binLabelFormatter) bc.binLabelFormatter = getNumDecimalsFormatter(bc)

	const orderedLabels = []
	// round the min and max values for use as bin start and stop
	// in the first and last bins, respectively
	const minFloor = Math.floor(summary.min * 100) / 100
	const maxCeil = Math.ceil(summary.max * 100) / 100
	const min = bc.first_bin.startunbounded
		? minFloor
		: bc.first_bin.start_percentile
		? summary['p' + bc.first_bin.start_percentile]
		: bc.first_bin.start
	let max = maxCeil, // in order to include the max value in the last bin
		last_start,
		last_stop

	if (bc.last_bin) {
		max = bc.last_bin.stopunbounded
			? maxCeil // in order to include the max value in the last bin
			: bc.last_bin.stop_percentile
			? summary['p' + bc.last_bin.stop_percentile]
			: isNumeric(bc.last_bin.stop) && bc.last_bin.stop <= summary.max // '0.0088' < 0.0088
			? bc.last_bin.stop
			: maxCeil // in order to include the max value in the last bin
		last_start = isStrictNumeric(bc.last_bin.start_percentile)
			? summary['p' + bc.last_bin.start_percentile]
			: isStrictNumeric(bc.last_bin.start)
			? bc.last_bin.start
			: undefined
		last_stop = bc.last_bin.stopunbounded
			? null
			: bc.last_bin.stop_percentile
			? summary['p' + bc.last_bin.stop_percentile]
			: isStrictNumeric(bc.last_bin.stop)
			? bc.last_bin.stop
			: null
	} else if (bc.lst) {
		const last_bin = bc.lst[bc.lst.length - 1]
		last_start = last_bin.start
		last_stop = 'stop' in last_bin && !last_bin.stopunbounded ? last_bin.stop : maxCeil
		max = last_stop
	} else {
		last_start = maxCeil
		last_stop = maxCeil
	}

	const numericMax = isStrictNumeric(max)
	const numericLastStart = isStrictNumeric(last_start)
	const numericLastStop = isStrictNumeric(last_stop)

	if (!numericMax && !numericLastStart) return [] //throw 'unable to compute the last bin start or stop'

	const bins = []
	let currBin = {
		startunbounded: bc.first_bin.startunbounded,
		start: bc.first_bin.startunbounded ? undefined : min,
		stop: isStrictNumeric(bc.first_bin.stop_percentile)
			? +summary['p' + bc.first_bin.stop_percentile]
			: isStrictNumeric(bc.first_bin.stop)
			? +bc.first_bin.stop
			: min + bc.bin_size,
		startinclusive: bc.startinclusive,
		stopinclusive: bc.stopinclusive
	}

	if (!isStrictNumeric(currBin.stop)) throw 'the computed first_bin.stop is non-numeric' + currBin.stop
	const maxNumBins = 100 // harcoded limit for now to not stress sqlite

	while ((numericMax && currBin.stop <= max) || (currBin.startunbounded && !bins.length) || currBin.stopunbounded) {
		bins.push(currBin)
		// force a computed last bin to have stopunbounded true
		if (currBin.stop >= max) {
			currBin.stopunbounded = true
			if (bins.length > 1) {
				delete currBin.stop
			}
		}
		currBin.label = get_bin_label(currBin, bc, valueConversion)
		if (currBin.stopunbounded) break

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
	if (bins.length > 1) {
		delete bins[bins.length - 1].stop
	}
	const k2c = getColors(bins.length) //to color bins
	for (const bin of bins) bin.color = k2c(bin.label)
	return bins
}

function getNumDecimalsFormatter(bc) {
	//return format('rounding' in bc ? bc.rounding : '')
	return 'rounding' in bc ? format(bc.rounding) : d => d // default to labeling using the start/stop value as-is
}

export function get_bin_label(bin, binconfig, valueConversion) {
	/*
  Generate a numeric bin label given a bin configuration and an optional term valueConversion object
*/
	if (bin.label) return bin.label

	const bc = binconfig
	if (!bc.binLabelFormatter) bc.binLabelFormatter = getNumDecimalsFormatter(bc)
	if (!bin.startunbounded && !bin.stopunbounded && !('startinclusive' in bin) && !('stopinclusive' in bin)) {
		if (bc.startinclusive) bin.startinclusive = true
		else if (bc.stopinclusive) bin.stopinclusive = true
	}

	const start = bc.use_as == 'bins' || bin.start
	const stop = bc.use_as == 'bins' || bin.stop

	let label_offset = 0
	if ('label_offset' in bc) {
		bc.label_offset_ignored = 'bin_size' in bc && bc.bin_size < bc.label_offset
		if (!bc.label_offset_ignored) label_offset = bc.label_offset
	} else if (bc.bin_size === 1 && bc.termtype == 'integer') {
		label_offset = 1
	}

	// one side-unbounded bins
	// label will be ">v" or "<v"
	if (bin.startunbounded) {
		const oper = bin.stopinclusive ? '≤' : '<' // \u2264
		const v1 = valueConversion
			? convertUnits(stop, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
			: bc.binLabelFormatter(stop) //bin.startinclusive && label_offset ? stop - label_offset : stop)
		return oper + v1
	}
	// a data value may coincide with the last bin's start
	if (bin.stopunbounded || start === stop) {
		const oper = bin.startinclusive /*|| label_offset*/ ? '≥' : '>' // \u2265
		const v0 = valueConversion
			? convertUnits(start, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
			: bc.binLabelFormatter(start) //bin.startinclusive || start == min ? start : start + label_offset)
		return oper + v0
	}

	// two-sided bins
	if (label_offset && bin.startinclusive && !bin.stopinclusive) {
		if (Number.isInteger(bc.bin_size) && Math.abs(start - stop) === label_offset) {
			// make a simpler label when the range simply spans the bin_size
			return (
				'' +
				(valueConversion
					? convertUnits(start, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
					: bc.binLabelFormatter(start))
			)
		} else {
			const v0 = valueConversion
				? convertUnits(start, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
				: bc.binLabelFormatter(start)
			const v1 = valueConversion
				? convertUnits(
						stop - label_offset,
						valueConversion.fromUnit,
						valueConversion.toUnit,
						valueConversion.scaleFactor,
						true
				  )
				: bc.binLabelFormatter(stop - label_offset)
			// ensure that last two bin labels make sense (the last is stopunbounded)
			return +v0 >= +v1 ? v0.toString() : v0 + ' to ' + v1
		}
	} else {
		// stop_inclusive || label_offset == 0
		const oper0 = bin.startinclusive ? '' : '>'
		const oper1 = bin.stopinclusive ? '' : '<'
		const v0 = valueConversion
			? convertUnits(start, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
			: Number.isInteger(start)
			? start
			: bc.binLabelFormatter(start)
		const v1 = valueConversion
			? convertUnits(stop, valueConversion.fromUnit, valueConversion.toUnit, valueConversion.scaleFactor, true)
			: Number.isInteger(stop)
			? stop
			: bc.binLabelFormatter(stop)
		// after rounding the bin labels, the bin start may equal the last bin stop as derived from actual data
		if (+v0 >= +v1) {
			const oper = bin.startinclusive ? '≥' : '>' // \u2265
			return oper + v0
		} else {
			return oper0 + v0 + ' to ' + oper1 + v1
		}
	}
}

// get bin range equation from bin label and bin properties
export function get_bin_range_equation(bin, binconfig) {
	const x = '<span style="font-family:Times;font-style:italic;">x</span>'
	let range_eq
	// should always use computed (not user-customized) bin label to determine bin range text
	const copy = structuredClone(bin)
	copy.label = '' // mutate only the copy, and not the original bin argument
	const bin_label = get_bin_label(copy, binconfig)
	if (bin.startunbounded || bin.stopunbounded) {
		// first or last bins, e.g. x ≤ 14 and x > 16
		range_eq = x + ' ' + bin_label
	} else if (bin.startinclusive) {
		// bins with startinclusive, e.g. 14 ≤ x < 16
		range_eq = bin_label.replace('to <', '≤ ' + x + ' <')
	} else if (bin.stopinclusive) {
		// bins with stopinclusive, e.g. 14 < x ≤ 16
		range_eq = bin_label.replace('>', '').replace('to', '< ' + x + ' ≤')
	}
	return range_eq
}

export function target_percentiles(binconfig) {
	const percentiles = []
	const f = binconfig.first_bin
	if (f && isStrictNumeric(f.start_percentile)) percentiles.push(f.start_percentile)
	if (f && isStrictNumeric(f.stop_percentile)) percentiles.push(f.stop_percentile)
	const l = binconfig.last_bin
	if (l && isStrictNumeric(l.start_percentile)) percentiles.push(l.start_percentile)
	if (l && isStrictNumeric(l.stop_percentile)) percentiles.push(l.stop_percentile)
	return percentiles
}
