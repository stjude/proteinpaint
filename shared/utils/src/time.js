function formatElapsedTime(ms) {
	if (typeof ms !== 'number') {
		return 'Invalid time: not a number'
	}
	if (isNaN(ms)) {
		return 'Invalid time: NaN'
	}
	if (!isFinite(ms)) {
		return ms > 0 ? 'Infinite time' : '-Infinite time'
	}
	const absMs = Math.abs(ms)
	const sign = ms < 0 ? '-' : ''
	if (absMs < 1e3) {
		return `${sign}${absMs}ms`
	} else if (absMs < 6e4) {
		const seconds = (absMs / 1e3).toFixed(2)
		return `${sign}${seconds}s`
	} else {
		const minutes = Math.floor(absMs / 6e4)
		const seconds = ((absMs % 6e4) / 1e3).toFixed(2)
		return `${sign}${minutes}m ${seconds}s`
	}
}
export { formatElapsedTime }
