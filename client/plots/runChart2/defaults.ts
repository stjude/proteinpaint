import type { RunChart2Settings } from './Settings.ts'

export function getDefaultRunChart2Settings(overrides = {}): RunChart2Settings {
	const defaults = {
		aggregation: 'mean',
		svgw: 800,
		svgh: 400,
		color: '#ce768e',
		minXScale: null as null | number,
		maxXScale: null as null | number,
		minYScale: null as null | number,
		maxYScale: null as null | number
	}

	return Object.assign(defaults, overrides)
}
