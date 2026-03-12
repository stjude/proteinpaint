function formatElapsedTime(ms, precision = 2) {
	if (typeof ms !== 'number' || isNaN(ms)) {
		return typeof ms !== 'number' ? 'Invalid time: not a number' : 'Invalid time: NaN'
	}
	if (!isFinite(ms)) {
		return ms > 0 ? 'Infinite time' : '-Infinite time'
	}
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
export { formatElapsedTime }
