import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'

class profileBarchart {
	constructor() {
		this.type = 'profileBarchart'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		const twLst = []
		this.component = this.config.plotByComponent[this.config.componentIndex || 0]
		this.component.hasSubjectiveData = false
		for (const group of this.component.groups)
			for (const row of group.rows) {
				for (const [i, tw] of row.twlst.entries()) {
					if (tw.id) {
						twLst.push(tw)
						if (i == 1) this.component.hasSubjectiveData = true
					}
				}
			}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		this.plot()
	}

	plot() {}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileBarchart
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileBarchart'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const component of config.plotByComponent)
			for (const group of component.groups)
				for (const row of group.rows) {
					for (const t of row.twlst) {
						if (t.id) await fillTermWrapper(t, app.vocabApi)
						// allow empty cells, not all cells have a corresponding term
					}
				}
		return config
	} catch (e) {
		throw `${e} [profileBarchart getPlotConfig()]`
	}
}

export const profileBarchartInit = getCompInit(profileBarchart)
// this alias will allow abstracted dynamic imports
export const componentInit = profileBarchartInit
