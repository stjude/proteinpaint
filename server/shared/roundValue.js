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

export function roundValueAuto(value) {
	const dp = decimalPlacesUntilFirstNonZero(value)
	let digits = Math.abs(value) > 1 ? 2 : dp > 0 ? dp + 1 : 2

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
