import type { RunChart2Settings } from './Settings.ts'

export function getDefaultRunChart2Settings(overrides = {}): RunChart2Settings {
	const defaults = {
		aggregation: 'median' as const,
		svgw: 1000,
		svgh: 500,
		color: '#ce768e',
		opacity: 0.6,
		minXScale: null,
		maxXScale: null,
		minYScale: null,
		maxYScale: null
	}

	return Object.assign(defaults, overrides)
}
