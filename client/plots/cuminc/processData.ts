/** TODO: Mv any data processing and formatting out of the Cuminc and MassCumInc. 
 * Those methods should be encapsulated and tested. See accompanying unit test file. */

export function computeTickValues(min: number, max: number): number[] {
	// compute width between ticks for a maximum of 5 ticks
	const tickWidth = (max - min) / 5
	// round tick width to the nearest 5
	const log = Math.floor(Math.log10(tickWidth))
	const tickWidth_rnd = Math.round(tickWidth / (5 * 10 ** log)) * (5 * 10 ** log) || 1 * 10 ** log
	// compute tick values using tick width
	const tickValues: number[] = []
	let tick = min
	while (tick <= Math.min(100, max + tickWidth_rnd)) {
		// using max + tickWidth_rnd to ensure that
		// the last tick will be greater than the max
		// value of the data
		tickValues.push(tick)
		tick = tick + tickWidth_rnd
	}
	if (!tickValues.includes(0)) tickValues.unshift(0)
	return tickValues
}
