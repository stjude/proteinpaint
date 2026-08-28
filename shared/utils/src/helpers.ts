/*
this is a helper file with a collection of functions to be used in backend and client side code. Here is a list.

1. isNumeric(n)
2. strictNumeric(n) 
2. convertUnits
3. TODO - move computepercentile, roundValue, etc here?
*/

// checks whether given argument n is Numeric, with option to cast from string
export function isNumeric(n) {
	const v = typeof n != 'string' || n === '' ? n : Number(n)
	const f = parseFloat(n)
	return !isNaN(f) && Number.isFinite(v) && v === f
}

// like isNumeric but does not cast from string
export function isStrictNumeric(n) {
	return typeof n === 'number' && Number.isFinite(n)
}

// converts a value from a unit to another unit
export function convertUnits(v, fromUnit, toUnit, scaleFactor, compact?: boolean) {
	// do floor() on toUnit
	// do ceil() on fromUnit, in case v is decimal (from violin range selection) and to keep showing integer fromUnit
	if (scaleFactor >= 1) {
		const toUnitV = Math.floor(v * scaleFactor)
		if (compact) return `${toUnitV}${toUnit.charAt(0)}`
		return `${toUnitV} ${toUnitV > 1 ? toUnit + 's' : ''}`
	}
	const toUnitV = Math.floor(v * scaleFactor)
	const fromUnitV = Math.ceil(v % (1 / scaleFactor))

	if (fromUnitV == 0) {
		if (compact) return `${toUnitV}${toUnit.charAt(0)}`
		return `${toUnitV} ${toUnitV > 1 ? toUnit + 's' : ''}`
	}

	if (compact) return `${toUnitV}${toUnit.charAt(0)}${fromUnitV}${fromUnit.charAt(0)}`
	return `${toUnitV} ${toUnitV > 1 ? toUnit + 's' : toUnit} ${fromUnitV} ${fromUnitV > 1 ? fromUnit + 's' : fromUnit}`
}

/*
term.valueConversion{} declares that a term's values are stored in .fromUnit (e.g. day), while
.toUnit (e.g. year) is the unit that is meaningful to a user. convertUnits() above formats a value
for display; this instead returns the plain multiplier, for code that must compute on the converted
value rather than print it (e.g. regression, so that a model estimate is per year and not per day).
returns 1 when the term has no valueConversion, so that callers may multiply unconditionally
*/
export function getValueConversionFactor(term): number {
	const f = Number(term?.valueConversion?.scaleFactor)
	return Number.isFinite(f) && f > 0 ? f : 1
}

/*
the pair below moves a numeric value across the boundary between what is stored and what is shown.
a term's values, and everything derived from them that is persisted (bin boundaries, tvs ranges,
spline knots), stay in .fromUnit, because that is what the server filters and bins by. only what a
user reads or types is in .toUnit. so a ui that shows an editable number calls toUserUnit() to fill
the input and toStoredUnit() to read it back

toUserUnit() rounds, since an unrounded 70.81451060916 is no more readable than the raw value it
replaced. that makes the round trip lossy by up to half of the last shown digit, which is immaterial
for a bin boundary or filter range but is why toStoredUnit() does not round again
*/
export function toUserUnit(v, term, digits = 2) {
	if (!isConvertible(v, term)) return v
	return Number((Number(v) * getValueConversionFactor(term)).toFixed(digits))
}

export function toStoredUnit(v, term): number {
	if (!isConvertible(v, term)) return v
	return Number(v) / getValueConversionFactor(term)
}

/* a blank or non-numeric input is handed back untouched rather than coerced, so that a caller's
own handling of it (an empty <input>, an unbounded bin edge) is not silently turned into a 0 */
function isConvertible(v, term) {
	if (getValueConversionFactor(term) == 1) return false
	if (v === '' || v === null || v === undefined) return false
	return Number.isFinite(Number(v))
}

export function deepEqual(x, y) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
		if (Object.keys(x).length != Object.keys(y).length) {
			return false
		}

		for (const prop of Object.keys(x)) {
			if (Object.prototype.hasOwnProperty.call(y, prop)) {
				if (!deepEqual(x[prop], y[prop])) return false
			} else {
				return false
			}
		}
		return true
	} else return false
}

/* one entry out of a ds's uiLabels{}, which lets a dataset rename what the ui calls things (gdc
counts cases, not samples). an entry is `string | {label, ...}` -- the object form is what term2/term0
use to carry a tooltip -- so a caller reaching for uiLabels[key] directly gets '[object Object]' where
it interpolates, or a throw where it calls a string method. one accessor rather than the same
narrowing at every call site. */
export function uiLabel(uiLabels: any, key: string, fallback: string): string {
	const v = uiLabels?.[key]
	if (typeof v == 'string') return v
	if (v && typeof v.label == 'string') return v.label
	return fallback
}

export function deepFreeze(obj) {
	Object.freeze(obj)
	// not using for..in loop, in order to not descend into inherited props/methods
	for (const value of Object.values(obj)) {
		if (value !== null && typeof value == 'object') deepFreeze(value)
	}
	return obj
}

export class CustomError extends Error {
	level = '' // '' | 'warn'
	code?: string

	constructor(message, opts: { name?: string; code?: string; level?: string } = {}) {
		super(message)
		if (opts.name) this.name = opts.name
		if (opts.code) this.code = opts.code
		if (opts.level) this.level = opts.level
	}
}
