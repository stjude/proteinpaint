import type { DMRSettings } from './Settings.ts'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	const defaults = {
		blockWidth: 800,
		pad: 2000
	}

	return Object.assign(defaults, overrides)
}
