/**
 * Formats elapsed time in milliseconds to a human-readable string with appropriate units
 * @param ms - Elapsed time in milliseconds
 * @returns Formatted time string with appropriate unit
 */
export function formatElapsedTime(ms: number | unknown): string {
	// Handle non-numeric inputs
	if (typeof ms !== 'number') {
		return 'Invalid time: not a number'
	}

	// Handle NaN
	if (isNaN(ms)) {
		return 'Invalid time: NaN'
	}

	// Handle infinite values
	if (!isFinite(ms)) {
		return ms > 0 ? 'Infinite time' : '-Infinite time'
	}

	// Handle negative times (use absolute value but preserve sign in output)
	const absMs = Math.abs(ms)
	const sign = ms < 0 ? '-' : ''

	if (absMs < 1000) {
		return `${sign}${absMs}ms`
	} else if (absMs < 60000) {
		const seconds = (absMs / 1000).toFixed(2)
		return `${sign}${seconds}s`
	} else {
		const minutes = Math.floor(absMs / 60000)
		const seconds = ((absMs % 60000) / 1000).toFixed(2)
		return `${sign}${minutes}m ${seconds}s`
	}
}
