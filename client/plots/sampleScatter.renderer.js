import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { icons as icon_functions } from '#dom/control.icons'
import { d3lasso } from '#common/lasso'
import { dt2label, morigin } from '#shared/common'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom, axisTop } from 'd3-axis'
import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { getSamplelstTW, getFilter } from '../mass/groups.js'
import { regressionPoly } from 'd3-regression'
import { line } from 'd3'
import { getId } from '#mass/nav'
import { minShapeSize, maxShapeSize } from './sampleScatter.js'
import { addNewGroup } from '../mass/groups.js'
import { setRenderersThree } from './sampleScatter.rendererThree.js'
import { shapes } from './sampleScatter.js'
import { roundValueAuto } from '#shared/roundValue.js'

export function setRenderers(self) {
	setRenderersThree(self)
	self.render = function () {
		const chartDivs = self.mainDiv.selectAll(':scope > div').data(self.charts, chart => chart?.id)
		chartDivs.exit().remove()
		chartDivs.each(self.renderChart)
		chartDivs.enter().append('div').style('vertical-align', 'top').each(self.renderChart)
	}

	self.renderChart = function (chart) {
		chart.chartDiv = select(this)
		const s = self.settings
		chart.chartDiv.style('opacity', 0).style('display', 'inline-block')
		chart.chartDiv.on('mouseover', event => {
			if (!self.onClick) self.showTooltip(event, chart)
		})
		chart.chartDiv.on('click', event => self.showTooltip(event, chart))

		chart.svg = chart.chartDiv.select('svg').empty() ? chart.chartDiv.append('svg') : chart.chartDiv.select('svg')
		renderSVG(chart, s, 0)

		chart.chartDiv.transition().duration(s.duration).style('opacity', 1)
	}

	self.initAxes = function (chart) {
		if (chart.data.samples.length == 0) return

		chart.xAxisScale = d3Linear()
			.domain([chart.xMin, chart.xMax])
			.range([self.axisOffset.x, self.settings.svgw + self.axisOffset.x])

		chart.axisBottom = axisBottom(chart.xAxisScale)
		chart.yAxisScale = d3Linear()
			.domain([chart.yMax, chart.yMin])
			.range([self.axisOffset.y, self.settings.svgh + self.axisOffset.y])

		chart.zAxisScale = d3Linear().domain([chart.zMin, chart.zMax]).range([0, self.settings.svgd])

		chart.xScaleMin = chart.xAxisScale(chart.xMin)
		chart.xScaleMax = chart.xAxisScale(chart.xMax)
		chart.yScaleMin = chart.xAxisScale(chart.yMin)
		chart.yScaleMax = chart.yAxisScale(chart.yMax)
		chart.zScaleMin = chart.xAxisScale(chart.zMin)
		chart.zScaleMax = chart.zAxisScale(chart.zMax)

		chart.axisLeft = axisLeft(chart.yAxisScale)
		const gradientColor = self.config.settings.sampleScatter.defaultColor
		if (!self.config.startColor) self.config.startColor = self.config.stopColor = {}
		if (!self.config.startColor[chart.id]) {
			self.config.startColor[chart.id] = rgb(gradientColor).brighter().brighter().toString()
		}
		if (!self.config.stopColor[chart.id]) {
			self.config.stopColor[chart.id] = rgb(gradientColor).darker().toString()
		}

		if (self.config.colorTW?.q.mode === 'continuous') {
			const [min, max] = chart.cohortSamples
				.filter(s => !self.config.colorTW.term.values || !(s.category in self.config.colorTW.term.values))
				.reduce(
					(s, d) => [d.category < s[0] ? d.category : s[0], d.category > s[1] ? d.category : s[1]],
					[chart.cohortSamples[0].category, chart.cohortSamples[0].category]
				)
			chart.colorGenerator = d3Linear()
				.domain([min, max])
				.range([self.config.startColor[chart.id], self.config.stopColor[chart.id]])
		}
	}

	function renderSVG(chart, s) {
		const svg = chart.svg

		let step = Math.min((20 * 40) / chart.colorLegend.size, 25)
		if (step < 12) step = 12
		let colorLegendSize = chart.colorLegend.size * step
		if (chart.colorLegend.get('Ref')?.sampleCount > 0) colorLegendSize += 60
		const scaleHeight = self.config.scaleDotTW ? 200 : 100
		self.legendHeight = Math.max(colorLegendSize, chart.shapeLegend.size * 30) + scaleHeight //legend step and header
		const width = self.charts.length == 1 ? s.svgw + 800 : s.svgw + (self.config.shapeTW ? 600 : 350)
		svg
			.transition()
			.duration(s.duration)
			.attr('width', width)
			.attr('height', Math.max(s.svgh + 100, self.legendHeight)) //leaving some space for top/bottom padding and y axis

		/* eslint-disable */
		fillSvgSubElems(chart)
		/* eslint-enable */

		if (self.is3D) self.render3DSerie(chart)
		else if (self.is2DLarge) self.render2DSerieLarge(chart)
		else {
			renderSerie(chart, s.duration)
			self.renderLegend(chart, step)
		}
	}

	function fillSvgSubElems(chart) {
		const svg = chart.svg
		let axisG, labelsG, clipRect
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			chart.mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = svg.append('g').attr('class', 'sjpcb-scatter-axis')
			labelsG = svg.append('g').attr('class', 'sjpcb-scatter-labelsG')
			chart.xAxis = axisG.append('g').attr('class', 'sjpcb-scatter-x-axis')
			chart.yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', `translate(${self.axisOffset.x}, 0)`)
			chart.mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', self.axisOffset.x)
				.attr('y', self.axisOffset.y - self.settings.size)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			chart.serie = chart.mainG.append('g').attr('class', 'sjpcb-scatter-series')
			chart.regressionG = chart.mainG.append('g').attr('class', 'sjpcb-scatter-lowess')

			//Adding clip path
			const id = `${Date.now()}`
			const idclip = `sjpp_clip_${id}`
			self.defs = svg.append('defs')
			clipRect = self.defs.append('clipPath').attr('id', idclip).append('rect')

			const gradient = self.defs
				.append('linearGradient')
				.attr('id', `linear-gradient-${chart.id}`)
				.attr('x1', '0%')
				.attr('y1', '0%')
				.attr('x2', '100%')
				.attr('y2', '0%')
			self.startGradient[chart.id] = gradient
				.append('stop')
				.attr('offset', '0%')
				.attr('stop-color', self.config.startColor[chart.id])
			self.stopGradient[chart.id] = gradient
				.append('stop')
				.attr('offset', '100%')
				.attr('stop-color', self.config.stopColor[chart.id])

			chart.mainG.attr('clip-path', `url(#${idclip})`)

			chart.legendG = svg.append('g').attr('class', 'sjpcb-scatter-legend')
		} else {
			chart.mainG = svg.select('.sjpcb-scatter-mainG')
			chart.serie = chart.mainG.select('.sjpcb-scatter-series')
			chart.regressionG = chart.mainG.select('.sjpcb-scatter-lowess')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			chart.xAxis = axisG.select('.sjpcb-scatter-x-axis')
			chart.yAxis = axisG.select('.sjpcb-scatter-y-axis')
			chart.legendG = svg.select('.sjpcb-scatter-legend')

			clipRect = svg.select(`defs > clipPath > rect`)
		}
		chart.xAxis.attr('transform', `translate(0, ${self.settings.svgh + self.axisOffset.y})`)

		chart.legendG.attr('transform', `translate(${self.settings.svgw + self.axisOffset.x + 50}, 20)`)
		if (chart.axisBottom) {
			chart.xAxis.call(chart.axisBottom)
			chart.yAxis.call(chart.axisLeft)
		}
		const particleWidth = Math.sqrt(self.settings.size)
		if (self.settings.showAxes && !(self.is2DLarge || self.is3D)) {
			clipRect
				.attr('x', self.axisOffset.x)
				.attr('y', 0)
				.attr('width', self.settings.svgw + 2 * particleWidth)
				.attr('height', self.settings.svgh + self.axisOffset.y)

			axisG.style('opacity', 1)
			if (self.config.term) {
				let termName = self.config.term.term.name
				if (!self.config.colorTW && !self.config.shapeTW && !self.config.term0)
					termName = `${termName}, n=${chart.cohortSamples.length}`

				labelsG.selectAll('*').remove()
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 40})`
					)
					.attr('text-anchor', 'middle')
					.text(termName)
				if (self.config.term0 && !self.config.colorTW && !self.config.shapeTW) {
					const term0Name = `${chart.id}, n=${chart.cohortSamples.length}`

					labelsG
						.append('text')
						.attr(
							'transform',
							`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 65})`
						)
						.attr('text-anchor', 'middle')
						.text(term0Name)
				}
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x - 50}, ${self.settings.svgh / 2 + self.axisOffset.y}) rotate(-90)`
					)
					.attr('text-anchor', 'middle')
					.text(self.config.term2.term.name)
			}
		} else {
			axisG.style('opacity', 0)
			clipRect
				.attr('x', self.axisOffset.x - particleWidth)
				.attr('y', 0)
				.attr('width', self.settings.svgw + 2 * particleWidth)
				.attr('height', self.settings.svgh + self.axisOffset.y + particleWidth)
		}
	}

	function renderSerie(chart, duration) {
		if (self.canvas) self.canvas.remove()
		const g = chart.serie
		const data = chart.data
		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path[name="serie"]').data(data.samples)
		symbols.exit().remove()
		symbols
			.transition()
			.duration(duration)
			.attr('name', 'serie')
			.attr('transform', c => self.transform(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))
			.attr('stroke', c => self.getColor(c, chart))
			.attr('stroke-width', c => self.getStrokeWidth(c))
			.style('fill-opacity', c => self.getOpacity(c))
		symbols
			.enter()
			.append('path')
			.attr('name', 'serie')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', c => self.transform(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))
			.attr('stroke', c => self.getColor(c, chart))
			.attr('stroke-width', c => self.getStrokeWidth(c))
			.style('fill-opacity', c => self.getOpacity(c))
			.transition()
			.duration(duration)
		self.mayRenderRegression()
	}

	self.getStrokeWidth = function (c) {
		const opacity = self.getOpacity(c)
		if (opacity <= 0.2)
			//hidden by filter or search
			return 0
		if (opacity == 1.2)
			//samples searched
			return 2
		return 1
	}

	self.processData = async function () {
		for (const chart of self.charts) {
			self.initAxes(chart)
			const regressionType = self.config.settings.sampleScatter.regression

			if (!regressionType || regressionType == 'None') continue
			let regression
			const data = []
			await chart.cohortSamples.forEach(c => {
				const x = chart.xAxisScale(c.x)
				const y = chart.yAxisScale(c.y)
				data.push({ x, y })
			})
			let regressionCurve
			// if (regressionType == 'Loess') {
			// 	regression = regressionLoess()
			// 		.x(c => c.x)
			// 		.y(c => c.y)
			// 		.bandwidth(0.25)
			// 	regressionCurve = regression(data)
			// } else
			if (regressionType == 'Polynomial') {
				regression = regressionPoly()
					.x(c => c.x)
					.y(c => c.y)
					.order(3)
				regressionCurve = regression(data)
			} else if (regressionType == 'Lowess') {
				const X = [],
					Y = []
				for (const sample of data) {
					X.push(sample.x)
					Y.push(sample.y)
				}
				regressionCurve = await self.app.vocabApi.getLowessCurve({ coords: { X, Y } })
			} else {
				throw `unsupported regression type='${regressionType}'`
			}
			chart.regressionCurve = regressionCurve
		}
	}

	self.mayRenderRegression = async function () {
		for (const chart of self.charts) {
			chart.regressionG?.selectAll('*').remove()
			if (chart.regressionCurve) {
				const l = line()
					.x(d => d[0])
					.y(d => d[1])
				const regressionPath = chart.regressionG.append('path')
				regressionPath
					.attr('d', l(chart.regressionCurve))
					.attr('stroke', 'blue')
					.attr('fill', 'none')
					.style('stroke-width', '2')
			}
		}
	}

	self.getColor = function (c, chart) {
		if (self.config.colorTW?.q.mode == 'continuous' && 'sampleId' in c) {
			const color = chart.colorGenerator(c.category)
			return color
		}
		if (c.category == 'Default') return self.config.settings.sampleScatter.defaultColor
		const category = chart.colorLegend.get(c.category)
		return category.color
	}

	self.getOpacity = function (c) {
		if ('sampleId' in c) {
			if (self.filterSampleStr) {
				if (!c.sample?.toLowerCase().includes(self.filterSampleStr.toLowerCase())) return 0.2
				else return 1.2
			}
			const opacity = c.hidden?.['category'] || c.hidden?.['shape'] ? 0 : self.settings.opacity
			return opacity
		}
		const refOpacity = self.settings.showRef ? self.settings.opacity : 0
		return refOpacity
	}

	self.getShape = function (chart, c, factor = 1) {
		const index = chart.shapeLegend.get(c.shape).shape % shapes.length
		return shapes[index]
	}

	self.transform = function (chart, c, factor = 1) {
		const x = chart.xAxisScale(c.x)
		const y = chart.yAxisScale(c.y)
		const isRef = !('sampleId' in c)
		let scale
		if (!self.config.scaleDotTW || isRef) {
			scale = 'sampleId' in c ? self.settings.size : self.settings.refSize
		} else {
			const range = self.settings.maxShapeSize - self.settings.minShapeSize
			if (self.settings.scaleDotOrder == 'Ascending')
				scale = self.settings.minShapeSize + ((c.scale - chart.scaleMin) / (chart.scaleMax - chart.scaleMin)) * range
			else scale = self.settings.maxShapeSize - ((c.scale - chart.scaleMin) / (chart.scaleMax - chart.scaleMin)) * range
		}
		const transform = `translate(${x},${y}) scale(${(self.zoom * scale * factor) / 3})` // original icons are scaled to 0.3
		return transform
	}

	self.lassoReset = chart => {
		const mainG = chart.chartDiv.select('.sjpcb-scatter-mainG')

		if (chart.lasso)
			chart.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path[name="serie"]'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)

		function lasso_start(event) {
			if (self.lassoOn) {
				chart.lasso
					.items()
					.attr('transform', c => self.transform(chart, c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('selected', false)
			}
		}

		function lasso_draw(event) {
			if (self.lassoOn) {
				// Style the possible dots

				chart.lasso
					.possibleItems()
					.attr('transform', c => self.transform(chart, c, 1.2))
					.style('fill-opacity', c => self.getOpacity(c))
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				chart.lasso
					.notPossibleItems()
					.attr('transform', c => self.transform(chart, c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end(dragEnd) {
			if (self.lassoOn) {
				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				chart.lasso.items().classed('not_possible', false).classed('possible', false)

				// Style the selected dots
				chart.lasso.selectedItems().attr('transform', c => self.transform(chart, c, 1.3))
				chart.lasso.items().style('fill-opacity', c => self.getOpacity(c))
				self.selectedItems = []
				for (const item of chart.lasso.selectedItems()) {
					const data = item.__data__
					if ('sampleId' in data && !(data.hidden['category'] || data.hidden['shape'])) self.selectedItems.push(item)
				}
				chart.lasso.notSelectedItems().attr('transform', c => self.transform(chart, c))

				showLassoMenu(dragEnd.sourceEvent)
			}
		}

		function showLassoMenu(event) {
			const samples = self.selectedItems.map(item => item.__data__)
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
					self.showTable(
						{
							name: 'Group ' + (self.config.groups.length + 1),
							items: samples
						},
						event.clientX,
						event.clientY,
						true
					)
				})

			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', async () => {
					const group = {
						name: 'Group',
						items: samples
					}
					const tw = getSamplelstTW([group])
					const filter = getFilter(tw)
					addNewGroup(self.app, filter, self.state.groups)
				})
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group and filter')
				.on('click', () => {
					const group = {
						name: 'Group',
						items: samples
					}
					const tw = getSamplelstTW([group])
					const filter = getFilter(tw)
					addNewGroup(self.app, filter, self.state.groups)
					self.addToFilter(tw)
				})
			if ('sample' in samples[0])
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Show samples')
					.on('click', async event => {
						const groupSamples = []
						for (const sample of samples) groupSamples.push({ sampleId: sample.sampleId, sampleName: sample.sample })
						self.app.dispatch({
							type: 'plot_create',
							id: getId(),
							config: {
								chartType: 'sampleView',
								samples: groupSamples
							}
						})
						self.dom.tip.hide()
					})
		}

		if (self.lassoOn) {
			// this seems to clear stale lasso data as sometimes seen
			// when the global filter is changed between lassoing
			// uncertain explanation: the svg and mainG is potentially different between rerenders,
			// so the previous mainG.call(chart.lasso) inside toggle_lasso is on a removed mainG????
			mainG.on('.zoom', null)
			mainG.on('mousedown.drag', null)
			mainG.call(chart.lasso)
		}
	}

	self.addGroup = async function (group) {
		group.plotId = self.id
		await self.app.vocabApi.addGroup(group)
		self.dom.tip.hide()
	}

	self.setTools = function () {
		if (!self.charts[0]) return
		const inline = self.config.settings.controls.isOpen
		const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		let display = 'block'
		if (inline) display = 'inline-block'
		// const helpDiv = toolsDiv
		// 	.insert('div')
		// 	.style('display', display)
		// 	.style('margin', '20px')
		// 	.attr('name', 'sjpp-help-btn') //For unit tests
		// icon_functions['help'](helpDiv, {
		// 	handler: () => window.open('https://github.com/stjude/proteinpaint/wiki/Scatter-plot', '_blank')
		// })

		const homeDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-reset-btn') //For unit tests
		icon_functions['restart'](homeDiv, { handler: resetToIdentity })
		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-in-btn') //For unit tests
		icon_functions['zoomIn'](zoomInDiv, { handler: zoomIn })
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-out-btn') //For unit tests
		icon_functions['zoomOut'](zoomOutDiv, { handler: zoomOut })
		const searchDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')
		const lassoDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')
		if (!(self.is2DLarge || self.is3D)) {
			icon_functions['search'](searchDiv, { handler: e => self.searchSample(e) })
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		}
		self.dom.groupDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')

		const mainG = self.charts[0].mainG
		const zoom = d3zoom()
			.scaleExtent([0.5, self.config.scaleDotTW ? 4 : 10])
			.on('zoom', handleZoom)
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		if (self.config.scaleDotTW && self.zoom > 4) resetToIdentity()
		mainG.call(zoom)
		for (const chart of self.charts) {
			chart.lasso = d3lasso()
			self.lassoReset(chart)
		}
		self.updateGroupsButton()

		const s = self.settings

		function handleZoom(event) {
			for (const chart of self.charts) {
				// create new scale ojects based on event
				const new_xScale = event.transform.rescaleX(chart.xAxisScale)
				const new_yScale = event.transform.rescaleY(chart.yAxisScale)

				chart.xAxis.call(chart.axisBottom.scale(new_xScale))
				chart.yAxis.call(chart.axisLeft.scale(new_yScale))
				chart.serie.attr('transform', event.transform)
				self.zoom = event.transform.scale(1).k
				//on zoom in the particle size is kept
				const symbols = chart.serie.selectAll('path[name="serie"')
				symbols.attr('transform', c => self.transform(chart, c, 1))
				if (self.lassoOn) chart.lasso.selectedItems().attr('transform', c => self.transform(chart, c, 1.2))
				if (self.config.scaleDotTW) self.drawScaleDotLegend(chart)
			}
		}

		function zoomIn() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = self.zoom + 0.25
				else zoom.scaleBy(chart.mainG.transition().duration(750), 1.5)
		}

		function zoomOut() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = self.zoom - 0.25
				else zoom.scaleBy(chart.mainG.transition().duration(750), 0.5)
		}

		function resetToIdentity() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = 1
				else chart.mainG.transition().duration(750).call(zoom.transform, zoomIdentity)
			self.render()
		}

		function toggle_lasso() {
			self.lassoOn = !self.lassoOn
			for (const chart of self.charts) {
				if (self.lassoOn) {
					chart.mainG.on('.zoom', null)
					chart.mainG.call(chart.lasso)
				} else {
					chart.mainG.on('mousedown.drag', null)
					chart.lasso.items().classed('not_possible', false)
					chart.lasso.items().classed('possible', false)
					chart.lasso
						.items()
						.attr('r', self.settings.size)
						.style('fill-opacity', c => self.getOpacity(c))
					chart.mainG.call(zoom)
					self.selectedItems = null
				}
			}
			lassoDiv.select('*').remove()
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		}
	}

	self.updateGroupsButton = function () {
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
				if (self.config.groups.length == 1) self.showGroupMenu(event, self.config.groups[0])
				else self.showGroupsMenu(event)
			})
	}

	self.renderLegend = function (chart, step) {
		const legendG = chart.legendG
		legendG.selectAll('*').remove()
		let offsetX = 0
		let offsetY = 25
		if (!self.config.colorTW && !self.config.shapeTW && !self.config.colorColumn) {
			if (self.config.scaleDotTW) {
				chart.scaleG = legendG.append('g').attr('transform', `translate(${offsetX + 45},${self.legendHeight - 150})`)
				self.drawScaleDotLegend(chart)
			}
			return
		}

		let title
		let fontSize = Math.min(0.8, 20 / chart.colorLegend.size)
		if (fontSize < 0.5) fontSize = 0.5
		const colorG = legendG.style('font-size', `${fontSize}em`)
		let title0 = self.config.term0
			? `${chart.id}, n=${chart.cohortSamples.length}`
			: `${chart.cohortSamples.length} ${self.config.sampleType ? self.config.sampleType + 's' : 'samples'}`
		if (self.filterSampleStr) title0 += `, search = ${self.filterSampleStr}`
		colorG.append('text').attr('x', 0).attr('y', offsetY).text(title0).style('font-weight', 'bold')
		offsetY += step + 10
		if (self.config.colorTW || self.config.colorColumn) {
			title = `${getTitle(
				self.config.colorTW?.term?.name || self.config.colorColumn.name,
				self.config.shapeTW == undefined
			)}`
			const colorRefCategory = chart.colorLegend.get('Ref')

			if (self.config.colorTW?.term?.type == 'geneVariant' && self.config.colorTW?.q.type == 'values')
				offsetY = self.renderGeneVariantLegend(
					chart,
					offsetX,
					offsetY,
					legendG,
					self.config.colorTW,
					'category',
					chart.colorLegend
				)
			else {
				colorG
					.append('text')
					.attr('id', 'legendTitle')
					.attr('x', offsetX)
					.attr('y', offsetY)
					.text(title)
					.style('font-weight', 'bold')
				offsetY += step

				if (self.config.colorTW?.q?.mode === 'continuous') {
					const gradientWidth = 150
					const [min, max] = chart.colorGenerator.domain()
					const gradientScale = d3Linear().domain([min, max]).range([0, gradientWidth])
					const gradientStep = (max - min) / 4
					const tickValues = [min, min + gradientStep, min + 2 * gradientStep, min + 3 * gradientStep, max]
					const axis = axisTop(gradientScale).tickValues(tickValues)
					colorG.append('g').attr('transform', `translate(0, 100)`).call(axis)
					chart.startRect = colorG
						.append('rect')
						.attr('x', -25)
						.attr('y', 100)
						.attr('width', 20)
						.attr('height', 20)
						.style('fill', self.config.startColor[chart.id])
						.on('click', e => self.editColor(chart, 'startColor', chart.startRect))
					chart.stopRect = colorG
						.append('rect')
						.attr('x', gradientWidth + 5)
						.attr('y', 100)
						.attr('width', 20)
						.attr('height', 20)
						.style('fill', self.config.stopColor[chart.id])
						.on('click', e => self.editColor(chart, 'stopColor', chart.stopRect))

					const rect = colorG
						.append('rect')
						.attr('x', 0)
						.attr('y', 100)
						.attr('width', gradientWidth)
						.attr('height', 20)
						.style('fill', `url(#linear-gradient-${chart.id})`)

					offsetY += step
				} else {
					for (const [key, category] of chart.colorLegend) {
						if (key == 'Ref') continue
						const name = key
						const hidden = self.config.colorTW?.q.hiddenValues ? key in self.config.colorTW.q.hiddenValues : false
						const [circleG, itemG] = addLegendItem(colorG, category, name, offsetX, offsetY, hidden)
						if (!self.config.colorColumn) {
							circleG.on('click', e => self.onLegendClick(chart, legendG, 'colorTW', key, e, category))
							itemG.on('click', event => self.onLegendClick(chart, legendG, 'colorTW', key, event, category))
						}
						offsetY += step
					}
				}
			}
			if (colorRefCategory?.sampleCount > 0) {
				offsetY = offsetY + step
				const titleG = legendG.append('g')
				titleG.append('text').attr('x', offsetX).attr('y', offsetY).text('Reference').style('font-weight', 'bold')

				offsetY = offsetY + step

				const refColorG = legendG.append('g')
				refColorG
					.append('path')
					.attr('transform', c => `translate(${offsetX - 2}, ${offsetY - 5}) scale(0.5)`)
					.style('fill', colorRefCategory.color)
					.attr('d', shapes[0])
					.style('stroke', rgb(colorRefCategory.color).darker())

				refColorG.on('click', e => self.onLegendClick(chart, legendG, 'colorTW', 'Ref', e, colorRefCategory))
				const refText = legendG
					.append('g')
					.append('text')
					.attr('x', offsetX + 10)
					.attr('y', offsetY)
					.text(`n=${colorRefCategory.sampleCount}`)
					.style('text-decoration', !self.settings.showRef ? 'line-through' : 'none')
					.attr('alignment-baseline', 'middle')

				refText.on('click', e => self.onLegendClick(chart, legendG, 'colorTW', 'Ref', e, colorRefCategory))
			}
		}
		if (self.config.scaleDotTW) {
			chart.scaleG = legendG.append('g').attr('transform', `translate(${offsetX},${self.legendHeight - 100})`)
			self.drawScaleDotLegend(chart)
		}
		if (self.config.shapeTW) {
			offsetX = !self.config.colorTW ? 0 : 300
			offsetY = 60
			title = `${getTitle(self.config.shapeTW.term.name)}`
			if (self.config.shapeTW.term.type == 'geneVariant' && self.config.shapeTW.q.type == 'values')
				self.renderGeneVariantLegend(chart, offsetX, offsetY, legendG, self.config.shapeTW, 'shape', chart.shapeLegend)
			else {
				const shapeG = legendG.append('g')

				shapeG.append('text').attr('x', offsetX).attr('y', offsetY).text(title).style('font-weight', 'bold')
				offsetY += step
				const color = 'gray'
				for (const [key, shape] of chart.shapeLegend) {
					if (key == 'Ref') continue
					const index = shape.shape % shapes.length
					const symbol = shapes[index]
					const name = key
					const count = shape.sampleCount
					const hidden = self.config.shapeTW.q.hiddenValues ? key in self.config.shapeTW.q.hiddenValues : false
					const itemG = shapeG.append('g')

					itemG
						.append('path')
						.attr('transform', c => `translate(${offsetX}, ${offsetY - 5}) scale(0.5)`)
						.style('fill', color)
						.attr('d', symbol)
						.style('stroke', rgb(color).darker())

					itemG
						.append('text')
						.attr('x', offsetX + 10)
						.attr('y', offsetY)
						.text(`${name}, n=${count}`)
						.style('text-decoration', hidden ? 'line-through' : 'none')
						.attr('alignment-baseline', 'middle')
					offsetY += step
					itemG.on('click', event => self.onLegendClick(chart, legendG, 'shapeTW', key, event, shape))
				}
			}
		}

		function getTitle(name, complete = false) {
			if (name.length > 25 && !complete) name = name.slice(0, 25) + '...'
			return name
		}

		function addLegendItem(g, category, name, x, y, hidden = false) {
			const radius = Math.min((5 * 40) / chart.colorLegend.size, 5)

			const circleG = g.append('g')
			circleG
				.append('path')
				.attr('d', shapes[0])
				.attr('transform', `translate(${x - 2}, ${y - 5}) scale(0.5)`)
				.style('fill', category.color)
				.style('stroke', rgb(category.color).darker())
			if (!self.config.colorColumn)
				circleG.on('click', e => self.onLegendClick(chart, legendG, 'colorTW', key, e, category))
			const itemG = g.append('g')
			itemG
				.append('text')
				.attr('name', 'sjpp-scatter-legend-label')
				.attr('x', x + 10)
				.attr('y', y)
				.text(`${name}, n=${category.sampleCount}`)
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.attr('alignment-baseline', 'middle')

			return [circleG, itemG]
		}
	}

	self.drawScaleDotLegend = function (chart) {
		const scaleG = chart.scaleG
		scaleG.selectAll('*').remove()
		const width = 70

		const minScale = self.settings.minShapeSize / 3
		const maxScale = self.settings.maxShapeSize / 3
		const order = self.settings.scaleDotOrder
		const isAscending = order == 'Ascending'

		const titleG = scaleG.append('g')

		titleG.append('text').text(self.config.scaleDotTW.term.name).style('font-weight', 'bold')
		const start = roundValueAuto(chart.scaleMin).toString()
		const end = roundValueAuto(chart.scaleMax).toString()
		const x = 30
		const y = 40
		const defaultSize = 16 //icons default size

		const minSize = defaultSize * minScale
		const maxSize = defaultSize * maxScale
		const minRadius = minSize / 2
		const maxRadius = maxSize / 2
		const minG = scaleG.append('g').attr('transform', `translate(${x},${y})`)
		const shift = 30
		const minPath = minG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -minRadius : -maxRadius}, ${isAscending ? -minRadius : -maxRadius}) scale(${
					isAscending ? minScale : maxScale
				})`
			)

		const maxG = scaleG.append('g').attr('transform', `translate(${width + x},${y})`)

		const maxPath = maxG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -maxRadius : -minRadius}, ${isAscending ? -maxRadius : -minRadius}) scale(${
					isAscending ? maxScale : minScale
				})`
			)

		minG
			.append('text')
			.attr('x', isAscending ? -minRadius - shift : -maxRadius - shift)
			.attr('y', 5)
			.style('font-size', '.8em')
			.attr('text-anchor', 'start')
			.text(start)

		maxG
			.append('text')
			.attr('x', isAscending ? maxSize + 5 : minSize + 5)
			.attr('y', 5)
			.style('font-size', '.8em')
			.text(end)

		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? minRadius : maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? maxRadius : minRadius)
			.style('stroke', '#aaa')
		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? -minRadius : -maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? -maxRadius : -minRadius)
			.style('stroke', '#aaa')

		scaleG
			.append('rect')
			.attr('width', 110 * self.zoom)
			.attr('height', 50)
			.attr('fill', 'transparent')
			.on('click', e => {
				const menu = new Menu({ padding: '3px' })
				const div = menu.d
				div.append('label').text('Min:')
				const minInput = div
					.append('input')
					.attr('type', 'number')
					.attr('min', '1')
					.attr('max', '100')
					.style('width', '50px')
					.attr('value', self.settings.minShapeSize)
					.on('change', () => {
						let value = parseFloat(minInput.node().value)
						if (value < minShapeSize) {
							value = minShapeSize
							minInput.node().value = minShapeSize
						}
						self.config.settings.sampleScatter.minShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				div.append('label').text('Max:')
				const maxInput = div
					.append('input')
					.attr('type', 'number')
					.attr('min', '1')
					.attr('max', '1000')
					.style('width', '50px')
					.attr('value', self.settings.maxShapeSize)
					.on('change', () => {
						let value = parseFloat(maxInput.node().value)
						if (value > maxShapeSize) {
							value = maxShapeSize
							maxInput.node().value = maxShapeSize
						}
						self.config.settings.sampleScatter.maxShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				const divRadios = menu.d.append('div')
				divRadios.append('label').text('Order: ')
				const data = ['Ascending', 'Descending']
				divRadios.selectAll('input').data(data).enter().append('div').style('display', 'inline-block').each(addRadio)
				function addRadio(text) {
					const div = select(this)
					const input = div
						.append('input')
						.attr('type', 'radio')
						.attr('id', text)
						.attr('value', text)
						.property('checked', text => text == order)

					div.append('label').text(text).attr('for', text)
					input.on('change', e => {
						self.config.settings.sampleScatter.scaleDotOrder = e.target.value
						const inputs = (divRadios
							.selectAll('input')
							.nodes()
							.find(d => d.value != e.target.value).checked = false)
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				}
				menu.showunder(e.target)
			})
	}

	self.editColor = function (chart, colorKey, elem) {
		const color = self.config[colorKey][chart.id]
		const colorMenu = new Menu({ padding: '3px' })
		const input = colorMenu
			.clear()
			.d.append('Label')
			.text('Color:')
			.append('input')
			.attr('type', 'color')
			.attr('value', rgb(color).formatHex())
			.on('change', () => {
				const color = input.node().value
				self.changeGradientColor(chart, colorKey, elem, color)
				colorMenu.hide()
			})
		colorMenu.showunder(elem.node(), false)
	}

	self.changeGradientColor = function (chart, colorKey, elem, color) {
		const hexColor = rgb(color).formatHex()
		self.config[colorKey][chart.id] = hexColor
		elem.style('fill', hexColor)

		chart.colorGenerator = d3Linear().range([self.config.startColor[chart.id], self.config.stopColor[chart.id]])
		self.startGradient[chart.id].attr('stop-color', self.config.startColor[chart.id])
		self.stopGradient[chart.id].attr('stop-color', self.config.stopColor[chart.id])
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: self.config
		})
	}

	self.renderGeneVariantLegend = function (chart, offsetX, offsetY, legendG, tw, cname, map) {
		const step = 125
		const name = tw.term.name.length > 25 ? tw.term.name.slice(0, 25) + '...' : tw.term.name
		let title = name
		const G = legendG.append('g').style('font-size', '0.9em')

		G.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', offsetY)
			.text(title)
			.style('font-weight', 'bold')

		offsetX += step
		const mutations = chart.cohortSamples[0]['cat_info'][cname]

		for (const [i, mutation] of mutations.entries()) {
			offsetY += 25
			const dt = mutation.dt
			const origin = morigin[mutation.origin]?.label
			const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]

			G.append('text')
				.attr('x', offsetX - step)
				.attr('y', offsetY)
				.text(origin ? `${origin} ${dt2label[dt]}` : dt2label[dt])
				.style('font-weight', 'bold')
			offsetY += 25
			for (const [key, category] of map) {
				if (key == 'Ref') continue
				if (!key.includes(dtlabel)) continue
				const mkey = key.split(', ')[0]
				const itemG = G.append('g')
				if (cname == 'shape') {
					const index = category.shape % shapes.length
					itemG
						.append('path')
						.attr('transform', c => `translate(${offsetX - step - 2}, ${offsetY - 8}) scale(0.5)`)
						.style('fill', 'gray')
						.attr('d', shapes[index])
						.style('stroke', rgb('gray').darker())
				} else {
					itemG
						.append('path')
						.attr('d', shapes[0])
						.attr('transform', `translate(${-2}, ${offsetY - 8}) scale(0.5)`)

						.style('fill', category.color)
						.style('stroke', rgb(category.color).darker())
					itemG.on('click', e => self.onLegendClick(chart, legendG, 'colorTW', key, e, category))
				}
				const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false

				G.append('g')
					.append('text')
					.attr('x', offsetX - step + 10)
					.attr('y', offsetY)
					.attr('name', 'sjpp-scatter-legend-label')
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.text(mkey + (key.includes(dtlabel) ? `, n=${category.sampleCount}` : ''))
					.on('click', event =>
						self.onLegendClick(chart, G, cname == 'shape' ? 'shapeTW' : 'colorTW', key, event, category)
					)

				offsetY += 25
			}
		}

		return offsetY
	}
}
