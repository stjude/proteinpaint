import type Settings from './Settings'

export function getDefaultAIHistoToolSettings(overrides = {}): Settings {
	const defaults: Settings = {}
	return Object.assign(defaults, overrides)
}
