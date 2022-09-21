import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import Partjson from 'partjson'
import { dofetch } from '../common/dofetch'
import { zoom as d3zoom, zoomIdentity } from 'd3'
import { d3lasso } from '../common/lasso'
import { Menu } from '#dom/menu'
import { controlsInit } from './controls'
import { axisLeft, axisBottom } from 'd3-axis'


class Scatter {
	constructor() {
		this.type = 'sampleScatter'
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		const holder = this.opts.controls ? opts.holder : this.opts.holder.append('div')
		const toolsDiv = this.opts.holder.append('div')

		this.dom = {
			header: this.opts.header,
			holder,
			controls,
			chartsDiv: holder.style('margin', '10px').style('display', 'inline-block'),
			toolsDiv,
			tip: new Menu({ padding: '5px' })
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		if (!this.pj) this.pj = getPj(this)
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
			termfilter: appState.termfilter
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
		//this.data = this.app.vocabApi.getScatterData(reqOpts)
		const data = await dofetch('textfile', { file: this.config.file })
		if (data.error) throw data.error
		else if (data.text) {
			this.processData(data.text)
			this.render()
		}
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c = this.config
		const opts = { term: c.term, filter: this.state.termfilter.filter }
	}

	processData(data) {
		const lines = data.split('\n')
		const header = lines[0].split('\t')
		const rows = []
		for (let i = 1; i < lines.length; i++) {
			if (!lines[i]) continue
			const row = {}
			for (const [j, v] of lines[i].split('\t').entries()) {
				const key = header[j]
				row[key] = key == 'x' || key == 'y' ? Number(v) : v
			}
			rows.push(row)
		}
		this.currData = { rows }
		this.pj.refresh({ data: this.currData.rows })
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
						configKey: 'term',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'term' },
						title: 'The term to use to color the samples',
						label: 'Term',
						vocabApi: this.app.vocabApi
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
					},
				]
			})
		}

		this.components.controls.on('downloadClick.survival', () => alert('TODO: data download?'))
	}
}

