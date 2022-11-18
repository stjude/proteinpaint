import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'
import { renderTable } from '../dom/table'
import { scaleLinear as d3Linear } from 'd3-scale'

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
	groups
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
		this.k = 1
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		const controlsDiv = this.opts.controls
			? opts.holder
			: this.opts.holder.append('div').style('display', 'inline-block')
		const mainDiv = controlsDiv.append('div').style('display', 'inline-block')

		const chartDiv = mainDiv.append('div').style('display', 'inline-block')
		const legendDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('margin-left', '100px')

		const holder = chartDiv.insert('div')

		this.dom = {
			header: this.opts.header,
			holder: holder,
			controls,
			legendDiv,
			tip: new Menu({ padding: '5px' }),
			tooltip: new Menu({ padding: '5px' }),
			termstip: new Menu({ padding: '5px', offsetX: 170, offsetY: -34 })
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

		console.log(data)
		this.shapeLegend = new Map(Object.entries(data.shapeLegend))
		this.colorLegend = new Map(Object.entries(data.colorLegend))

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
		this.setTools()
		this.lassoReset()
		this.updateGroupsButton()
		this.dom.tip.hide()
		this.dom.termstip.hide()
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
		const controlsHolder = this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: [
					{
						type: 'term',
						configKey: 'colorTW',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'colorTW' },
						title: 'The term to use to color the samples',
						label: 'Color',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove'
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
						label: 'Sample size',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'size',
						title: 'It represents the area of the symbols in square pixels',
						min: 0
					},
					{
						label: 'Ref sample size',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'refSize',
						title: 'It represents the area of the reference samples in square pixels',
						min: 0
					},
					{
						label: 'Chart width',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'svgw'
					},
					{
						label: 'Chart height',
						type: 'number',
						chartType: 'sampleScatter',
						settingsKey: 'svgh'
					},
					{
						boxLabel: 'Visible',
						label: 'Show axes',
						type: 'checkbox',
						chartType: 'sampleScatter',
						settingsKey: 'showAxes',
						title: `Option to show/hide plot axes`
					},
					{
						boxLabel: 'Visible',
						label: 'Show reference',
						type: 'checkbox',
						chartType: 'sampleScatter',
						settingsKey: 'showRef',
						title: `Option to show/hide ref samples`
					}
				]
			})
		}

		this.components.controls.on('downloadClick.scatter', () => downloadSVG(this.svg))
		this.dom.toolsDiv = this.dom.controls.insert('div')
	}

	renderLegend(legendG) {
		legendG.selectAll('*').remove()
		const step = 30
		let offsetX = 0
		let offsetY = 60
		let title = this.config.colorTW.term.name
		const colorG = legendG.append('g')
		colorG
			.append('text')
			.attr('x', offsetX)
			.attr('y', 30)
			.text(title)
			.style('font-weight', 'bold')

		const radius = 6
		let category, count, name, color
		for (const [key, category] of this.colorLegend) {
			color = category.color
			count = category.sampleCount
			name = key

			colorG
				.append('circle')
				.attr('cx', offsetX)
				.attr('cy', offsetY)
				.attr('r', radius)
				.style('fill', color)
			colorG
				.append('text')
				.attr('x', offsetX + 10)
				.attr('y', offsetY)
				.text(`${name}, n=${count}`)
				.style('font-size', '15px')
				.attr('alignment-baseline', 'middle')
			offsetY += step
		}
		if (this.config.shapeTW) {
			offsetX = 300
			offsetY = 60
			title = this.config.shapeTW.term.name

			const shapeG = legendG.append('g')
			shapeG
				.append('text')
				.attr('x', offsetX)
				.attr('y', 30)
				.text(title)
				.style('font-weight', 'bold')

			let index, symbol
			color = 'gray'
			for (const [key, shape] of this.shapeLegend) {
				index = shape.shape % this.symbols.length
				symbol = this.symbols[index].size(64)()
				name = key
				count = shape.sampleCount

				shapeG
					.append('path')
					.attr('transform', c => `translate(${offsetX}, ${offsetY})`)
					.style('fill', color)
					.attr('d', symbol)
				shapeG
					.append('text')
					.attr('x', offsetX + 10)
					.attr('y', offsetY)
					.text(`${name}, n=${count}`)
					.style('font-size', '15px')
					.attr('alignment-baseline', 'middle')
				offsetY += step
			}
		}
	}
}

