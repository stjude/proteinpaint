import type { DMRSettings } from './Settings.ts'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	const defaults = {
		blockWidth: 800,
		pad: 2000,
		lambda: 1000,
		C: 2,
		fdr_cutoff: 0.05,
		colors: {
			group1: '#3b5ee6',
			group2: '#c04e00',
			hyper: '#e66101',
			hypo: '#5e81f4'
		},
		backend: 'rust' as const
	}

	return Object.assign(defaults, overrides)
}
