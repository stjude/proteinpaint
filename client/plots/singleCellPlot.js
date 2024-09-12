import { getCompInit, copyMerge } from '../rx/index.js'
import { Menu } from '#dom/menu'
import { axisLeft, axisBottom, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { sayerror } from '../dom/sayerror.ts'
import { dofetch3 } from '#common/dofetch'
import { getColors, plotColor } from '#shared/common'
import { zoom as d3zoom } from 'd3-zoom'
import { renderTable } from '../dom/table.ts'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'
import { rgb } from 'd3'
import { addGeneSearchbox } from '../dom/genesearch.ts'
import { roundValueAuto } from '../shared/roundValue.js'
import { TermTypes } from '../shared/terms.js'

/*
this
	.tableOnPlot=bool

	.samples[]
		datastructure returned by /termdb/singlecellSamples
		only attached when tableOnPlot=true

	.config{}
		if a sample is already selected, config is {sample:str} or {sample:str, experimentID:str}
		if config.sample is undefined, use 

	.legendRendered=bool
	.state{}
		.config{}
			.sample
*/

class singleCellPlot {
	constructor() {
		this.type = 'singleCellPlot'
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 0 })
		this.tip.d.style('max-height', '300px').style('overflow', 'scroll').style('font-size', '0.9em')
		this.startGradient = {}
		this.stopGradient = {}
	}

	async init(appState) {
		const state = this.getState(appState)
		const q = state.termdbConfig.queries
		this.tableOnPlot = appState.nav?.header_mode == 'hidden'

		//read files data
		const controlsDiv = this.opts.holder
			.insert('div')
			.style('display', 'inline-block')
			.attr('class', 'pp-termdb-plot-controls')
		const mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerDiv = mainDiv.append('div').style('padding', '10px')
		const tableDiv = mainDiv.append('div')
		const showDiv = headerDiv.append('div') //.style('display', 'inline-block')
		const searchGeneDiv = headerDiv.append('div').style('padding-top', '10px').style('display', 'inline-block')

		if (this.tableOnPlot) {
			showDiv
				.append('input')
				.attr('id', `showSamples`)
				.attr('type', 'checkbox')
				.property('checked', true)
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { singleCellPlot: { showSamples: e.target.checked } } }
					})
				})
			showDiv.append('label').text('Show samples').attr('for', `showSamples`)
		}
		for (const plot of state.config.plots) {
			const id = plot.name.replace(/\s+/g, '')
			showDiv
				.append('input')
				.attr('id', `show${id}`)
				.attr('type', 'checkbox')
				.property('checked', true)
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { singleCellPlot: { [`show${id}`]: e.target.checked } } }
					})
				})
			showDiv.append('label').text(plot.name).attr('for', `show${id}`)
		}
		if (q.singleCell?.geneExpression) {
			searchGeneDiv.append('label').html('Gene expression:')
			const geneSearch = addGeneSearchbox({
				tip: new Menu({ padding: '0px' }),
				genome: this.app.opts.genome,
				row: searchGeneDiv,
				searchOnly: 'gene',
				placeholder: state.config.gene || 'Gene',
				callback: () => {
					violinBt?.style('display', 'inline-block')
					select?.style('display', 'inline-block')

					const gene = geneSearch.geneSymbol
					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { gene } })
				},
				emptyInputCallback: () => {
					violinBt.style('display', 'none')
					select.style('display', 'none')
					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { gene: null } })
				},
				hideHelp: true,
				focusOff: true
			})
			const select = searchGeneDiv.append('select').style('display', state.config.gene ? 'inline-block' : 'none')
			for (const plot of state.termdbConfig?.queries.singleCell.data.plots) {
				select.append('option').text(plot.colorColumn)
			}
			select.on('change', async () => {
				const plot = state.termdbConfig?.queries.singleCell.data.plots[0]
				const columnName = plot.columnName
				const args = {
					sample: state.config.sample.sampleName,
					columnName,
					category: select.node().value
				}
				const result = await this.app.vocabApi.getTopTermsByType(args)
			})

			const violinBt = searchGeneDiv
				.append('button')
				.text('Open violin')
				.style('margin-left', '2px')
				.style('display', state.config.gene ? 'inline-block' : 'none')
			violinBt.on('click', () => {
				const gene = geneSearch.geneSymbol || state.config.gene
				const name = this.state.config.plots.find(p => p.colorColumn == select.node().value).name
				const plot = this.plots.find(p => p.name == name)
				const values = {}
				for (const cluster of plot.clusters) {
					values[cluster] = { key: cluster, value: cluster }
				}
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'violin',
						settings: { violin: { plotThickness: 50 } },
						term: {
							term: {
								type: TermTypes.SINGLECELL_GENE_EXPRESSION,
								id: gene,
								gene,
								name: gene,
								sample: state.config.sample
							}
						},
						term2: {
							term: {
								type: TermTypes.SINGLECELL_CELLTYPE,
								id: TermTypes.SINGLECELL_CELLTYPE,
								name: 'Cell type',
								sample: state.config.sample,
								plot: plot.name,
								values
							}
						}
					}
				})
			})
		}

		const deDiv = headerDiv.append('div').style('padding', '10px').style('display', 'inline-block')
		const plotsDiv = mainDiv
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')
			.style('width', '92vw')

		this.dom = {
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder: controlsDiv,
			tableDiv,
			deDiv,
			plotsDiv
		}

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }

		if (q.singleCell?.DEgenes) {
			this.dom.deDiv.append('label').html('View differentially expresed genes of a cluster vs rest of cells:&nbsp;')
			this.dom.deselect = this.dom.deDiv.append('select')
			if (this.app.opts.genome.termdbs)
				this.dom.GSEAbt = this.dom.deDiv
					.append('button')
					.style('margin-left', '5px')
					.property('disabled', true)
					.text('Gene set enrichment analysis')
					.on('click', e => {
						const gsea_params = {
							genes: this.genes,
							fold_change: this.fold_changes,
							genome: this.app.vocabApi.opts.state.vocab.genome
						}
						const config = {
							chartType: 'gsea',
							gsea_params: gsea_params
						}
						this.app.dispatch({
							type: 'plot_create',
							config
						})
					})
			const DETableDiv = this.dom.deDiv.append('div')
			this.dom.DETableDiv = DETableDiv
			this.dom.deselect.append('option').text('')
			this.dom.deselect.on('change', async e => {
				DETableDiv.selectAll('*').remove()
				const categoryName = this.dom.deselect.node().value.split(' ')?.[1]
				if (this.dom.GSEAbt) this.dom.GSEAbt.property('disabled', !categoryName)
				if (!categoryName) return

				const columnName = state.termdbConfig.queries.singleCell.DEgenes.columnName
				const sample =
					this.state.config.experimentID || this.state.config.sample || this.samples[0]?.experiments[0]?.experimentID
				const args = { genome: state.genome, dslabel: state.dslabel, categoryName, sample, columnName }
				const result = await dofetch3('termdb/singlecellDEgenes', { body: args })
				const columns = [{ label: 'Gene' }, { label: 'Log2FC' }, { label: 'Adjusted P-value' }]
				const rows = []
				this.genes = []
				this.fold_changes = []
				result.genes.sort((a, b) => b.avg_log2FC - a.avg_log2FC)
				for (const gene of result.genes) {
					const row = [
						{ value: gene.name },
						{ value: roundValueAuto(gene.avg_log2FC) },
						{ value: roundValueAuto(gene.p_val_adj) }
					]
					rows.push(row)
					this.genes.push(gene.name)
					this.fold_changes.push(gene.avg_log2FC)
				}
				renderTable({
					rows,
					columns,
					resize: true,
					div: DETableDiv
				})
			})
		}

		this.settings = {}

		document.addEventListener('scroll', event => this?.tip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.tip.hide())
		await this.setControls(state)
	}

	async setControls(state) {
		const inputs = [
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'svgw',
				min: 300,
				max: 1000
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'svgh',
				min: 300,
				max: 1000
			},
			{
				label: 'Show borders',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showBorders',
				boxLabel: ''
			}
		]
		if (this.tableOnPlot)
			inputs.push({
				label: 'Show samples',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showSamples',
				boxLabel: ''
			})

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs
			})
		}
		this.components.controls.on('downloadClick.singleCellPlot', () => {
			for (const plot of this.plots) downloadSingleSVG(plot.svg, 'plot.svg', this.opts.holder.node())
		})
	}
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		console.log(315, config)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			termdbConfig: appState.termdbConfig,
			termfilter: appState.termfilter
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		console.log(330, 'singleCellPlot.main()')
		this.config = structuredClone(this.state.config) // this config can be edited to dispatch changes
		copyMerge(this.settings, this.config.settings.singleCellPlot)

		this.dom.tableDiv.style('display', this.settings.showSamples ? 'block' : 'none')
		if (this.tableOnPlot) {
			console.log(332, this.tableOnPlot)
			await renderSamplesTable(this.dom.tableDiv, this, this.state)
		}

		this.legendRendered = false
		console.log(336, this.config)
		// if (!this.config.sample) {
		// 	this.dom.plotsDiv.style('display', 'none')
		// } else {
		const result = await this.getData()
		this.dom.plotsDiv.style('display', '')
		this.renderPlots(result)
		if (this.dom.header) this.dom.header.html(`${sample} Single Cell Data`)
		//}
	}

	async getData() {
		const plots = []
		for (const plot of this.config.plots) {
			const id = plot.name.replace(/\s+/g, '')
			console.log(343, id, plot.name)
			const display = this.settings[`show${id}`]
			if (display) plots.push(plot.name)
		}

		const body = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			plots,
			filter0: this.state.termfilter.filter0
		}
		let sample
		if (this.state.config.sample) {
			// a sample has already been selected
			sample = this.state.config.sample
			body.sample = this.state.config.experimentID || this.state.config.sample
		} else {
			// no given sample in state.config{}, assume that this.samples[] are already loaded, then use 1st sample
			sample = this.samples[0].sample
			body.sample = this.samples[0].experiments?.[0]?.experimentID || this.samples[0].sample
		}
		if (this.state.config.gene) body.gene = this.state.config.gene
		try {
			const result = await dofetch3('termdb/singlecellData', { body })
			if (result.error) throw result.error
			this.refName = result.refName
			return result
		} catch (e) {
			if (e.stack) console.log(e.stack)
			sayerror(this.dom.plotsDiv, e)
			return
		}
	}

	renderPlots(result) {
		console.log(375, this.dom.plotsDiv.node())
		this.dom.plotsDiv.selectAll('*').remove()
		this.plots = []
		for (const plot of result.plots) {
			plot.id = plot.name.replace(/\s+/g, '')
			this.renderPlot(plot)
		}
	}

	renderPlot(plot) {
		const colorMap = {}
		let clusters = new Set(plot.cells.map(c => c.category))

		plot.clusters = Array.from(clusters).sort((a, b) => {
			const num1 = parseInt(a.split(' ')[1])
			const num2 = parseInt(b.split(' ')[1])
			return num1 - num2
		})
		if (this.dom.deselect && !this.legendRendered) {
			//first plot
			this.dom.deselect.selectAll('*').remove()
			this.dom.deselect.append('option').text('')
			for (const cluster of plot.clusters) this.dom.deselect.append('option').text(cluster)
		}
		const cat2Color = getColors(plot.clusters.length + 2) //Helps to use the same color scheme in different samples
		for (const cluster of plot.clusters)
			colorMap[cluster] =
				cluster == 'ref' || cluster == 'No'
					? '#F2F2F2'
					: plot.colorMap?.[cluster]
					? plot.colorMap[cluster]
					: cat2Color(cluster)

		plot.colorMap = colorMap
		this.plots.push(plot)
		this.initAxes(plot)

		plot.plotDiv = this.dom.plotsDiv
			.append('div')
			.style('overflow', 'hidden')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.style('flex-grow', 1)
		if (this.state.config.settings.singleCellPlot.showBorders) plot.plotDiv.style('border', '1px solid #aaa')

		this.renderLegend(plot)

		const svg = plot.plotDiv
			.append('svg')
			.attr('width', this.settings.svgw)
			.attr('height', this.settings.svgh + 40)
			.on('mouseover', event => {
				if (this.state.config.gene && !this.onClick) this.showTooltip(event, plot)
			})
			.on('click', event => this.showTooltip(event, plot))
		svg.append('text').attr('transform', `translate(20, 30)`).style('font-weight', 'bold').text(`${plot.name}`)

		plot.svg = svg

		const zoom = d3zoom()
			.scaleExtent([0.5, 5])
			.on('zoom', e => this.handleZoom(e, plot))
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		svg.call(zoom)

		const symbols = svg.selectAll('g').data(plot.cells)

		symbols
			.enter()
			.append('g')
			.attr('transform', c => `translate(${plot.xAxisScale(c.x)}, ${plot.yAxisScale(c.y) + 40})`)
			.append('circle')
			.attr('r', 1.5)
			.attr('fill', d => this.getColor(d, plot))
			.style('fill-opacity', d => this.getOpacity(d))
	}

	getOpacity(d) {
		if (this.config.hiddenClusters.includes(d.category)) return 0
		return 0.7
	}

	getColor(d, plot) {
		const noExpColor = '#FAFAFA'
		if (this.state.config.gene) {
			if (!d.geneExp) return noExpColor
			if (plot.colorGenerator) return plot.colorGenerator(d.geneExp)
			return noExpColor //no gene expression data for this plot
		}
		return plot.colorMap[d.category]
	}

	handleZoom(e, plot) {
		plot.svg.attr('transform', e.transform)
		plot.zoom = e.transform.scale(1).k
	}

	initAxes(plot) {
		if (!plot.cells.length) return
		const s0 = plot.cells[0]
		const [xMin, xMax, yMin, yMax] = plot.cells.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		const r = 5
		plot.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([0 + r, this.settings.svgh + r])
		plot.axisBottom = axisBottom(plot.xAxisScale)
		plot.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([0 + r, this.settings.svgh + r])
		plot.axisLeft = axisLeft(plot.yAxisScale)
		plot.zoom = 1
	}

	renderLegend(plot) {
		const colorMap = plot.colorMap
		let legendSVG = plot.legendSVG
		if (!plot.legendSVG) {
			legendSVG = plot.plotDiv
				.append('svg')
				.attr('width', 250)
				.attr('height', this.settings.svgh)
				.style('vertical-align', 'top')
			plot.legendSVG = legendSVG
		}
		legendSVG.selectAll('*').remove()
		if (this.state.termdbConfig.queries.singleCell.data.sameLegend && this.legendRendered) return
		this.legendRendered = true

		const legendG = legendSVG.append('g').attr('transform', `translate(25, 50)`).style('font-size', '0.8em')
		if (this.state.config.gene) {
			this.renderColorGradient(plot, legendG)
			return
		}

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
							? this.state.termdbConfig.queries.singleCell.data.refName
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

	renderColorGradient(plot, legendG) {
		if (plot.cells.length == 0) return
		const colorGradient = rgb(plotColor)
		if (!this.config.startColor[plot.name]) this.config.startColor[plot.name] = colorGradient.brighter(1).toString()
		if (!this.config.stopColor[plot.name]) this.config.stopColor[plot.name] = colorGradient.darker(3).toString()
		const startColor = this.config.startColor[plot.name]
		const stopColor = this.config.stopColor[plot.name]
		const gradient = legendG
			.append('defs')
			.append('linearGradient')
			.attr('id', `linear-gradient-${plot.id}`)
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '100%')
			.attr('y2', '0%')
		this.startGradient[plot.name] = gradient.append('stop').attr('offset', '0%').attr('stop-color', startColor)
		this.stopGradient[plot.name] = gradient.append('stop').attr('offset', '100%').attr('stop-color', stopColor)

		let offsetY = 25
		const step = 20
		let min, max
		const values = plot.cells[0]?.geneExp == undefined ? [] : plot.cells.map(cell => cell.geneExp)
		if (values.length == 0) {
			plot.colorGenerator = null
			return
		} else [min, max] = values.reduce((s, d) => [d < s[0] ? d : s[0], d > s[1] ? d : s[1]], [values[0], values[0]])

		plot.colorGenerator = d3Linear().domain([min, max]).range([startColor, stopColor])

		const gradientWidth = 100
		const gradientScale = d3Linear().domain([min, max]).range([0, gradientWidth])
		const gradientStep = (max - min) / 4
		const tickValues = [min, min + gradientStep, min + 2 * gradientStep, min + 3 * gradientStep, max]
		const axis = axisTop(gradientScale).tickValues(tickValues)
		legendG.append('g').attr('transform', `translate(0, 100)`).call(axis)
		plot.startRect = legendG
			.append('rect')
			.attr('x', -25)
			.attr('y', 100)
			.attr('width', 20)
			.attr('height', 20)
			.style('fill', startColor)
			.on('click', e => this.editColor(plot, 'startColor', plot.startRect))
		plot.stopRect = legendG
			.append('rect')
			.attr('x', gradientWidth + 5)
			.attr('y', 100)
			.attr('width', 20)
			.attr('height', 20)
			.style('fill', stopColor)
			.on('click', e => this.editColor(plot, 'stopColor', plot.stopRect))

		const rect = legendG
			.append('rect')
			.attr('x', 0)
			.attr('y', 100)
			.attr('width', gradientWidth)
			.attr('height', 20)
			.style('fill', `url(#linear-gradient-${plot.id})`)

		offsetY += step
	}

	editColor(plot, colorKey, elem) {
		const color = this.config[colorKey][plot.name]
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
				this.changeGradientColor(plot, colorKey, elem, color)
				colorMenu.hide()
			})
		colorMenu.showunder(elem.node(), false)
	}

	changeGradientColor = function (plot, colorKey, elem, color) {
		this.config[colorKey][plot.name] = color

		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: this.config
		})
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

			const menu = this.tip.clear()
			const table = menu.d.append('table')
			let tr = table.append('tr')
			tr.append('td').style('color', '#aaa').text(plot.colorBy)

			const td = tr.append('td')
			const svg = td.append('svg').attr('width', 150).attr('height', 20)
			const x = 10
			const y = 12
			const g = svg.append('g').attr('transform', `translate(${x}, ${y})`)
			g.append('circle').attr('fill', this.getColor(d, plot)).attr('r', 4)
			svg
				.append('g')
				.attr('transform', `translate(${x + 15}, ${y + 4})`)
				.append('text')
				.text(d.category)

			if ('geneExp' in d) {
				tr = table.append('tr')
				tr.append('td').style('color', '#aaa').text('Gene expression')
				tr.append('td').text(roundValueAuto(d.geneExp))
			}
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
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
	const body = { genome: state.genome, dslabel: state.dslabel, filter0: state.termfilter.filter0 || null }
	let result
	try {
		result = await dofetch3('termdb/singlecellSamples', { body })
		if (result.error) throw result.error
	} catch (e) {
		sayerror(div, e)
		return
	}
	div.selectAll('*').remove()
	const samples = result.samples
	self.samples = samples
	console.log(732, samples)

	samples.sort((elem1, elem2) => {
		const result = elem1.primarySite?.localeCompare(elem2.primarySite)
		if (result == 1 || result == -1) return result
		else return elem1.sample.localeCompare(elem2.sample)
	})

	const [rows, columns] = await getTableData(self, samples, state)

	const selectedRows = []
	let maxHeight = '40vh'
	if (self.tableOnPlot) {
		selectedRows.push(0)
		maxHeight = '30vh'
	}
	renderTable({
		rows,
		columns,
		resize: true,
		singleMode: true,
		div,
		maxHeight,
		noButtonCallback: index => {
			if (self.dom.DETableDiv) {
				self.dom.deselect.node().value = ''
				self.dom.DETableDiv.selectAll('*').remove()
				if (self.dom.GSEAbt) self.dom.GSEAbt.property('disabled', true)
			}
			const sample = rows[index][0].value
			const config = { chartType: 'singleCellPlot', sample }
			if (rows[index][0].__experimentID) {
				config.experimentID = rows[index][0].__experimentID
			}

			if (self.tableOnPlot) {
				self.app.dispatch({ type: 'plot_edit', id: self.id, config })
			} else {
				// please explain
				self.dom.tip.hide()
				self.app.dispatch({ type: 'plot_create', config })
			}
		},
		selectedRows
	})
}