function setRenderers(self) {
	self.render = function(data) {
		const chartDiv = self.dom.holder
		if (chartDiv.selectAll('*').size() > 0) updateCharts()
		else addCharts()
		self.dom.holder
			.on('mouseover', self.mouseover)
			.on('mouseout', self.mouseout)
			.on('click', self.mouseclick)

		function addCharts() {
			const s = self.settings
			chartDiv.style('opacity', 0)

			self.svg = chartDiv.append('svg')
			renderSVG(self.svg, chartDiv, s, 0, data)

			chartDiv
				.transition()
				.duration(s.duration)
				.style('opacity', 1)
		}

		function updateCharts() {
			const s = self.settings
			chartDiv.transition().duration(s.duration)
			renderSVG(chartDiv.select('svg'), chartDiv, s, s.duration, data)
		}
	}

	function renderSVG(svg, chart, s, duration, data) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + 700)
			.attr('height', s.svgh + 110) //leaving 100 px for the y-axis and 10 to leave some space on top

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, legendG] = getSvgSubElems(svg, chart)
		/* eslint-enable */

		if (mainG.select('.sjpcb-scatter-series').size() == 0) mainG.append('g').attr('class', 'sjpcb-scatter-series')
		const serie = mainG.select('.sjpcb-scatter-series')
		renderSerie(serie, data, s, duration)
		self.renderLegend(legendG)
	}

	function getSvgSubElems(svg, chart) {
		let mainG, axisG, xAxis, yAxis, legendG
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
			mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', 101)
				.attr('y', 0)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			//Adding clip path
			const idclip = `sjpp_clip_${Date.now()}`
			svg
				.append('defs')
				.append('clipPath')
				.attr('id', idclip)
				.append('rect')
				.attr('x', 80)
				.attr('y', 0)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh + 20)
			mainG.attr('clip-path', `url(#${idclip})`)
			xAxis.call(self.axisBottom)
			yAxis.call(self.axisLeft)
			legendG = svg
				.append('g')
				.attr('class', 'sjpcb-scatter-legend')
				.attr('transform', `translate(${self.settings.svgw + 200}, 0)`)
		} else {
			mainG = svg.select('.sjpcb-scatter-mainG')
			axisG = svg.select('.sjpcb-scatter-axis')

			xAxis = axisG.select('.sjpcb-scatter-x-axis')
			yAxis = axisG.select('.sjpcb-scatter-y-axis')
			legendG = svg.select('.sjpcb-scatter-legend')
		}
		if (self.settings.showAxes) axisG.style('opacity', 1)
		else axisG.style('opacity', 0)
		return [mainG, axisG, xAxis, yAxis, legendG]
	}

	function renderSerie(g, data, s, duration) {
		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path').data(data.samples)
		symbols.exit().remove()
		symbols
			.transition()
			.duration(duration)
			.attr('transform', translate)
			.attr('d', c => getShape(self, c))
			.attr('fill', c => getColor(self, c))

			.style('fill-opacity', c => ('sampleId' in c || s.showRef ? 1 : 0))
		symbols
			.enter()
			.append('path')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', translate)
			.attr('d', c => getShape(self, c))
			.attr('fill', c => getColor(self, c))

			.style('fill-opacity', c => ('sampleId' in c || s.showRef ? 1 : 0))
			.transition()
			.duration(duration)
	}

	function translate(c) {
		const transform = `translate(${self.xAxisScale(c.x) + 100},${self.yAxisScale(c.y) + 10})`
		return transform
	}

	self.lassoReset = () => {
		const mainG = self.dom.holder.select('.sjpcb-scatter-mainG')

		if (self.lasso)
			self.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)
		function lasso_start(event) {
			if (self.lassoOn) {
				self.lasso
					.items()
					.attr('d', c => getShape(self, c, 1 / 2))
					.style('fill-opacity', c => ('sampleId' in c || self.settings.showRef ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('selected', false)
			}
		}

		function lasso_draw(event) {
			if (self.lassoOn) {
				// Style the possible dots

				self.lasso
					.possibleItems()
					.attr('d', c => getShape(self, c, 2))
					.style('fill-opacity', c => ('sampleId' in c || self.settings.showRef ? 1 : 0))
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				self.lasso
					.notPossibleItems()
					.attr('d', c => getShape(self, c, 1 / 2))
					.style('fill-opacity', c => ('sampleId' in c || self.settings.showRef ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end(dragEnd) {
			if (self.lassoOn) {
				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				self.lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)

				// Style the selected dots
				self.lasso.selectedItems().attr('d', c => getShape(self, c, 2))
				self.lasso.items().style('fill-opacity', c => ('sampleId' in c || self.settings.showRef ? 1 : 0))
				self.selectedItems = []
				let data
				for (const item of self.lasso.selectedItems()._groups[0]) {
					data = item.__data__
					if ('sampleId' in data) self.selectedItems.push(item)
				}
				self.lasso.notSelectedItems().attr('d', c => getShape(self, c))

				showLassoMenu(dragEnd.sourceEvent)
			}
		}

		function showLassoMenu(event) {
			self.dom.tip.clear().hide()
			if (self.selectedItems.length == 0) return
			self.dom.tip.show(event.clientX, event.clientY)

			const menuDiv = self.dom.tip.d.append('div')
			const listDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`List ${self.selectedItems.length} samples`)
				.on('click', event => {
					self.dom.tip.hide()
					showTable({ name: 'Selected samples', items: self.selectedItems }, event.clientX, event.clientY, true)
				})

			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', () => {
					self.config.groups.push({
						name: `Group ${self.config.groups.length + 1}`,
						items: self.selectedItems,
						index: groups.length
					})
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				})
		}
	}

	self.setTools = function() {
		const inline = self.config.settings.controls.isOpen
		const svg = self.svg
		const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		let display = 'block'
		if (inline) display = 'inline-block'

		const homeDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
		icon_functions['restart'](homeDiv, { handler: resetToIdentity })
		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
		icon_functions['zoomIn'](zoomInDiv, { handler: zoomIn })
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
		icon_functions['zoomOut'](zoomOutDiv, { handler: zoomOut })
		const lassoDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
		icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		self.dom.groupDiv = toolsDiv
			.insert('div')
			.style('display', display)
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
		const s = self.settings
		function handleZoom(event) {
			// create new scale ojects based on event
			const new_xScale = event.transform.rescaleX(self.xAxisScale)
			const new_yScale = event.transform.rescaleY(self.yAxisScale)

			xAxisG.call(self.axisBottom.scale(new_xScale))
			yAxisG.call(self.axisLeft.scale(new_yScale))
			seriesG.attr('transform', event.transform)
			self.k = event.transform.scale(1).k
			//on zoom in the particle size is kept
			symbols.attr('d', c => getShape(self, c))
			if (self.lassoOn) self.lasso.selectedItems().attr('d', c => getShape(self, c, 2))
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

		self.lasso = d3lasso()

		self.lassoReset()

		function toggle_lasso() {
			self.lassoOn = !self.lassoOn
			if (self.lassoOn) {
				mainG.on('.zoom', null)
				mainG.call(self.lasso)
			} else {
				mainG.on('mousedown.drag', self.lassoReset())
				self.lasso.items().classed('not_possible', false)
				self.lasso.items().classed('possible', false)
				self.lasso
					.items()
					.attr('r', self.settings.size)
					.style('fill-opacity', '1')
				mainG.call(zoom)
				self.selectedItems = null
			}
			lassoDiv.select('*').remove()
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		}
	}

	self.updateGroupsButton = function() {
		self.dom.groupDiv.selectAll('*').remove()
		self.dom.tip.hide()
		if (self.config.groups.length == 0) return
		self.dom.groupDiv
			.append('button')
			.style('border', 'none')
			.style('background', 'transparent')
			.style('padding', 0)
			.append('div')
			.style('font-size', '1.1em')
			.html(`&#931${self.config.groups.length + 1};`)
			.on('click', event => {
				if (self.config.groups.length == 1) showGroupMenu(event, self.config.groups[0])
				else showGroupsMenu(event)
			})
	}

	function showGroupsMenu(event) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY)
		const menuDiv = self.dom.tip.d.append('div')

		let row = menuDiv.append('div')

		for (const [i, group] of self.config.groups.entries()) {
			row = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			row
				.insert('div')
				.style('display', 'inline-block')
				.text(` ${group.name}: ${group.items.length} `)

			row
				.append('div')
				.style('display', 'inline-block')
				.style('float', 'right')
				.html('&nbsp;&nbsp;›')
			row.on('click', e => {
				self.dom.tip.clear().hide()
				showGroupMenu(event, group)
			})
		}
		if (self.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.html('Compare survival&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				showTermsTree(
					self,
					survivalDiv,
					term => {
						openSurvivalPlot(self, term, getGroupsOverlay(self.config.groups))
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			showTermsTree(self, summarizeDiv, term => {
				openSummaryPlot(self, term, getGroupsOverlay(self.config.groups))
			})
		})
		row = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete groups')
			.on('click', event => {
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: [] } })
			})
	}

	function showGroupMenu(event, group) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY)

		const menuDiv = self.dom.tip.d.append('div')
		menuDiv
			.append('div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.7rem')
		const listDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Edit ${group.items.length} samples`)
			.on('click', e => {
				self.dom.tip.hide()
				showTable(group, event.clientX, event.clientY, false)
			})

		if (self.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.style('position', 'relative')
				.html('Survival analysis&nbsp;&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				showTermsTree(
					self,
					survivalDiv,
					term => {
						openSurvivalPlot(self, term, getGroupvsOthersOverlay(group))
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			showTermsTree(self, summarizeDiv, term => openSummaryPlot(self, term, getGroupvsOthersOverlay(group)))
		})
		const deleteDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Delete group`)
			.on('click', e => {
				self.config.groups = self.config.groups.splice(group.index, 1)
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
			})
	}

	function showTable(group, x, y, addGroup) {
		let rows = []
		const columns = [formatCell('Sample', 'label'), formatCell(self.config.colorTW.term.name, 'label')]
		if (self.config.shapeTW) columns.push(formatCell(self.config.shapeTW.term.name, 'label'))
		columns.push(formatCell('Info', 'label'))
		for (const item of group.items) {
			const data = item.__data__
			const row = [formatCell(data.sample)]
			if ('category' in data) row.push(formatCell(getCategoryInfo(data, 'category')))
			else row.push(formatCell(''))
			if (self.config.shapeTW) row.push(formatCell(getCategoryInfo(data, 'shape')))
			if ('info' in data) {
				const values = []
				for (const [k, v] of Object.entries(data.info)) values.push(`${k}: ${v}`)
				row.push(formatCell(values.join(', ')))
			} else row.push({ value: '' })
			rows.push(row)
		}
		self.dom.tip.clear()
		const headerDiv = self.dom.tip.d.append('div')
		headerDiv
			.insert('div')
			.html('&nbsp;' + group.name)
			.style('display', 'inline-block')
			.style('font-weight', 'bold')
			.style('margin-top', '5px')
		const tableDiv = self.dom.tip.d.append('div')
		const buttons = []
		if (addGroup) {
			const addGroup = {
				text: 'Add to a group',
				callback: indexes => {
					const items = []
					for (const i of indexes) items.push(self.selectedItems[i])
					self.config.groups.push({
						name: `Group ${self.config.groups.length + 1}`,
						items,
						index: groups.length
					})
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				}
			}
			buttons.push(addGroup)
		} else {
			const deleteSamples = {
				text: 'Delete samples',
				callback: indexes => {
					group.items = group.items.filter((elem, index, array) => !(index in indexes))
					showTable(group, x, y, addGroup)
				}
			}
			buttons.push(deleteSamples)
		}
		renderTable({
			rows,
			columns,
			div: tableDiv,
			style: { max_width: '550px', max_height: '35vh' },
			buttons
		})

		self.dom.tip.show(x, y)
		//scroll(x, y)
		function formatCell(column, name = 'value') {
			let dict = { width: '150px' }
			dict[name] = column
			return dict
		}
	}
}

