import type { AppApi } from '#rx'
import type { ClientGenome } from '../../../types/clientGenome'

/** Handles the interactivity from the view */
export class SCInteractions {
	app: AppApi
	id: string
	genome: ClientGenome

	constructor(app: AppApi, id: string) {
		this.app = app
		this.id = id
		this.genome = this.app.opts.genome
	}

	/** Used in the gene search menu shown on click from a plot btn */
	async createSubplot(_config) {
		const config = Object.assign({}, _config, { parentId: this.id })
		await this.app.dispatch({
			type: 'plot_create',
			parentId: this.id,
			config
		})
	}

	/** Updates the sample in the plot settings */
	async updateSample(sample) {
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { settings: { sc: { sample } } }
		})
	}
}
