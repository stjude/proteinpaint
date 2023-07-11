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
		for (const group of this.state.config.groups)
			for (const row of group.rows) {
				for (const tw of row.twlst) {
					if (tw.id) twLst.push(tw)
				}
			}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		if (!this.sample) this.sample = this.state.config.sampleName
		this.plot()
	}

	plot() {
		this.dom.holder.selectAll('*').remove()
		let data
		const samples = []
		let sample
		for (const k in this.data.samples) {
			if (this.data.samples[k].sampleName == this.sample) data = this.data.samples[k]
			samples.push(this.data.samples[k].sampleName)
		}
		if (!data) throw 'no data returned for sample'
		const holder = this.dom.holder.append('div')
		const select = holder
			.append('div')
			.style('margin-left', '50px')
			.style('margin-top', '20px')
			.append('label')
			.html('Component:')
			.style('font-weight', 'bold')
			.append('select')
			.style('margin-left', '5px')
		select
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.property('selected', d => d == this.sample)
			.html((d, i) => d)
		select.on('change', () => {
			this.sample = select.node().value
			this.plot()
		})
		const config = this.state.config
		const svg = holder.append('svg').attr('width', config.svgw).attr('height', config.svgh)

		let x = 500
		let y = 100
		let stepx = 300
		let step = 30

		for (const c of config.columnNames) {
			svg
				.append('text')
				.attr('transform', `translate(${x + 100}, ${75})`)
				.attr('text-anchor', 'end')
				.style('font-weight', 'bold')
				.text(`${c}%`)
			x += stepx
		}
		for (const group of config.groups) {
			svg
				.append('text')
				.attr('transform', `translate(${400}, ${y + 20})`)
				.attr('text-anchor', 'end')
				.text(`${group.label}`)
				.style('font-weight', 'bold')

			y += step + 20
			for (const row of group.rows) {
				x = 400
				for (const [i, tw] of row.twlst.entries()) {
					const color = '#2381c3'
					drawRect(x, y, color, tw, i)
					x += stepx
				}
				y += step
			}
		}

		function drawRect(x, y, color, tw, i) {
			const value = data[tw.$id]?.value
			const isFirst = i % 2 == 0
			if (value) {
				const width = (value / 100) * 100
				svg
					.append('g')
					.attr('transform', `translate(${x + 10}, ${y})`)
					.append('rect')
					.attr('x', 0)
					.attr('y', 0)
					.attr('width', width)
					.attr('height', 20)
					.attr('fill', color)
				svg
					.append('text')
					.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(`${value}%`)
			}
			if (isFirst)
				svg
					.append('text')
					.attr('transform', `translate(${x}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(tw.term.name)
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = { svgw: 1200, svgh: 1200 }
		const config = copyMerge(defaults, opts)
		for (const group of config.groups)
			for (const row of group.rows) {
				for (const t of row.twlst) {
					if (t.id) await fillTermWrapper(t, app.vocabApi)
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