function setRenderers(self) {
	self.render = function () {
		const chartDivs = self.dom.holder.selectAll('.pp-scatter-chart').data(self.pj.tree.charts, d => d.chartId)

		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)
		self.dom.holder.style('display', 'inline-block')
		self.dom.holder.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function (d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-scatter-chart')
			.style('opacity', 0)
			//.style("position", "absolute")
			.style('width', s.svgw + 150 + 'px')
			.style('height', s.svgh + 150 + 'px')

			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('top', 0) //layout.byChc[d.chc].top)
			.style('left', 0) //layout.byChc[d.chc].left)
			.style('text-align', 'left')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		const svg = div.append('svg').attr('class', 'pp-scatter-svg')
		renderSVG(svg, d, s, 0)

		div
			.transition()
			.duration(s.duration)
			.style('opacity', 1)
		setTools(self.dom, svg)
	}

	self.updateCharts = function (d) {
		const s = self.settings
		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			.style('width', s.svgw + 50 + 'px')
		//.style("top", layout.byChc[d.chc].top)
		//.style("left", layout.byChc[d.chc].left)

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), d, s, s.duration)
	}

	function renderSVG(svg, chart, s, duration) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + 100)
			.attr('height', s.svgh + 100)
		

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);

		const serieses = mainG
			.selectAll('.sjpcb-scatter-series')
			.data(chart.serieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function (series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpcb-scatter-series')
			.each(function (series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})
		if(s.showAxes)
				renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)

	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = mainG.append('g').attr('class', 'sjpcb-scatter-axis')
			xAxis = axisG.append('g').attr('class', 'sjpcb-scatter-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpcb-scatter-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpcb-scatter-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-scatter-y-title')
		} else {

			mainG = svg.select('.sjpcb-scatter-mainG')
			axisG = mainG.select('.sjpcb-scatter-axis')
			xAxis = axisG.select('.sjpcb-scatter-x-axis')
			yAxis = axisG.select('.sjpcb-scatter-y-axis')
			xTitle = axisG.select('.sjpcb-scatter-x-title')
			yTitle = axisG.select('.sjpcb-scatter-y-title')
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		// remove all circles as there is no data id for privacy
		g.selectAll('circle').remove()
		const circles = g.selectAll('circle').data(series.data, b => b.x)

		circles.exit().remove()
		const default_color = 'blue'
		circles
			.transition()
			.duration(duration)
			.attr('r', s.radius)
			.attr('cx', c => {
				c.scaledX + 100
			})
			.attr('cy', c => {
				c.scaledY
			})
			.style('fill', c => ('color' in c ? c.color : default_color))
			.style('fill-opacity', s.fillOpacity)
		//.style("stroke", color);
		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX + 100)
			.attr('cy', c => c.scaledY)
			//.style("opacity", 0)
			.style('fill', c => ('color' in c ? c.color : default_color))
			.style('fill-opacity', s.fillOpacity)
			//.style("stroke", color)
			.transition()
			.duration(duration)
	}

	function setTools(dom, svg) {
		const scattersvg_buttons = dom.toolsDiv
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('float', 'right')

		const zoom_menu = scattersvg_buttons
			.append('div')
			.style('margin-top', '2px')
			.style('padding', '2px 5px')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('background-color', '#ddd')

		const zoom_inout_div = zoom_menu.append('div').style('margin', '5px 2px')
		zoom_inout_div
			.append('div')
			.style('display', 'block')
			.style('padding', '2px')
			.style('font-size', '70%')
			.html('<p style="margin:1px;">Use the mouse and/or this </br>panel to interact with the plot</p>')

		zoom_inout_div
			.append('div')
			.style('display', 'block')
			.style('padding', '2px 4px')
			.style('font-size', '80%')
			.text('Zoom')

		const zoom_in_btn = zoom_inout_div
			.append('button')
			.style('margin', '1px')
			.style('padding', '2px 7px')
			.text('+')

		const zoom_out_btn = zoom_inout_div
			.append('button')
			.style('margin', '1px')
			.style('padding', '2px 8px')
			.text('-')

		const pan_div = zoom_menu.append('div').style('margin', '5px 2px')

		pan_div
			.append('div')
			.style('display', 'block')
			.style('padding', '2px')
			.style('font-size', '80%')
			.text('Pan')

		const pan_left_btn = pan_div
			.append('button')
			.style('margin', '1px')
			.style('padding', '2px 7px')
			.text('+')

		const pan_right_btn = pan_div
			.append('button')
			.style('margin', '1px')
			.style('padding', '2px 8px')
			.text('-')

		const reset_div = zoom_menu.append('div').style('margin', '5px 2px')

		const reset_btn = reset_div
			.append('button')
			.style('margin', '1px')
			.style('padding', '2px 8px')
			.text('Reset')
		const lasso_div = zoom_menu.append('div').style('margin', '5px 2px').style('font-size', '70%')
		const lasso_chb = lasso_div.append('input')
			.attr('type', 'checkbox')
			.attr('id', 'lasso_chb')
			.on('input', toggle_lasso)
			.property('checked', false)
		lasso_div.append('label').attr('for', 'lasso_chb').html('Use lasso')

		zoom_menu.style('display', 'inline-block')

		const zoom = d3zoom()
			.scaleExtent([0.5, 5])
			.on('zoom', () => {
				svg.select('g').attr('transform', event.transform)
			})

		svg.call(zoom)
		zoom_in_btn.on('click', () => {
			zoom.scaleBy(svg.transition().duration(750), 1.5)
		})

		zoom_out_btn.on('click', () => {
			zoom.scaleBy(svg.transition().duration(750), 0.5)
		})

		reset_btn.on('click', () => {
			svg
				.transition()
				.duration(750)
				.call(zoom.transform, zoomIdentity)
		})

		pan_left_btn.on('click', () => {
			zoom.translateBy(svg.transition().duration(750), -50, 0)
		})

		pan_right_btn.on('click', () => {
			zoom.translateBy(svg.transition().duration(750), 50, 0)
		})

		const circles = svg.selectAll('g').selectAll('circle')
		console.log('circles', circles)
		const lasso = d3lasso()
			.items(circles)
			.targetArea(svg)
			.on('start', lasso_start)
			.on('draw', lasso_draw)
			.on('end', lasso_end)

		function lasso_start() {
			if (lasso_chb.checked)
				lasso
					.items()
					.attr('r', 2)
					.style('fill-opacity', '.5')
					.classed('not_possible', true)
					.classed('selected', false)
		}

		function lasso_draw() {
			if (lasso_chb.checked) {
				// Style the possible dots
				lasso
					.possibleItems()
					.attr('r', self.settings.radius)
					.style('fill-opacity', '1')
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				lasso
					.notPossibleItems()
					.attr('r', 2)
					.style('fill-opacity', '.5')
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end() {
			if (lasso_chb.checked) {

				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)

				// Style the selected dots
				lasso.selectedItems().attr('r', self.settings.radius)

				// if none of the items are selected, reset radius of all dots or
				// keep them as unselected with tiny radius
				lasso
					.items()
					.style('fill-opacity', '1')
			}
		}

		function toggle_lasso() {
			lasso_chb.checked = lasso_chb.property('checked')
			if (lasso_chb.checked)
			{
				svg.on('.zoom', null);
				svg.call(lasso)
			}
			else
			{
				svg.on('mousedown.drag', null)
				lasso.items().classed('not_possible', false)
				lasso.items().classed('possible', false)
				lasso
					.items()
					.attr('r',  self.settings.radius)
					.style('fill-opacity', '1')
				svg.call(zoom)
			}
		}
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
		xAxis
			.attr('transform', 'translate(100,' + (s.svgh) + ')')
			.call(axisBottom(d.xScale).ticks(5))

		yAxis.attr('transform', 'translate(100, 0)')
		.call(
			axisLeft(
				d3Linear()
					.domain(d.yScale.domain())
					.range([0, s.svgh])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const xTitleLabel =
			self.config.term.term.name.length > 24
				? self.config.term.term.name.slice(0, 20) + '...'
				: self.config.term.term.name
		const xText = xTitle
			.attr(
				'transform',
				'translate(' +
					(100 + s.svgw) / 2 +
					',' +
					(50 + s.svgh) +
					')'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(xTitleLabel + (self.config.term.term.unit ? ', ' + self.config.term.term.unit : ''))

		xText.append('title').text(self.config.term.term.name)

		const yTitleLabel = 'Y'
		yTitle.select('text, title').remove()
		const yText = yTitle
			.attr(
				'transform',
				'translate(' +
					( - s.axisTitleFontSize) +
					',' +
					(s.svgh) / 2 +
					')rotate(-90)'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
		
	}

}



function setInteractivity(self) {
	self.mouseover = function () {
		if (event.target.tagName == 'circle') {
			const d = event.target.__data__
			const rows = [
				`<tr><td style='padding:3px; color:#aaa'>Sample:</td><td style='padding:3px; text-align:center'>${d.sample}</td></tr>`
			]
			self.app.tip
				.show(event.clientX, event.clientY)
				.d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		} else {
			self.app.tip.hide()
		}
	}

	self.mouseout = function () {
		self.app.tip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'sampleScatter getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		const config = {
			id: opts.term.id,
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: {
					radius: 5,
					svgw: 600,
					svgh: 600,
					axisTitleFontSize: 16,
					xAxisOffset: 5,
					yAxisOffset: -5,
					showAxes: true
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

function getPj(self) {
	const s = self.settings
	const pj = new Partjson({
		template: {
			//"__:charts": "@.byChc.@values",
			yMin: '>$y',
			yMax: '<$y',
			charts: [
				{
					chartId: '@key',
					chc: '@key',
					xMin: '>$x',
					xMax: '<$x',
					yMin: '>$y',
					yMax: '<$y',
					'__:xScale': '=xScale()',
					'__:yScale': '=yScale()',
					serieses: [
						{
							chartId: '@parent.@parent.@key',
							seriesId: '@key',
							data: [
								{
									'__:seriesId': '@parent.@parent.seriesId',
									color: '$color',
									x: '$x',
									y: '$y',
									sample: '$sample',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'$y'
							]
						},
						'-'
					]
				},
				'$val0'
			]
		},
		'=': {
			xScale(row, context) {
				const cx = d3Linear()
					.domain([context.self.xMin, context.self.xMax])
					.range([3 * s.radius, s.svgw - 3 * s.radius])
				return cx
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				return context.context.context.context.parent.yScale(context.self.y)
			},
			yScale(row, context) {
				const yMin = context.self.yMin
				const yMax = context.self.yMax
				const domain = s.scale == 'byChart' ? [yMax, yMin] : [context.root.yMax, yMin]
				const cy = d3Linear()
					.domain(domain)
					.range([3 * s.radius, s.svgh - 3 * s.radius]) 
				return cy
			}
		}
	})
	return pj
}
