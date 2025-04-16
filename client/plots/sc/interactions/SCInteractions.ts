import type { MassAppApi } from '#mass/types/mass'
import type { ClientCopyGenome } from '../../../types/global'

export class SCInteractions {
	app: MassAppApi
	id: string
	genome: ClientCopyGenome

	constructor(app: MassAppApi, id: string) {
		this.app = app
		this.id = id
		this.genome = this.app.opts.genome
	}

	async geneSearchboxCallback(gene, plot) {
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
