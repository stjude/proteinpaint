const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')

function validate_bins(binconfig) {
	// Number.isFinite('1') returns false, which is desired

	const bc = binconfig
	if (!bc || typeof bc !== 'object') throw 'bin schema must be an object'

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

	const b = bc.last_bin
	if (b) {
		if (b.stopunbounded) {
			// requires start_percentile or start
			if (b.start_percentile) {
				if (!Number.isInteger(b.start_percentile)) throw 'last_bin.start_percentile should be integer'
				if (b.start_percentile <= 0 || b.start_percentile >= 100) throw 'last_bin.start_percentile out of bound (0-100)'
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
				if (!Number.isFinite(b.stop)) throw 'last_bin.stop not a number when neither startunbounded or stop_percentile'
			}
		}
	}
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

	if (typeof summaryfxn != 'function') throw 'summaryfxn required for modules/termdb.bins.js get_bins()'
	const percentiles = target_percentiles(bc)
	const summary = summaryfxn(percentiles)
	if (!summary || typeof summary !== 'object') throw 'invalid returned value by summaryfxn'
	bc.results = { summary }

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
	}
	const numericMax = isNumeric(max)
	const numericLastStart = isNumeric(last_start)
	const numericLastStop = isNumeric(last_stop)

	if (!numericMax && !numericLastStart) throw 'unable to compute the last bin start or stop'

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
	const maxNumBins = 50 // harcoded limit for now to not stress sqlite

	while ((numericMax && currBin.stop <= max) || currBin.stopunbounded) {
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
	return bins
}

exports.compute_bins = compute_bins

function get_bin_label(bin, binconfig) {
	/*
  Generate a numeric bin label given a bin configuration
*/
	const bc = binconfig

	// one side-unbounded bins
	// label will be ">v" or "<v"
	if (bin.startunbounded) {
		const oper = bin.stopinclusive ? '\u2264' : '<'
		const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
		return oper + v1
	}
	if (bin.stopunbounded) {
		const oper = bin.startinclusive ? '\u2265' : '>'
		const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
		return oper + v0
	}

	// two-sided bins
	// label cannot be the same as unbounded bins
	// otherwise, it can generate the same label ">15" for the last two bins (the last is stopunbounded)
	if (Number.isInteger(bc.bin_size)) {
		// bin size is integer, make nicer label
		if (bc.bin_size == 1) {
			// bin size is 1; use just start value as label, not a range
			return '' + bin.start //binLabelFormatter(start)
		}
		if (Number.isInteger(bin.start) || Number.isInteger(bin.stop)) {
			// else if ('label_offset' in binconfig) {
			// should change condition later to be detected via 'label_offset' in binconfig
			// so that the label_offset may be applied to floats also
			const label_offset = 1 // change to binconfig.label_offset later
			const min =
				'start' in binconfig.first_bin
					? binconfig.first_bin.start
					: 'start_percentile' in binconfig.first_bin
					? binconfig.results.summary['p' + binconfig.first_bin.start_percentile]
					: binconfig.results.summary.min
			const v0 = bin.startinclusive || bin.start == min ? bin.start : bin.start + label_offset // bin.start - 1 : bin.start
			const max = !binconfig.last_bin
				? binconfig.results.summary.max
				: 'stop' in binconfig.last_bin
				? binconfig.first_bin.stop
				: 'stop_percentile' in binconfig.last_bin
				? binconfig.results.summary['p' + binconfig.last_bin.stop_percentile]
				: binconfig.results.summary.max
			const v1 = bin.stopinclusive || bin.stop == max ? bin.stop : bin.stop - label_offset // bin.stop - 1 : bin.stop
			return v0 == v1 ? v0.toString() : v0 + ' to ' + v1
		}
		const oper0 = '' //bc.startinclusive ? "" : ">"
		const oper1 = '' //bc.stopinclusive ? "" : "<"
		const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
		const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
		return oper0 + v0 + ' to ' + oper1 + v1
	}

	// bin size not integer
	const oper0 = bc.startinclusive ? '' : '>'
	const oper1 = bc.stopinclusive ? '' : '<'
	const v0 = Number.isInteger(bin.start) ? bin.start : binLabelFormatter(bin.start)
	const v1 = Number.isInteger(bin.stop) ? bin.stop : binLabelFormatter(bin.stop)
	return oper0 + v0 + ' to ' + oper1 + v1
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
	return !isNaN(parseFloat(n)) && isFinite(n)
}
