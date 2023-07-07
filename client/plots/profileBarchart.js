import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'

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
		const twLst = []
		for (const row of this.state.config.rows) {
			for (const tw of row.twlst) {
				if (tw.id) twLst.push(tw)
			}
		}
		const data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		this.plot(data)
	}

	plot(_d) {
		let data
		for (const k in _d.samples) {
			if (_d.samples[k].sampleName == this.state.config.sampleName) data = _d.samples[k]
		}
		if (!data) throw 'no data returned for sample'
		const table = this.dom.holder.append('table')
		// header
		{
			const tr = table.append('tr')
			tr.append('td').text(this.state.config.sampleName)
			for (const c of this.state.config.columnNames) tr.append('td').text(c)
		}
		for (const row of this.state.config.rows) {
			const tr = table.append('tr')
			tr.append('td').text(row.name)
			for (const tw of row.twlst) {
				const td = tr.append('td')
				const value = data[tw.$id]?.value
				// TODO barplot
				if (Number.isFinite(value)) {
					td.text(value)
				}
			}
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = {}
		const config = copyMerge(defaults, opts)
		for (const row of config.rows) {
			for (const t of row.twlst) {
				if (t.id) {
					await fillTermWrapper(t, app.vocabApi)
				} else {
					// allow a cell without a term to leave it blank, e.g the term corresponding to this cell does not exist
				}
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
