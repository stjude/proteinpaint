import type { MassAppApi } from '#mass/types/mass'
// import type { DEanalysisSettings } from '../DEanalysisTypes'

export class Model {
	app: MassAppApi
	constructor(app) {
		this.app = app
	}
}
