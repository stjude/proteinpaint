import type { DMRSettings } from './Settings.ts'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	const defaults = {
		blockWidth: 800,
		trackHeight: 150,
		pad: 2000,
		shoreSize: 2000,
		nanThreshold: 0.5,
		trackDpi: 100,
		trackYPad: 0.1,
		colors: {
			group1: '#3b5ee6',
			group2: '#c04e00',
			hyper: '#e66101',
			hypo: '#5e81f4'
		},
		annotationColors: {
			CGI: '#06b6d4',
			Shore: '#22d3ee',
			Promoter: '#8b5cf6',
			Enhancer: '#f59e0b',
			CTCF: '#ef4444'
		}
	}

	return Object.assign(defaults, overrides)
}
