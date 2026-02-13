import type { FrequencyChart2Settings } from './Settings.ts'

export function getDefaultFrequencyChart2Settings(overrides = {}): FrequencyChart2Settings {
	const defaults: FrequencyChart2Settings = {
		aggregation: 'mean',
		svgw: 1000,
		svgh: 500,
		color: '#ce768e',
		opacity: 0.6,
		minXScale: null,
		maxXScale: null,
		minYScale: null,
		maxYScale: null,
		showCumulativeFrequency: true
	}
	return { ...defaults, ...overrides } as FrequencyChart2Settings
}
