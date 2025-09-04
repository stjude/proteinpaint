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
	async geneSearchboxCallback(gene: string, plot: any) {
		const parentConfig = this.app.getState().plots.find(p => p.id === this.id)
		const plotConfig = plot.getPlotConfig(gene)
		const config = Object.assign({ subplots: [plotConfig] }, parentConfig)
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}
