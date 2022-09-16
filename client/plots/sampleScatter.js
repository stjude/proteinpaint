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

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		const holder = this.opts.holder || this.opts.holder.append('div')
		const zoomDiv = this.opts.holder.append('div')

		this.dom = {
			header: this.opts.header,
			holder,
			controls,
			chartsDiv: holder
				.append('div')
				.style('margin', '10px')
				.style('display', 'inline-block'),
			zoomDiv,
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
					}
				]
			})
		}

		this.components.controls.on('downloadClick.survival', () => alert('TODO: data download?'))
	}
}

function setRenderers(self) {
	self.render = function() {
		const chartDivs = self.dom.holder.selectAll('.pp-scatter-chart').data(self.pj.tree.charts, d => d.chartId)

		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)
		self.dom.holder.style('display', 'inline-block')
		self.dom.holder.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function(d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-scatter-chart')
			.style('opacity', 0)
			//.style("position", "absolute")
			.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('top', 0) //layout.byChc[d.chc].top)
			.style('left', 0) //layout.byChc[d.chc].left)
			.style('text-align', 'left')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.append('div')
			.attr('class', 'sjpcb-scatter-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(d.chartId)
			.html(d.chartId)
		//.on("click", viz.chcClick);

		const svg = div.append('svg').attr('class', 'pp-scatter-svg')
		renderSVG(svg, d, s, 0)

		div
			.transition()
			.duration(s.duration)
			.style('opacity', 1)
		setZoomer(self.dom)
	}

	self.updateCharts = function(d) {
		const s = self.settings
		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			.style('width', s.svgw + 50 + 'px')
			//.style("top", layout.byChc[d.chc].top)
			//.style("left", layout.byChc[d.chc].left)
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.select('.sjpcb-scatter-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(d.chartId)
			.html(d.chartId)

		div.selectAll('.sjpcb-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), d, s, s.duration)
	}

	function renderSVG(svg, chart, s, duration) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw)
			.attr('height', s.svgh)
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);

		mainG.attr('transform', 'translate(' + s.svgPadding.left + ',' + s.svgPadding.top + ')')
		const serieses = mainG
			.selectAll('.sjpcb-scatter-series')
			.data(chart.serieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function(series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpcb-scatter-series')
			.each(function(series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (!svg.select('.sjpcb-scatter-mainG').size()) {
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
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('fill', c => ('color' in c ? c.color : default_color))
			.style('fill-opacity', s.fillOpacity)
		//.style("stroke", color);
		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			//.style("opacity", 0)
			.style('fill', c => ('color' in c ? c.color : default_color))
			.style('fill-opacity', s.fillOpacity)
			//.style("stroke", color)
			.transition()
			.duration(duration)
	}

	function setZoomer(dom) {
		console.log(dom)
		const obj = dom.zoomDiv
		obj.style('display', 'inline-block')
		const svg = select('svg')
		obj.scattersvg_buttons = obj.append('div').style('display', 'inline-block')
		obj.style('vertical-align', 'top').style('float', 'right')

		const zoom_menu = obj.scattersvg_buttons
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

		zoom_menu.style('display', 'inline-block')

		const zoom = d3zoom()
			.scaleExtent([1, 5])
			.on('zoom', () => {
				select('svg g').attr('transform', event.transform)
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

		svg.call(lasso)

		function lasso_start() {
			console.log('lasso start')
			lasso
				.items()
				.attr('r', 2)
				.style('fill-opacity', '.5')
				.classed('not_possible', true)
				.classed('selected', false)
		}

		function lasso_draw() {
			console.log('lasso draw')

			// Style the possible dots
			lasso
				.possibleItems()
				.attr('r', radius)
				.style('fill-opacity', '1')
				.classed('not_possible', false)
				.classed('possible', true)

			// Style the not possible dot
			// lasso.notPossibleItems()
			// 	.attr('r',2)
			// 	.style('fill-opacity','.5')
			// 	.classed('not_possible',true)
			// 	.classed('possible',false)
		}

		function lasso_end() {
			console.log('lasso end')

			// show menu if at least 1 sample selected
			const selected_samples = svg
				.selectAll('.possible')
				.data()
				.map(d => d.sample)
			if (selected_samples.length) show_lasso_menu(selected_samples)
			else obj.menu.hide()

			// Reset classes of all items (.possible and .not_possible are useful
			// only while drawing lasso. At end of drawing, only selectedItems()
			// should be used)
			lasso
				.items()
				.classed('not_possible', false)
				.classed('possible', false)

			// Style the selected dots
			lasso.selectedItems().attr('r', radius)

			// if none of the items are selected, reset radius of all dots or
			// keep them as unselected with tiny radius
			lasso
				.notSelectedItems()
				.attr('r', selected_samples.length == 0 ? radius : radius_tiny)
				.style('fill-opacity', '1')
		}
	}
}

function setInteractivity(self) {
	self.mouseover = function() {
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

	self.mouseout = function() {
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
					svgPadding: {
						top: 0,
						left: 0,
						right: 0,
						bottom: 0
					},
					axisTitleFontSize: 16,
					xAxisOffset: 5,
					yAxisOffset: -5
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
				return d3Linear()
					.domain([context.self.xMin, context.self.xMax])
					.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
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
				return d3Linear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			}
		}
	})
	return pj
}
