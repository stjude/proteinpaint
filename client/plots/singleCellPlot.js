import { getCompInit, copyMerge, deepEqual } from '../rx/index.js'
import { scaleLinear as d3Linear } from 'd3-scale'
import { dofetch3 } from '#common/dofetch'
import { getColors, plotColor } from '#shared/common.js'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'
import { line, max, rgb } from 'd3'
import { roundValueAuto } from '#shared/roundValue.js'
import { TermTypes } from '#shared/terms.js'
import { ColorScale, icons as icon_functions, addGeneSearchbox, renderTable, sayerror, Menu } from '#dom'
import { Tabs } from '../dom/toggleButtons.js'
import * as THREE from 'three'
import { getThreeCircle } from './sampleScatter.rendererThree.js'
import { render } from '#src/block.mds2.vcf.plain'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/*
this

	.samples[]
		datastructure returned by /termdb/singlecellSamples


	.legendRendered=bool
	.state{}
		.config{}
			.sample
*/

const SAMPLES_TAB = 0
const PLOTS_TAB = 1
const COLORBY_TAB = 2
const GENE_EXPRESSION_TAB = 3
const DIFFERENTIAL_EXPRESSION_TAB = 4

const noExpColor = '#F5F5F5' //lightGray

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

		const body = { genome: state.genome, dslabel: state.dslabel, filter0: state.termfilter.filter0 || null }
		let result
		try {
			result = await dofetch3('termdb/singlecellSamples', { body })
			if (result.error) throw result.error
		} catch (e) {
			sayerror(div, e)
			return
		}

		this.samples = result.samples
		// need to set the this.samples based on the current filter0
		this.samples.sort((elem1, elem2) => {
			const result = elem1.primarySite?.localeCompare(elem2.primarySite)
			if (result == 1 || result == -1) return result
			else return elem1.sample.localeCompare(elem2.sample)
		})

		this.tabs = []
		const activeTab = state.config.activeTab
		if (this.samples.length > 1)
			this.tabs.push({
				label: 'Samples',
				id: SAMPLES_TAB,
				active: activeTab == SAMPLES_TAB,
				callback: () => this.setActiveTab(SAMPLES_TAB)
			})
		if (state.config.plots.length > 1)
			this.tabs.push({
				label: 'Plots',
				id: PLOTS_TAB,
				active: activeTab == PLOTS_TAB,
				callback: () => this.setActiveTab(PLOTS_TAB)
			})
		this.tabs.push(
			{
				label: 'Clusters',
				id: COLORBY_TAB,
				active: activeTab == COLORBY_TAB,
				callback: () => this.setActiveTab(COLORBY_TAB)
			},
			{
				label: 'Gene expression',
				id: GENE_EXPRESSION_TAB,
				active: activeTab == GENE_EXPRESSION_TAB,
				callback: () => this.setActiveTab(GENE_EXPRESSION_TAB)
			}
		)
		if (state.termdbConfig.queries?.singleCell?.DEgenes)
			this.tabs.push({
				label: 'Differential expression',
				id: DIFFERENTIAL_EXPRESSION_TAB,
				active: activeTab == DIFFERENTIAL_EXPRESSION_TAB,
				callback: () => this.setActiveTab(DIFFERENTIAL_EXPRESSION_TAB)
			})

		const q = state.termdbConfig.queries
		this.opts.holder.style('position', 'relative')
		this.mainDivId = `${this.id}-sandbox`
		const errorDiv = this.opts.holder.append('div')
		const mainDiv = this.opts.holder
			.insert('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('white-space', 'nowrap')
			.attr('id', this.mainDivId)

		const leftDiv = mainDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const controlsDiv = leftDiv.append('div').attr('class', 'pp-termdb-plot-controls')

		const contentDiv = mainDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		this.tabsComp = await new Tabs({
			holder: contentDiv,
			tabsPosition: 'horizontal',
			tabs: this.tabs
		}).main()

		const headerDiv = contentDiv.append('div').style('display', 'inline-block').style('padding-bottom', '20px')
		const showDiv = headerDiv.append('div').style('padding-bottom', '10px')

		const tableDiv = headerDiv.append('div')
		await this.renderSamplesTable(tableDiv, state)

		if (state.config.plots.length > 1) this.renderShowPlots(showDiv, state)
		// div to show optional DE genes (precomputed by seurat for each cluster, e.g. via gdc)
		const geDiv = headerDiv.append('div').style('display', 'inline-block')
		const deDiv = headerDiv.append('div').style('display', 'inline-block')

		const plotsDivParent = contentDiv.append('div')
		const plotsDiv = plotsDivParent
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')

		const loadingDiv = this.opts.holder
			.append('div')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('width', '100%')
			.style('height', '100%')
			.style('background-color', 'rgba(255, 255, 255, 0.8)')
			.style('text-align', 'center')

		this.dom = {
			header: this.opts.header,
			headerDiv,
			showDiv,
			mainDiv,
			loadingDiv,
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder: controlsDiv,
			tableDiv,
			geDiv,
			deDiv,
			plotsDiv,
			plotsDivParent,
			errorDiv
		}
		if (q.singleCell?.geneExpression) this.renderGeneExpressionControls(geDiv, state)

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }

		if (q.singleCell?.DEgenes) {
			const label = this.dom.deDiv
				.append('label')
				.html('View differentially expressed genes for cells of a cluster versus rest of the cells:&nbsp;')
			this.dom.deselect = label.append('select').on('change', e => {
				const display = this.dom.deselect.node().value ? 'inline-block' : 'none'
				const cluster = this.dom.deselect.node().value.split(' ')[1]
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { cluster, gene: null } })
				this.dom.GSEAbt.style('display', display)
			})
			this.dom.deselect.append('option').text('')

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
							// if getPlotHolder is defined, use this.mainDivId as insertBefore,
							// so that in GDC frontend framework, plots that are launched from scRNAseq
							// will be inserted before it. TODO: may insert after the scRNAseq plot instead???
							insertBefore: this.app.opts?.app?.getPlotHolder ? this.mainDivId : this.id
						}
						this.app.dispatch({
							type: 'plot_create',
							config
						})
					})
			this.dom.DETableDiv = deDiv.append('div').style('padding-top', '10px')
		}

		this.settings = {}

		document.addEventListener('scroll', event => this?.tip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.tip.hide())
	}

	renderShowPlots(showDiv, state) {
		showDiv.append('label').text('Plots:').style('font-size', '1.1em')

		for (const plot of state.config.plots) {
			const id = plot.name.replace(/\s+/g, '')
			const key = `show${id}`
			showDiv
				.append('input')
				.attr('type', 'checkbox')
				.attr('id', key)
				.property('checked', plot.selected)
				.on('change', e => {
					let plots = structuredClone(this.state.config.plots)
					plots.find(p => p.name == plot.name).selected = e.target.checked
					const selectedPlots = plots.filter(p => p.selected)
					const width = 1000
					const height = 1000
					let settings = {}
					settings.svgh = width / selectedPlots.length
					settings.svgw = height / selectedPlots.length
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { plots, settings: { singleCellPlot: settings } }
					})
				})
			showDiv.append('label').attr('for', key).text(plot.name)
		}
	}

	renderGeneExpressionControls(geDiv, state) {
		this.dom.searchboxDiv = geDiv.append('div').style('display', 'inline-block')
		this.dom.geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.app.opts.genome,
			row: this.dom.searchboxDiv,
			searchOnly: 'gene',
			placeholder: state.config.gene || 'Gene',
			callback: () => this.colorByGeneExp(),
			emptyInputCallback: () => this.colorByGeneExp(),
			hideHelp: true,
			focusOff: true
		})
		this.dom.searchbox = this.dom.geneSearch?.searchbox

		this.dom.colorBySelect = geDiv
			.append('select')
			.style('display', state.config.gene ? 'inline-block' : 'none')
			.style('margin-left', '20px')

		this.dom.colorBySelect.on('change', async () => {
			const plot = state.termdbConfig?.queries.singleCell.data.plots[0]
			const columnName = plot.columnName
			const args = {
				sample: state.config.sample.sampleName,
				columnName,
				category: this.dom.colorBySelect.node().value
			}
			const result = await this.app.vocabApi.getTopTermsByType(args)
		})

		this.dom.violinBt = geDiv
			.append('button')
			.text('Open violin')
			.style('margin-left', '2px')
			.style('display', state.config.gene ? 'inline-block' : 'none')
		this.dom.violinBt.on('click', () => {
			const gene = this.dom.geneSearch.geneSymbol || state.config.gene
			const columnName = this.dom.colorBySelect.node().value
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

	async setActiveTab(tab) {
		if (!this.state) return
		await this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeTab: tab } })
	}

	showActiveTab() {
		const tab = this.state.config.activeTab || this.tabs[0].id
		switch (tab) {
			case SAMPLES_TAB:
				this.dom.headerDiv.style('display', 'block')
				this.dom.tableDiv.style('display', 'block')
				this.dom.showDiv.style('display', 'none')
				this.dom.deDiv.style('display', 'none')
				this.dom.geDiv.style('display', 'none')

				break
			case PLOTS_TAB:
				this.dom.headerDiv.style('display', 'block')
				this.dom.tableDiv.style('display', 'none')
				this.dom.showDiv.style('display', 'block')
				this.dom.deDiv.style('display', 'none')
				this.dom.geDiv.style('display', 'none')
				break
			case COLORBY_TAB:
				this.dom.headerDiv.style('display', 'none')
				this.dom.geDiv.style('display', 'none')
				this.dom.deDiv.style('display', 'none')
				this.dom.tableDiv.style('display', 'none')
				this.dom.showDiv.style('display', 'none')
				break
			case GENE_EXPRESSION_TAB:
				this.dom.headerDiv.style('display', 'block')
				this.dom.deDiv.style('display', 'none')
				this.dom.geDiv.style('display', 'inline-block')
				this.dom.tableDiv.style('display', 'none')
				this.dom.showDiv.style('display', 'none')
				this.dom.searchbox.node().focus()
				if (this.state.config.gene) this.dom.searchbox.node().value = this.state.config.gene
				this.fillColorBy()
				break
			case DIFFERENTIAL_EXPRESSION_TAB:
				this.dom.headerDiv.style('display', 'block')
				this.dom.deDiv.style('display', 'inline-block')
				this.dom.geDiv.style('display', 'none')
				this.dom.tableDiv.style('display', 'none')
				this.dom.showDiv.style('display', 'none')
				this.renderDETable()
				break
		}
	}

	addZoomIcons(iconsDiv, plot) {
		const zoomInDiv = iconsDiv.append('div').style('margin', '20px')
		icon_functions['zoomIn'](zoomInDiv, {
			handler: () => {
				plot.particles.position.z += 0.1
			},
			title: 'Zoom in. You can also zoom in moving the mouse wheel with the Ctrl key pressed.'
		})
		const zoomOutDiv = iconsDiv.append('div').style('margin', '20px')
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: () => {
				plot.particles.position.z -= 0.1
			},
			title: 'Zoom out. You can also zoom out moving the mouse wheel with the Ctrl key pressed.'
		})
		const identityDiv = iconsDiv.append('div').style('margin', '20px')
		icon_functions['restart'](identityDiv, {
			handler: () => {
				plot.particles.position.z = 0
				plot.particles.position.x = 0
				plot.particles.position.y = 0
			},
			title: 'Reset plot to defaults'
		})
	}

	async renderDETable() {
		const DETableDiv = this.dom.DETableDiv
		DETableDiv.selectAll('*').remove()

		const categoryName = this.state.config.cluster
		this.dom.deselect.node().value = `Cluster ${categoryName}` || ''
		if (this.dom.GSEAbt) this.dom.GSEAbt.style('display', categoryName ? 'inline-block' : 'none')
		if (!categoryName) return
		const columnName = this.state.termdbConfig.queries.singleCell.DEgenes.columnName
		const sample =
			this.state.config.experimentID || this.state.config.sample || this.samples?.[0]?.experiments[0]?.experimentID
		const args = { genome: this.state.genome, dslabel: this.state.dslabel, categoryName, sample, columnName }
		this.dom.loadingDiv.selectAll('*').remove()
		this.dom.loadingDiv.style('display', '').append('div').attr('class', 'sjpp-spinner')
		const result = await dofetch3('termdb/singlecellDEgenes', { body: args })
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
		const selectedRows = []
		let i = 0
		for (const gene of result.genes) {
			const row = [
				{ value: gene.name },
				{ value: roundValueAuto(gene.avg_log2FC) },
				{ value: roundValueAuto(gene.p_val_adj) }
			]
			rows.push(row)
			this.genes.push(gene.name)
			this.fold_changes.push(gene.avg_log2FC)
			if (gene.name == this.state.config.gene) selectedRows.push(i)
			i++
		}
		renderTable({
			rows,
			columns,
			maxWidth: '50vw',
			maxHeight: '20vh',
			div: DETableDiv,
			singleMode: true,
			noButtonCallback: (i, node) => {
				const gene = result.genes[i].name
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						gene,
						sample: this.state.config.sample || this.samples?.[0]?.sample,
						experimentID: this.state.config.experimentID || this.samples?.[0].experiments?.[0]?.experimentID
					}
				})
			},
			selectedRows
		})
		DETableDiv.append('div')
			.style('font-size', '0.9rem')
			.style('padding-top', '5px')
			.text('Select a gene to view its expression.')
		this.dom.loadingDiv.style('display', 'none')
	}

	colorByGeneExp() {
		const gene = this.dom.searchbox.node().value

		for (const div of this.plotColorByDivs) div.style('display', 'none')
		this.dom.violinBt?.style('display', gene ? 'inline-block' : 'none')
		this.dom.colorBySelect?.style('display', gene ? 'inline-block' : 'none')

		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: {
				gene,
				sample: this.state.config.sample || this.samples?.[0]?.sample,
				experimentID: this.state.config.experimentID || this.samples?.[0].experiments?.[0]?.experimentID
			}
		})
	}

	async setControls() {
		this.dom.controlsHolder.selectAll('*').remove()
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
				label: 'Sample size',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'sampleSizeThree',
				title: 'Sample size',
				min: 0.001,
				max: 0.1,
				step: 0.001
			},
			{
				label: 'Show grid',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showGrid',
				title: 'Show grid'
			},
			{
				label: 'Show no expression',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showNoExpCells',
				title: 'Show cells without expression'
			},
			{
				label: 'Max expression percentile',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'maxGeneExpPercentile',
				title: 'Max gene expression percentile, by default 0.95, representing the 95th percentile',
				min: 0.01,
				max: 0.99
			}
		]

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
		try {
			this.colorByGene =
				this.state.config.activeTab == GENE_EXPRESSION_TAB || this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB
			this.config = structuredClone(this.state.config) // this config can be edited to dispatch changes
			copyMerge(this.settings, this.config.settings.singleCellPlot)
			this.plotColorByDivs = []

			this.dom.loadingDiv.selectAll('*').remove()
			this.dom.loadingDiv.style('display', '').append('div').attr('class', 'sjpp-spinner')
			this.legendRendered = false
			this.showActiveTab()
			this.data = await this.getData()
			if (this.data.error) throw this.data.error
			this.dom.loadingDiv.style('display', 'none')
			this.renderPlots(this.data)
			await this.setControls()
			if (this.dom.header)
				this.dom.header.html(` ${this.state.config.sample || this.samples[0].sample} single cell data`)
		} catch (e) {
			this.app.tip.hide()
			this.dom.loadingDiv.style('display', 'none')
			this.dom.plotsDiv.style('display', 'none')
			if (e.stack) console.log(e.stack)
			sayerror(this.dom.errorDiv, e)
		}
	}

	fillColorBy() {
		// Only add unique colorColumn among plots as option
		const uniqueColorColumns = new Set()
		if (this.dom.colorBySelect) {
			this.dom.colorBySelect.selectAll('*').remove()
			for (const plot of this.state.termdbConfig?.queries.singleCell.data.plots) {
				const colorColumn = this.state.config.colorBy?.[plot.name] || plot.colorColumns[0]
				if (!uniqueColorColumns.has(colorColumn) && plot.selected) {
					this.dom.colorBySelect.append('option').text(colorColumn)
					uniqueColorColumns.add(colorColumn)
				}
			}
		}
	}

	async getData() {
		const plots = []
		for (const plot of this.config.plots) {
			if (plot.selected) plots.push(plot.name)
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
		if (
			this.state.config.gene &&
			(this.state.config.activeTab == GENE_EXPRESSION_TAB || this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB)
		)
			body.gene = this.state.config.gene
		else body.colorBy = this.state.config.colorBy
		try {
			const result = await dofetch3('termdb/singlecellData', { body })
			if (result.error) throw result.error
			this.refName = result.refName
			return result
		} catch (e) {
			if (e.stack) console.log(e.stack)
			return { error: e }
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
			this.plots.push(plot)
			const expCells = plot.expCells.sort((a, b) => a.geneExp - b.geneExp)
			plot.maxGeneExp = expCells[Math.floor(expCells.length * this.settings.maxGeneExpPercentile)]?.geneExp
			plot.cells = [...plot.noExpCells, ...expCells]
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
		if (
			this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB &&
			!this.legendRendered &&
			this.state.termdbConfig?.queries?.singleCell?.DEgenes
		) {
			//first plot
			this.dom.deselect.selectAll('*').remove()
			this.dom.deselect.append('option').text('')
			for (const cluster of plot.clusters) this.dom.deselect.append('option').text(cluster)
			if (this.state.config.cluster) this.dom.deselect.node().value = `Cluster ${this.state.config.cluster}` || ''
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

		//used to plot the cells
		this.initAxes(plot)
		const plotDiv = this.dom.plotsDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const leftDiv = plotDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		plot.plotDiv = plotDiv.append('div').style('overflow', 'hidden').style('display', 'inline-block')

		this.addZoomIcons(leftDiv, plot)

		//.style('flex-grow', 1)
		plot.headerDiv = plot.plotDiv.append('div')
		plot.headerDiv.append('label').text(plot.name).style('font-size', '1.2em').style('margin-right', '10px')
		if (this.colorByGene && this.state.config.gene) {
			// for gene expression sc plot, needs to add colorGenerator to plot even
			// when legend is not needed for the plot
			const colorGradient = rgb(plotColor)
			if (!this.config.startColor[plot.name]) this.config.startColor[plot.name] = 'white'
			if (!this.config.stopColor[plot.name]) this.config.stopColor[plot.name] = colorGradient.darker(3).toString()
			const startColor = this.config.startColor[plot.name]
			const stopColor = this.config.stopColor[plot.name]
			let min, max
			const expCells = plot.expCells

			const values = expCells.map(cell => cell.geneExp)
			if (values.length == 0) {
				plot.colorGenerator = null
			} else {
				if (this.state.config.min) {
					min = this.state.config.min
					max = this.state.config.max
				} else {
					;[min, max] = values.reduce((s, d) => [d < s[0] ? d : s[0], d > s[1] ? d : s[1]], [values[0], values[0]])
					min = 0 //force min to start in cero
				}
				plot.colorGenerator = d3Linear().domain([min, plot.maxGeneExp]).range([startColor, stopColor])
				plot.min = min
				plot.max = max
			}
		}
		this.renderLargePlotThree(plot)
		this.renderLegend(plot)
	}

	getOpacity(d) {
		if (this.config.hiddenClusters.includes(d.category)) return 0
		if (this.colorByGene && this.state.config.gene && !d.geneExp)
			return this.settings.showNoExpCells ? this.settings.opacity : 0
		return this.settings.opacity
	}

	getColor(d, plot) {
		if (!this.colorByGene || !this.state.config.gene) return plot.colorMap[d.category]
		else if (this.colorByGene && this.state.config.gene) {
			if (!d.geneExp) return noExpColor
			if (d.geneExp > plot.maxGeneExp) return plot.colorGenerator(plot.maxGeneExp)
			else return plot.colorGenerator(d.geneExp)
		}
	}

	handleZoom(e, plot) {
		plot.mainG.attr('transform', e.transform)
	}

	initAxes(plot) {
		if (!plot.cells.length) return
		const s0 = plot.cells[0]
		const [xMin, xMax, yMin, yMax] = plot.cells.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		plot.xAxisScale = d3Linear().domain([xMin, xMax]).range([-1, 1])
		plot.yAxisScale = d3Linear().domain([yMin, yMax]).range([-1, 1])
	}

	renderLegend(plot) {
		const colorMap = plot.colorMap
		let legendSVG = plot.legendSVG
		if (!plot.legendSVG) {
			const activeTab = this.tabs.find(tab => tab.active)
			if (activeTab.id == COLORBY_TAB) {
				const app = this.app
				const plotColorByDiv = plot.headerDiv
					.append('div')
					.style('display', 'inline-block')
					.style('padding-bottom', '20px')
				plotColorByDiv.append('label').text('Color by:').style('margin-right', '5px')
				const colorBySelect = plotColorByDiv.append('select')
				this.plotColorByDivs.push(plotColorByDiv)
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

		this.legendRendered = true

		const legendG = legendSVG.append('g').attr('transform', `translate(20, 0)`).style('font-size', '0.9em')
		if (
			this.state.config.activeTab == GENE_EXPRESSION_TAB ||
			this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB
		) {
			if (this.state.config.gene) this.renderColorGradient(plot, legendG, this.state.config.gene)
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
			itemG.append('circle').attr('r', 5).attr('fill', color)
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
		if (plot.cells.length == 0 || !plot.colorGenerator) return
		const colors = [this.config.startColor[plot.name], this.config.stopColor[plot.name]]

		let offsetY = 25
		const step = 20
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
			domain: [plot.min, plot.max],
			position: '0, 20',
			ticks: 4,
			tickSize: 5,
			topTicks: true,
			cutoffMode: this.state.config.min || this.state.config.max ? 'fixed' : 'auto',
			setColorsCallback: (val, idx) => {
				this.changeGradientColor(plot, val, idx)
			}
			// setMinMaxCallback: obj => {
			// 	if (obj.cutoffMode == 'auto') {
			// 		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { min: null, max: null } })
			// 	} else if (obj.cutoffMode == 'fixed') {
			// 		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { min: obj.min, max: obj.max } })
			// 	}
			// }
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

			let td = tr.append('td')
			td.text(d.category)

			if ('geneExp' in d) {
				tr = table.append('tr')
				tr.append('td').style('color', '#aaa').text('Gene expression')
				td = tr.append('td')
				const svg = td.append('svg').attr('width', 150).attr('height', 20)
				const x = 10
				const y = 12
				const g = svg.append('g').attr('transform', `translate(${x}, ${y})`)
				g.append('circle').attr('fill', this.getColor(d, plot)).attr('r', 4)
				svg
					.append('g')
					.attr('transform', `translate(${x + 15}, ${y + 4})`)
					.append('text')
					.text(roundValueAuto(d.geneExp))
			}
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
	}

	async renderSamplesTable(div, state) {
		// need to do this after the this.samples has been set
		if (this.samples.length == 0) {
			this.dom.plotsDiv.selectAll('*').remove()
			this.showNoMatchingDataMessage()

			return
		}

		div.selectAll('*').remove()
		const [rows, columns] = await this.getTableData(state)
		const selectedRows = []
		let maxHeight = '20vh'
		const selectedSample = state.config.sample
		const selectedRow = this.samples.findIndex(s => s.sample == selectedSample)
		const selectedRowIndex = selectedRow == -1 ? 0 : selectedRow
		selectedRows.push(selectedRowIndex)
		renderTable({
			rows,
			columns,
			resize: true,
			singleMode: true,
			div,
			maxWidth: columns.length > 3 ? '90vw' : '40vw',
			maxHeight,
			noButtonCallback: index => {
				const sample = rows[index][0].value
				const config = { chartType: 'singleCellPlot', sample }
				if (rows[index][0].__experimentID) {
					config.experimentID = rows[index][0].__experimentID
				}

				this.app.dispatch({ type: 'plot_edit', id: this.id, config })
			},
			selectedRows,
			striped: true
		})
	}

	async getTableData(state) {
		const samples = this.samples
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
				label: (await this.app.vocabApi.getterm(c.termid)).name,
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

	renderLargePlotThree = async function (plot) {
		plot.canvas = plot.plotDiv.append('canvas').node()
		plot.canvas.width = this.settings.svgw
		plot.canvas.height = this.settings.svgh

		const DragControls = await import('three/examples/jsm/controls/DragControls.js')
		const OrbitControls = await import('three/addons/controls/OrbitControls.js')

		const fov = this.settings.threeFOV
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()
		camera.position.set(0, 0, 2)
		camera.lookAt(scene.position)
		camera.updateMatrix()
		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor

		const geometry = new THREE.BufferGeometry()
		const { vertices, colors } = this.getVertices(plot)

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
		const tex = getThreeCircle(256)
		const material = new THREE.PointsMaterial({
			size: this.settings.sampleSizeThree,
			sizeAttenuation: true,
			transparent: true,
			opacity: this.settings.opacity,
			map: tex,
			vertexColors: true
		})

		const particles = new THREE.Points(geometry, material)
		plot.particles = particles

		scene.add(particles)
		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: plot.canvas, preserveDrawingBuffer: true })
		renderer.setSize(this.settings.svgw, this.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)

		const controls = new DragControls.DragControls([particles], camera, renderer.domElement)

		plot.canvas.addEventListener('mousewheel', event => {
			if (!event.ctrlKey) return
			event.preventDefault()
			if (event.ctrlKey) particles.position.z -= event.deltaY / 500
		})

		const self = this
		function animate() {
			requestAnimationFrame(animate)
			renderer.render(scene, camera)
		}
		animate()
		if (this.settings.showGrid) this.renderThreeGrid(scene)

		// Function to get mouse position in normalized device coordinates (-1 to +1)
		function getMouseNDC(event) {
			const rect = renderer.domElement.getBoundingClientRect()
			return new THREE.Vector2(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				(-(event.clientY - rect.top) / rect.height) * 2 + 1
			)
		}
	}

	renderThreeGrid(scene) {
		let x = -1
		// Line Geometry
		const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffd3d3d3 })

		const lines = 8
		const step = 3 / lines

		for (let i = 0; i < lines; i++) {
			let points = []
			points.push(new THREE.Vector3(x, 1.5, 0))
			points.push(new THREE.Vector3(x, -1.5, 0))
			let lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
			let line = new THREE.Line(lineGeometry, lineMaterial)
			scene.add(line)
			points = []
			points.push(new THREE.Vector3(-1.5, x, 0))
			points.push(new THREE.Vector3(1.5, x, 0))
			lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
			line = new THREE.Line(lineGeometry, lineMaterial)
			scene.add(line)
			x += step
		}
	}

	getVertices(plot) {
		const vertices = []
		const colors = []
		for (const c of plot.cells) {
			const opacity = this.getOpacity(c)
			if (opacity == 0) continue
			let x = plot.xAxisScale(c.x)
			let y = plot.yAxisScale(c.y)
			const rgbColor = rgb(this.getColor(c, plot))
			vertices.push(x, y, 0)
			colors.push(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255)
		}
		return { vertices, colors }
	}
}

export const scatterInit = getCompInit(singleCellPlot)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export async function getPlotConfig(opts, app) {
	try {
		const data = app.vocabApi.termdbConfig?.queries?.singleCell?.data
		const plots = data?.plots
		let settings = getDefaultSingleCellSettings()
		if (data.settings)
			for (const key in data.settings) {
				settings[key] = data.settings[key]
			}

		const config = {
			hiddenClusters: [],
			settings: {
				singleCellPlot: settings,
				controls: { isOpen: false }
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
		svgw: 1000,
		svgh: 1000,
		showGrid: true,
		sampleSize: 1.5,
		sampleSizeThree: 0.008,
		threeFOV: 60,
		opacity: 1,
		maxGeneExpPercentile: 0.95,
		showNoExpCells: false
	}
}
