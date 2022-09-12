import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import Partjson from 'partjson'
import { dofetch } from '../common/dofetch'

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
	}

	async init(opts) {
		const div = this.opts.controls ? this.opts.holder : this.opts.holder.append('div')
		this.dom = {
			header: this.opts.header,
			//controls: this.opts.controls ? null : holder.append('div'),
			div
		}
		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		if (!this.pj) this.pj = getPj(this)
		//await this.setControls()
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
		this.config = this.state.config
		if (this.dom.header) this.dom.header.html(this.config.plot.name + ' Scatter Plot')
		copyMerge(this.settings, this.config.settings.sampleScatter)
		const reqOpts = this.getDataRequestOpts()
		//this.data = this.app.vocabApi.getScatterData(reqOpts)
		const data = await dofetch('textfile', { file: this.config.plot.file })
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
}

function setRenderers(self) {
	self.render = function() {
		const chartDivs = self.dom.div.selectAll('.pp-scatter-chart').data(self.pj.tree.charts, d => d.chartId)

		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)
		self.dom.div.style('display', 'block')
		self.dom.div.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
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
			.style('border', '1px solid #eee')
			.style('box-shadow', '0px 0px 1px 0px #ccc')
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

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
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

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
		xAxis
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom) + ')')
			.call(axisBottom(d.xScale).ticks(5))

		yAxis.call(
			axisLeft(
				d3Linear()
					.domain(d.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
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
					(s.svgw - s.svgPadding.left - s.svgPadding.right) / 2 +
					',' +
					(s.svgh - s.axisTitleFontSize) +
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
					(-s.svgPadding.left / 2 - s.axisTitleFontSize) +
					',' +
					(s.svgh - s.svgPadding.top - s.svgPadding.bottom) / 2 +
					')rotate(-90)'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
		//.text(yTitleLabel + (self.config.term2.term.unit ? ', ' + self.config.term2.term.unit : ''))

		//yText.append('title').text(self.config.term2.term.name)
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
					svgw: 400,
					svgh: 300,
					svgPadding: {
						top: 20,
						left: 55,
						right: 20,
						bottom: 50
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

function setInteractivity(self) {
	self.mouseover = function() {
		if (event.target.tagName == 'circle') {
			const d = event.target.__data__
			const rows = [
				`<tr><td style='padding:3px; color:#aaa'>X:</td><td style='padding:3px; text-align:center'>${d.x}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>Y:</td><td style='padding:3px; text-align:center'>${d.y}</td></tr>`
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
