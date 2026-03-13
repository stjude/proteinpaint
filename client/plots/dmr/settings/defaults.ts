import type { DMRSettings } from './Settings.ts'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	const defaults = {
		blockWidth: 800,
		pad: 200
	}

	return Object.assign(defaults, overrides)
}
