import { getCompInit, copyMerge } from '../../rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from '../controls'
import { RxComponent } from '../../types/rx.d'
import { Model } from './Model'
import { View } from './View'
// import * as client from '../src/client'
// import { schemeCategory10 } from 'd3-scale-chromatic'
// import { schemeCategory20 } from '#common/legacy-d3-polyfill'

/** TODOs:
 * - Old code `this.components.controls.on('downloadClick.boxplot', this.download)`. Needed?
 *
 */

class TdbBoxplot extends RxComponent {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: any
	constructor() {
		super()
		this.components = {
			controls: {}
		}
		this.dom = {}
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'boxplot',
				label: 'Customize', //TODO: Verify if this is correct
				vocabApi: this.app.vocabApi,
				menuOptions: 'edit'
			}
		]
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: config.term,
				term2: config.term2,
				settings: {
					common: config.settings.common,
					boxplot: config.settings.boxplot
				}
			}
		}
	}

	async init() {
		const holder = this.opts.holder.classed('sjpp-boxplot-main', true)
		if (this.opts.header) this.dom.header = this.opts.header.html('Boxplot')

		this.dom.controls = this.opts.controls ? holder : holder.append('div')
		this.dom.div = this.opts.controls ? holder : holder.append('div')
		this.dom.div.style('display', 'inline-block').style('margin', '10px')
		this.dom.svg = this.dom.div.append('svg').style('margin-right', '20px').style('display', 'inline-block')
		this.dom.yAxis = this.dom.svg.append('g')
		this.dom.boxplots = this.dom.svg.append('g')

		try {
			await this.setControls()
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
	}

	async main() {
		try {
			const state = this['state'] //Don't like this. calling getState here is blank?
			const config = structuredClone(state.config)
			const t2 = config.term2

			const model = new Model(config, state, this.app)
			const data = await model.getData()

			if (this.dom.header) this.dom.header.html(`${config.term.term.name} vs ${t2.term.name}`)

			const settings = config.settings.boxplot
			new View(data, settings, this.dom)
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
	}
}

export const boxplotInit = getCompInit(TdbBoxplot)
export const componentInit = boxplotInit

export function getDefaultBoxplotSettings(app, overrides = {}) {
	const defaults = {
		boxplotWidth: 500,
		color: 'black',
		labelSpace: 50,
		rowHeight: 150
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'boxplot getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [boxplot getPlotConfig()]`))
		throw `boxplot getPlotConfig() failed`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
				term2: null
			}
		}
	}
	return copyMerge(config, opts)
}

// function setInteractivity(self) {
// 	self.download = () => {
// 		if (!self.state || !self.state.isVisible) return
// 		const svg_name = self.config.term.term.name + ' boxplot'
// 		client.to_svg(self.dom.svg.node(), svg_name, { apply_dom_styles: true })
// 	}
// }

// function setRenderers(self) {
// 	self.render = function(lst, binmax) {
// 		self.items = lst
// 		self.config.settings.boxplot.yscale_max = binmax
// 		const sc = self.config.settings.common
// 		const s = self.config.settings.boxplot
// 		const max_label_height = self.get_max_labelheight(s)

// 		// space for boxplot
// 		// let box_plot_space = (self.boxplot) ?  30 : 4
// 		const box_plot_space = 4
// 		// define svg height and width
// 		const svg_width = self.items.length * (s.barwidth + s.barspace) + s.yaxis_width
// 		const svg_height = s.toppad + s.barheight + max_label_height + box_plot_space
// 		self.y_scale = scaleLinear()
// 			.domain([s.yscale_max, 0])
// 			.range([0, s.barheight])

// 		self.dom.svg
// 			.transition()
// 			.attr('width', svg_width)
// 			.attr('height', svg_height)

