/*
round a value to specified digits
    - if value is integer, value is returned
    - if value is a fractional float, round to precision
    - if value is not a fractional float, round to decimal point
    - TODO: handle scientific notation
value: given value
digits: number of digits to round to
*/
module.exports = function roundValue(value, digits) {
	const v = Number(value)
	if (Number.isInteger(v)) return v
	if (Math.abs(v) < 1) return Number(v.toPrecision(digits))
	return Number(v.toFixed(digits))
}
