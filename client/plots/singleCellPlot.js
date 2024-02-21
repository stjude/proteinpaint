import { getCompInit, copyMerge } from '../rx/index.js'
import { Menu } from '#dom/menu'
import { axisLeft, axisBottom, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { sayerror } from '../dom/sayerror.ts'
import { dofetch3 } from '#common/dofetch'
import { getColors } from '#shared/common'
import { zoom as d3zoom } from 'd3-zoom'
import { renderTable } from '../dom/table.ts'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'

export const minDotSize = 9
export const maxDotSize = 300

class singleCellPlot {
	constructor() {
		this.type = 'singleCellPlot'
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 0 })
		this.tip.d.style('max-height', '300px').style('overflow', 'scroll').style('font-size', '0.9em')
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		//read files data
		const controlsDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		this.mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		this.tableOnPlot = appState.nav?.header_mode == 'hidden'
		console.log(this.tableOnPlot)

		if (this.tableOnPlot) {
			this.sampleDiv = this.mainDiv.insert('div').style('display', 'inline-block').style('padding', '10px')
			await renderSamplesTable(this.sampleDiv, this, appState)
		}
		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }
		const controlsHolder = controlsDiv.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')
		const tableDiv = this.mainDiv
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')
			.style('width', '100vw')
		this.dom = {
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder,
			tableDiv
		}

		// this.sampleDiv.insert('label').style('vertical-align', 'top').html('Samples:')
		// const sample = this.samples[0]
		// const input = this.sampleDiv
		// 	.append('input')
		// 	.attr('list', 'sampleDatalist')
		// 	.attr('placeholder', sample.sample)
		// 	.style('width', '500px')
		// 	.on('change', e => {
		// 		const sample = input.node().value
		// 		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: sample } })
		// 	})
		// const datalist = this.sampleDiv.append('datalist').attr('id', 'sampleDatalist')
		// datalist
		// 	.selectAll('option')
		// 	.data(this.samples)
		// 	.enter()
		// 	.append('option')
		// 	.attr('value', d => d.sample)
		// 	.attr('label', d => ('primarySite' in d ? `${d.primarySite} | ${d.diseaseType}` : ''))

		this.settings = {}

		await this.setControls()
		document.addEventListener('scroll', event => this.tip.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.tip.hide())
	}

	async setControls() {
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs: [
					{
						label: 'Chart width',
						type: 'number',
						chartType: 'singleCellPlot',
						settingsKey: 'svgw'
					},
					{
						label: 'Chart height',
						type: 'number',
						chartType: 'singleCellPlot',
						settingsKey: 'svgh'
					}
				]
			})
		}
		this.components.controls.on('downloadClick.singleCellPlot', () => {
			for (const plot of this.plots) downloadSingleSVG(plot.svg, 'plot.svg', this.opts.holder.node())
		})
	}
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			termdbConfig: appState.termdbConfig
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))

		this.dom.tableDiv.selectAll('*').remove()
		this.plots = []
		copyMerge(this.settings, this.config.settings.singleCellPlot)

		let sample = this.state.config.sample
		this.legendRendered = false
		if (!this.tableOnPlot) {
			const body = { genome: this.state.genome, dslabel: this.state.dslabel, sample: this.state.config.sample }
			this.renderPlots(body)
		} else {
			let file
			if (!this.state.config.file) {
				sample = this.samples[0].sample
				file = this.samples[0].files[0].fileId
			} else {
				sample = this.state.config.sample
				file = this.state.config.file
			}
			const body = { genome: this.state.genome, dslabel: this.state.dslabel, sample: file }
			this.renderPlots(body)
		}
		if (this.dom.header) this.dom.header.html(`${sample} Single Cell Data`)
	}

	async renderPlots(body) {
		try {
			const result = await dofetch3('termdb/singlecellData', { body })
			if (result.error) throw result.error
			for (const plot of result.plots) {
				for (const tid in result.tid2cellvalue) {
					plot.clusterMap = result.tid2cellvalue[tid]
					plot.tid = tid
					this.renderPlot(plot)
				}
			}
			this.refName = result.refName
		} catch (e) {
			if (e.stack) console.log(e.stack)
			sayerror(this.mainDiv, e)
			return
		}
	}

	renderPlot(plot) {
		this.plots.push(plot)
		let clusters = new Set(plot.cells.map(c => c.category))
		clusters = Array.from(clusters).sort()
		const cat2Color = getColors(clusters.length + 2) //Helps to use the same color scheme in different samples
		const colorMap = {}
		for (const cluster of clusters)
			colorMap[cluster] =
				cluster == 'ref' || cluster == 'No'
					? '#F2F2F2'
					: plot.colorMap?.[cluster]
					? plot.colorMap[cluster]
					: cat2Color(cluster)

		plot.colorMap = colorMap
		this.initAxes(plot)

		const plotDiv = this.dom.tableDiv.append('div').style('display', 'inline-block').style('padding', '10px')

		const svg = plotDiv
			.append('svg')
			.attr('width', this.settings.svgw)
			.attr('height', this.settings.svgh + 40)
			.on('mouseover', event => {
				if (!this.onClick) this.showTooltip(event, plot)
			})
			.on('click', event => this.showTooltip(event, plot))
		svg
			.append('text')
			.attr('transform', `translate(20, 30)`)
			.style('font-weight', 'bold')
			.style('font-size', '1.1em')
			.text(`${plot.name}`)

		const legendSVG = plotDiv
			.append('svg')
			.attr('width', 250)
			.attr('height', this.settings.svgh)
			.style('vertical-align', 'top')

		plot.svg = svg
		plot.legendSVG = legendSVG
		const zoom = d3zoom()
			.scaleExtent([0.5, 10])
			.on('zoom', e => this.handleZoom(e, mainG, plot))
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		svg.call(zoom)
		const mainG = svg.append('g')

		const legendG = legendSVG.append('g').attr('transform', `translate(20, 50)`).style('font-size', '0.8em')

		const symbols = mainG.selectAll('path').data(plot.cells)

		symbols
			.enter()
			.append('g')
			.attr('transform', c => `translate(${plot.xAxisScale(c.x)}, ${plot.yAxisScale(c.y) + 40})`)
			.append('circle')
			.attr('r', 1.5)
			.attr('fill', d => colorMap[d.category])
			.style('fill-opacity', d => (this.config.hiddenClusters.includes(d.category) ? 0 : 0.7))

		this.renderLegend(legendG, plot, colorMap)
	}

	handleZoom(e, mainG, plot) {
		mainG.attr('transform', e.transform)
		plot.zoom = e.transform.scale(1).k
	}

	renderLegend(legendG, plot, colorMap) {
		if (this.state.termdbConfig.singleCell.sameLegend && this.legendRendered) return
		this.legendRendered = true
		legendG
			.append('text')
			.attr('transform', `translate(${0}, ${25})`)
			.style('font-weight', 'bold')
			.text(`${plot.colorBy}`)

		const step = 20
		let y = 50
		let x = 0
		for (const cluster in colorMap) {
			const clusterCells = plot.cells.filter(item => item.category == cluster)
			const hidden = this.config.hiddenClusters.includes(cluster)
			const n = clusterCells.length
			const color = colorMap[cluster]
			const itemG = legendG.append('g').attr('transform', c => `translate(${x}, ${y})`)
			itemG.append('circle').attr('r', 3).attr('fill', color)
			itemG
				.append('g')
				.attr('transform', `translate(${x + 10}, ${5})`)
				.append('text')
				.text(
					`${
						cluster == 'ref'
							? this.state.termdbConfig.singleCell.refName
							: cluster == 'query'
							? this.state.config.sample
							: cluster
					} n=${n}`
				)
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.on('click', e => onCategoryClick(this, e, cluster, plot))
			y += step
		}

		function onCategoryClick(parent, e, cluster, plot) {
			const itemG = e.target
			const hidden = itemG.style['text-decoration'] == 'line-through'
			itemG.style['text-decoration'] = hidden ? 'none' : 'line-through'
			let hiddenClusters = parent.config.hiddenClusters
			if (!hidden) hiddenClusters.push(cluster)
			else hiddenClusters.splice(hiddenClusters.indexOf(cluster), 1)
			parent.app.dispatch({
				type: 'plot_edit',
				id: parent.id,
				config: { hiddenClusters }
			})
		}
	}

	initAxes(plot) {
		const s0 = plot.cells[0]
		const [xMin, xMax, yMin, yMax] = plot.cells.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		const r = 5
		plot.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([0 + r, this.settings.svgh - 5])
		plot.axisBottom = axisBottom(plot.xAxisScale)
		plot.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([0 + r, this.settings.svgh - r])
		plot.axisLeft = axisLeft(plot.yAxisScale)
		plot.zoom = 1
	}

	distance(x1, y1, x2, y2, plot) {
		const x = plot.xAxisScale(x2) - plot.xAxisScale(x1)
		const y = plot.yAxisScale(y2) - plot.yAxisScale(y1)
		const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
		return distance
	}

	showTooltip(event, plot) {
		if (this.onClick && event.type == 'click') {
			this.onClick = false
			this.tip.hide()
			return
		}
		if (event.target.tagName == 'circle') {
			this.onClick = event.type == 'click'

			const d = event.target.__data__
			let threshold = 10 //min distance in pixels to be in the neighborhood
			threshold = threshold / plot.zoom //Threshold should consider the zoom
			const samples = plot.cells.filter(s => {
				if (this.getOpacity(s) == 0) return false
				const dist = this.distance(s.x, s.y, d.x, d.y, plot)
				return dist < threshold
			})
			const tree = []

			for (const sample of samples) {
				const cluster = d.category

				let node = tree.find(item => item.id == cluster)
				if (!node) {
					node = { id: cluster, parentId: null, samples: [sample], level: 1, category: null, children: [] }
					tree.push(node)
				} else {
					node.samples.push(sample)
				}
			}
			const menu = this.tip.clear()
			const table = menu.d.append('table')
			for (const node of tree) {
				let tr = table.append('tr')
				tr.append('td').style('color', '#aaa').text(plot.colorBy)

				const cluster = node.id
				const td = tr.append('td')
				const svg = td.append('svg').attr('width', 150).attr('height', 20)
				const x = 10
				const y = 12
				const g = svg.append('g').attr('transform', `translate(${x}, ${y})`)
				g.append('circle').attr('fill', plot.colorMap[cluster]).attr('r', 4)
				svg
					.append('g')
					.attr('transform', `translate(${x + 15}, ${y + 4})`)
					.append('text')
					.text(cluster)
				tr = table.append('tr')
				tr.append('td').style('color', '#aaa').text('cells')
				tr.append('td').text(node.samples.length)
			}
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
	}

	getOpacity(d) {
		return this.config.hiddenClusters.includes(d.category) ? 0 : 1
	}
}

