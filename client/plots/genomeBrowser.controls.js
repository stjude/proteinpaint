import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'

// unfinished!!

class GbControls {
	constructor(opts) {
		console.log(22, opts)
		this.type = 'gbControls'
	}

	async init(appState) {
		console.log(this)
		this.dom = {
			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			group1div: this.opts.holder.append('div'),
			group2div: this.opts.holder.append('div'),
			// the whole holder has white-space=nowrap (likely from sjpp-output-sandbox-content)
			// must set white-space=normal to let INFO filter wrap and not to extend beyond holder
			variantFilterHolder: this.opts.holder.append('div'),
			groupShowCountDiv: [] // elements are <span> of that "filter" group, by the order of details.groups[]
		}
	}

	getState(appState) {
		return {
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		console.log(this.state)
	}
}

export const gbControlsInit = getCompInit(GbControls)
