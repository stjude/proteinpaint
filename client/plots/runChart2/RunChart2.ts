import { PlotBase } from '#plots/PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'

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

	//Need to implement getState() and init() here

	async main() {
		const config = await this.getMutableConfig()
		console.log('RunChart2 main()', config)
	}
}

export const runChart2Init = getCompInit(RunChart2)
export const componentInit = runChart2Init

export function getPlotConfig(opts /*app*/) {
	// if (!opts.term) throw new Error('opts.term{} missing')
	console.log('RunChart2 getPlotConfig()', opts)

	const config = {
		//TODO: fill in default config
	}

	return copyMerge(config, opts)
}
