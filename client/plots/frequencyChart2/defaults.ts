import type { FrequencyChart2Settings } from './Settings.ts'

export function getDefaultFrequencyChart2Settings(overrides = {}): FrequencyChart2Settings {
	const defaults = {
		aggregation: 'mean' as const, // required by RunChart2Settings; unused by FrequencyChart2
		svgw: 1000,
		svgh: 500,
		color: '#ce768e',
		opacity: 0.6,
		minXScale: null,
		maxXScale: null,
		minYScale: null,
		maxYScale: null,
		showCumulativeFrequency: true // Key difference from runChart2!
	}

	return Object.assign(defaults, overrides) as FrequencyChart2Settings
}
