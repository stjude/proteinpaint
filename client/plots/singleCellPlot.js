import { getCompInit, copyMerge, deepEqual } from '../rx/index.js'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { dofetch3 } from '#common/dofetch'
import { getColors, plotColor } from '#shared/common.js'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'
import { rgb } from 'd3'
import { roundValueAuto } from '#shared/roundValue.js'
import { TermTypes } from '#shared/terms.js'
import { ColorScale, icons as icon_functions, make_radios, addGeneSearchbox, renderTable, sayerror, Menu } from '#dom'

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
		this.colorByGene = state.config.gene ? true : false
		const q = state.termdbConfig.queries
		this.tableOnPlot = appState.nav?.header_mode == 'hidden'
		this.opts.holder.style('position', 'relative')
		this.insertBeforeId = `${this.id}-sandbox`
		const mainDiv = this.opts.holder
			.insert('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.attr('id', this.insertBeforeId)

		const leftDiv = mainDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const controlsDiv = leftDiv.append('div').attr('class', 'pp-termdb-plot-controls')
		const iconsDiv = leftDiv.append('div')
		const zoomInDiv = iconsDiv.append('div').style('margin', '20px')
		const duration = 750
		icon_functions['zoomIn'](zoomInDiv, {
			handler: () => {
				for (const plot of this.plots) plot.zoom.scaleBy(plot.svg.transition().duration(duration), 1.1)
			},
			title: 'Zoom in'
		})
		const zoomOutDiv = iconsDiv.append('div').style('margin', '20px')
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: () => {
				for (const plot of this.plots) plot.zoom.scaleBy(plot.svg.transition().duration(duration), 0.9)
			},
			title: 'Zoom out'
		})
		const identityDiv = iconsDiv.append('div').style('margin', '20px')
		icon_functions['restart'](identityDiv, {
			handler: () => {
				for (const plot of this.plots) {
					plot.svg.transition().duration(duration).call(plot.zoom.transform, zoomIdentity)
				}
			},
			title: 'Reset plot to defaults'
		})

		const contentDiv = mainDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const topDiv = contentDiv.append('div').style('padding', '20px 0px')

		const headerDiv = topDiv.append('div').style('display', 'inline-block')
		const showDiv = topDiv.append('div').style('display', 'inline-block').style('float', 'right')

		const tableDiv = contentDiv
			.append('div')
			.style('display', this.tableOnPlot ? 'block' : 'none')
			.style('padding', this.tableOnPlot ? '10px' : '0px')
		let showSamplesBt
		if (this.tableOnPlot) {
			showSamplesBt = headerDiv
				.append('button')
				.attr('aria-label', 'Select sample from table')
				.text('Change sample')
				.on('click', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { singleCellPlot: { showSamples: !this.settings.showSamples } } }
					})
				})
		}
		if (state.config.plots.length > 1) {
			showDiv.append('label').text('Show Plots:').style('padding-right', '10px').style('vertical-align', 'top')
			const plot_select = showDiv
				.append('select')
				.property('multiple', true)
				.on('change', e => {
					const options = plot_select.node().options
					const singleCellPlot = {}
					for (const option of options) singleCellPlot[option.value] = option.selected
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { singleCellPlot } }
					})
				})

			for (const plot of state.config.plots) {
				const id = plot.name.replace(/\s+/g, '')
				const key = `show${id}`
				const option = plot_select
					.append('option')
					.text(plot.name)
					.attr('value', key)
					.property('selected', plot.selected)
			}
		}
		let selectCategory, violinBt, geneSearch, searchboxDiv
		if (q.singleCell?.geneExpression) {
			headerDiv.append('label').text('Color by:').style('padding-left', '25px')

			make_radios({
				holder: headerDiv,
				options: [
					{ label: 'Plot category', value: '1', checked: !this.colorByGene },
					{
						label: 'Gene expression',
						value: '2',
						checked: this.colorByGene
					}
				],
				styles: { display: 'inline' },
				callback: async value => this.onColorByChange(value)
			})
			searchboxDiv = headerDiv.append('div')
			geneSearch = addGeneSearchbox({
				tip: new Menu({ padding: '0px' }),
				genome: this.app.opts.genome,
				row: searchboxDiv,
				searchOnly: 'gene',
				placeholder: state.config.gene || 'Gene',
				callback: () => this.onColorByChange('2'),
				emptyInputCallback: () => this.onColorByChange('2'),
				hideHelp: true,
				focusOff: true
			})
			searchboxDiv.style('display', state.config.gene ? 'inline-block' : 'none')
			selectCategory = headerDiv.append('select').style('display', state.config.gene ? 'inline-block' : 'none')

			selectCategory.on('change', async () => {
				const plot = state.termdbConfig?.queries.singleCell.data.plots[0]
				const columnName = plot.columnName
				const args = {
					sample: state.config.sample.sampleName,
					columnName,
					category: selectCategory.node().value
				}
				const result = await this.app.vocabApi.getTopTermsByType(args)
			})

			violinBt = headerDiv
				.append('button')
				.text('Open violin')
				.style('margin-left', '2px')
				.style('display', state.config.gene ? 'inline-block' : 'none')
			violinBt.on('click', () => {
				const gene = geneSearch.geneSymbol || state.config.gene
				const columnName = selectCategory.node().value
				const plot = this.plots.find(p => p.colorColumns.some(c => c == columnName))

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
								sample: {
									sID: this.state.config.sample,
									eID: this.state.config.experimentID
								}
							}
						},
						term2: {
							term: {
								type: TermTypes.SINGLECELL_CELLTYPE,
								id: TermTypes.SINGLECELL_CELLTYPE,
								name: 'Cell type',
								sample: {
									sID: this.state.config.sample,
									eID: this.state.config.experimentID
								},
								plot: plot.name,
								values
							}
						}
					}
				})
			})
		}

		// div to show optional DE genes (precomputed by seurat for each cluster, e.g. via gdc)
		const deDiv = headerDiv.append('div').style('padding-left', '40px').style('display', 'inline-block')

		const DETableDiv = contentDiv.append('div')
		const plotsDivParent = contentDiv.append('div').style('display', 'inline-block')
		const plotsDiv = plotsDivParent
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')
			.style('width', '92vw')

		const loadingDiv = this.opts.holder
			.append('div')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('width', '100%')
			.style('height', '100%')
			.style('background-color', 'rgba(255, 255, 255, 0.8)')
			.style('text-align', 'center')

		loadingDiv.append('div').attr('class', 'sjpp-spinner')
		this.dom = {
			selectCategory,
			violinBt,
			geneSearch,
			searchbox: geneSearch?.searchbox,
			searchboxDiv,
			header: this.opts.header,
			mainDiv,
			//holder,
			loadingDiv,
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder: controlsDiv,
			tableDiv,
			deDiv,
			DETableDiv,
			plotsDiv,
			plotsDivParent,
			showSamplesBt
		}

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }

		if (q.singleCell?.DEgenes) {
			const label = this.dom.deDiv
				.append('label')
				.html('View differentially expresed genes of a cluster vs rest of cells:&nbsp;')
			this.dom.deselect = label.append('select')
			if (this.app.opts.genome.termdbs)
				this.dom.GSEAbt = this.dom.deDiv
					.append('button')
					.style('margin-left', '5px')
					.style('display', 'none')
					.text('Gene set enrichment analysis')
					.on('click', e => {
						const gsea_params = {
							genes: this.genes,
							fold_change: this.fold_changes,
							genome: this.app.vocabApi.opts.state.vocab.genome
						}
						const config = {
							chartType: 'gsea',
							gsea_params: gsea_params,
							//if getPlotHolder is defined use this.insertBeforeId, needed for GDC
							insertBefore: this.app.opts?.app?.getPlotHolder ? this.insertBeforeId : this.id
						}
						this.app.dispatch({
							type: 'plot_create',
							config
						})
					})
			this.dom.deselect.append('option').text('')
			this.dom.deselect.on('change', async e => {
				DETableDiv.selectAll('*').remove()
				const categoryName = this.dom.deselect.node().value.split(' ')?.[1]
				if (this.dom.GSEAbt) this.dom.GSEAbt.style('display', categoryName ? 'inline-block' : 'none')
				if (!categoryName) return

				const columnName = state.termdbConfig.queries.singleCell.DEgenes.columnName
				const sample =
					this.state.config.experimentID || this.state.config.sample || this.samples?.[0]?.experiments[0]?.experimentID
				const args = { genome: state.genome, dslabel: state.dslabel, categoryName, sample, columnName }
				this.dom.loadingDiv.selectAll('*').remove()
				this.dom.loadingDiv.style('display', '').append('div').attr('class', 'sjpp-spinner')
				const result = await dofetch3('termdb/singlecellDEgenes', { body: args })
				this.dom.loadingDiv.style('display', 'none')
				if (result.error) {
					DETableDiv.text(result.error)
					return
				}
				if (!Array.isArray(result.genes)) {
					DETableDiv.text('.genes[] missing')
					return
				}
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
					maxWidth: '40vw',
					maxHeight: '20vh',
					div: DETableDiv
				})
			})
		}

		this.settings = {}

		document.addEventListener('scroll', event => this?.tip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.tip.hide())
		await this.setControls(state)
	}

	onColorByChange(value) {
		const gene = this.dom.searchbox.node().value
		this.colorByGene = value == '2'
		for (const div of this.colorByDivs) div.style('display', this.colorByGene ? 'none' : '')
		this.dom.searchboxDiv.style('display', this.colorByGene ? 'inline-block' : 'none')
		if (this.colorByGene) this.dom.searchbox.node().focus()
		this.dom.plotsDiv.selectAll('*').remove()
		this.dom.violinBt?.style('display', this.colorByGene && gene ? 'inline-block' : 'none')
		this.dom.selectCategory?.style('display', this.colorByGene && gene ? 'inline-block' : 'none')
		this.dom.deDiv.style('display', this.colorByGene ? 'none' : 'inline-block')
		this.dom.DETableDiv.style('display', this.colorByGene ? 'none' : 'inline-block')

		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: {
				gene: this.colorByGene ? gene : null,
				sample: this.state.config.sample || this.samples?.[0]?.sample,
				experimentID: this.state.config.experimentID || this.samples?.[0].experiments?.[0]?.experimentID
			}
		})
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
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		this.prevFilter0 = this.state?.termfilter.filter0
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
		this.config = structuredClone(this.state.config) // this config can be edited to dispatch changes
		copyMerge(this.settings, this.config.settings.singleCellPlot)
		this.colorByDivs = []
		// Only add unique colorColumn among plots as option
		const uniqueColorColumns = new Set()
		if (this.dom.selectCategory) {
			this.dom.selectCategory.selectAll('*').remove()
			for (const plot of this.state.termdbConfig?.queries.singleCell.data.plots) {
				const colorColumn = this.state.config.colorBy?.[plot.name] || plot.colorColumns[0]
				const id = plot.name.replace(/\s+/g, '') //plot id
				const plotKey = `show${id}` //for each plot a show checkbox is added and its value is stored in settings
				const display = this.settings[plotKey]
				if (!uniqueColorColumns.has(colorColumn) && display) {
					this.dom.selectCategory.append('option').text(colorColumn)
					uniqueColorColumns.add(colorColumn)
				}
			}
		}
		this.dom.tableDiv.style('display', this.settings.showSamples ? 'block' : 'none')
		if (this.tableOnPlot) {
			this.dom.showSamplesBt.text(this.settings.showSamples ? 'Hide samples' : 'Change sample')
			await renderSamplesTable(this.dom.tableDiv, this, this.state, this.state.dslabel, this.state.genome)
			if (!this.samples?.length) {
				this.showNoMatchingDataMessage()
				return
			}
		}
		if (this.colorByGene && !this.state.config.gene) return
		this.dom.loadingDiv.selectAll('*').remove()
		this.dom.loadingDiv.style('display', '').append('div').attr('class', 'sjpp-spinner')
		this.dom.mainDiv.style('opacity', 1).style('display', '')
		this.legendRendered = false
		this.data = await this.getData()
		this.dom.plotsDivParent.style('display', 'inline-block')
		this.renderPlots(this.data)
		this.dom.loadingDiv.style('display', 'none')
		if (this.dom.header) this.dom.header.html(` ${this.state.config.sample || this.samples[0].sample} Single Cell Data`)
	}

	async getData() {
		const plots = []
		for (const plot of this.config.plots) {
			const id = plot.name.replace(/\s+/g, '')
			const display = this.settings[`show${id}`]
			if (display) plots.push(plot.name)
		}

		const body = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			plots,
			filter0: this.state.termfilter.filter0
		}

		// change the sample to contains both sampleID and experimentID, so that they could
		// both be used to query data. (GDC sc gene expression only support sample uuid now)
		if (this.state.config.sample) {
			// a sample has already been selected
			body.sample = {
				eID: this.state.config.experimentID,
				sID: this.state.config.sample
			}
		} else {
			// no given sample in state.config{}, assume that this.samples[] are already loaded, then use 1st sample
			body.sample = {
				eID: this.samples?.[0]?.experiments?.[0]?.experimentID,
				sID: this.samples?.[0]?.sample
			}
		}
		body.colorBy = this.state.config.colorBy
		if (this.state.config.gene && this.colorByGene) body.gene = this.state.config.gene
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

	showNoMatchingDataMessage() {
		this.dom.mainDiv.style('opacity', 0.001).style('display', 'none')
		this.dom.loadingDiv.style('display', '').html('')
		const div = this.dom.loadingDiv
			.append('div')
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('position', 'relative')
			.style('left', '-150px')
			.style('font-size', '1.2em')
			.style('margin', '2em 1em')
			.html('No matching cohort data.')
	}

	renderPlots(result) {
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
		this.initAxes(plot)

		plot.plotDiv = this.dom.plotsDiv
			.append('div')
			.style('overflow', 'hidden')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.style('flex-grow', 1)
		if (this.state.config.settings.singleCellPlot.showBorders) plot.plotDiv.style('border', '1px solid #aaa')

		this.renderLegend(plot)

		plot.svg = plot.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('overflow', 'hidden')
			.append('svg')
			.attr('width', this.settings.svgw + 40)
			.attr('height', this.settings.svgh + 40)
			.on('mouseover', event => {
				if (this.state.config.gene && !this.onClick) this.showTooltip(event, plot)
			})
			.on('click', event => this.showTooltip(event, plot))

		plot.zoom = d3zoom()
			.scaleExtent([0.5, 5])
			.on('zoom', e => this.handleZoom(e, plot))
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		plot.svg.call(plot.zoom)
		this.plots.push(plot)

		const symbols = plot.svg.selectAll('g').data(plot.cells)

		symbols
			.enter()
			.append('g')
			.attr('transform', c => `translate(${plot.xAxisScale(c.x)}, ${plot.yAxisScale(c.y)})`)
			.append('circle')
			.attr('r', 1.5)
			.attr('fill', d => this.getColor(d, plot))
			.style('fill-opacity', d => this.getOpacity(d))
	}

	getOpacity(d) {
		if (this.config.hiddenClusters.includes(d.category)) return 0
		return 0.8
	}

	getColor(d, plot) {
		const noExpColor = '#FAFAFA'

		if (!this.colorByGene) return plot.colorMap[d.category]
		else if (this.state.config.gene) {
			if (!d.geneExp) return noExpColor
			if (plot.colorGenerator) return plot.colorGenerator(d.geneExp)
			return noExpColor //no gene expression data for this plot
		}
		return noExpColor
	}

	handleZoom(e, plot) {
		plot.svg.attr('transform', e.transform)
		plot.zoomK = e.transform.scale(1).k
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
			.range([0 + r, this.settings.svgw - r])
		plot.axisBottom = axisBottom(plot.xAxisScale)
		plot.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([0 + r, this.settings.svgh - r])
		plot.axisLeft = axisLeft(plot.yAxisScale)
		plot.zoomK = 1
	}

	renderLegend(plot) {
		const colorMap = plot.colorMap
		let legendSVG = plot.legendSVG
		if (!plot.legendSVG) {
			if (plot.colorColumns.length > 1 && !this.colorByGene) {
				const app = this.app
				const colorByDiv = plot.plotDiv.append('div')
				colorByDiv.append('label').text('Color by:').style('margin-right', '5px')
				const colorBySelect = colorByDiv.append('select')
				this.colorByDivs.push(colorByDiv)
				colorBySelect
					.selectAll('option')
					.data(plot.colorColumns)
					.enter()
					.append('option')
					.attr('value', d => d)
					.property('selected', d => d == this.state.config.colorBy?.[plot.name])
					.html(d => d)
				colorBySelect.on('change', () => {
					const colorBy = colorBySelect.node().value
					app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { colorBy: { [plot.name]: colorBy } }
					})
				})
			}
			legendSVG = plot.plotDiv
				.append('svg')
				.attr('width', 250)
				.attr('height', this.settings.svgh)
				.style('vertical-align', 'top')
			plot.legendSVG = legendSVG
		}
		legendSVG.selectAll('*').remove()
		legendSVG.append('text').attr('transform', `translate(0, 20)`).style('font-size', '0.9em').text(plot.name)
		const sameLegend = this.state.termdbConfig.queries.singleCell.data.sameLegend || this.colorByGene
		if (sameLegend && this.legendRendered) {
			if (this.state.config.gene) {
				// for gene expression sc plot, needs to add colorGenerator to plot even
				// when legend is not needed for the plot
				const colorGradient = rgb(plotColor)
				if (!this.config.startColor[plot.name]) this.config.startColor[plot.name] = colorGradient.brighter(1).toString()
				if (!this.config.stopColor[plot.name]) this.config.stopColor[plot.name] = colorGradient.darker(3).toString()
				const startColor = this.config.startColor[plot.name]
				const stopColor = this.config.stopColor[plot.name]
				let min, max
				const values = plot.cells[0]?.geneExp == undefined ? [] : plot.cells.map(cell => cell.geneExp)
				if (values.length == 0) {
					plot.colorGenerator = null
					return
				} else [min, max] = values.reduce((s, d) => [d < s[0] ? d : s[0], d > s[1] ? d : s[1]], [values[0], values[0]])
				plot.colorGenerator = d3Linear().domain([min, max]).range([startColor, stopColor])
			}
			return
		}
		this.legendRendered = true

		const legendG = legendSVG.append('g').attr('transform', `translate(10, 50)`).style('font-size', '0.8em')
		if (this.state.config.gene) {
			this.renderColorGradient(plot, legendG, this.state.config.gene)
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

	renderColorGradient(plot, legendG, gene) {
		if (plot.cells.length == 0) return
		const colorGradient = rgb(plotColor)
		if (!this.config.startColor[plot.name]) this.config.startColor[plot.name] = colorGradient.brighter(1).toString()
		if (!this.config.stopColor[plot.name]) this.config.stopColor[plot.name] = colorGradient.darker(3).toString()
		const colors = [this.config.startColor[plot.name], this.config.stopColor[plot.name]]

		let offsetY = 25
		const step = 20
		let min, max
		const values = plot.cells[0]?.geneExp == undefined ? [] : plot.cells.map(cell => cell.geneExp)
		if (values.length == 0) {
			plot.colorGenerator = null
			return
		} else [min, max] = values.reduce((s, d) => [d < s[0] ? d : s[0], d > s[1] ? d : s[1]], [values[0], values[0]])

		plot.colorGenerator = d3Linear().domain([min, max]).range(colors)

		const barwidth = 100

		legendG
			.append('text')
			.style('font-weight', '550')
			.attr('transform', `translate(${barwidth * 0.05}, -5)`)
			.text(`${gene} expression`)

		const colorScale = new ColorScale({
			holder: legendG,
			barwidth,
			barheight: 20,
			colors,
			data: [min, max],
			position: '0, 20',
			ticks: 4,
			tickSize: 5,
			topTicks: true,
			callback: (val, idx) => {
				this.changeGradientColor(plot, val, idx)
			}
		})
		colorScale.updateScale()

		offsetY += step
	}

	changeGradientColor = function (plot, newColor, idx) {
		const colorKey = idx == 0 ? 'startColor' : 'stopColor'
		this.config[colorKey][plot.name] = newColor

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
	renderSamplesTable(
		menuDiv,
		chartsInstance,
		chartsInstance.state,
		chartsInstance.state.vocab.dslabel,
		chartsInstance.state.vocab.genome
	)
}

async function renderSamplesTable(div, self, state, dslabel, genome) {
	const body = { genome, dslabel, filter0: state.termfilter.filter0 || null }
	let result
	try {
		result = await dofetch3('termdb/singlecellSamples', { body })
		if (result.error) throw result.error
	} catch (e) {
		sayerror(div, e)
		return
	}
	const samples = result.samples
	// need to set the salf.samples based on the current filter0
	self.samples = samples

	// need to do this after the self.samples has been set
	if (self.tableOnPlot) {
		if (samples.length == 0) {
			self.dom.plotsDiv.selectAll('*').remove()
			return
		}
		if (self.table && deepEqual(self.state.termfilter.filter0, self.prevFilter0)) return
	}

	div.selectAll('*').remove()

	samples.sort((elem1, elem2) => {
		const result = elem1.primarySite?.localeCompare(elem2.primarySite)
		if (result == 1 || result == -1) return result
		else return elem1.sample.localeCompare(elem2.sample)
	})

	const [rows, columns] = await getTableData(self, samples, state)

	const selectedRows = []
	let maxHeight = '40vh'
	if (self.tableOnPlot) {
		const selectedSample = self.config.sample
		const selectedRow = self.samples.findIndex(s => s.sample == selectedSample)
		const selectedRowIndex = selectedRow == -1 ? 0 : selectedRow
		selectedRows.push(selectedRowIndex)
		maxHeight = '20vh'
	}
	self.table = renderTable({
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
				if (self.dom.GSEAbt) self.dom.GSEAbt.style('display', 'none')
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
		const data = app.vocabApi.termdbConfig?.queries?.singleCell?.data
		const plots = data?.plots
		let settings = getDefaultSingleCellSettings()
		if (data.width) settings.svgw = data.width
		if (data.height) settings.svgh = data.height
		for (const plot of plots) {
			const id = plot.name.replace(/\s+/g, '')
			const key = `show${id}`
			settings[key] = plot.selected
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
		svgw: 700,
		svgh: 700,
		showBorders: false,
		showSamples: false
	}
}
