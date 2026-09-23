import type { Elem, Input } from '../types/d3'
import type { FullyBoundedBin } from '#types'

type TvsRange = FullyBoundedBin & { value?: number }
type Opts = {
	width?: string // width of input
	/** multiplier from the unit a term's values are stored in to the unit shown to users, from
	 * term.valueConversion (see getValueConversionFactor()). the range handed in and given back is
	 * always in the stored unit; only the text in the <input> is in the user-facing one */
	scaleFactor?: number
	/** the allowed bounds of a typed range, in the stored unit, e.g. 0 and 1 for a fraction. kept apart
	 * from the range, which is replaced by every parsed entry */
	min?: number | null
	max?: number | null
}

export class NumericRangeInput {
	callback: (f: any) => void
	input: Input
	range: any
	scaleFactor: number
	min?: number | null
	max?: number | null

	constructor(holder: Elem, range: any, callback: () => void, opts?: Opts) {
		this.scaleFactor = opts?.scaleFactor && opts.scaleFactor > 0 ? opts.scaleFactor : 1
		this.min = opts?.min
		this.max = opts?.max
		this.input = holder
			.append('input')
			.attr('name', 'rangeInput')
			.attr('aria-label', 'Leave blank for the allowed minimum value')
			.style('width', opts?.width || '180px')
			.style('margin', '3px 5px')
			//.style('font-size', '20px')
			.on('change', () => {
				try {
					this.parseRange()
				} catch (ex) {
					alert(ex)
					this.setRange()
				}
			})
		this.setRange(range)
		this.callback = callback
	}

	getInput() {
		return this.input
	}

	parseRange() {
		const str = this.input.node()!.value
		const new_range = toStoredUnits(parseRange(str), this.scaleFactor)
		this.validateBounds(new_range)
		this.range = new_range
		this.callback(new_range)
		return new_range
	}

	/** throws on a range that selects nothing within the allowed bounds. a bound at the min or max is
	 * allowed when inclusive, e.g. x>=1 for a fraction */
	validateBounds(r: any) {
		const min = this.min,
			max = this.max
		const minLabel = toDisplayValue(min, this.scaleFactor),
			maxLabel = toDisplayValue(max, this.scaleFactor)
		if (r.value != undefined) {
			if (min != undefined && r.value < min) throw `Invalid value < minimum allowed (${minLabel})`
			if (max != undefined && r.value > max) throw `Invalid value > maximum allowed (${maxLabel})`
			return
		}
		if (min != undefined) {
			if (!r.startunbounded && r.start < min) throw `Invalid start value < minimum allowed (${minLabel})`
			if (!r.stopunbounded && (r.stop < min || (r.stop == min && !r.stopinclusive)))
				throw `Invalid stop value ${r.stopinclusive ? '<' : '<='} minimum allowed (${minLabel})`
		}
		if (max != undefined) {
			if (!r.stopunbounded && r.stop > max) throw `Invalid stop value > maximum allowed (${maxLabel})`
			if (!r.startunbounded && (r.start > max || (r.start == max && !r.startinclusive)))
				throw `Invalid start value ${r.startinclusive ? '>' : '>='} maximum allowed (${maxLabel})`
		}
	}

	getRange() {
		return this.range
	}

	setRange(range?: TvsRange) {
		if (!range) range = this.range
		//When an error is thrown the previous range is restored
		else this.range = range

		//So ts doesn't complain
		if (!range) return
		const [start, stop] = formatRangeBounds(range, this.scaleFactor)
		this.input.node()!.value =
			range.value != undefined ? ` x=${toDisplayValue(range.value, this.scaleFactor)} ` : `${start} x ${stop}`
	}
}

/** convert a range parsed from the <input> text back to the unit its values are stored in */
function toStoredUnits(range: any, scaleFactor: number) {
	if (scaleFactor == 1) return range
	for (const k of ['start', 'stop', 'value']) {
		if (Number.isFinite(range[k])) range[k] = range[k] / scaleFactor
	}
	return range
}

/** a converted value is rounded, so that an input does not read 70.81451060916.
 * this makes the round trip through parseRange() lossy by up to half of the last shown digit,
 * which is immaterial for a filter range */
function toDisplayValue(v: any, scaleFactor: number) {
	if (scaleFactor == 1 || !Number.isFinite(Number(v))) return v
	return Number((Number(v) * scaleFactor).toFixed(2))
}

/** Format the start and stop of a range as displayed to the user, e.g. ['10 <', '<= 20'].
 *
 * A bound is exclusive unless the range marks it inclusive, matching how a range is
 * evaluated elsewhere, e.g. isInRange() on the server and the tvs pill label. The displayed
 * expression must round-trip through parseRange(), since the input text is the only source
 * of the applied range: rendering an exclusive bound as inclusive would silently widen a
 * saved range on apply.
 */
export function formatRangeBounds(range: any, scaleFactor = 1): [string, string] {
	const startV = toDisplayValue(range.start, scaleFactor)
	const stopV = toDisplayValue(range.stop, scaleFactor)
	const start = range.startunbounded || range.start == undefined ? '' : `${startV} ${range.startinclusive ? '<=' : '<'}`
	const stop = range.stopunbounded || range.stop == undefined ? '' : `${range.stopinclusive ? '<=' : '<'} ${stopV}`
	return [start, stop]
}

export function parseRange(str: string) {
	if (!str) throw 'Empty range'
	const tokens = str.replace(/\s/g, '').split('x')
	let start, stop, startinclusive, stopinclusive, value

	if (tokens[0]) parseRangeToken(tokens[0])
	if (tokens[1]) parseRangeToken(tokens[1])
	if (value != undefined) return { value, label: `x = ${value}` }
	const startunbounded = start === undefined
	const stopunbounded = stop === undefined

	if (!startunbounded && !stopunbounded && start > stop) throw 'start must be lower than stop'
	return { start, stop, value, startinclusive, stopinclusive, startunbounded, stopunbounded }

	function parseRangeToken(rangeToken) {
		const floatExpr = '[+-]?\\d+(\\.\\d+)?'

		if (new RegExp(`^${floatExpr}<$`).test(rangeToken) || new RegExp(`^>${floatExpr}$`).test(rangeToken)) {
			start = parseFloat(rangeToken.match(floatExpr))
			startinclusive = false
		} else if (new RegExp(`^${floatExpr}<=$`).test(rangeToken) || new RegExp(`^>=${floatExpr}$`).test(rangeToken)) {
			start = parseFloat(rangeToken.match(floatExpr))
			startinclusive = true
		} else if (new RegExp(`^${floatExpr}>$`).test(rangeToken) || new RegExp(`^<${floatExpr}$`).test(rangeToken)) {
			stop = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = false
		} else if (new RegExp(`^${floatExpr}>=$`).test(rangeToken) || new RegExp(`^<=${floatExpr}$`).test(rangeToken)) {
			stop = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = true
		} else if (new RegExp(`^${floatExpr}=$`).test(rangeToken) || new RegExp(`^=${floatExpr}$`).test(rangeToken)) {
			value = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = true
			startinclusive = true
		} else throw `Could not parse expression '${rangeToken}'`
	}
}
