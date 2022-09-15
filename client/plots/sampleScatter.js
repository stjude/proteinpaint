import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import Partjson from 'partjson'
import { dofetch } from '../common/dofetch'
import { zoom as d3zoom } from 'd3'
import { Menu } from '#dom/menu'
import { controlsInit } from './controls'

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
	}

	async init(opts) {
		const controls = this.opts.controls ? null : this.opts.holder.append('div')
		const holder = this.opts.controls ? this.opts.holder : this.opts.holder.append('div')
		const zoom_ctrl = this.opts.holder.append('div')

		this.dom = {
			loadingDiv: holder
				.append('div')
				.style('position', 'absolute')
				.style('display', 'none')
				.style('padding', '20px')
				.html('Loading ...'),
			header: this.opts.header,
			holder,
			controls,
			chartsDiv: holder
				.append('div')
				.style('margin', '10px')
				.style('display'),
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
					// {
					// 	type: 'term',
					// 	usecase: { target: 'scatterPlot', detail: 'term' },
					// 	vocab: this.app.vocabApi,
					// 	title: 'The term to use to color the samples'
					// },

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
			.style('overflow', 'visible')
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
		console.log('svg', svg)
		const zoomer = d3zoom()
			.scaleExtent([1, 5])
			.on('zoom', () => {
				svg.attr('transform', event.transform)
			})
		svg.call(zoomer)
		function zoomIn() {
			d3.select('svg')
				.transition()
				.call(zoom.scaleBy, 2)
		}

		function zoomOut() {
			d3.select('svg')
				.transition()
				.call(zoom.scaleBy, 0.5)
		}

		function resetZoom() {
			d3.select('svg')
				.transition()
				.call(zoom.scaleTo, 1)
		}

		function center() {
			d3.select('svg')
				.transition()
				.call(zoom.translateTo, 0.5 * width, 0.5 * height)
		}

		function panLeft() {
			d3.select('svg')
				.transition()
				.call(zoom.translateBy, -50, 0)
		}

		function panRight() {
			d3.select('svg')
				.transition()
				.call(zoom.translateBy, 50, 0)
		}
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
		console.log('data', series.data)
		const circles = g.selectAll('circle').data(series.data, b => b.x)

		circles.exit().remove()

		circles
			.transition()
			.duration(duration)
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			//.style("fill", color)
			.style('fill-opacity', s.fillOpacity)
		//.style("stroke", color);
		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			//.style("opacity", 0)
			.style('fill', c => ('color' in c ? c.color : 'black'))
			.style('fill-opacity', s.fillOpacity)
			//.style("stroke", color)
			.transition()
			.duration(duration)
	}
}

