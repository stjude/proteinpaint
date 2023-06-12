/*
this is a helper file with a collection of functions to be used in backend and client side code. Here is a list.

1. isNumeric(n) - checks whether given argument n is Numeric
2. TODO - move computepercentile, roundValue, etc here?

*/

export function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}
