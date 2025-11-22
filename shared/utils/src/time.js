/**
 * Format elapsed time in milliseconds to a human-readable string
 * Handles negative times (preserves sign) for defensive programming - useful when
 * calculating time differences that might be in the wrong order (e.g., startTime - endTime)
 * @param {number} ms - Time in milliseconds
 * @param {number} [precision=2] - Number of decimal places for seconds (optional, defaults to 2)
 * @returns {string} Formatted time string with units
 */
export function formatElapsedTime(ms, precision = 2) {
	// Handle all invalid cases
	if (typeof ms !== 'number' || isNaN(ms)) {
		return typeof ms !== 'number' ? 'Invalid time: not a number' : 'Invalid time: NaN'
	}
	if (!isFinite(ms)) {
		return ms > 0 ? 'Infinite time' : '-Infinite time'
	}

	// This additional logic is for handling negative times and preserving the sign in the output
	const absMs = Math.abs(ms)
	const sign = ms < 0 ? '-' : ''

	if (absMs < 1e3) {
		return `${sign}${absMs}ms`
	}
	if (absMs < 6e4) {
		return `${sign}${(absMs / 1e3).toFixed(precision)}s`
	}
	const minutes = Math.floor(absMs / 6e4)
	const seconds = ((absMs % 6e4) / 1e3).toFixed(precision)
	return `${sign}${minutes}m ${seconds}s`
}