export async function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/

	const menuDiv = holder.append('div').style('padding', '5px')
	renderSamplesTable(menuDiv, chartsInstance, chartsInstance.state)
}

async function renderSamplesTable(div, self, state) {
	const body = { genome: state.vocab.genome, dslabel: state.vocab.dslabel }
	let result
	try {
		result = await dofetch3('termdb/singlecellSamples', { body })
		if (result.error) throw result.error
	} catch (e) {
		sayerror(div, e)
		return
	}
	const samples = result.samples
	samples.sort((elem1, elem2) => {
		const result = elem1.primarySite?.localeCompare(elem2.primarySite)
		if (result == 1 || result == -1) return result
		else return elem1.sample.localeCompare(elem2.sample)
	})

	const rows = []
	let columns = []
	const fields = result.fields
	const columnNames = result.columnNames
	for (const column of columnNames) columns.push({ label: column })
	const index = columnNames.length == 1 ? 0 : columnNames.length - 1
	columns[index].width = '25vw'

	for (const sample of samples) {
		if (sample.files)
			for (const file of sample.files) {
				const row = []
				addFields(row, fields, sample)
				row.push({ value: file.sampleType })
				row.push({ value: file.fileId })
				rows.push(row)
			}
		else {
			const row = []
			addFields(row, fields, sample)
			rows.push(row)
		}
	}

	function addFields(row, fields, sample) {
		for (const field of fields) {
			row.push({ value: sample[field] })
		}
	}
	const selectedRows = []
	let maxHeight = '40vh'
	if (self.tableOnPlot) {
		selectedRows.push(0)
		self.samples = samples
		maxHeight = '21vh'
	}

	renderTable({
		rows,
		columns,
		resize: true,
		singleMode: true,
		div,
		maxHeight,
		noButtonCallback: index => {
			const sample = samples[index].sample
			const file = rows[index][columns.length - 1].value
			let config = { chartType: 'singleCellPlot', sample, file }
			let type = 'plot_edit'
			if (!self.tableOnPlot) {
				self.dom.tip.hide()
				type = 'plot_create'
				self.app.dispatch({ type, config })
			} else self.app.dispatch({ type, id: self.id, config })
		},
		selectedRows
	})
}

export const scatterInit = getCompInit(singleCellPlot)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export async function getPlotConfig(opts, app) {
	try {
		const settings = getDefaultSingleCellSettings()
		const config = {
			hiddenClusters: [],
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				singleCellPlot: settings
			}
		}
		// may apply term-specific changes to the default object
		const result = copyMerge(config, opts)
		return result
	} catch (e) {
		console.log(e)
		throw `${e} [singleCellPlot getPlotConfig()]`
	}
}

export function getDefaultSingleCellSettings() {
	return {
		svgw: 450,
		svgh: 450
	}
}
