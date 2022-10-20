import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'
import { select, pointer } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { export_data, newpane } from '../src/client'

import {
	zoom as d3zoom,
	zoomIdentity,
	symbolCircle,
	symbolTriangle,
	symbolCross,
	symbolSquare,
	symbolWye,
	symbolAsterisk,
	symbolDiamond,
	symbolDiamond2,
	symbolStar,
	symbolSquare2,
	groups,
	group
} from 'd3'
import { d3lasso } from '../common/lasso'
import { Menu } from '#dom/menu'
import { controlsInit } from './controls'
import { axisLeft, axisBottom } from 'd3-axis'
import { make_table_2col } from '#dom/table2col'
import { icons as icon_functions } from '../dom/control.icons'
import { symbol } from 'd3-shape'

/*
sample object returned by server:
{
	sample=str
	x=number
	y=number
	category=str
}

NOTE
"sample" and "category" attributes here are hardcoded

*/

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
		this.lassoOn = false
		this.groups = []
		const mySymbols = [
			symbolCircle,
			symbolSquare,
			symbolCross,
			symbolWye,
			symbolTriangle,
			//symbolAsterisk,
			symbolDiamond,
			symbolDiamond2,
			symbolStar,
			symbolSquare2
		]
		this.symbols = mySymbols.map(s => symbol(s))
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		let holder = this.opts.controls ? opts.holder : this.opts.holder.append('div').style('display', 'inline-block')
		const mainDiv = holder.append('div').style('display', 'inline-block')

		const chartsDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '20px')
		const legendDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('margin-left', '100px')

		this.dom = {
			header: this.opts.header,
			holder: chartsDiv,
			controls,
			legendDiv,
			tip: new Menu({ padding: '5px' })
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		await this.setControls()
		setInteractivity(this)
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			allowedTermTypes: appState.termdbConfig.allowedTermTypes
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))

		if (this.dom.header)
			this.dom.header.html(
				this.config.name + ` <span style="opacity:.6;font-size:.7em;margin-left:10px;">SCATTER PLOT</span>`
			)
		copyMerge(this.settings, this.config.settings.sampleScatter)
		const reqOpts = this.getDataRequestOpts()
		const data = await this.app.vocabApi.getScatterData(reqOpts)
		if (data.error) throw data.error
		if (!Array.isArray(data.samples)) throw 'data.samples[] not array'
		this.shapes = data.shapeLegend
		const s0 = data.samples[0]
		const [xMin, xMax, yMin, yMax] = data.samples.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		this.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([0, this.settings.svgw])

		this.axisBottom = axisBottom(this.xAxisScale)
		this.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([0, this.settings.svgh])
		this.axisLeft = axisLeft(this.yAxisScale)

		this.render(data)
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c = this.config
		const opts = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter: this.state.termfilter.filter
		}
		if (c.shapeTW) opts.shapeTW = c.shapeTW
		return opts
	}

	async setControls() {
		this.dom.holder
			.attr('class', 'pp-termdb-plot-viz')
			.style('display', 'inline-block')
			.style('min-width', '300px')
			.style('margin-left', '50px')

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
				inputs: [
					{
						type: 'term',
						configKey: 'colorTW',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'colorTW' },
						title: 'The term to use to color the samples',
						label: 'Color',
						vocabApi: this.app.vocabApi
					},
					{
						type: 'term',
						configKey: 'shapeTW',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'shapeTW' },
						title: 'The term to use to shape the samples',
						label: 'Shape',
						vocabApi: this.app.vocabApi
					},
					{
						label: 'Symbol size',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'size',
						title: 'The internal width of the chart plot'
					},
					{
						label: 'Chart width',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'svgw',
						title: 'The internal width of the chart plot'
					},
					{
						label: 'Chart height',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'svgh',
						title: 'The internal height of the chart plot'
					},
					{
						boxLabel: 'Visible',
						label: 'Show axes',
						type: 'checkbox',
						chartType: 'sampleScatter',
						settingsKey: 'showAxes',
						title: `Option to show/hide plot axes`
					}
				]
			})
		}

		this.components.controls.on('downloadClick.survival', () => alert('TODO: data download?'))
	}

	renderLegend(holder, categories, shapes) {
		holder.selectAll('*').remove()
		const colorDiv = holder.append('div').style('display', 'inline-block')
		const shapeDiv = holder
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')

		let row = colorDiv
			.insert('div')
			.attr('class', 'sja_clb')
			.style('display', 'block')
			.style('font-weight', 'bold')
			.style('margin-top', '10px')
			.html('&nbsp;' + this.config.colorTW.term.name)
		let items = []
		let item
		for (const category of categories) {
			const color = category[1].color
			const sample_count = category[1].sampleCount
			const name = category[0]
			const row = colorDiv
				.append('div')
				.attr('class', 'sja_clb')
				.style('display', 'block')
			row
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('background', color)
				.html(sample_count)
			row
				.append('div')
				.style('display', 'inline-block')
				.style('color', color)
				.html('&nbsp;' + name)
		}
		if (this.config.shapeTW) {
			row = shapeDiv
				.insert('div')
				.attr('class', 'sja_clb')
				.style('display', 'block')
				.style('font-weight', 'bold')
				.style('margin-top', '10px')
				.html('&nbsp;' + this.config.shapeTW.term.name)
			items = []
			let i = 0
			const color = 'gray'
			for (const shape of shapes) {
				const index = shape[1].shape % this.symbols.length
				const category_shape = this.symbols[index].size(64)()
				const name = shape[0]

				const row = shapeDiv
					.append('div')
					.attr('class', 'sja_clb')
					.style('display', 'block')

				row
					.append('div')
					.style('display', 'inline-block')

					.append('svg')
					.attr('width', 20)
					.attr('height', 22)

					.append('path')
					.attr('d', category_shape)
					.attr('fill', color)
					.attr('transform', c => `translate(10, 15)`)

				row
					.append('div')
					.style('display', 'inline-block')
					.html('&nbsp;' + name + ` (${shape[1].sampleCount})`)
				i++
			}
		}
	}
}

