import type { RunChart2Settings } from './Settings.ts'

export function getDefaultRunChart2Settings(overrides = {}): RunChart2Settings {
	const defaults = {
		aggregation: 'mean',
		svgw: 800,
		svgh: 400,
		color: '#1f77b4'
	}

	return Object.assign(defaults, overrides)
}
