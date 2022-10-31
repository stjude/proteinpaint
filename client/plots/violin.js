import { getCompInit } from '../rx'
import { controlsInit } from './controls'
import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleBand } from 'd3-scale'
import { extent } from 'd3-array'
import { area, curveBumpX, curveBumpY } from 'd3-shape'

/*
TODO vertical rendering does not work yet
*/

const plotColor = '#c6c4f2'

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
		setRenderers(this)
	}

	async init() {
		this.dom = {
			controls: this.opts.holder
				.append('div')
				.attr('class', 'sjpp-plot-controls')
				.style('display', 'inline-block'),

			holder: this.opts.holder
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '5px'),

			legendHolder: this.opts.holder
				.append('div')
				.style('margin-left', '100px')
				.style('padding', '5px')
		}

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controls,
				inputs: [
					{
						type: 'term1',
						// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
						usecase: { target: 'violin', detail: 'term' }
					},
					{
						type: 'overlay',
						// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
						usecase: { target: 'violin', detail: 'term2' }
					}
					//disable orientation.
					// {
					// 	label: 'Orientation',
					// 	type: 'radio',
					// 	chartType: 'violin',
					// 	settingsKey: 'orientation',
					// 	options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }]
					// }
				]
			})
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return action.id === this.id && (!action.config.childType || action.config.childType == this.type)
		}
		return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			nav: appState.nav,
			termfilter: appState.termfilter,
			config,
			bar_click_menu: appState.bar_click_menu || {},
			// optional
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		this.config = this.state.config
		if (this.dom.header)
			this.dom.header.html(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		this.data = await this.app.vocabApi.getViolinPlotData({
			termid: this.config.term.term.id,
			term2: this.config.term2
		})
		if (this.data.error) throw this.data.error
		/*
		.min
		.max
		.plots[]
			.biggestBin
			.label
			.plotValueCount
			.bins[]
				.x0
				.x1
				.binValueCount
		*/
		this.render()
	}

	getLegendGrps() {
		const t2 = this.config.term2

		if (!t2) {
			// no term2, no legend to show
			this.dom.legendHolder.style('display', 'none')
			return
		}

		// show legend
		this.dom.legendHolder
			.style('display', 'block')
			.selectAll('*')
			.remove()

		if (this.data.plots.length == 0) return

		this.dom.legendHolder.append('div').text(this.config.term2.term.name)

		for (const plot of this.data.plots) {
			this.dom.legendHolder
				.append('div')
				.style('font-size', '15px')
				.text(plot.label)
		}
	}
}

export const violinInit = getCompInit(ViolinPlot)
export const componentInit = violinInit

async function setRenderers(self) {
	self.render = function() {
		self.getLegendGrps()
		const t2 = self.config.term2

		if (self.data.plots.length == 0) {
			self.dom.holder.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			return
		}

		// append the svg object to the body of the page
		self.dom.holder.select('.sjpp-violin-plot').remove()

		const violinDiv = self.dom.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const svg = violinDiv.append('svg')

		// test render all labels to get max label width
		let maxLabelSize = 0
		for (const p of self.data.plots) {
			const l = svg.append('text').text(p.label)
			maxLabelSize = Math.max(maxLabelSize, l.node().getBBox().width)
			l.remove()
		}

		const isH = self.config.settings.violin.orientation == 'horizontal'
		const axisHeight = 80

		// Render the violin plot
		let margin
		if (isH) {
			margin = { left: maxLabelSize + 5, top: axisHeight, right: 50, bottom: 10 }
		} else {
			margin = { left: axisHeight + 5, top: 50, right: 50, bottom: maxLabelSize }
		}

		const plotLength = 470, // span length of a plot, not including margin
			// thickness of a plot
			plotThickness =
				self.data.plots.length < 2
					? 100
					: self.data.plots.length >= 2 && self.data.plots.length < 5
					? 80
					: self.data.plots.length >= 5 && self.data.plots.length < 8
					? 60
					: self.data.plots.length >= 8 && self.data.plots.length < 11
					? 50
					: 40

		svg
			.attr('width', margin.left + margin.right + (isH ? plotLength : plotThickness * self.data.plots.length))
			.attr('height', margin.bottom + margin.top + (isH ? plotThickness * self.data.plots.length : plotLength))
			.classed('sjpp-violin-plot', true)

		// a <g> in which everything is rendered into
		const svgG = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		// creates numeric axis
		const axisScale = scaleLinear()
			.domain([self.data.min, self.data.max])
			.range(isH ? [0, plotLength] : [plotLength, 0])

		{
			// <g>: holder of numeric axis
			const g = svgG.append('g')
			g.call((isH ? axisTop : axisLeft)().scale(axisScale))
			const lab = svgG.append('text').text(self.config.term.term.name)
			if (isH) {
				lab
					.attr('x', plotLength / 2)
					.attr('y', -30)
					.attr('text-anchor', 'middle')
			} else {
				lab
					.attr('y', plotLength / 2)
					.attr('x', -25)
					.attr('text-anchor', 'middle')
					.attr('transform', 'rotate(-90)')
			}
		}

		for (const [plotIdx, plot] of self.data.plots.entries()) {
			// <g> of one plot
			// adding .5 to plotIdx allows to anchor each plot <g> to the middle point

			const violinG = svgG
				.append('g')
				.attr(
					'transform',
					isH
						? 'translate(0,' + plotThickness * (plotIdx + 0.5) + ')'
						: 'translate(' + plotThickness * (plotIdx + 0.5) + ',0)'
				)

			// create label
			const label = violinG.append('text').text(plot.label)
			if (isH) {
				label
					.attr('x', -5)
					.attr('y', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
			} else {
				label
					.attr('x', 0)
					.attr('y', plotLength + 5)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.attr('transform', 'rotate(-90)') // FIXME
			}

			// times 0.45 will leave out 10% as spacing between plots
			const wScale = scaleLinear()
				.domain([-plot.biggestBin, plot.biggestBin])
				.range([-plotThickness * 0.45, plotThickness * 0.45])

			let areaBuilder
			if (isH) {
				areaBuilder = area()
					.y0(d => wScale(-d.binValueCount))
					.y1(d => wScale(d.binValueCount))
					.x(d => axisScale(d.x0))
					.curve(curveBumpX)
			} else {
				areaBuilder = area()
					.x0(d => wScale(-d.binValueCount))
					.x1(d => wScale(d.binValueCount))
					.y(d => axisScale(d.x0))
					.curve(curveBumpY)
			}

			violinG
				.append('path')
				.style('fill', plotColor)
				.attr('d', areaBuilder(plot.bins))
		}
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'violin getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [violin getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			// common: {
			// 	use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
			// 	use_percentage: false,
			// 	barheight: 300, // maximum bar length
			// 	barwidth: 20, // bar thickness
			// 	barspace: 2 // space between two bars
			// },
			violin: {
				orientation: 'horizontal',
				// unit: 'abs',
				// overlay: 'none',
				// divideBy: 'none',
				rowlabelw: 250
			}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
