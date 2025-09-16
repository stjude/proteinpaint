import type { AppApi } from '#rx'
import type { ClientGenome } from '../../../types/clientGenome'

/** Handles the interactivity from the view */
export class SCInteractions {
	app: AppApi
	dom: any
	id: string
	genome: ClientGenome

	constructor(app: AppApi, dom: any, id: string) {
		this.app = app
		this.dom = dom
		this.id = id
		this.genome = this.app.opts.genome
	}

	/** Used in the gene search menu shown on click from a plot btn
	 * Add the plot to the state.plots array with .parentId. Adding
	 * .parentId prevents the plot from launching in a new sandbox.
	 * Pass the .parentId to both the plotConfig and the action.
	 * this.getState() in SC.ts will find all the subplots with the parentId=this.id
	 * SC.main() initializes the subplots as components in chartsDiv
	 */
	async createSubplot(config) {
		await this.app.dispatch({
			type: 'plot_create',
			parentId: this.id,
			config: Object.assign({}, config, { parentId: this.id })
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