function setRenderers(self) {
	self.render = function(data) {
		const chartDiv = self.dom.holder.select('.pp-scatter-chart')
		if (chartDiv.size() > 0) updateCharts(chartDiv)
		else addCharts()
		self.dom.holder.style('display', 'inline-block')
		self.dom.holder.on('mouseover', self.mouseover).on('mouseout', self.mouseout)

		function addCharts() {
			const s = self.settings
			const div = self.dom.holder
				.append('div')
				.attr('class', 'pp-scatter-chart')
				.style('opacity', 0)
				//.style("position", "absolute")
				.style('width', s.svgw + 100 + 'px')
				.style('height', s.svgh + 50 + 'px')
				.style('display', 'inline-block')
				.style('margin', s.chartMargin + 'px')
				.style('top', 0) //layout.byChc[d.chc].top)
				.style('left', 0) //layout.byChc[d.chc].left)
				.style('text-align', 'left')

			const svg = div.append('svg')
			renderSVG(svg, div, s, 0, data)

			div
				.transition()
				.duration(s.duration)
				.style('opacity', 1)

			setTools(self.dom, svg, div)
			self.renderLegend(self.dom.legendDiv, data.colorLegend, data.shapeLegend)
		}

		function updateCharts(d) {
			const s = self.settings
			const div = d

			div.transition().duration(s.duration)
			//.style('width', s.svgw + 50 + 'px')

			div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

			renderSVG(div.select('svg'), d, s, s.duration, data)
			self.renderLegend(self.dom.legendDiv, data.colorLegend, data.shapeLegend)
		}
	}

	function renderSVG(svg, chart, s, duration, data) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + 100)
			.attr('height', s.svgh + 100)

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg, chart)
		/* eslint-enable */

		if (s.showAxes) mainG.attr('clip-path', `url(#clip)`)
		else mainG.attr('clip-path', '')

		let serie = mainG.select('.sjpcb-scatter-series')
		if (serie.size() == 0) serie = mainG.append('g').attr('class', 'sjpcb-scatter-series')

		renderSerie(serie, chart, data, s, duration)
	}

	function getSvgSubElems(svg, chart) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			svg.append('defs')
			mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = mainG.append('g').attr('class', 'sjpcb-scatter-axis')
			xAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-x-axis')
				.attr('transform', 'translate(100,' + self.settings.svgh + ')')
			yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', 'translate(100, 0)')
			xTitle = axisG.append('g').attr('class', 'sjpcb-scatter-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-scatter-y-title')
			mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', 101)
				.attr('y', 0)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			//Adding clip path
			svg
				.append('defs')
				.append('clipPath')
				.attr('id', 'clip')
				.append('rect')
				.attr('x', 80)
				.attr('y', 0)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh + 20)
			renderAxes(xAxis, xTitle, yAxis, yTitle, self.settings, chart)
		} else {
			mainG = svg.select('.sjpcb-scatter-mainG')
			axisG = svg.select('.sjpcb-scatter-axis')

			xAxis = axisG.select('.sjpcb-scatter-x-axis')
			yAxis = axisG.select('.sjpcb-scatter-y-axis')
			xTitle = axisG.select('.sjpcb-scatter-x-title')
			yTitle = axisG.select('.sjpcb-scatter-y-title')
		}
		if (self.settings.showAxes) axisG.style('opacity', 1)
		else axisG.style('opacity', 0)
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle]
	}

	function renderSerie(g, chart, data, s, duration) {
		// remove all symbols as there is no data id for privacy
		g.selectAll('path').remove()
		const symbols = g.selectAll('path').data(data.samples)
		symbols.exit().remove()
		symbols
			.transition()
			.duration(duration)
			.attr('transform', translate)
			.attr('d', c => getShape(self, c))
			.attr('fill', c => c.color)

			.style('fill-opacity', s.fillOpacity)
		symbols
			.enter()
			.append('path')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', translate)
			.attr('d', c => getShape(self, c))
			.attr('fill', c => c.color)

			.style('fill-opacity', s.fillOpacity)
			.transition()
			.duration(duration)
	}

	function translate(c) {
		const transform = `translate(${self.xAxisScale(c.x) + 100},${self.yAxisScale(c.y)})`
		return transform
	}

	function setTools(dom, svg, d) {
		const homeDiv = dom.controls
			.insert('div')
			.style('display', 'block')
			.style('margin', '20px')
		icon_functions['restart'](homeDiv, { handler: resetToIdentity })
		const zoomInDiv = dom.controls
			.insert('div')
			.style('display', 'block')
			.style('margin', '20px')
		icon_functions['zoomIn'](zoomInDiv, { handler: zoomIn })
		const zoomOutDiv = dom.controls
			.insert('div')
			.style('display', 'block')
			.style('margin', '20px')
		icon_functions['zoomOut'](zoomOutDiv, { handler: zoomOut })
		const lassoDiv = dom.controls
			.insert('div')
			.style('display', 'block')
			.style('margin', '20px')
		icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: false })
		const groupDiv = dom.controls
			.insert('div')
			.style('display', 'block')
			.style('margin', '20px')

		const mainG = svg.select('.sjpcb-scatter-mainG')
		const seriesG = mainG.select('.sjpcb-scatter-series')
		const symbols = seriesG.selectAll('path')
		const axisG = mainG.select('.sjpcb-scatter-axis')
		const xAxisG = axisG.select('.sjpcb-scatter-x-axis')
		const yAxisG = axisG.select('.sjpcb-scatter-y-axis')
		const zoom = d3zoom()
			.scaleExtent([0.5, 10])
			.on('zoom', handleZoom)

		mainG.call(zoom)
		const minsize = self.settings.size / 2
		const maxsize = self.settings.size * 2

		function handleZoom(event) {
			// create new scale ojects based on event
			const new_xScale = event.transform.rescaleX(self.xAxisScale)
			const new_yScale = event.transform.rescaleY(self.yAxisScale)

			xAxisG.call(self.axisBottom.scale(new_xScale))
			yAxisG.call(self.axisLeft.scale(new_yScale))
			seriesG.attr('transform', event.transform)
			const k = event.transform.scale(1).k
			//on zoom in the particle size is kept
			symbols.attr('d', c => getShape(self, c, size / k))
			if (self.lassoOn) lasso.selectedItems().attr('d', c => getShape(self, c, maxsize / k))
		}

		function zoomIn() {
			zoom.scaleBy(mainG.transition().duration(750), 1.5)
		}

		function zoomOut() {
			zoom.scaleBy(mainG.transition().duration(750), 0.5)
		}

		function resetToIdentity() {
			mainG
				.transition()
				.duration(750)
				.call(zoom.transform, zoomIdentity)
		}

		const lasso = d3lasso()
		self.lassoReset = () => {
			lasso
				.items(seriesG.selectAll('path'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)
		}

		self.lassoReset()

		function lasso_start(event) {
			lasso
				.items()
				.attr('d', c => getShape(self, c, minsize))
				.style('fill-opacity', '.5')
				.classed('not_possible', true)
				.classed('selected', false)
		}

		function lasso_draw(event) {
			if (self.lassoOn) {
				// Style the possible dots

				lasso
					.possibleItems()
					.attr('d', c => getShape(self, c, maxsize))
					.style('fill-opacity', '1')
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				lasso
					.notPossibleItems()
					.attr('d', c => getShape(self, c, minsize))
					.style('fill-opacity', '.5')
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end(dragEnd) {
			if (self.lassoOn) {
				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)

				// Style the selected dots
				lasso.selectedItems().attr('d', c => getShape(self, c, maxsize))
				lasso.items().style('fill-opacity', '1')
				self.selectedItems = []
				let data
				for (const item of lasso.selectedItems()._groups[0]) {
					data = item.__data__
					if (data.sample !== 'Ref') self.selectedItems.push(item)
				}
				lasso.notSelectedItems().attr('d', c => getShape(self, c))

				showLassoMenu(dragEnd.sourceEvent)
			}
		}

		function toggle_lasso() {
			self.lassoOn = !self.lassoOn
			if (self.lassoOn) {
				mainG.on('.zoom', null)
				mainG.call(lasso)
			} else {
				mainG.on('mousedown.drag', null)
				lasso.items().classed('not_possible', false)
				lasso.items().classed('possible', false)
				lasso
					.items()
					.attr('r', self.settings.size)
					.style('fill-opacity', '1')
				mainG.call(zoom)
				self.selectedItems = null
				groupDiv.select('*').remove()
			}
			lassoDiv.select('*').remove()
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
			groupDiv.select('*').remove()
		}

		function showLassoMenu(event) {
			self.dom.tip.clear().hide()
			if (self.selectedItems.length == 0) return
			self.dom.tip.show(event.clientX, event.clientY)

			const menuDiv = self.dom.tip.d.append('div')
			const listDiv = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			icon_functions['list'](listDiv, {
				is_button: false,
				text: `List ${self.selectedItems.length} samples`,
				handler: () => {
					showTable(self, self.selectedItems, `List of ${self.selectedItems.length} selected samples`)
					self.dom.tip.hide()
				}
			})
			if (self.state.allowedTermTypes.includes('survival')) {
				const survivalDiv = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
				icon_functions['survival'](survivalDiv, {
					is_button: false,
					handler: async e => {
						const subMenuDiv = new Menu({ padding: '5px' })
						const termdb = await import('../termdb/app')
						termdb.appInit({
							holder: subMenuDiv.d,
							vocabApi: self.app.vocabApi,
							state: {
								nav: {
									header_mode: 'search_only'
								},
								tree: { usecase: { target: 'survival', detail: 'term' } }
							},
							tree: {
								click_term: term => {
									openSurvivalPlot(self, self.selectedItems, term)
									self.dom.tip.hide()
									subMenuDiv.hide()
								}
							}
						})
						subMenuDiv.show(event.clientX + 190, event.clientY + 36)
					}
				})
				const startDiv = survivalDiv
					.append('div')
					.style('display', 'inline-block')
					.html('&nbsp;&nbsp;›')
			}
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', () => {
					self.groups.push(self.selectedItems)
					updateGroupsButton(groupDiv)
					self.dom.tip.hide()
				})
		}
	}

	function updateGroupsButton(groupDiv) {
		groupDiv.select('*').remove()
		groupDiv
			.append('button')
			.style('border', 'none')
			.style('background', 'transparent')
			.style('padding', 0)
			.append('div')
			.style('font-size', '1.1em')
			.html(`&#931${self.groups.length + 1};`)
			.on('click', event => showGroupsMenu(event, groupDiv))
		const tooltip = `Lasso toolbox`
		groupDiv.attr('title', tooltip)
	}

	function showGroupsMenu(event, groupDiv) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY)
		const menuDiv = self.dom.tip.d.append('div').style('min-width', '20vw')

		let row = menuDiv.append('div')
		row
			.insert('div')
			.text('Lasso toolbox')
			.style('text-align', 'center')
		row = row
			.insert('div')
			.style('display', 'flex')
			.style('justify-content', 'flex-start')
		if (self.state.allowedTermTypes.includes('survival')) {
			let survivalDiv = row
				.insert('div')
				.style('padding', '5px')
				.style('margin-left', '20px')

			icon_functions['survival'](survivalDiv, {
				width: 20,
				height: 20,
				text: 'Survival analysis on all',
				handler: async () => {
					const subMenuDiv = new Menu({ padding: '5px' })
					const termdb = await import('../termdb/app')
					termdb.appInit({
						holder: subMenuDiv.d,
						vocabApi: self.app.vocabApi,
						state: {
							nav: {
								header_mode: 'search_only'
							},
							tree: { usecase: { target: 'survival', detail: 'term' } }
						},
						tree: {
							click_term: term => {
								openSurvivalPlots(self, term)
								self.dom.tip.hide()
								subMenuDiv.hide()
							}
						}
					})
					subMenuDiv.show(event.clientX + 190, event.clientY + 36)
				}
			})
		}
		let deleteDiv = row.insert('div').style('padding', '5px')
		icon_functions['delete'](deleteDiv, {
			width: 20,
			height: 20,
			text: 'Delete all',
			handler: () => {
				groupDiv.select('*').remove()
				self.groups = []
				self.dom.tip.hide()
			}
		})
		for (const [i, group] of self.groups.entries()) {
			row = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			row
				.insert('div')
				.style('display', 'inline-block')
				.style('width', '40px')
				.append('input')
				.attr('type', 'checkbox')
			row
				.insert('div')
				.style('display', 'inline-block')
				.style('width', '80px')
				.text('Group ' + (i + 1))
			row
				.insert('div')
				.style('display', 'inline-block')
				.style('width', '80px')
				.text(group.length)
			const listDiv = row
				.insert('div')
				.style('display', 'inline-block')
				.style('width', '80px')
			icon_functions['list'](listDiv, {
				handler: () => showTable(self, group, `List of ${group.length} samples in Group ${i + 1}`)
			})
			if (self.state.allowedTermTypes.includes('survival')) {
				const survivalDiv = row
					.insert('div')
					.style('display', 'inline-block')
					.style('width', '180px')
				icon_functions['survival'](survivalDiv, { handler: () => openSurvivalPlot(self, group) })
				const deleteDiv = row
					.insert('div')
					.style('display', 'inline-block')
					.style('width', '80px')
				icon_functions['delete'](deleteDiv, {
					handler: () => {
						self.groups.splice(i, 1)
						if (self.groups.length == 0) groupDiv.select('*').remove()
						else updateGroupsButton(groupDiv)
						self.dom.tip.hide()
					}
				})
			}
		}
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s) {
		// create new scale ojects based on event

		xAxis.call(self.axisBottom)
		yAxis.call(self.axisLeft)

		xTitle.select('text, title').remove()
		const xTitleLabel =
			self.config.colorTW.term.name.length > 24
				? self.config.colorTW.term.name.slice(0, 20) + '...'
				: self.config.colorTW.term.name
		const xText = xTitle
			.attr('transform', 'translate(' + (100 + s.svgw) / 2 + ',' + (50 + s.svgh) + ')')
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(xTitleLabel + (self.config.colorTW.term.unit ? ', ' + self.config.colorTW.term.unit : ''))

		xText.append('title').text(self.config.colorTW.term.name)

		const yTitleLabel = 'Y'
		yTitle.select('text, title').remove()
		const yText = yTitle
			.attr('transform', 'translate(' + -s.axisTitleFontSize + ',' + s.svgh / 2 + ')rotate(-90)')
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
	}
}