// 		// Y axis
// 		self.dom.yaxis_g
// 			.attr('transform', 'translate(' + (s.yaxis_width - 2) + ',' + s.toppad + ')')
// 			.transition()
// 			.call(
// 				axisLeft()
// 					.scale(self.y_scale)
// 					// .tickFormat(d3format('d'))
// 					.ticks(10, d3format('d'))
// 			)

// 		client.axisstyle({
// 			axis: self.dom.yaxis_g,
// 			showline: true,
// 			fontsize: s.barwidth * 0.8,
// 			color: 'black'
// 		})

// 		// if is stacked-bar, need to get color mapping for term2 values
// 		let term2valuecolor
// 		if (self.items[0].lst) {
// 			// may need a better way of deciding if it is two-term crosstabulate
// 			// to get all values for term2
// 			const term2values = new Set()
// 			for (const i of self.items) {
// 				for (const j of i.lst) {
// 					term2values.add(j.label)
// 				}
// 			}
// 			if (term2values.size > 10) {
// 				term2valuecolor = scaleOrdinal(schemeCategory20)
// 			} else {
// 				term2valuecolor = scaleOrdinal(schemeCategory10)
// 			}
// 		}

// 		// plot each bar
// 		let x = s.yaxis_width + s.barspace + s.barwidth / 2

// 		self.dom.graph_g
// 			.attr('transform', 'translate(' + x + ',' + (s.toppad + s.barheight) + ')')
// 			.selectAll('*')
// 			.remove()

// 		self.items.forEach((item, itemidx) => {
// 			if (!item.boxplot) return
// 			const g = self.dom.graph_g
// 				.append('g')
// 				.datum(item)
// 				.attr('transform', 'translate(' + itemidx * (s.barwidth + s.barspace) + ',0)')

// 			// X axis labels
// 			const xlabel = g
// 				.append('text')
// 				.text(item.label)
// 				.attr('transform', 'translate(0,' + box_plot_space + ') rotate(-65)')
// 				.attr('text-anchor', 'end')
// 				.attr('font-size', s.label_fontsize)
// 				.attr('font-family', client.font)
// 				.attr('dominant-baseline', 'central')

// 			let x_lab_tip = ''

// 			//this is for boxplot for 2nd numerical term
// 			if ('w1' in item.boxplot) {
// 				g.append('line')
// 					.attr('x1', 0)
// 					.attr('y1', self.y_scale(item.boxplot.w1) - s.barheight)
// 					.attr('x2', 0)
// 					.attr('y2', self.y_scale(item.boxplot.w2) - s.barheight)
// 					.attr('stroke-width', 2)
// 					.attr('stroke', 'black')

// 				g.append('rect')
// 					.attr('x', -s.barwidth / 2)
// 					.attr('y', self.y_scale(item.boxplot.p75) - s.barheight)
// 					.attr('width', s.barwidth)
// 					.attr(
// 						'height',
// 						s.barheight -
// 							self.y_scale(sc.use_logscale ? item.boxplot.p75 / item.boxplot.p25 : item.boxplot.p75 - item.boxplot.p25)
// 					)
// 					.attr('fill', '#901739')
// 					.on('mouseover', event => {
// 						self.app.tip
// 							.clear()
// 							.show(event.clientX, event.clientY)
// 							.d.append('div')
// 							.html(
// 								`<table class='sja_simpletable'>
// 	                <tr>
// 	                  <td style='padding: 3px; color:#aaa'>${self.config.term.term.name}</td>
// 	                  <td style='padding: 3px'>${item.label}</td>
// 	                </tr>
// 	                <tr>
// 	                  <td style='padding: 3px; color:#aaa'>Mean</td>
// 	                  <td style='padding: 3px'>${item.boxplot.mean.toPrecision(4)}</td>
// 	                </tr>
// 	                <tr>
// 	                  <td style='padding: 3px; color:#aaa'>Median</td>
// 	                  <td style='padding: 3px'>${item.boxplot.p50.toPrecision(4)}</td>
// 	                </tr>
// 	                <tr>
// 	                  <td style='padding: 3px; color:#aaa'>1st to 3rd Quartile</td>
// 	                  <td style='padding: 3px'>${item.boxplot.p25.toPrecision(4)} to ${item.boxplot.p75.toPrecision(4)}</td>
// 	                </tr>
// 	                <tr>
// 	                  <td style='padding: 3px; color:#aaa'>Std. Deviation</td>
// 	                  <td style='padding: 3px'>${item.boxplot.sd.toPrecision(4)}</td>
// 	                </tr>
// 	              </table>`
// 							)
// 					})
// 					.on('mouseout', () => self.app.tip.hide())

