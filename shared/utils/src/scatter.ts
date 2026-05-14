/** The scatter renders both on the client and the server.
 * The functions below are data processing and formatting utils used
 * in both contexts. */

export function getCoordinate(val: number, min: number | null, max: number | null) {
	if (min != null && val < min) return min
	if (max != null && val > max) return max
	return val
}
