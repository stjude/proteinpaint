/** The scatter renders both on the client and the server.
 * The consts and functions below are data processing and formatting utils used
 * in both contexts. */

export const xAxisOffSet = 80
export const yAxisOffSet = 30

export function getCoordinate(val: number, min: number | null, max: number | null) {
	if (min != null && val < min) return min
	if (max != null && val > max) return max
	return val
}

/** Extra space prevents clipping data points on the scale (i.e. plot axis) */
export function calculatePadding(minScale: number | null, maxScale: number | null, min: number, max: number) {
	return minScale != null || maxScale != null ? 0 : (max - min) * 0.01
}