// 				g.append('line')
// 					.attr('x1', -s.barwidth / 2.2)
// 					.attr('y1', self.y_scale(item.boxplot.w1) - s.barheight)
// 					.attr('x2', s.barwidth / 2.2)
// 					.attr('y2', self.y_scale(item.boxplot.w1) - s.barheight)
// 					.attr('stroke-width', 2)
// 					.attr('stroke', 'black')

// 				g.append('line')
// 					.attr('x1', -s.barwidth / 2.2)
// 					.attr('y1', self.y_scale(item.boxplot.p50) - s.barheight)
// 					.attr('x2', s.barwidth / 2.2)
// 					.attr('y2', self.y_scale(item.boxplot.p50) - s.barheight)
// 					.attr('stroke-width', 1.5)
// 					.attr('stroke', 'white')

// 				g.append('line')
// 					.attr('x1', -s.barwidth / 2.2)
// 					.attr('y1', self.y_scale(item.boxplot.w2) - s.barheight)
// 					.attr('x2', s.barwidth / 2.2)
// 					.attr('y2', self.y_scale(item.boxplot.w2) - s.barheight)
// 					.attr('stroke-width', 2)
// 					.attr('stroke', 'black')
// 			}

// 			for (const outlier of item.boxplot.out) {
// 				g.append('circle')
// 					.attr('cx', 0)
// 					.attr('cy', self.y_scale(outlier.value) - s.barheight)
// 					.attr('r', 2)
// 					.attr('fill', '#901739')
// 					.on('mouseover', event => {
// 						self.app.tip
// 							.clear()
// 							.show(event.clientX, event.clientY)
// 							.d.append('div')
// 							.html(self.config.term2.term.name + ' ' + outlier.value.toPrecision(4))
// 					})
// 					.on('mouseout', () => {
// 						self.app.tip.hide()
// 					})
// 			}
// 			// x-label tooltip
// 			if (item.lst) {
// 				xlabel
// 					.on('mouseover', event => {
// 						self.app.tip
// 							.clear()
// 							.show(event.clientX, event.clientY)
// 							.d.append('div')
// 							.html(
// 								self.config.term.term.name +
// 									': ' +
// 									item.label +
// 									'<br>' +
// 									'# patients: ' +
// 									item.value +
// 									'<br>' +
// 									x_lab_tip
// 							)
// 					})
// 					.on('mouseout', () => {
// 						self.app.tip.hide()
// 					})
// 			} else {
// 				xlabel
// 					.on('mouseover', event => {
// 						self.app.tip
// 							.clear()
// 							.show(event.clientX, event.clientY)
// 							.d.append('div')
// 							.html(self.config.term.term.name + ': ' + item.label + '<br>' + '# patients: ' + item.value)
// 					})
// 					.on('mouseout', () => {
// 						self.app.tip.hide()
// 					})
// 			}
// 		})
// 	}

// 	self.get_max_labelheight = function(s) {
// 		let textwidth = 0
// 		for (const i of self.items) {
// 			self.dom.svg
// 				.append('text')
// 				.text(i.label)
// 				.attr('font-family', client.font)
// 				.attr('font-size', s.label_fontsize)
// 				.each(function() {
// 					textwidth = Math.max(textwidth, this.getBBox().width)
// 				})
// 				.remove()
// 		}

// 		return textwidth
// 	}
// }
