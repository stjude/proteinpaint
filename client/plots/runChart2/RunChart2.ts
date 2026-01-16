import { PlotBase } from '#plots/PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { dofetch3 } from '#common/dofetch'

class RunChart2 extends PlotBase implements RxComponent {
	static type = 'runChart2'
	type: string
	components: { controls: any }

	constructor(opts: any, api: any) {
		super(opts)
		this.opts = opts
		this.api = api
		this.type = RunChart2.type
		this.components = {
			controls: {}
		}
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		if (action.type.startsWith('plot_')) {
			return (
				(action.id === this.id || action.id == this.parentId) &&
				(!action.config?.childType || action.config?.childType == this.type)
			)
		}
	}

	//Need to implement init() here
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return { config }
	}

	async main() {
		const result = await dofetch3('termdb/runChart', { body: await this.getRequestArg() })
		console.log('RunChart2 runChart result', result)
	}
	async getRequestArg() {
		const config = await this.getMutableConfig()
		const reqArg: any = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			term: config.term,
			term2: config.term2
		}
		return reqArg
	}
}

export const runChart2Init = getCompInit(RunChart2)
export const componentInit = runChart2Init

export function getPlotConfig(opts) {
	if (!opts.term) throw 'opts.term missing' // for X axis
	if (!opts.term2) throw 'opts.term2 missing' // for Y axis
	const config = {
		//TODO: fill in default config
	}

	return copyMerge(config, opts)
}
