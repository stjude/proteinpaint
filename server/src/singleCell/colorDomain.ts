import type { FormattedCell2Sample, TermdbSingleCellPlotsRequest } from '#types'

/** Resolve numeric-column colors from the same visible cells used for rendering.
 * Only percentile mode allocates a distribution; automatic mode needs just extrema. */
export function getNumericColorDomain(
	samples: FormattedCell2Sample[],
	settings: TermdbSingleCellPlotsRequest['canvasSettings']
): [number, number] {
	const mode = settings.colorScaleMode || 'auto'
	if (mode == 'fixed') {
		const min = settings.colorScaleMinFixed
		const max = settings.colorScaleMaxFixed
		if (!Number.isFinite(min) || !Number.isFinite(max) || min! > max!) {
			throw new Error('Fixed color scale requires finite bounds with min <= max')
		}
		return [min!, max!]
	}
	if (mode != 'auto' && mode != 'percentile') throw new Error('Invalid color scale mode')
	const percentile = settings.colorScalePercentile ?? 95
	if (mode == 'percentile' && (!Number.isFinite(percentile) || percentile < 0 || percentile > 100)) {
		throw new Error('Color scale percentile must be between 0 and 100')
	}
	const values = mode == 'percentile' ? new Float64Array(samples.length) : undefined
	let min = Infinity, max = -Infinity, count = 0
	for (const sample of samples) {
		if (sample.category == null || String(sample.category).trim() === '') continue
		const value = Number(sample.category)
		if (!Number.isFinite(value)) continue
		if (value < min) min = value
		if (value > max) max = value
		if (values) values[count] = value
		count++
	}
	if (!count) throw new Error('No numeric data for color scale')
	if (values) {
		const sorted = values.subarray(0, count).sort()
		// Match the client rank convention, including the 100th percentile endpoint.
		max = sorted[Math.min(count - 1, Math.floor(count * percentile / 100))]
	}
	return [min, max]
}
