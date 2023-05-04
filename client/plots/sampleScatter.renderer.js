import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { icons as icon_functions } from '#dom/control.icons'
import { d3lasso } from '#common/lasso'
import { dt2label, morigin, mclass } from '#shared/common'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { getSamplelstTW } from '#termsetting/handlers/samplelst'

export function setRenderers(self) {
	self.render = function() {
		const chartDivs = self.mainDiv.selectAll(':scope > div').data(self.charts, chart => chart.id)
		chartDivs.exit().remove()
		chartDivs.each(self.renderChart)
		chartDivs
			.enter()
			.append('div')
			.each(self.renderChart)
	}

	self.renderChart = function(chart) {
		chart.chartDiv = select(this)
		const s = self.settings
		chart.chartDiv.style('opacity', 0).style('display', 'inline-block')
		chart.chartDiv.on('mouseover', event => self.mouseover(event, chart)).on('click', self.mouseclick)
		chart.svg = chart.chartDiv.select('svg').empty() ? chart.chartDiv.append('svg') : chart.chartDiv.select('svg')
		renderSVG(chart, s, 0)

		chart.chartDiv
			.transition()
			.duration(s.duration)
			.style('opacity', 1)
	}

	self.initAxes = function(chart) {
		if (chart.data.samples.length == 0) return
		const s0 = chart.data.samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax] = chart.data.samples.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		chart.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([self.axisOffset.x, self.settings.svgw + self.axisOffset.x])

		chart.axisBottom = axisBottom(chart.xAxisScale)
		chart.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([self.axisOffset.y, self.settings.svgh + self.axisOffset.y])
		chart.axisLeft = axisLeft(chart.yAxisScale)
		if (!self.config.gradientColor) self.config.gradientColor = {}
		if (!self.config.gradientColor[chart.id]) self.config.gradientColor[chart.id] = '#008000'
		chart.startColor = rgb(self.config.gradientColor[chart.id])
			.brighter()
			.brighter()
		chart.stopColor = rgb(self.config.gradientColor[chart.id])
			.darker()
			.darker()
		if (self.config.colorTW?.q.mode === 'continuous') {
			const [min, max] = chart.cohortSamples.reduce(
				(s, d) => [d.value < s[0] ? d.category : s[0], d.category > s[1] ? d.category : s[1]],
				[chart.cohortSamples[0].category, chart.cohortSamples[0].category]
			)

			chart.colorGenerator = d3Linear()
				.domain([min, max])
				.range([chart.startColor, chart.stopColor])
		}
	}

	function renderSVG(chart, s) {
		self.initAxes(chart)
		const svg = chart.svg
		let colorLegends = chart.colorLegend.size * 30
		if (chart.colorLegend.get('Ref').sampleCount > 0) colorLegends += 60
		const legendHeight = Math.max(colorLegends, chart.shapeLegend.size * 30) + 100 //legend step and header

		svg
			.transition()
			.duration(s.duration)
			.attr('width', s.svgw + 500)
			.attr('height', Math.max(s.svgh + 100, legendHeight)) //leaving some space for top/bottom padding and y axis

		/* eslint-disable */
		fillSvgSubElems(chart)
		/* eslint-enable */

		renderSerie(chart, s.duration)
		self.renderLegend(chart)
	}

	function fillSvgSubElems(chart) {
		const svg = chart.svg
		let mainG, axisG, xAxis, yAxis, legendG, labelsG, clipRect, serie
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = svg.append('g').attr('class', 'sjpcb-scatter-axis')
			labelsG = svg.append('g').attr('class', 'sjpcb-scatter-labelsG')
			xAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-x-axis')
				.attr('transform', `translate(0, ${self.settings.svgh + self.axisOffset.y})`)
			yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', `translate(${self.axisOffset.x}, 0)`)
			mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', self.axisOffset.x)
				.attr('y', self.axisOffset.y - self.settings.size)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			serie = mainG.append('g').attr('class', 'sjpcb-scatter-series')

			//Adding clip path
			const id = `${Date.now()}`
			const idclip = `sjpp_clip_${id}`
			self.defs = svg.append('defs')
			clipRect = self.defs
				.append('clipPath')
				.attr('id', idclip)
				.append('rect')

			const gradient = self.defs
				.append('linearGradient')
				.attr('id', `linear-gradient-${self.id}`)
				.attr('x1', '0%')
				.attr('y1', '0%')
				.attr('x2', '100%')
				.attr('y2', '0%')
			self.startGradient = gradient
				.append('stop')
				.attr('offset', '0%')
				.attr('start-color', chart.startColor)
			self.stopGradient = gradient
				.append('stop')
				.attr('offset', '100%')
				.attr('stop-color', chart.stopColor)

			mainG.attr('clip-path', `url(#${idclip})`)

			legendG = svg
				.append('g')
				.attr('class', 'sjpcb-scatter-legend')
				.attr('transform', `translate(${self.settings.svgw + self.axisOffset.x + 50}, 0)`)
		} else {
			mainG = svg.select('.sjpcb-scatter-mainG')
			serie = mainG.select('.sjpcb-scatter-series')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			xAxis = axisG.select('.sjpcb-scatter-x-axis')
			yAxis = axisG.select('.sjpcb-scatter-y-axis')
			legendG = svg.select('.sjpcb-scatter-legend')
			clipRect = svg.select(`defs > clipPath > rect`)
		}
		if (chart.axisBottom) {
			xAxis.call(chart.axisBottom)
			yAxis.call(chart.axisLeft)
		}
		const particleWidth = Math.sqrt(self.settings.size)
		if (self.settings.showAxes) {
			clipRect
				.attr('x', self.axisOffset.x)
				.attr('y', 0)
				.attr('width', self.settings.svgw + 2 * particleWidth)
				.attr('height', self.settings.svgh + self.axisOffset.y)

			axisG.style('opacity', 1)
			if (self.config.term) {
				labelsG.selectAll('*').remove()
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 40})`
					)
					.attr('text-anchor', 'middle')
					.text(self.config.term.term.name)
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

		chart.mainG = mainG
		chart.serie = serie
		chart.legendG = legendG
	}

	function renderSerie(chart, duration) {
		const g = chart.serie
		const data = chart.data
		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path').data(data.samples)
		symbols.exit().remove()
		symbols
			.transition()
			.duration(duration)
			.attr('transform', c => translate(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))

			.style('fill-opacity', c => self.getOpacity(c))
		symbols
			.enter()
			.append('path')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', c => translate(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))

			.style('fill-opacity', c => self.getOpacity(c))
			.transition()
			.duration(duration)
	}

	self.getColor = function(c, chart) {
		if (self.config.colorTW?.q.mode == 'continuous' && 'sampleId' in c) return chart.colorGenerator(c.category)
		if (c.category == 'Default') return self.config.settings.sampleScatter.defaultColor
		const category = chart.colorLegend.get(c.category)
		return category.color
	}

	self.getOpacity = function(c) {
		if ('sampleId' in c) {
			for (const group of self.config.groups)
				if (group.showOnly) {
					for (const sample of group.items)
						if (c.sampleId == sample.sampleId)
							return c.hidden['category'] || c.hidden['shape'] ? 0 : self.settings.opacity
					return 0
				}
			const opacity = c.hidden['category'] || c.hidden['shape'] ? 0 : self.settings.opacity
			return opacity
		}
		const refOpacity = self.settings.showRef ? self.settings.opacity : 0
		return refOpacity
	}

	self.getShape = function(chart, c, factor = 1) {
		const index = chart.shapeLegend.get(c.shape).shape % self.symbols.length
		const size = 'sampleId' in c ? self.settings.size : self.settings.refSize
		return self.symbols[index].size((size * factor) / self.k)()
	}

	function translate(chart, c) {
		const transform = `translate(${chart.xAxisScale(c.x)},${chart.yAxisScale(c.y)})`
		return transform
	}

	self.lassoReset = chart => {
		const mainG = chart.chartDiv.select('.sjpcb-scatter-mainG')

		if (chart.lasso)
			chart.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)

		function lasso_start(event) {
			if (self.lassoOn) {
				chart.lasso
					.items()
					.attr('d', c => self.getShape(chart, c, 1 / 2))
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
					.attr('d', c => self.getShape(chart, c, 2))
					.style('fill-opacity', c => self.getOpacity(c))
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				chart.lasso
					.notPossibleItems()
					.attr('d', c => self.getShape(chart, c, 1 / 2))
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
				chart.lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)

				// Style the selected dots
				chart.lasso.selectedItems().attr('d', c => self.getShape(chart, c, 2))
				chart.lasso.items().style('fill-opacity', c => self.getOpacity(c))
				self.selectedItems = []
				for (const item of chart.lasso.selectedItems()) {
					const data = item.__data__
					if ('sampleId' in data && !(data.hidden['category'] || data.hidden['shape'])) self.selectedItems.push(item)
				}
				chart.lasso.notSelectedItems().attr('d', c => self.getShape(chart, c))

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
					self.showTable(
						{ name: 'Group ' + (self.config.groups.length + 1), items: self.selectedItems.map(item => item.__data__) },
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
						name: `Group ${self.config.groups.length + 1}`,
						items: self.selectedItems.map(item => item.__data__),
						index: self.config.groups.length
					}
					self.config.groups.push(group)
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
					const samplelstTW = getSamplelstTW(self.config.groups)
					const appGroup = {
						name: group.name,
						filter: self.getFilter(samplelstTW)
					}
					await self.app.vocabApi.addGroup(appGroup)
					const appGroups = await self.app.vocabApi.getGroups()
					self.app.dispatch({
						type: 'app_refresh',
						state: { groups: appGroups }
					})
				})
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group and filter')
				.on('click', () => {
					const group = {
						name: `Group ${self.config.groups.length + 1}`,
						items: self.selectedItems.map(item => item.__data__),
						index: self.config.groups.length
					}
					self.config.groups.push(group)
					const tw = getSamplelstTW([group])
					self.addToFilter(tw)
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
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

	self.setTools = function() {
		for (const chart of self.charts) {
			const inline = self.config.settings.controls.isOpen
			const svg = chart.svg
			const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
			toolsDiv.selectAll('*').remove()
			let display = 'block'
			if (inline) display = 'inline-block'
			const helpDiv = toolsDiv
				.insert('div')
				.style('display', display)
				.style('margin', '20px')
				.attr('name', 'sjpp-help-btn') //For unit tests
			icon_functions['help'](helpDiv, {
				handler: () => window.open('https://github.com/stjude/proteinpaint/wiki/Scatter-plot', '_blank')
			})

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
			const canSearch = chart.cohortSamples.length > 0 && 'sample' in chart.cohortSamples[0]
			if (canSearch) {
				const searchDiv = toolsDiv
					.insert('div')
					.style('display', display)
					.style('margin', '20px')
				icon_functions['search'](searchDiv, { handler: e => self.searchSample(e) })
			}
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
			const axisG = svg.select('.sjpcb-scatter-axis')
			const xAxisG = axisG.select('.sjpcb-scatter-x-axis')
			const yAxisG = axisG.select('.sjpcb-scatter-y-axis')
			const zoom = d3zoom()
				.scaleExtent([0.5, 10])
				.on('zoom', handleZoom)

			mainG.call(zoom)
			const s = self.settings
			function handleZoom(event) {
				// create new scale ojects based on event
				const new_xScale = event.transform.rescaleX(chart.xAxisScale)
				const new_yScale = event.transform.rescaleY(chart.yAxisScale)

				xAxisG.call(chart.axisBottom.scale(new_xScale))
				yAxisG.call(chart.axisLeft.scale(new_yScale))
				seriesG.attr('transform', event.transform)
				self.k = event.transform.scale(1).k
				//on zoom in the particle size is kept
				symbols.attr('d', c => self.getShape(chart, c))
				if (self.lassoOn) chart.lasso.selectedItems().attr('d', c => self.getShape(chart, c, 2))
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

			chart.lasso = d3lasso()

			self.lassoReset(chart)

			function toggle_lasso() {
				self.lassoOn = !self.lassoOn
				if (self.lassoOn) {
					mainG.on('.zoom', null)
					mainG.call(chart.lasso)
				} else {
					mainG.on('mousedown.drag', null)
					chart.lasso.items().classed('not_possible', false)
					chart.lasso.items().classed('possible', false)
					chart.lasso
						.items()
						.attr('r', self.settings.size)
						.style('fill-opacity', c => self.getOpacity(c))
					mainG.call(zoom)
					self.selectedItems = null
				}
				lassoDiv.select('*').remove()
				icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
			}
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
				if (self.config.groups.length == 1) self.showGroupMenu(event, self.config.groups[0])
				else self.showGroupsMenu(event)
			})
	}

	self.renderLegend = function(chart) {
		const legendG = chart.legendG
		legendG.selectAll('*').remove()
		if (!self.config.colorTW) return

		const step = 25
		let offsetX = 0
		let offsetY = 50
		const name =
			self.config.colorTW.term.name.length > 25
				? self.config.colorTW.term.name.slice(0, 25) + '...'
				: self.config.colorTW.term.name
		let title = `${name}, n=${chart.cohortSamples.length}`
		const colorRefCategory = chart.colorLegend.get('Ref')

		if (self.config.colorTW.term.type == 'geneVariant')
			offsetY = self.renderGeneVariantLegend(chart, 0, legendG, self.config.colorTW, 'category', chart.colorLegend)
		else {
			const colorG = legendG.append('g')
			colorG
				.append('text')
				.attr('id', 'legendTitle')
				.attr('x', offsetX)
				.attr('y', step)
				.text(title)
				.style('font-weight', 'bold')
				.style('font-size', '0.8em')

			if (self.config.colorTW.q.mode === 'continuous') {
				const [min, max] = chart.colorGenerator.domain()
				const gradientScale = d3Linear()
					.domain([min, max])
					.range([0, 130])
				const axis = axisBottom(gradientScale).ticks(3)
				const axisG = colorG
					.append('g')
					.attr('transform', `translate(0, 70)`)
					.call(axis)

				const rect = colorG
					.append('rect')
					.attr('x', 0)
					.attr('y', 50)
					.attr('width', 130)
					.attr('height', 20)
					.style('fill', `url(#linear-gradient-${self.id})`)
					.on('click', e => {
						const menu = new Menu()
						const input = menu.d
							.append('input')
							.attr('type', 'color')
							.attr('value', self.config.gradientColor[chart.id])
							.on('change', () => {
								self.config.gradientColor[chart.id] = input.node().value
								chart.startColor = rgb(self.config.gradientColor[chart.id])
									.brighter()
									.brighter()
								chart.stopColor = rgb(self.config.gradientColor[chart.id])
									.darker()
									.darker()
								chart.colorGenerator = d3Linear().range([chart.startColor, chart.stopColor])

								self.startGradient.attr('stop-color', chart.startColor)
								self.stopGradient.attr('stop-color', chart.stopColor)
								self.app.dispatch({
									type: 'plot_edit',
									id: self.id,
									config: self.config
								})
								menu.hide()
							})
						menu.show(e.clientX, e.clientY, false)
					})

				offsetY += step
			} else {
				for (const [key, category] of chart.colorLegend) {
					if (key == 'Ref') continue
					const color = category.color
					const count = category.sampleCount
					const name = key
					const hidden = self.config.colorTW.q.hiddenValues ? key in self.config.colorTW.q.hiddenValues : false
					const [circleG, itemG] = addLegendItem(colorG, category, name, offsetX, offsetY, hidden)
					circleG.on('click', e => self.onColorClick(e, key, category))
					offsetY += step
					itemG.on('click', event => self.onLegendClick(chart, legendG, 'colorTW', key, event))
				}
			}
		}
		if (colorRefCategory.sampleCount > 0) {
			offsetY = offsetY + step
			const titleG = legendG.append('g')
			titleG
				.append('text')
				.attr('x', offsetX)
				.attr('y', offsetY)
				.text('Reference')
				.style('font-weight', 'bold')
				.style('font-size', '0.8em')

			offsetY = offsetY + step

			let symbol = self.symbols[0].size(64)()
			const refColorG = legendG.append('g')
			refColorG
				.append('path')
				.attr('transform', c => `translate(${offsetX}, ${offsetY})`)
				.style('fill', colorRefCategory.color)
				.attr('d', symbol)
				.style('stroke', rgb(colorRefCategory.color).darker())

			refColorG.on('click', e => self.onColorClick(e, 'Ref', colorRefCategory))
			const refText = legendG
				.append('g')
				.append('text')
				.attr('x', offsetX + 10)
				.attr('y', offsetY)
				.text(`n=${colorRefCategory.sampleCount}`)
				.style('text-decoration', !self.settings.showRef ? 'line-through' : 'none')
				.style('font-size', '15px')
				.attr('alignment-baseline', 'middle')
				.style('font-size', '0.8em')

			refText.on('click', () => {
				refText.style('text-decoration', !self.settings.showRef ? 'none' : 'line-through')
				self.settings.showRef = !self.settings.showRef

				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						settings: { sampleScatter: self.settings }
					}
				})
			})
		}
		if (self.config.shapeTW) {
			offsetX = 300
			offsetY = 50
			title = `${self.config.shapeTW.term.name}, n=${chart.cohortSamples.length}`
			if (self.config.shapeTW.term.type == 'geneVariant')
				self.renderGeneVariantLegend(chart, offsetX, legendG, self.config.shapeTW, 'shape', chart.shapeLegend)
			else {
				const shapeG = legendG.append('g')
				shapeG
					.append('text')
					.attr('x', offsetX)
					.attr('y', step)
					.text(title)
					.style('font-weight', 'bold')
					.style('font-size', '0.8em')

				const color = 'gray'
				for (const [key, shape] of chart.shapeLegend) {
					if (key == 'Ref') continue
					const index = shape.shape % self.symbols.length
					const symbol = self.symbols[index].size(64)()
					const name = key
					const count = shape.sampleCount
					const hidden = self.config.shapeTW.q.hiddenValues ? key in self.config.shapeTW.q.hiddenValues : false
					const itemG = shapeG.append('g')

					itemG
						.append('path')
						.attr('transform', c => `translate(${offsetX}, ${offsetY})`)
						.style('fill', color)
						.attr('d', symbol)
						.style('stroke', rgb(color).darker())

					itemG
						.append('text')
						.attr('x', offsetX + 10)
						.attr('y', offsetY)
						.text(`${name}, n=${count}`)
						.style('font-size', '15px')
						.style('text-decoration', hidden ? 'line-through' : 'none')
						.attr('alignment-baseline', 'middle')
						.style('font-size', '0.8em')
					offsetY += step
					itemG.on('click', event => self.onLegendClick(chart, legendG, 'shapeTW', key, event))
				}
			}
		}

		function addLegendItem(g, category, name, x, y, hidden = false) {
			const radius = 5

			const circleG = g.append('g')
			circleG
				.append('circle')
				.attr('cx', x)
				.attr('cy', y)
				.attr('r', radius)
				.style('fill', category.color)
				.style('stroke', rgb(category.color).darker())

			circleG.on('click', e => self.onColorClick(e, key, category))
			const itemG = g.append('g')
			itemG
				.append('text')
				.attr('name', 'sjpp-scatter-legend-label')
				.attr('x', x + 10)
				.attr('y', y)
				.text(`${name}, n=${category.sampleCount}`)
				.style('font-size', '15px')
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.attr('alignment-baseline', 'middle')
				.style('font-size', '0.8em')

			return [circleG, itemG]
		}
	}

	self.renderGeneVariantLegend = function(chart, offsetX, legendG, tw, cname, map) {
		const step = 125
		let offsetY = 25
		const name = tw.term.name.length > 25 ? tw.term.name.slice(0, 25) + '...' : tw.term.name
		let title = `${name}, n=${chart.cohortSamples.length}`
		const G = legendG.append('g')
		G.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', 25)
			.text(title)
			.style('font-weight', 'bold')
			.style('font-size', '0.8em')

		offsetX += step
		const mutations = chart.cohortSamples[0]['cat_info'][cname]

		for (const [i, mutation] of mutations.entries()) {
			offsetY += 25
			const dt = mutation.dt
			const origin = morigin[mutation.origin]?.label
			const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]

			G.append('text')
				.attr('x', offsetX)
				.attr('y', offsetY - 25)
				.text(origin ? `${origin} ${dt2label[dt]}` : dt2label[dt])
				.style('font-weight', 'bold')
				.style('font-size', '0.8em')

			for (const [key, category] of map) {
				if (key == 'Ref') continue
				if (!key.includes(dtlabel)) continue
				const mkey = key.split(',')[0]
				const itemG = G.append('g')
				if (cname == 'shape') {
					const index = category.shape % self.symbols.length
					itemG
						.append('path')
						.attr('transform', c => `translate(${offsetX - step}, ${offsetY - 5})`)
						.style('fill', 'gray')
						.attr('d', self.symbols[index].size(64)())
						.style('stroke', rgb('gray').darker())
				} else {
					itemG
						.append('circle')
						.attr('cx', offsetX - step)
						.attr('cy', offsetY - 5)
						.attr('r', 5)
						.style('fill', category.color)
						.style('stroke', rgb(category.color).darker())
					itemG.on('click', e => self.onColorClick(e, key, category))
				}
				const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false
				G.append('g')
					.append('text')
					.attr('x', offsetX - step + 10)
					.attr('y', offsetY)
					.attr('name', 'sjpp-scatter-legend-label')
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.text(mkey)
					.style('font-size', '0.8em')
					.on('click', event => self.onLegendClick(chart, G, cname == 'shape' ? 'shapeTW' : 'colorTW', key, event))

				const assay = key.split(',')[1]
				if (key.includes(dtlabel))
					G.append('text')
						.attr('x', offsetX)
						.attr('y', offsetY)
						.text(`${category.sampleCount}${category.hasOrigin ? assay[0] : ''}`)
						.style('font-size', '0.8em')
				offsetY += 25
			}
		}

		return offsetY
	}
}
