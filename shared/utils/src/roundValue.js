/*
round a value to specified digits
    - if value is integer, value is returned
    - if value is a fractional float, round to precision
    - if value is not a fractional float, round to decimal point
    - TODO: handle scientific notation
value: given value
digits: number of digits to round to
*/

export function roundValue(value, digits) {
	const v = Number(value)
	if (Number.isInteger(v)) return v
	if (Math.abs(v) < 1) return Number(v.toPrecision(digits))
	return Number(v.toFixed(digits))
}

/** Rounds numbers to the appropriate decimal point
 * if format is true, returns either a number or string in
 * scientific notation.
 *
 * TODO: Review digit logic.
 */

export function roundValueAuto(value, format = false) {
	if (!value && value != 0) return value
	const dp = decimalPlacesUntilFirstNonZero(value)
	const digits = Math.abs(value) > 1 ? 2 : dp > 0 ? dp + 1 : 2
	if (format) return formatValue(value, digits)
	return roundValue(value, digits)
}

export function decimalPlacesUntilFirstNonZero(number) {
	// Convert number to string
	const numberStr = number.toString()

	// Find the position of the decimal point
	const decimalIndex = numberStr.indexOf('.')

	// If decimal point is not found or number is an integer, return 0
	if (decimalIndex === -1 || decimalIndex === numberStr.length - 1) {
		return 0
	}

	// Iterate through characters after the decimal point
	let decimalPlaces = 0
	for (let i = decimalIndex + 1; i < numberStr.length; i++) {
		// Increment the count of decimal places until a non-zero digit is found
		if (numberStr[i] === '0') {
			decimalPlaces++
		} else if (numberStr[i] >= '1' && numberStr[i] <= '9') {
			break
		}
	}

	return decimalPlaces
}

/* 
simple logic to return a number close to original while rounding up decimals.
supplements roundValueAuto which rounds 12345 to 1.2e4 which is only suitable for human quick glance but not subsequent computing

TODO:
10000 and 10001 to 1e4
0.00001 to 1e-5
1.00001 to 1
*/
export function roundValue2(value) {
	if (!Number.isFinite(value)) return value // not a number
	if (Number.isInteger(value)) return value // is integer, do not convert
	const abs = Math.abs(value)
	if (abs > 100) return Math.round(value) // 12345.1234 to 12345 (compared to 1.2e4 from roundValueAuto)
	if (abs > 10) return Number(value.toFixed(1)) // 99.1234 to 99.1
	if (abs > 1) return Number(value.toFixed(2)) // 9.1234 to 9.12
	if (abs > 0.1) return Number(value.toFixed(3)) // 0.12345 to 0.123
	if (abs > 0.01) return Number(value.toFixed(4)) // 0.012345 to 0.0123
	return value // as is
}

/** Use to return displayed values in scientific notation
 * Do not use for values intended for calculation later.
 */
export function formatValue(value, digits) {
	const v = Number(value)
	if (Number.isInteger(v)) return v
	const abs = Math.abs(v)
	if (abs < 1 || abs > 9999) {
		//Number() reverts positive values less than 10^21 to a whole number
		//To return the value in scientific notation, use toPrecision without Number()
		return abs > 9999 ? v.toPrecision(digits) : Number(v.toPrecision(digits))
	}
	return Number(v.toFixed(digits))
}