function setInteractivity(self) {
	self.mouseover = function() {
		if (event.target.tagName == 'circle') {
			const d = event.target.__data__
			console.log(d)
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
	console.log('opts', opts)
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
						top: 100,
						left: 200,
						right: 20,
						bottom: 100
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
	self.dom.div.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
}

/* function makeConfigPanel(obj) {
	const svg = obj.scattersvg

	// settings buttons
	obj.scattersvg_buttons
		.style('position', 'absolute')
		.style('right', '0px')
		.style('top', '0px')

	// zoom button
	obj.zoom_active = false
	const zoom_btn = obj.scattersvg_buttons
		.append('div')
		.style('padding', '2px 5px')
		.style('border', '1px solid #999')
		.style('color', '#999')
		.style('background-color', '#fff')
		.style('cursor', 'pointer')
		.style('font-weight', '300')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.text('Pan / Zoom')
		.on('click', zoomToggle)

	const zoom_menu = obj.scattersvg_buttons
		.append('div')
		.style('margin-top', '2px')
		.style('padding', '2px 5px')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.style('display', obj.zoom_active ? 'block' : 'none')
		.style('background-color', '#ddd')

	const zoom_inout_div = zoom_menu.append('div').style('margin', '5px 2px')

	zoom_inout_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px 4px')
		.style('font-size', '80%')
		.text('Zoom')

	zoom_inout_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html('<p style="margin:1px;">Mouse wheel </br>or use these buttons</p>')

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

	pan_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html('<p style="margin:1px;">Mouse click </br>+ Mouse move</p>')

	const reset_div = zoom_menu.append('div').style('margin', '5px 2px')

	const reset_btn = reset_div
		.append('button')
		.style('margin', '1px')
		.style('padding', '2px 8px')
		.text('Reset')

	function zoomToggle() {
		obj.zoom_active = obj.zoom_active ? false : true

		zoom_btn
			.style('border', obj.zoom_active ? '2px solid #000' : '1px solid #999')
			.style('color', obj.zoom_active ? '#000' : '#999')
			.style('background-color', obj.zoom_active ? '#eee' : '#fff')
			.style('font-weight', obj.zoom_active ? '400' : '300')

		lasso_btn.style('pointer-events', obj.zoom_active ? 'none' : 'auto')

		zoom_menu.style('display', obj.zoom_active ? 'block' : 'none')

		const zoom = d3zoom()
			.scaleExtent([1, 5])
			.on('zoom', obj.zoom_active ? zoomed : null)

		function zoomed() {
			obj.new_xscale = d3event.transform.rescaleX(obj.xscale)
			obj.new_yscale = d3event.transform.rescaleY(obj.yscale)
			obj.zoomed_scale = d3event.transform.k
			const dots = obj.dotg.selectAll('.sample_dot')
			dots.attr('transform', d => 'translate(' + obj.new_xscale(d.x) + ',' + obj.new_yscale(d.y) + ')')
			const userlabelg = obj.dotg.selectAll('.userlabelg')
			userlabelg.attr(
				'transform',
				d => 'translate(' + obj.new_xscale(d.x_ || d.x) + ',' + obj.new_yscale(d.y_ || d.y) + ')'
			)
		}

		if (obj.zoom_active) svg.call(zoom)
		else svg.on('.zoom', null)

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
	}

	const lasso_btn = obj.scattersvg_buttons
		.append('div')
		.style('display', 'block')
		.style('padding', '2px 5px')
		.style('margin-top', '5px')
		.style('border', '1px solid #999')
		.style('color', '#999')
		.style('background-color', '#fff')
		.style('cursor', 'pointer')
		.style('font-weight', '300')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.text('Lasso select')
		.on('click', lassoToggle)

	const lasso_menu = obj.scattersvg_buttons
		.append('div')
		.style('margin-top', '2px')
		.style('padding', '2px 5px')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.style('display', obj.lasso_active ? 'block' : 'none')
		.style('background-color', '#ddd')

	const lasso_div = lasso_menu.append('div').style('margin', '5px 2px')

	lasso_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '80%')
		.text('Lasso usage')

	lasso_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html(
			'<p style="margin:1px;">Mouse click </br>+ Mouse move <br>' +
				'TIP: Release the mouse <br> when desired dots <br> are selected, without <br>closing the loop. </p>'
		)

	function lassoToggle() {
		const dots = obj.dotg.selectAll('g')
		obj.lasso_active = obj.lasso_active ? false : true
		zoom_btn.style('pointer-events', obj.lasso_active ? 'none' : 'auto')
		lasso_menu.style('display', obj.lasso_active ? 'block' : 'none')

		lasso_btn
			.style('border', obj.lasso_active ? '2px solid #000' : '1px solid #999')
			.style('color', obj.lasso_active ? '#000' : '#999')
			.style('background-color', obj.lasso_active ? '#eee' : '#fff')
			.style('font-weight', obj.lasso_active ? '400' : '300')

		lasso_select(obj, dots)

		// reset dots to original state if lasso button deactivated
		if (obj.lasso_active) return
		dots
			.selectAll('circle')
			.classed('not_possible', false)
			.classed('possible', false)
			.attr('r', radius)
			.style('fill-opacity', '1')
	}
} */
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