function setInteractivity(self) {
	self.mouseover = function(event) {
		if (self.lassoOn) return
		if (event.target.tagName == 'path') {
			self.dom.tip.clear().show(event.clientX, event.clientY)
			const d = event.target.__data__
			if (!d) return
			const rows = [{ k: 'Sample', v: d.sample }]
			if ('category' in d) {
				rows.push({ k: self.config.colorTW.id, v: d.category })
			}
			if ('info' in d) for (const [k, v] of Object.entries(d.info)) rows.push({ k: k, v: v })
			make_table_2col(self.dom.tip.d, rows)
		} else {
			self.dom.tip.hide()
		}
	}

	self.mouseout = function() {
		if (!self.lassoOn) self.dom.tip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	try {
		await fillTermWrapper(opts.colorTW, app.vocabApi)
		if (opts.shapeTW) await fillTermWrapper(opts.shapeTW, app.vocabApi)

		const config = {
			id: opts.colorTW.id,
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: {
					size: 5,
					svgw: 500,
					svgh: 500,
					axisTitleFontSize: 16,
					showAxes: false
				}
			}
		}

		// may apply term-specific changes to the default object
		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [bsampleScatter getPlotConfig()]`
	}
}

export const scatterInit = getCompInit(Scatter)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

function showTable(self, group, title, pos = 1) {
	let rows = []
	const labels = ['Sample', self.config.colorTW.id]
	if (self.config.shapeTW) labels.push(self.config.shapeTW.id)
	rows.push(labels)
	let row, data
	for (const item of group) {
		data = item.__data__
		row = [data.sample]
		if ('category' in data) row.push(data.category)
		if (self.config.shapeTW) row.push(getShapeName(self.shapes, data))

		if ('info' in data) for (const [k, v] of Object.entries(data.info)) row.push(v)
		rows.push(row)
	}
	export_data(title, [{ text: rows.join('\n') }], pos)
}

function getShape(self, c, size) {
	const index = c.shape % self.symbols.length
	if (!size) size = self.settings.size
	return self.symbols[index].size(size)()
}

function getShapeName(shapes, data) {
	for (const shape of shapes) {
		const index = shape[1].shape
		const name = shape[0]
		if (data.shape === index) return name
	}
	return null
}

function openSurvivalPlot(self, group, term) {
	const values = []
	let data
	for (const item of group) {
		data = item.__data__
		values.push(data.sample)
	}
	let config = {
		chartType: 'survival',
		term,
		term2: {
			term: { name: 'TSNE selected groups', type: 'samplelst' },
			q: {
				mode: 'custom-groupsetting',
				groups: [
					{
						name: 'Group 1',
						key: 'sample',
						values: values
					},
					{
						name: 'Others',
						key: 'sample',
						in: false,
						values: values
					}
				]
			}
		},
		settings: {
			survival: {
				xTickValues: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
			}
		}
	}
	self.app.dispatch({
		type: 'plot_create',
		config: config
	})
}

function openSurvivalPlots(self, term) {
	let groups = []
	let values, tgroup, data

	for (const [i, group] of self.groups.entries()) {
		values = []
		for (const item of group) {
			data = item.__data__
			values.push(data.sample)
		}
		;(tgroup = {
			name: 'Group ' + (i + 1),
			key: 'sample',
			values: values
		}),
			groups.push(tgroup)
	}
	let config = {
		chartType: 'survival',
		term,
		term2: {
			term: { name: 'TSNE selected groups', type: 'samplelst' },
			q: {
				mode: 'custom-groupsetting',
				groups: groups
			}
		},
		settings: {
			survival: {
				xTickValues: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
			}
		}
	}
	self.app.dispatch({
		type: 'plot_create',
		config: config
	})
}
