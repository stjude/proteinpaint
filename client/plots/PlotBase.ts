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
		this.id = opts?.id
		this.app = opts?.app
		this.parentId = opts?.parentId
	}

	async getMutableConfig() {
		// TODO: may improve to not require a full copy??
		const config = structuredClone(this.state.config)
		if (!config || !this.configTermKeys?.length) return structuredClone(config)

		const opts = {
			vocabApi: this.app.vocabApi
		}

		for (const key of this.configTermKeys) {
			const value = config[key.split('.')[0]]
			// const orig = this.state.config[key] // TODO: may reuse the original copy if there's a better way to mutate
			if (!value) continue
			if (Array.isArray(value)) {
				for (const [i, v] of value.entries()) {
					if (key.includes('.')) {
						const k = key.split('.')[1]
						const _v = v[k]
						if (Array.isArray(_v)) {
							for (const [j, tw] of (_v as any[]).entries()) {
								if (tw.type && routedTermTypes.has(tw.term?.type)) {
									_v[j] = await TwRouter.init(tw, opts)
								}
							}
						} else {
							if (_v.type && routedTermTypes.has(_v.term?.type)) v[k] = await TwRouter.init(_v, opts)
						}
					} else {
						if (v.type && routedTermTypes.has(v.term?.type)) config[key][i] = await TwRouter.init(v, opts)
					}
				}
			} /*else if (typeof orig == 'object' && orig.contructor?.name != 'Object') {
				config[key] = orig
			}*/ else if (value.type && routedTermTypes.has(value.term?.type)) {
				config[key] = await TwRouter.initRaw(value, opts)
			}
		}

		return config
	}
}

// default UI labels
// used by plot controls and tooltips
export const defaultUiLabels = {
	Samples: 'Samples',
	samples: 'samples',
	Sample: 'Sample',
	sample: 'sample',
	Terms: 'Variables',
	terms: 'variables',
	Term: 'Variable',
	term: 'Variable',
	Mutations: 'Mutations',
	term2: { label: 'Overlay', title: 'Overlay data' },
	term0: { label: 'Divide by', title: 'Divide by data' }
}