function setInteractivity(self) {
	self.mouseover = function(event) {
		if (event.target.tagName == 'path') {
			const d = event.target.__data__
			if (!d) return
			if (!('sampleId' in d) && (!self.settings.showRef || self.settings.refSize == 0)) return
			self.dom.tooltip.clear().hide()

			const rows = [{ k: 'Sample', v: d.sample }]
			const cat_info = getCategoryInfo(d, 'category')
			rows.push({ k: self.config.colorTW.term.name, v: cat_info })
			if (self.config.shapeTW) {
				const cat_info = getCategoryInfo(d, 'shape')
				rows.push({ k: self.config.shapeTW.term.name, v: cat_info })
			}
			if ('info' in d) for (const [k, v] of Object.entries(d.info)) rows.push({ k: k, v: v })
			make_table_2col(self.dom.tooltip.d, rows)
			self.dom.tooltip.show(event.clientX, event.clientY)
		} else self.dom.tooltip.hide()
	}

	self.mouseout = function() {
		if (!self.lassoOn) self.dom.tooltip.hide()
	}

	self.mouseclick = function() {
		if (!self.lassoOn) self.dom.tip.hide()
		self.dom.termstip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	try {
		await fillTermWrapper(opts.colorTW, app.vocabApi)
		if (opts.shapeTW) await fillTermWrapper(opts.shapeTW, app.vocabApi)
		const config = {
			groups: [],
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: {
					size: 16,
					refSize: 9,
					svgw: 600,
					svgh: 600,
					axisTitleFontSize: 16,
					showAxes: false,
					showRef: true
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

function getCategoryInfo(d, category) {
	if (!(category in d)) return ''
	return d.category_info?.[category] ? `${d.category_info[category]} ${d[category]}` : d[category]
}

function getColor(self, c) {
	const color = 'category' in c ? self.colorLegend.get(c.category).color : self.colorLegend.get('None').color
	return color
}

function getShape(self, c, factor = 1) {
	const index = self.shapeLegend.get(c.shape).shape % self.symbols.length
	const size = 'sampleId' in c ? self.settings.size : self.settings.refSize
	return self.symbols[index].size((size * factor) / self.k)()
}

function openSurvivalPlot(self, term, groups) {
	let config = {
		chartType: 'survival',
		term,
		term2: {
			term: { name: self.config.name + ' groups', type: 'samplelst' },
			q: {
				mode: 'custom-groupsetting',
				groups: groups
			}
		},
		insertBefore: self.id,
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

function downloadSVG(svg) {
	const link = document.createElement('a')
	// If you don't know the name or want to use
	// the webserver default set name = ''
	link.setAttribute('download', 'scatter.svg')
	document.body.appendChild(link)
	link.click()
	link.remove()
	const serializer = new XMLSerializer()
	const svg_blob = new Blob([serializer.serializeToString(svg.node())], {
		type: 'image/svg+xml'
	})
	link.href = URL.createObjectURL(svg_blob)
	link.click()
	link.remove()
}

function openSummaryPlot(self, term, groups) {
	let config = {
		chartType: 'summary',
		childType: 'barchart',
		term,
		term2: {
			term: { name: self.config.name + ' groups', type: 'samplelst' },
			q: {
				mode: 'custom-groupsetting',
				groups: groups
			}
		},
		insertBefore: self.id
	}
	self.app.dispatch({
		type: 'plot_create',
		config
	})
}

function getGroupsOverlay(groups) {
	const overlayGroups = []
	let values, tgroup, data
	for (const [i, group] of groups.entries()) {
		values = []
		for (const item of group.items) {
			data = item.__data__
			values.push(data.sample)
		}
		;(tgroup = {
			name: 'Group ' + (i + 1),
			key: 'sample',
			values: values
		}),
			overlayGroups.push(tgroup)
	}
	return overlayGroups
}

function getGroupvsOthersOverlay(group) {
	const values = []
	let data
	for (const item of group.items) {
		data = item.__data__
		values.push(data.sample)
	}
	return [
		{
			name: 'Group 1',
			key: 'sample',
			values
		},
		{
			name: 'Others',
			key: 'sample',
			in: false,
			values
		}
	]
}

async function showTermsTree(self, div, callback, state = { tree: { usecase: { detail: 'term' } } }) {
	self.dom.termstip.clear()
	self.dom.termstip.showunderoffset(div.node())
	const termdb = await import('../termdb/app')
	termdb.appInit({
		holder: self.dom.termstip.d,
		vocabApi: self.app.vocabApi,
		state,
		tree: {
			click_term: term => {
				callback(term)
				self.dom.tip.hide()
				self.dom.termstip.hide()
			}
		}
	})
}
