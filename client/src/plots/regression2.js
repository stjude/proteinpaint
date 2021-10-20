import { regressionUIInit } from './regression.ui'
import { MassRegressionInputs } from './regression.inputs'
import { MassRegressionResults } from './regression.results'
import { getCompInit } from '../common/rx.core'
import { select } from 'd3-selection'

class MassRegression {
	constructor(opts) {
		this.type = 'regression'
	}

	async init() {
		this.opts.holder.style('margin-left', 0)
		const inputs = this.opts.holder.append('div')
		const results = this.opts.holder.append('div').style('margin-left', '40px')

		this.dom = {
			header: this.opts.header,
			inputs,
			banner: this.opts.holder
				.append('div')
				.style('color', '#bbb')
				.style('display', 'none')
				.style('margin-bottom', '10px'),
			results
		}

		this.inputs = new MassRegressionInputs({
			app: this.app,
			parent: this,
			id: this.id,
			holder: this.dom.inputs
		})

		this.results = new MassRegressionResults({
			app: this.app,
			parent: this,
			id: this.id,
			holder: this.dom.results
		})
	}

	getState(appState, sub) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		if (!config.regressionType) throw 'regressionType is required'
		return {
			vocab: appState.vocab,
			formIsComplete: config.term && config.independent.length,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: config.term,
				regressionType: config.regressionType,
				independent: config.independent,
				settings: {
					table: config.settings && config.settings.regression
				}
			}
		}
	}

	async main() {
		//if (!this.state.config.term) return
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.dom.banner.style('display', this.state.formIsComplete ? 'block' : 'none')
		if (this.dom.header) {
			this.dom.header.html(
				this.config.term.term.name +
					` <span style="opacity:.6;font-size:.7em;margin-left:10px;">${this.config.regressionType.toUpperCase()} REGRESSION</span>`
			)
		}
		this.dom.banner.style('display', 'none')
		await this.inputs.main(this.config)
		await this.results.main(this.config)
		await this.inputs.updateBtns(true)
	}
}

export const regressionInit = getCompInit(MassRegression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit
