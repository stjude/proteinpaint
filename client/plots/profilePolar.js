import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'

class profilePolar {
	constructor() {
		this.type = 'profilePolar'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder
		}
		this.arcGenerator = d3.arc().innerRadius(0)
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
		for (const [i, tw] of this.config.terms.entries()) {
			if (tw.id) {
				twLst.push(tw)
			}
		}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		this.plot()
	}

	plot() {
		const config = this.config
		let data
		this.dom.holder.selectAll('*').remove()
		const samples = []

		for (const k in this.data.samples) {
			if (!config.sampleName && k == 0) data = this.data.samples[k]
			if (config.sampleName && this.data.samples[k].sampleName == config.sampleName) data = this.data.samples[k]
			samples.push(this.data.samples[k].sampleName)
		}

		const holder = this.dom.holder.append('div')

		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')

		const svg = holder.append('svg').attr('width', config.svgw).attr('height', config.svgh)

		if (samples.length == 0) return
		div.append('label').style('margin-left', '5px').html('Site ID:').style('font-weight', 'bold')
		const select = div.append('select').style('margin-left', '5px')
		select
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.property('selected', d => d == config.sampleName)
			.html((d, i) => d)

		select.on('change', () => {
			config.sampleName = select.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})
		// Create a polar grid.
		const radius = 200

		const polarG = svg.append('g').attr('transform', 'translate(400,300)')

		const angle = (Math.PI * 2) / config.terms.length
		let i = 0
		for (const d of config.terms) {
			polarG
				.append('g')
				.append('path')
				.attr('fill', d.color)
				.attr('stroke-width', 1)
				.attr('stroke', 'darkslategray')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: (d.percentage / 100) * radius,
						startAngle: i * angle,
						endAngle: (i + 1) * angle
					})
				)
			i++
		}

		addCircle(50)
		addCircle(75)
		addCircle(100)

		function addCircle(percent) {
			polarG
				.append('circle')
				.attr('r', (percent / 100) * radius)
				.style('fill', 'none')
				.style('stroke', '#aaa')
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profilePolar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePolar'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const t of config.terms) {
			if (t.id) await fillTermWrapper(t, app.vocabApi)
		}
		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePolarInit = getCompInit(profilePolar)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePolarInit
