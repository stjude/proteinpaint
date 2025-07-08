// import Settings from './Settings'

export function getDefaultAIHistoToolSettings(overrides = {}) {
	const defaults: any = {
		test: true
	}
	return Object.assign(defaults, overrides)
}
