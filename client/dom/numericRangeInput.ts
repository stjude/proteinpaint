import type { Elem, Input } from '../types/d3'
import type { FullyBoundedBin } from '#types'

type TvsRange = FullyBoundedBin & { value?: number }
type Opts = {
	width?: string // width of input
	/** multiplier from the unit a term's values are stored in to the unit shown to users, from
	 * term.valueConversion (see getValueConversionFactor()). the range handed in and given back is
	 * always in the stored unit; only the text in the <input> is in the user-facing one */
	scaleFactor?: number
}

export class NumericRangeInput {
	callback: (f: any) => void
	input: Input
	range: any
	scaleFactor: number

	constructor(holder: Elem, range: any, callback: () => void, opts?: Opts) {
		this.scaleFactor = opts?.scaleFactor && opts.scaleFactor > 0 ? opts.scaleFactor : 1
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
		if (this.range?.min != undefined) {
			if (!new_range.startunbounded && this.range?.min > new_range.start) throw 'Invalid start value < minimum allowed'
			if (!new_range.stopunbounded && this.range?.min >= new_range.stop) throw 'Invalid stop value >= minimum allowed'
		}
		if (this.range?.max != undefined) {
			if (!new_range.stopunbounded && this.range?.max < new_range.stop) throw 'Invalid stop value > maximum allowed'

			if (!new_range.startunbounded && new_range.start >= this.range?.max)
				throw 'Invalid start value >= maximum allowed'
		}

		this.range = new_range
		this.callback(new_range)
		return new_range
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