async function getTableData(self, samples, state) {
	const rows = []
	for (const sample of samples) {
		if (sample.experiments)
			for (const exp of sample.experiments) {
				// first cell is always sample name. sneak in experiment object to be accessed in click callback
				const row = [{ value: sample.sample, __experimentID: exp.experimentID }]

				// optional sample and experiment columns
				for (const c of state.termdbConfig.queries.singleCell.samples.sampleColumns || []) {
					row.push({ value: sample[c.termid] })
				}
				for (const c of state.termdbConfig.queries.singleCell.samples.experimentColumns || []) {
					row.push({ value: sample[c.label] })
				}

				// hardcode to always add in experiment id column
				row.push({ value: exp.experimentID })
				rows.push(row)
			}
		else {
			// sample does not use experiment

			// first cell is sample name
			const row = [{ value: sample.sample }]

			// optional sample columns
			for (const c of state.termdbConfig.queries.singleCell.samples.sampleColumns || []) {
				row.push({ value: sample[c.termid] })
			}
			rows.push(row)
		}
	}

	// first column is sample and is hardcoded
	const columns = [{ label: state.termdbConfig.queries.singleCell.samples.firstColumnName || 'Sample' }]

	// add in optional sample columns
	for (const c of state.termdbConfig.queries.singleCell.samples.sampleColumns || []) {
		columns.push({
			label: (await self.app.vocabApi.getterm(c.termid)).name,
			width: '15vw'
		})
	}

	// add in optional experiment columns
	for (const c of state.termdbConfig.queries.singleCell.samples.experimentColumns || []) {
		columns.push({ label: c.label, width: '20vw' })
	}

	// if samples are using experiments, add the last hardcoded experiment column
	if (samples.some(i => i.experiments)) {
		columns.push({ label: 'Experiment' })
	}

	//const index = columnNames.length == 1 ? 0 : columnNames.length - 1
	//columns[index].width = '25vw'
	return [rows, columns]
}

export const scatterInit = getCompInit(singleCellPlot)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export async function getPlotConfig(opts, app) {
	try {
		const plots = app.vocabApi.termdbConfig?.queries?.singleCell.data.plots
		const settings = getDefaultSingleCellSettings()
		for (const plot of plots) {
			const id = plot.name.replace(/\s+/g, '')
			const key = `show${id}`
			settings[key] = true
		}
		const config = {
			hiddenClusters: [],
			settings: {
				singleCellPlot: settings
			},
			startColor: {},
			stopColor: {},
			plots
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
		svgw: 420,
		svgh: 420,
		showBorders: false,
		showSamples: true
	}
}
