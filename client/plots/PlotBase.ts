import type { AppApi, ComponentApi } from '#rx'
import { TwRouter, routedTermTypes } from '#tw'

export class PlotBase {
	//type: string
	//id: string
	api?: ComponentApi
	opts: any
	app: AppApi
	id: string
	state: any
	parentId?: string

	dom: {
		[name: string]: any
	} = {}

	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	// dom: any
	// config: any
	configTermKeys?: string[]

	constructor(opts, plotApi?: ComponentApi) {
		if (plotApi) this.api = plotApi
		this.opts = opts
		this.id = opts.id
		this.app = opts.app
		this.parentId = opts?.parentId
	}

	async getMutableConfig() {
		// TODO: may improve to not require a full copy??
		const config = structuredClone(this.state.config)
		if (!this.configTermKeys) return config

		const opts = {
			vocabApi: this.app.vocabApi
		}

		for (const key of this.configTermKeys) {
			const value = config[key]
			if (!value) continue
			if (Array.isArray(value)) {
				for (const [i, tw] of value.entries()) {
					if (routedTermTypes.has(tw.term?.type)) config[key][i] = TwRouter.init(tw, opts)
				}
			} else if (routedTermTypes.has(value.term?.type)) {
				config[key] = await TwRouter.initRaw(value, opts)
			}
		}

		return config
	}
}
