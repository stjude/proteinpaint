import type Settings from './Settings'

export function getDefaultAIProjectAdminSettings(overrides = {}): Settings {
	const defaults: Settings = {}
	return Object.assign(defaults, overrides)
}
