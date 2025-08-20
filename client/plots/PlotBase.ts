// import type {} from '#types'
import { TwRouter, routedTermTypes } from '#tw'

export class PlotBase /*implements RxComponentInner*/ {
	app?: any
	type?: string
	state: any
	config: any
	configTermKeys?: string[]

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
					if (routedTermTypes.has(tw.term?.type)) this.config[key][i] = TwRouter.init(tw, opts)
				}
			} else if (routedTermTypes.has(value.term?.type)) {
				config[key] = await TwRouter.initRaw(value, opts)
			}
		}

		return config
	}
}
