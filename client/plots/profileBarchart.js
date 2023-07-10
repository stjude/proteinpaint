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
		const holder = this.dom.holder.append('div')
		const config = this.state.config
		const svg = holder.append('svg').attr('width', config.svgw).attr('height', config.svgh)

		let x = 400
		let y = 100
		let stepx = 600
		let step = 30
		svg
			.append('text')
			.attr('transform', `translate(${x}, ${50})`)
			.attr('text-anchor', 'end')
			.text(`${config.sampleName} Component`)
		for (const c of config.columnNames) {
			svg
				.append('text')
				.attr('transform', `translate(${x}, ${75})`)
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
				for (const tw of row.twlst) {
					const color = '#aaa'
					drawRect(x, y, color, tw)
					x += stepx
				}
				y += step
			}
		}
		function drawRect(x, y, color, tw) {
			const value = data[tw.$id]?.value

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
					.attr('transform', `translate(${x + width + 50}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(`${value}%`)
			}

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
		console.log(config)
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
