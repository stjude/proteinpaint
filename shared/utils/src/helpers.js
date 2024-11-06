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
export function convertUnits(v, fromUnit, toUnit, scaleFactor, compact) {
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

export function deepEqual(x, y) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
		if (Object.keys(x).length != Object.keys(y).length) {
			return false
		}

		for (var prop in x) {
			if (y.hasOwnProperty(prop)) {
				if (!deepEqual(x[prop], y[prop])) return false
			} else {
				return false
			}
		}
		return true
	} else return false
}
