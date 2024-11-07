import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import { select } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import Partjson from 'partjson'
import { to_svg } from '../src/client'

class TdbScatter {
	constructor(opts) {
		this.type = 'scatter'
	}

	async init() {
		const div = this.opts.controls ? this.opts.holder : this.opts.holder.append('div')
		this.dom = {
			header: this.opts.header,
			controls: this.opts.controls ? null : holder.append('div'),
			div
		}
		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		await this.setControls()
		setInteractivity(this)
		setRenderers(this)
	}

	async setControls() {
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.scatter', this.download)
		} else {
			this.components = {
				controls: await controlsInit({
					app: this.app,
					id: this.id,
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls'),
					inputs: ['term1', 'overlay', 'divideBy']
				})
			}
			this.components.controls.on('downloadClick.scatter', this.download)
		}
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
				term0: config.term0,
				term2: config.term2,
				settings: {
					common: config.settings.common,
					scatter: JSON.parse(JSON.stringify(config.settings.scatter))
				}
			}
		}
	}

	async main() {
		try {
			this.config = structuredClone(this.state.config)
			if (this.dom.header) this.dom.header.html(this.config.term.term.name + ' vs ' + this.config.term2.term.name)
			copyMerge(this.settings, this.state.config.settings.scatter)
			if (!this.pj) this.pj = getPj(this)

			const reqOpts = this.getDataRequestOpts()
			this.currData = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			this.app.vocabApi.syncTermData(this.state.config, this.currData)
			this.pj.refresh({ data: this.currData.rows })
			this.render()
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.config
		const opts = { chartType: 'scatter', term: c.term, filter: this.state.termfilter.filter }
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		if (this.state.ssid) opts.ssid = this.state.ssid
		return opts
	}
}

export const scatterInit = getCompInit(TdbScatter)

export function setRenderers(self) {
	self.render = function () {
		const chartDivs = self.dom.div.selectAll('.pp-scatter-chart').data(self.pj.tree.charts, d => d.chartId)

		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.div.style('display', 'block')

		self.dom.div.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function (d) {
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

		div.transition().duration(s.duration).style('opacity', 1)
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
			//.style("fill", color)
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

		const yTitleLabel =
			self.config.term2.term.name.length > 24
				? self.config.term2.term.name.slice(0, 20) + '...'
				: self.config.term2.term.name
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
			.text(yTitleLabel + (self.config.term2.term.unit ? ', ' + self.config.term2.term.unit : ''))

		yText.append('title').text(self.config.term2.term.name)
	}
}

function setInteractivity(self) {
	self.mouseover = function (event) {
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

	self.mouseout = function () {
		self.app.tip.hide()
	}

	self.download = () => {
		if (!self.state || !self.state.isVisible) return
		// has to be able to handle multichart view
		const mainGs = []
		const translate = { x: undefined, y: undefined }
		const titles = []
		let maxw = 0,
			maxh = 0,
			tboxh = 0
		let prevY = 0,
			numChartsPerRow = 0

		self.dom.div.selectAll('.sjpcb-scatter-mainG').each(function () {
			mainGs.push(this)
			const bbox = this.getBBox()
			if (bbox.width > maxw) maxw = bbox.width
			if (bbox.height > maxh) maxh = bbox.height
			const divY = Math.round(this.parentNode.parentNode.getBoundingClientRect().y)
			if (!numChartsPerRow) {
				prevY = divY
				numChartsPerRow++
			} else if (Math.abs(divY - prevY) < 5) {
				numChartsPerRow++
			}
			const xy = select(this)
				.attr('transform')
				.split('translate(')[1]
				.split(')')[0]
				.split(',')
				.map(d => +d.trim())
			if (translate.x === undefined || xy[0] > translate.x) translate.x = +xy[0]
			if (translate.y === undefined || xy[1] > translate.y) translate.y = +xy[1]

			const title = this.parentNode.parentNode.firstChild
			const tbox = title.getBoundingClientRect()
			if (tbox.width > maxw) maxw = tbox.width
			if (tbox.height > tboxh) tboxh = tbox.height
			titles.push({ text: title.innerText, styles: window.getComputedStyle(title) })
		})

		// add padding between charts
		maxw += 30
		maxh += 30

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

		select(svg)
			.style('display', 'block')
			.style('opacity', 1)
			.attr('width', numChartsPerRow * maxw)
			.attr('height', Math.floor(mainGs.length / numChartsPerRow) * maxh)

		const svgStyles = window.getComputedStyle(document.querySelector('.pp-scatter-svg'))
		const svgSel = select(svg)
		for (const prop of svgStyles) {
			if (prop.startsWith('font')) svgSel.style(prop, svgStyles.getPropertyValue(prop))
		}

		mainGs.forEach((g, i) => {
			const mainG = g.cloneNode(true)
			const colNum = i % numChartsPerRow
			const rowNum = Math.floor(i / numChartsPerRow)
			const corner = { x: colNum * maxw + translate.x, y: rowNum * maxh + translate.y }
			const title = select(svg)
				.append('text')
				.attr('transform', 'translate(' + corner.x + ',' + corner.y + ')')
				.text(titles[i].text)
			for (const prop of titles[i].styles) {
				if (prop.startsWith('font')) title.style(prop, titles[i].styles.getPropertyValue(prop))
			}

			select(mainG).attr('transform', 'translate(' + corner.x + ',' + (corner.y + tboxh) + ')')
			svg.appendChild(mainG)
		})

		const svg_name = self.plot.term.term.name + ' scatter'
		to_svg(svg, svg_name) //,{apply_dom_styles:true})
	}
}

function getPj(self) {
	const s = self.settings

	const pj = new Partjson({
		template: {
			//"__:charts": "@.byChc.@values",
			yMin: '>$val2',
			yMax: '<$val2',
			charts: [
				{
					chartId: '@key',
					chc: '@key',
					xMin: '>$val1',
					xMax: '<$val1',
					yMin: '>$val2',
					yMax: '<$val2',
					'__:xScale': '=xScale()',
					'__:yScale': '=yScale()',
					serieses: [
						{
							chartId: '@parent.@parent.@key',
							seriesId: '@key',
							data: [
								{
									'__:chc': '@parent.@parent.chc',
									'__:seriesId': '@parent.@parent.seriesId',
									//color: "$color",
									x: '$val1',
									y: '$val2',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'$val2'
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
				const yMax = context.self.yMax
				const domain = s.scale == 'byChart' ? [yMax, 0] : [context.root.yMax, 0]
				return d3Linear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			}
		}
	})

	return pj
}
