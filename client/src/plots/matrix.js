import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		this.dom = {
			header: opts.header,
			//controls,
			holder,
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		if (this.dom.header) this.dom.header.html('Sample Matrix')
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({}, this.opts.settings)
		await this.setControls(appState)
	}

	async setControls(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.boxplot', this.download)
		} else {
			this.dom.holder
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			isVisible: true,
			config
		}
	}

	async main() {
		try {
			//this.config = this.state.config
			Object.assign(this.settings, this.state.config.settings)
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getMatrixData(reqOpts)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		return {
			termgroups: this.state.config.termgroups
		}
	}

	processData(data) {}
}

export const matrixInit = getCompInit(Matrix)
// this alias will allow abstracted dynamic imports
export const componentInit = matrixInit

function setRenderers(self) {
	self.render = function() {}
}

export async function getPlotConfig(opts, app) {
	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],

		// rendering options
		settings: {
			matrix: {}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
