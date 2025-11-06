import { getCompInit, copyMerge, deepEqual } from '../rx/index.js'
import { scaleLinear as d3Linear } from 'd3-scale'
import { dofetch3 } from '#common/dofetch'
import { getColors } from '#shared/common.js'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '#common/svg.download'
import { select } from 'd3-selection'
import { rgb, create, extent } from 'd3'
import { roundValueAuto } from '#shared/roundValue.js'
import { TermTypes } from '#shared/terms.js'
import {
	ColorScale,
	icons as icon_functions,
	addGeneSearchbox,
	renderTable,
	sayerror,
	Menu,
	Tabs,
	downloadTable
} from '#dom'
import * as THREE from 'three'
import { getThreeCircle } from './scatter/viewmodel/scatterViewModel2DLarge.js'
import { renderContours } from './scatter/viewmodel/scatterViewModel.js'
import { digestMessage } from '#termsetting'

/*

hardcoded behaviors when this.samples[].experiments[] is present:

- all samples must either have or not have .experiments[]
- experiments[] supports tracking multiple experiments done on same sample
- an experiment must be {experimentID,sampleName} along with optional prop
- state tracks experimentID as well as this.samples[].sample
- in sample table, both experimentID and sampleName are shown

this
	samples[]
		datastructure returned by /termdb/singlecellSamples
		
		element structure:

		{
			sample: str
			<termid>: <term value>
			experiments?: []
				experimentID: str // required to track which table row is selected and for backend to retrieve data for
				sampleName: str // for display
		}


	legendRendered=bool

	state{}
		config{}
			sample // name of selected sample. matches to this.samples[].sample
			experimentID // optional. set when this.samples[].experiments[] is present. allow to match to a specific experiment of a sample that has multiples

*/

const SAMPLES_TAB = 1
const PLOTS_TAB = 2
const DIFFERENTIAL_EXPRESSION_TAB = 3
const GENE_EXPRESSION_TAB = 4
const IMAGES_TAB = 5
const VIOLIN_TAB = 6
const noExpColor = '#F5F5F5' //lightGray
const DE_GENES_TAB = 8
const DE_GSEA_TAB = 7

class singleCellPlot {
	constructor() {
		this.type = 'singleCellPlot'

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 0 })
		this.tip.d.style('max-height', '300px').style('overflow', 'scroll').style('font-size', '0.9em')
		this.startGradient = {}
		this.stopGradient = {}
	}

	async init(appState) {
		// generate sample table in init() but not main() is because sample table is constant and no need to update it on dispatch
		// TODO sample table still needs to be changed when gdc (external portal) cohort changes

		const state = this.getState(appState)
		if (this.opts.header) this.opts.header.html(`SINGLE CELL PLOT`).style('font-size', '0.9em')

		// need to set the this.samples based on the current filter0

		this.tabs = []
		const activeTab = state.config.activeTab
		// shared isVisible function for tabs that require config.sample;
		// note that tab.isVisible() will be called on tab.update(), which
		// is called in main() -> showActiveTab() below
		const isVisible = () => this.isValidSample

		this.tabs.push({
			label: 'Samples',
			id: SAMPLES_TAB,
			isVisible,
			active: activeTab == SAMPLES_TAB,
			callback: () => this.setActiveTab(SAMPLES_TAB)
		})
		this.tabs.push({
			label: 'Plots',
			id: PLOTS_TAB,
			active: activeTab == PLOTS_TAB,
			isVisible,
			callback: () => this.setActiveTab(PLOTS_TAB)
		})
		if (state.termdbConfig.queries.singleCell.DEgenes) {
			this.tabs.push({
				label: 'Differential Expression',
				id: DIFFERENTIAL_EXPRESSION_TAB,
				active: activeTab == DIFFERENTIAL_EXPRESSION_TAB,
				isVisible,
				callback: () => this.setActiveTab(DIFFERENTIAL_EXPRESSION_TAB)
			})
		}
		if (state.termdbConfig.queries.singleCell.geneExpression)
			this.tabs.push({
				label: 'Gene Expression',
				id: GENE_EXPRESSION_TAB,
				active: activeTab == GENE_EXPRESSION_TAB,
				isVisible,
				callback: () => this.setActiveTab(GENE_EXPRESSION_TAB)
			})

		// summary tab is not limited to geneExp, as later it can be applied to cell category terms too (if there are multiple)
		this.tabs.push({
			label: 'Summary',
			id: VIOLIN_TAB,
			active: activeTab == VIOLIN_TAB,
			isVisible,
			callback: () => this.setActiveTab(VIOLIN_TAB)
		})

		if (state.termdbConfig.queries.singleCell.images)
			this.tabs.push({
				label: state.termdbConfig.queries.singleCell.images.label,
				id: IMAGES_TAB,
				active: activeTab == IMAGES_TAB,
				isVisible,
				callback: () => this.setActiveTab(IMAGES_TAB)
			})
		const q = state.termdbConfig.queries
		this.opts.holder.style('position', 'relative').style('min-height', '200px')
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

		const contentDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding-left', '10px')
			.style('min-height', '300px')
		this.tabsComp = await new Tabs({
			holder: contentDiv,
			tabsPosition: 'horizontal',
			tabs: this.tabs
		})
		this.tabsComp.main()
		const headerDiv = contentDiv.append('div').style('display', 'inline-block').style('padding-bottom', '10px')

		const samplesPromptDiv = headerDiv
			.append('div')
			.style('display', 'none')
			.text('Select a sample below to see its data:')
			.style('padding', '0px 40px 10px 10px')
		const showDiv = headerDiv.append('div').style('padding-bottom', '10px').style('display', 'none')

		if (state.config.plots.length > 1) this.renderShowPlots(showDiv, state)
		// div to show optional DE genes (precomputed by seurat for each cluster, e.g. via gdc)
		const geDiv = headerDiv.append('div').style('display', 'none')
		const violinSelectDiv = headerDiv.append('div').style('padding-left', '30px').style('display', 'none')
		const deDiv = headerDiv.append('div').style('display', 'none')
		const sampleDiv = headerDiv
			.append('div')
			.style('display', 'inline-block')
			.html(await this.getSampleDetails(state))
			.style('padding', '10px 20px')
		const plotsDivParent = contentDiv.append('div')
		const samplesTableDiv = plotsDivParent.append('div').style('padding-bottom', '10px')

		const plotsDiv = plotsDivParent
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')

		const loadingDiv = this.opts.holder
			.append('div')
			.style('position', 'absolute')
			.style('top', '0')
			.style('left', '0')
			.style('width', '100%')
			.style('height', '100%')
			.style('background-color', 'rgba(255, 255, 255, 0.95)')
			.style('text-align', 'center')

		this.dom = {
			sampleDiv,
			samplesPromptDiv,
			samplesTableDiv,
			showDiv,
			mainDiv,
			loadingDiv,
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder: controlsDiv,
			geDiv,
			violinSelectDiv,
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
				this.genes = null
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { cluster, gene: null } })
			})
			this.dom.deselect.append('option').text('')
		}

		this.settings = {}

		document.addEventListener('scroll', event => this?.tip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.tip.hide())
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
			termfilter: appState.termfilter,
			vocab: appState.vocab
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.dom.mainDiv.style('display', 'block') // show the main div in case it was hidden because no data was found
		this.dom.loadingDiv.selectAll('*').remove()
		this.dom.loadingDiv
			.style('display', '')
			.append('div')
			.style('position', 'relative')
			.style('top', '50%')
			.text('Loading...')
		try {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				filter0: this.state.termfilter.filter0 || null
			}
			const result = await dofetch3('termdb/singlecellSamples', { body })
			if (result.error) throw result.error
			this.samples = result.samples
			if (this.samples.length == 0) {
				this.showNoMatchingDataMessage()
				return
			}
			this.isValidSample = this.state.config.sample && this.samples.find(i => i.sample == this.state.config.sample)
			this.colorByGene =
				this.state.config.activeTab == GENE_EXPRESSION_TAB || this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB
			this.config = structuredClone(this.state.config) // this config can be edited to dispatch changes
			copyMerge(this.settings, this.config.settings.singleCellPlot)
			this.plotColorByDivs = []
			this.plots = []

			this.legendRendered = false
			this.dom.plotsDiv.selectAll('*').remove()
			await this.getData()
			await this.setControls()
			this.dom.sampleDiv.html(await this.getSampleDetails(this.state))
			this.showActiveTab()
			this.dom.loadingDiv.style('display', 'none')
		} catch (e) {
			this.app.tip.hide()
			this.dom.loadingDiv.style('display', 'none')
			if (e.stack) console.log(e.stack)
			sayerror(this.dom.errorDiv, e)
		}
	}

	async getData() {
		if (!this.state.config.sample) return
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
		// a sample has already been selected
		body.sample = {
			eID: this.state.config.experimentID,
			sID: this.state.config.sample
		}
		if (
			this.state.config.gene &&
			(this.state.config.activeTab == GENE_EXPRESSION_TAB || this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB)
		)
			body.gene = this.state.config.gene
		else body.colorBy = this.state.config.colorBy
		//if error it will be catched on main
		const result = await dofetch3('termdb/singlecellData', { body })
		if (result.error) throw result.error
		this.refName = result.refName
		this.data = result
	}

	async getSampleDetails(state) {
		if (!this.samples) return ''
		const sampleIdx = this.samples.findIndex(i => i.sample == state.config.sample)
		if (sampleIdx == -1) return ''

		const extraText = [] // extra text to show alongside sample name

		if (state.config.experimentID) {
			// experimentID is tracked in state, meaning this.samples[].experiments[] is present. and the id specifies which experiment, out of potential multiple of one sample, is currently selected.
			// in such case, experiments[].sampleName should also be present, and display the sampleName next to config.sample which is actually person id
			extraText.push(
				'<span style="margin-left:15px;font-size:.7em">SAMPLE</span> ' +
					this.samples[sampleIdx].experiments?.find(i => i.experimentID == state.config.experimentID)?.sampleName
			)
		} else if (this.samples[sampleIdx].experiments) {
			// experimentID not in state, but sample carries exp array; this is possible when app launches. simply show first experiment of this sample
			extraText.push(
				'<span style="margin-left:15px;font-size:.7em">SAMPLE</span> ' +
					this.samples[sampleIdx].experiments[0].sampleName
			)
		}

		if (state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel) {
			// value is a term id. get the term name
			const termname = (
				await this.app.vocabApi.getterm(state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel)
			).name
			// get the term value from current sample
			const sampleValue = this.samples[sampleIdx][state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel]
			extraText.push(`<span style="margin-left:15px;font-size:.7em">${termname.toUpperCase()}</span> ${sampleValue}`)
		}

		return `<span style="font-size:.7em">${state.config.settings.singleCellPlot.uiLabels.sample.toUpperCase()}</span>
			${this.samples[sampleIdx].sample}
			${extraText.join('')}`
	}

	async getSampleFilename(state) {
		const sampleIdx = this.samples.findIndex(i => i.sample == state.config.sample)
		if (sampleIdx == -1) return ''

		const extraText = [] // extra text to show alongside sample name

		if (state.config.experimentID) {
			// experimentID is tracked in state, meaning this.samples[].experiments[] is present. and the id specifies which experiment, out of potential multiple of one sample, is currently selected.
			// in such case, experiments[].sampleName should also be present, and display the sampleName next to config.sample which is actually person id
			extraText.push(
				'SAMPLE_' +
					this.samples[sampleIdx].experiments?.find(i => i.experimentID == state.config.experimentID)?.sampleName
			)
		} else if (this.samples[sampleIdx].experiments) {
			// experimentID not in state, but sample carries exp array; this is possible when app launches. simply show first experiment of this sample
			extraText.push('SAMPLE_' + this.samples[sampleIdx].experiments[0].sampleName)
		}

		if (state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel) {
			// value is a term id. get the term name
			const termname = (
				await this.app.vocabApi.getterm(state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel)
			).name
			// get the term value from current sample
			const sampleValue = this.samples[sampleIdx][state.termdbConfig.queries.singleCell.samples.extraSampleTabLabel]
			extraText.push(`${termname.toUpperCase()}_${sampleValue}`)
		}
		if (this.state.config.activeTab == GENE_EXPRESSION_TAB) extraText.push(this.state.config.gene)
		if (this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB) extraText.push(this.state.config.cluster)
		if (this.state.config.activeTab == VIOLIN_TAB && this.dom.expressionBySelect)
			extraText.push(this.dom.expressionBySelect.node().value)

		const filename = `${state.config.settings.singleCellPlot.uiLabels.sample.toUpperCase()}_
			${this.samples[sampleIdx].sample}_
			${extraText.join('_')}`

		return filename.replace(/[^0-9a-z_]/gi, '')
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
					const selectedCount = plots.filter(p => p.selected).length
					const defaultSettings = getDefaultSingleCellSettings()
					let settings = { svgw: defaultSettings.svgw, svgh: defaultSettings.svgh }

					if (selectedCount > 1) {
						const width = 800
						const height = 800
						settings.svgh = width / selectedCount
						settings.svgw = height / selectedCount
						settings.contourBandwidth = 10
					}
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
	}

	async setActiveTab(tab) {
		if (!this.state) return
		await this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeTab: tab } })
	}

	async showActiveTab() {
		let id = this.state.config.activeTab || this.tabs[0].id
		if (!this.isValidSample && id != SAMPLES_TAB) {
			id = SAMPLES_TAB
			this.config.activeTab = SAMPLES_TAB
		}
		const index = this.tabs.findIndex(t => t.id == id)
		const tab = this.tabs[index]
		tab.active = true
		this.tabsComp.update(index)

		this.dom.deDiv.style('display', 'none')
		this.dom.geDiv.style('display', 'none')
		this.dom.showDiv.style('display', 'none')
		this.dom.violinSelectDiv.style('display', 'none')
		this.dom.samplesTableDiv.style('display', 'none')
		this.dom.samplesPromptDiv.style('display', 'none')
		this.dom.controlsHolder.style('display', 'none')
		switch (id) {
			case SAMPLES_TAB:
				this.dom.samplesTableDiv.style('display', 'block')
				this.dom.samplesPromptDiv.style('display', 'inline-block')
				this.renderSamplesTable()
				break
			case PLOTS_TAB:
				await this.renderPlots()
				this.dom.showDiv.style('display', 'inline-block')
				this.dom.controlsHolder.style('display', 'block')
				break

			case GENE_EXPRESSION_TAB:
				this.dom.controlsHolder.style('display', 'block')
				await this.renderPlots()
				this.dom.geDiv.style('display', 'inline-block')
				this.dom.searchbox.node().focus()
				if (this.state.config.gene) this.dom.searchbox.node().value = this.state.config.gene
				break
			case DIFFERENTIAL_EXPRESSION_TAB:
				this.dom.deDiv.style('display', 'inline-block')
				this.renderDETable()
				break

			case IMAGES_TAB:
				this.renderImage()
				break
			case VIOLIN_TAB:
				this.dom.geDiv.style('display', 'inline-block')
				this.renderViolinTab()
				this.dom.searchbox.node().focus()
				break
		}
	}

	addZoomIcons(iconsDiv, plot) {
		const zoomInDiv = iconsDiv.append('div').style('margin', '20px 0px')
		icon_functions['zoomIn'](zoomInDiv, {
			handler: () => {
				plot.particles.position.z += 0.1
			},
			title: 'Zoom in. You can also zoom in moving the mouse wheel with the Ctrl key pressed.'
		})
		const zoomOutDiv = iconsDiv.append('div').style('margin', '20px 0px')
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: () => {
				plot.particles.position.z -= 0.1
			},
			title: 'Zoom out. You can also zoom out moving the mouse wheel with the Ctrl key pressed.'
		})
		const identityDiv = iconsDiv.append('div').style('margin', '20px 0px')
		icon_functions['restart'](identityDiv, {
			handler: () => {
				plot.particles.position.z = 0
				plot.particles.position.x = 0
				plot.particles.position.y = 0
			},
			title: 'Reset plot to defaults'
		})
	}

	async renderImage() {
		const sample = this.state.config.sample || this.samples[0].sample
		const i = this.state.termdbConfig.queries.singleCell.images
		const result = await dofetch3(`img?file=${i.folder}${i.folder.endsWith('/') ? '' : '/'}${sample}/${i.fileName}`)
		if (!result.src || result.error) {
			sayerror(this.dom.plotsDiv, 'Cannot load image: ' + (result.error || ''))
			return
		}
		this.dom.plotsDiv.append('img').attr('src', result.src).attr('height', 400)
	}

	async renderViolinTab() {
		if (!this.state.config.gene) return
		const selectDiv = this.dom.violinSelectDiv.style('display', 'inline-block')
		selectDiv.selectAll('*').remove()
		const plotDiv = this.dom.plotsDiv.append('div').style('width', '100%')

		const options = new Set()
		let selectedOption = ''
		for (const plot of this.data.plots) {
			const colorBy = this.state.config.colorBy?.[plot.name] || plot.colorColumns[0]
			if (!selectedOption) selectedOption = colorBy
			for (const c of plot.colorColumns) options.add(c)
		}

		if (options.size > 1) {
			selectDiv.append('label').text('Show expression by: ')
			const expressionBySelect = selectDiv.append('select').on('change', async e => {
				const expressionBy = e.target.value
				violinDiv.selectAll('*').remove()
				this.renderViolin(expressionBy, violinDiv)
			})
			this.dom.expressionBySelect = expressionBySelect
			expressionBySelect
				.selectAll('option')
				.data(Array.from(options))
				.enter()
				.append('option')
				.attr('value', d => d)
				.attr('selected', d => (d == selectedOption ? d : null))
				.html(d => d)
		} else selectDiv.append('label').text(`Expression by ${selectedOption}:`)
		const violinDiv = this.dom.plotsDiv.append('div')
		this.renderViolin(selectedOption, violinDiv)
	}

	async renderViolin(colorBy, violinDiv) {
		const gene = this.state.config.gene
		const plot = this.data.plots.find(p => p.colorColumns.find(c => c == colorBy))
		this.initPlot(plot)
		const values = {}
		for (const cluster of plot.clusters) {
			values[cluster] = { key: cluster, value: cluster }
		}
		const downloadFilename = (await this.getSampleFilename(this.state)) + '_VIOLIN'
		const opts = {
			holder: violinDiv,
			state: {
				vocab: this.state.vocab,
				plots: [
					{
						chartType: 'violin',
						term: {
							$id: await digestMessage(`${gene}-${this.state.config.sample}-${this.state.config.experimentID}`),
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
							$id: await digestMessage(`${colorBy}-${this.state.config.sample}-${this.state.config.experimentID}`),

							term: {
								type: TermTypes.SINGLECELL_CELLTYPE,
								id: colorBy,
								name: colorBy,
								sample: {
									sID: this.state.config.sample,
									eID: this.state.config.experimentID
								},
								//plot and color by are used to read the sample categories from the plot
								plot: plot.name,
								colorBy,
								values
							}
						},
						downloadFilename
					}
				]
			}
		}
		const plotImport = await import('#plots/plot.app.js')
		const plotAppApi = await plotImport.appInit(opts)
	}

	async renderGSEA(holder) {
		const gsea_params = {
			genes: this.genes,
			fold_change: this.fold_changes,
			genome: this.app.vocabApi.opts.state.vocab.genome
		}
		const downloadFilename = (await this.getSampleFilename(this.state)) + '_GSEA'
		const config = {
			chartType: 'gsea',
			gsea_params: gsea_params,
			// if getPlotHolder is defined, use this.mainDivId as insertBefore,
			// so that in GDC frontend framework, plots that are launched from scRNAseq
			// will be inserted before it. TODO: may insert after the scRNAseq plot instead???
			insertBefore: this.app.opts?.app?.getPlotHolder ? this.mainDivId : this.id,
			downloadFilename
		}
		const opts = {
			genome: this.app.opts.genome,
			holder,
			state: {
				vocab: this.state.vocab,
				plots: [config]
			}
		}
		const plotImport = await import('#plots/plot.app.js')
		const plotAppApi = await plotImport.appInit(opts)
	}

	async renderDETable() {
		//first plot
		this.dom.deselect.selectAll('*').remove()
		this.dom.deselect.append('option').text('')
		const plot = this.data.plots[0]
		this.initPlot(plot)
		for (const cluster of plot.clusters) this.dom.deselect.append('option').text(cluster)
		const categoryName = this.state.config.cluster
		this.dom.deselect.node().value = categoryName != undefined ? `Cluster ${categoryName}` : ''
		if (!categoryName) return
		const columnName = this.state.termdbConfig.queries.singleCell.DEgenes.columnName
		const sample =
			this.state.config.experimentID || this.state.config.sample || this.samples?.[0]?.experiments[0]?.experimentID

		const DEContentDiv = this.dom.plotsDiv.append('div').style('width', '100%')

		const tabsDiv = DEContentDiv.append('div')
		const tableDiv = DEContentDiv.append('div')
		const GSEADiv = DEContentDiv.append('div').style('display', 'none')

		let result
		try {
			const args = { genome: this.state.genome, dslabel: this.state.dslabel, categoryName, sample, columnName }
			result = await dofetch3('termdb/singlecellDEgenes', { body: args })
			if (result.error) {
				tableDiv.text(result.error)
				return
			}
			if (!result.data || !result?.data?.length) {
				tableDiv.text('No differentially expressed genes found.')
				return
			}
		} catch (e) {
			if (e.stack) console.error(e.stack)
			else throw `Error fetching DE genes: ${e.message || e} [singleCellPlot.renderDETable()]`
			return
		}

		const tabs = [
			{
				label: 'Differentially Expressed Genes',
				id: DE_GENES_TAB,
				active: true,
				callback: () => showActiveDETab(DE_GENES_TAB)
			}
		]
		if (this.app.opts.genome.termdbs) {
			// assumption is that can run gsea on the differential genes, when the genome-level termdb is available (which is right now geneset dbs)
			tabs.push({
				label: 'Gene Set Enrichment Analysis (GSEA)',
				id: DE_GSEA_TAB,
				active: false,
				callback: () => showActiveDETab(DE_GSEA_TAB)
			})
		}

		function showActiveDETab(id) {
			tableDiv.style('display', 'none')
			GSEADiv.style('display', 'none')
			if (id == DE_GENES_TAB) tableDiv.style('display', 'block')
			if (id == DE_GSEA_TAB) GSEADiv.style('display', 'block')
		}
		if (tabs.length > 1) {
			const deTabs = await new Tabs({
				holder: tabsDiv,
				tabsPosition: 'horizontal',
				tabs
			})
			deTabs.main()
		}

		tableDiv.append('div').style('padding-bottom', '10px').text('Select a gene to view its expression:')

		const tableDivContent = tableDiv.append('div').style('padding-bottom', '10px')
		const columns = [
			{ label: 'Gene', width: '15vw' },
			{ label: 'Log2FC', width: '12vw', barplot: {} },
			{ label: 'Adjusted P-value', width: '12vw' }
		]
		const rows = []
		this.genes = []
		this.fold_changes = []
		result.data.sort((a, b) => b.fold_change - a.fold_change)
		const selectedRows = []
		let i = 0
		for (const gene of result.data) {
			const row = [
				{ value: gene.gene_name },
				{ value: gene.fold_change },
				{ value: roundValueAuto(gene.adjusted_p_value) }
			]
			rows.push(row)
			this.genes.push(gene.gene_name)
			this.fold_changes.push(gene.fold_change)
			if (gene.gene_name == this.state.config.gene) selectedRows.push(i)
			i++
		}
		this.DETable = { rows, columns }
		const downloadFilename = `${await this.getSampleFilename(this.state)}_DE_GENES.tsv`
		renderTable({
			rows,
			columns,
			maxHeight: '50vh',
			div: tableDivContent,
			singleMode: true,
			noButtonCallback: (i, node) => {
				const gene = result.data[i].gene_name
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						gene,
						sample: this.state.config.sample || this.samples?.[0]?.sample,
						experimentID: this.state.config.experimentID || this.samples?.[0].experiments?.[0]?.experimentID,
						activeTab: GENE_EXPRESSION_TAB
					}
				})
			},
			selectedRows,
			resize: true,
			download: { fileName: downloadFilename }
		})
		this.renderGSEA(GSEADiv)
	}

	colorByGeneExp() {
		const gene = this.dom.searchbox.node().value

		for (const div of this.plotColorByDivs) div.style('display', 'none')

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
				title: 'Chart width',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'svgw',
				min: 300,
				max: 1000
			},
			{
				label: 'Chart height',
				title: 'Chart height',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'svgh',
				min: 300,
				max: 1000
			},
			{
				label: 'Dot size',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'sampleSizeThree',
				title: 'Dot size',
				min: 0.001,
				max: 0.1,
				step: 0.001
			},
			{
				label: 'Dot opacity',
				type: 'number',
				chartType: 'singleCellPlot',
				settingsKey: 'opacity',
				title: 'Dot opacity',
				min: 0.1,
				max: 1,
				step: 0.1
			},
			{
				label: 'Show grid',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showGrid',
				title: 'Show grid'
			}
		]
		const enableContour = this.state.config.activeTab == GENE_EXPRESSION_TAB && this.state.config.gene
		if (enableContour)
			inputs.push({
				label: 'Show contour map',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showContour',
				title:
					'Shows the density of point clouds. It uses gene expression to weight the points when calculating the density contours.'
			})
		if (enableContour && this.settings.showContour)
			//enabled and active
			inputs.push(
				{
					label: 'Color contours',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'singleCellPlot',
					settingsKey: 'colorContours'
				},
				{
					label: 'Contour bandwidth',
					type: 'number',
					chartType: 'singleCellPlot',
					settingsKey: 'contourBandwidth',
					title: 'Reduce to increase resolution. ',
					min: 5,
					max: 50,
					step: 5
				},
				{
					label: 'Contour thresholds',
					type: 'number',
					chartType: 'singleCellPlot',
					settingsKey: 'contourThresholds',
					title: 'Dot size',
					min: 5,
					max: 30,
					step: 5
				}
			)
		if (
			(this.state.config.activeTab == GENE_EXPRESSION_TAB ||
				this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB) &&
			this.state.config.gene
		)
			inputs.unshift({
				label: 'Show unexpressed cells',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'singleCellPlot',
				settingsKey: 'showNoExpCells',
				title: 'Show cells not expressing the selected gene'
			})
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs
			})
		}
		this.components.controls.on('downloadClick.singleCellPlot', async () => {
			if (!this.state) return
			const filename = await this.getSampleFilename(this.state)
			if (this.state.config.activeTab == GENE_EXPRESSION_TAB || this.state.config.activeTab == PLOTS_TAB)
				for (const plot of this.plots) this.downloadPlot(plot, filename)
		})
	}

	downloadSCTable(name, table) {
		downloadTable(table.rows, table.columns, name)
	}

	downloadPlot(plot, filename) {
		downloadSingleSVG(plot.legendSVG, filename + '_LEGEND.svg', this.opts.holder.node())
		const downloadImgName = plot.name
		const a = document.createElement('a')
		document.body.appendChild(a)
		const dataURL = plot.canvas.toDataURL()

		a.addEventListener(
			'click',
			() => {
				// Download the image
				a.download = filename + '_' + downloadImgName + '.png'
				a.href = dataURL
				document.body.removeChild(a)
			},
			false
		)
		a.click()
	}

	showNoMatchingDataMessage() {
		this.dom.mainDiv.style('display', 'none')
		this.dom.loadingDiv.selectAll('*').remove()
		this.dom.loadingDiv.style('display', '').append('div').style('font-size', '1.2em').html('No matching cohort data.')
	}

	renderPlots() {
		const result = this.data
		if (result.nodata) return
		for (const plot of result.plots) {
			if (
				(this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB ||
					this.state.config.activeTab == GENE_EXPRESSION_TAB) &&
				this.state.config.gene &&
				!plot.expCells.length
			)
				continue

			this.renderPlot(plot)
		}
		if (this.plots.length == 0) this.dom.plotsDiv.append('div').text('No data to plot')
	}

	renderPlot(plot) {
		if (!plot.plotDiv) {
			const plotDiv = this.dom.plotsDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
			const leftDiv = plotDiv
				.append('div')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('padding-top', '30px')
			plot.plotDiv = plotDiv.append('div').style('display', 'inline-block')
			this.addZoomIcons(leftDiv, plot)
		}
		const colorMap = {}
		this.initPlot(plot)

		const cat2Color = getColors(plot.clusters.length + 2) //Helps to use the same color scheme in different samples
		for (const cluster of plot.clusters)
			colorMap[cluster] = plot.colorMap?.[cluster] ? plot.colorMap[cluster] : cat2Color(cluster)

		plot.colorMap = colorMap

		//used to plot the cells
		this.initAxes(plot)

		//.style('flex-grow', 1)
		plot.headerDiv = plot.plotDiv.append('div')
		plot.headerDiv.append('label').text(plot.name).style('font-size', '1.2em').style('margin-right', '10px')
		if (this.colorByGene && this.state.config.gene) {
			// for gene expression sc plot, needs to add colorGenerator to plot even
			// when legend is not needed for the plot
			if (!this.config.startColor[plot.name]) this.config.startColor[plot.name] = '#fffee0'
			if (!this.config.stopColor[plot.name]) this.config.stopColor[plot.name] = 'red'
			const startColor = this.config.startColor[plot.name]
			const stopColor = this.config.stopColor[plot.name]
			let min, max
			const expCells = plot.expCells

			const values = expCells.map(cell => cell.geneExp).sort()
			plot.colorValues = values
			if (values.length == 0) {
				plot.colorGenerator = null
			} else {
				switch (this.settings.colorScaleMode) {
					// Fixed mode: Use user-defined min/max values
					// This is useful when you want consistent scaling across different views
					case 'fixed':
						min = this.settings.colorScaleMinFixed
						max = this.settings.colorScaleMaxFixed
						break

					case 'percentile':
						// Percentile mode: Scale based on data distribution
						min = values[0] // Start at the first value of the array for percentile mode
						// Calculate the value at the specified percentile
						// This helps handle outliers by focusing on the main distribution
						const index = Math.floor((values.length * this.settings.colorScalePercentile) / 100)
						max = values[index]
						break

					case 'auto':
					default:
						// Auto mode (default): Use the full range of the data
						// This gives the most accurate representation of the actual data distribution
						min = values[0]
						max = values[values.length - 1] // Since the values are already sorted in ascending
						// order just get the first and last values
						break
				}

				plot.colorGenerator = d3Linear().domain([min, max]).range([startColor, stopColor])
			}
		}
		this.renderLargePlotThree(plot)
		this.renderLegend(plot)
	}

	initPlot(plot) {
		this.plots.push(plot)
		const expCells = plot.expCells.sort((a, b) => a.geneExp - b.geneExp)
		plot.cells = [...plot.noExpCells, ...expCells]
		plot.id = plot.name.replace(/\s+/g, '')
		let clusters = new Set(plot.cells.map(c => c.category))

		plot.clusters = Array.from(clusters).sort((a, b) => {
			const num1 = parseInt(a.split(' ')[1])
			const num2 = parseInt(b.split(' ')[1])
			return num1 - num2
		})
	}

	getOpacity(d) {
		if (this.config.hiddenClusters[d.category]) return 0
		if (this.colorByGene && this.state.config.gene && !d.geneExp)
			return this.settings.showNoExpCells ? this.settings.opacity : 0
		return this.settings.opacity
	}

	getColor(d, plot) {
		let color = plot.colorMap[d.category]
		if (this.colorByGene && this.state.config.gene) {
			if (!d.geneExp) color = noExpColor
			else if (d.geneExp > plot.max) color = plot.colorGenerator(plot.max)
			else color = plot.colorGenerator(d.geneExp)
		}
		return color
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
		const clustersHeight = 20 * Object.keys(colorMap).length + 50 //added 50 for the title and padding
		const height = Math.max(this.settings.svgh, clustersHeight)
		if (!plot.legendSVG) {
			const activeTab = this.tabs.find(tab => tab.active)
			if (activeTab.id == PLOTS_TAB) {
				const app = this.app

				if (plot.colorColumns.length > 1) {
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
			}

			legendSVG = plot.plotDiv
				.append('svg')
				.attr('width', 250)
				.attr('height', height)
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('font-size', '0.9em')

			plot.legendSVG = legendSVG
		}
		legendSVG.selectAll('*').remove()

		this.legendRendered = true

		if (
			(this.state.config.activeTab == GENE_EXPRESSION_TAB ||
				this.state.config.activeTab == DIFFERENTIAL_EXPRESSION_TAB) &&
			this.state.config.gene
		) {
			this.renderColorGradient(plot)
			return
		}
		let x = 20

		plot.legendSVG
			.append('text')
			.attr('transform', `translate(${x}, ${25})`)
			.style('font-weight', 'bold')
			.text(`${plot.colorBy}`)
		let step = 25
		if (height < 500) {
			plot.legendSVG.style('font-size', '0.8em')
			step = 20
		}
		let y = 50
		const configPlot = this.state.config.plots.find(p => p.name == plot.name)
		const aliases = configPlot.colorColumns.find(c => c.name == plot.colorBy)?.aliases
		for (const cluster in colorMap) {
			const clusterCells = plot.cells.filter(item => item.category == cluster)
			const hidden = this.config.hiddenClusters?.[cluster]
			const n = clusterCells.length
			const color = colorMap[cluster]
			const itemG = plot.legendSVG.append('g').attr('transform', c => `translate(${x}, ${y})`)
			itemG.append('circle').attr('r', 5).attr('fill', color)
			itemG
				.append('g')
				.attr('transform', `translate(15, 5)`)
				.append('text')
				.text(
					`${
						cluster == 'ref'
							? this.state.termdbConfig.queries.singleCell.data.refName
							: cluster == 'query'
							? this.state.config.sample || this.samples[0].sample
							: aliases
							? aliases[cluster]
							: cluster
					} n=${n}`
				)
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.on('click', e => this.showLegendItemMenu(e, cluster, plot))
			y += step
		}
	}

	hideCategory(key, hidden) {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { hiddenClusters: { [key]: hidden } }
		})
	}

	showLegendItemMenu(e, key, plot) {
		let hiddenCount = 0
		for (const cluster in this.state.config.hiddenClusters) if (this.state.config.hiddenClusters[cluster]) hiddenCount++
		const hidden = this.state.config.hiddenClusters?.[key]
		if (hidden && hiddenCount == 1) {
			//show hidden category and skip menu
			this.hideCategory(key, false, plot.legendSVG)
			return
		}
		const menu = this.tip.clear()
		const div = menu.d.append('div')
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(hidden ? 'Show' : 'Hide')
			.on('click', () => {
				this.hideCategory(key, !hidden, plot.legendSVG)
				menu.hide()
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				for (const cluster in plot.colorMap) if (key != cluster) this.hideCategory(cluster, true, plot.legendSVG)
				this.hideCategory(key, false, plot.legendSVG)
				menu.hide()
			})
		if (hiddenCount > 1)
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show all')
				.on('click', () => {
					menu.hide()
					for (const mapKey in plot.colorMap) this.hideCategory(mapKey, false, plot.legendSVG)
				})
		menu.showunder(e.target)
	}

	renderColorGradient(plot) {
		if (plot.cells.length == 0 || !plot.colorGenerator) return
		const colors = [this.config.startColor[plot.name], this.config.stopColor[plot.name]]
		const gene = this.state.config.gene
		let offsetY = 20
		const barwidth = 100
		plot.legendSVG
			.append('g')
			.attr('transform', `translate(${20}, ${offsetY})`)
			.append('text')
			.text(`${gene} expression`)
		const legendG = plot.legendSVG.append('g').attr('transform', `translate(20, ${2 * offsetY})`)
		const colorScale = new ColorScale({
			holder: legendG,
			barwidth,
			barheight: 20,
			colors,
			domain: plot.colorGenerator.domain(),

			position: '0, 20',
			ticks: 4,
			tickSize: 5,
			topTicks: true,
			setColorsCallback: (val, idx) => {
				this.changeGradientColor(plot, val, idx)
			},
			numericInputs: {
				cutoffMode: this.settings.colorScaleMode,
				defaultPercentile: this.settings.colorScalePercentile,
				callback: obj => {
					let min, max
					const colorValues = plot.colorValues
					// Handle different modes for color scaling
					if (obj.cutoffMode === 'auto') {
						min = colorValues[0]
						max = colorValues[colorValues.length - 1]
					} else if (obj.cutoffMode === 'fixed') {
						min = obj.min
						max = obj.max
					} else if (obj.cutoffMode === 'percentile') {
						min = colorValues[0]
						const index = Math.floor((colorValues.length * obj.percentile) / 100)
						max = colorValues[index]
					}

					// Dispatch the updated config
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: {
							settings: {
								singleCellPlot: {
									colorScaleMode: obj.cutoffMode,
									colorScaleMinFixed: obj.cutoffMode === 'fixed' ? min : null,
									colorScaleMaxFixed: obj.cutoffMode === 'fixed' ? max : null,
									colorScalePercentile:
										obj.cutoffMode === 'percentile' ? obj.percentile : this.settings.colorScalePercentile
								}
							}
						}
					})
				}
			}
		})
		colorScale.updateScale()
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

	async renderSamplesTable() {
		const state = this.state
		// need to do this after the this.samples has been set

		const div = this.dom.samplesTableDiv

		div.selectAll('*').remove()
		const [rows, columns] = await this.getTableData(state)
		if (columns.length > 5) div.style('font-size', '0.9em')
		const selectedRows = []
		const i = this.samples.findIndex(i => i.sample == state.config.sample)
		if (i != -1) selectedRows.push(i)
		renderTable({
			rows,
			columns,
			resize: true,
			singleMode: true,
			div,
			maxWidth: columns.length > 3 ? '98vw' : '40vw',
			maxHeight: '50vh',
			noButtonCallback: index => {
				// NOTE that "index" is not array index of this.samples[]
				const sample = rows[index][0].value
				const hiddenClusters = {}
				// reset hidden clusters when changing sample
				for (const cluster in this.config.hiddenClusters) hiddenClusters[cluster] = false
				// reset these settings when changing sample
				const settings = {
					colorScaleMode: 'auto',
					colorScaleMinFixed: null,
					colorScaleMaxFixed: null,
					colorScalePercentile: 95,
					showNoExpCells: false,
					showContour: false,
					colorContours: false,
					contourBandwidth: 15,
					contourThresholds: 10
				}
				const config = {
					chartType: 'singleCellPlot',
					sample, // track sample name to identify it in this.samples[]
					activeTab: PLOTS_TAB, // on selecting a sample from table, auto switch to plots to directly show this sample's plots, to save user a click
					cluster: null, // reset cluster
					hiddenClusters, // reset hidden clusters
					settings: { singleCellPlot: settings }
				}
				this.genes = null // reset DE genes
				if (rows[index][0].__experimentID) {
					config.experimentID = rows[index][0].__experimentID
				}

				this.app.dispatch({ type: 'plot_edit', id: this.id, config })
			},
			selectedRows,
			striped: true,
			header: { style: { 'text-transform': 'capitalize' } } // to show header in title case; if it results in a conflict (e.g. a sample name showing in 1st tab has to be lower case), then use sampleColumns[].columnHeader as override of term name
		})
	}

	async getTableData(state) {
		const { uiLabels } = state.config.settings.singleCellPlot
		const s = state.termdbConfig.queries?.singleCell?.samples || {}
		const samples = this.samples
		const rows = []
		const hasExperiments = samples.some(i => i.experiments)
		// first column is sample and is hardcoded
		const columns = [{ label: uiLabels.Sample }]
		if (hasExperiments) columns.push({ label: 'Sample' }) //add after the case column

		// add in optional sample columns
		for (const c of s.sampleColumns || []) {
			let label = c.termid
			try {
				label = (await this.app.vocabApi.getterm(c.termid)).name
			} catch (e) {
				/* term not found by c.termid, in such case ignore and just show termid as column header
				this is due to practical constrain that gdc needs to supply analysis.workflow_type as 'Library',
				but this is not a term in gdc dictionary
				*/
			}
			columns.push({ label, width: '14vw' })
		}

		// if samples are using experiments, add the hardcoded experiment column at the end
		if (hasExperiments) columns.push({ label: 'Experiment' }) // corresponds to this.samples[].experiments[].experimentID

		for (const sample of samples) {
			if (hasExperiments)
				//GDC
				for (const exp of sample.experiments) {
					// first cell is always sample name. sneak in experiment object to be accessed in click callback
					const row = [{ value: sample.sample, __experimentID: exp.experimentID }]
					// hardcode to expect exp.sampleName and add this as a column
					row.push({ value: exp.sampleName })
					// optional sample and experiment columns
					for (const c of s.sampleColumns || []) {
						row.push({ value: sample[c.termid] })
					}

					// hardcode to always add in experiment id column
					const urlTemp = this.state.termdbConfig?.urlTemplates?.scrnaExperimentId
					if (urlTemp) row.push({ value: exp.experimentID, url: `${urlTemp.base}${exp.experimentID}` })
					else row.push({ value: exp.experimentID })
					rows.push(row)
				}
			else {
				// sample does not use experiment

				// first cell is sample name
				const row = [{ value: sample.sample }]

				// optional sample columns
				for (const c of s.sampleColumns || []) {
					row.push({ value: sample[c.termid] })
				}
				rows.push(row)
			}
		}

		//const index = columnNames.length == 1 ? 0 : columnNames.length - 1
		//columns[index].width = '25vw'
		return [rows, columns]
	}

	renderLargePlotThree = async function (plot) {
		if (!plot.canvas) {
			const canvas = plot.plotDiv.append('canvas').style('display', 'inline-block').style('vertical-align', 'top')
			plot.canvas = canvas.node()
			plot.canvas.width = this.settings.svgw
			plot.canvas.height = this.settings.svgh
			plot.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: plot.canvas, preserveDrawingBuffer: true })
		} else plot.renderer.clear()

		const renderer = plot.renderer

		//WebGLRenderer.outputColorSpace property determines the color space of the final rendered output. By default this is set to THREE.SRGBColorSpace, so that the rendered image is correctly displayed on standard monitors.
		//There are times where you may want to set the output color space to THREE.LinearSRGBColorSpace, so that color information is not altered before post processing effects are applied.
		//This fixes the issue where the colors are washed out and look lighter than in the legend
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')

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

		renderer.setSize(this.settings.svgw, this.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)

		plot.canvas.addEventListener('mousewheel', event => {
			if (!event.ctrlKey) return
			event.preventDefault()
			particles.position.z -= event.deltaY / 500
		})

		if (this.settings.showContour && this.state.config.gene && this.state.config.activeTab == GENE_EXPRESSION_TAB) {
			const cells = plot.expCells.length > 0 ? plot.expCells : plot.cells
			const xAxisScale = plot.xAxisScale.range([0, this.settings.svgw])
			const yAxisScale = plot.yAxisScale.range([this.settings.svgh, 0])
			let zAxisScale
			if (plot.expCells.length > 0) {
				const [min, max] = extent(plot.expCells, d => d.geneExp)
				zAxisScale = d3Linear().domain([min, max]).range([0, 1])
			}

			const xCoords = cells.map(c => xAxisScale(c.x))
			const yCoords = cells.map(c => yAxisScale(c.y))
			const zCoords = cells.map(c => (zAxisScale ? zAxisScale(c.geneExp) : 1))
			await this.renderContourMap(scene, xCoords, yCoords, zCoords, plot)
		}

		const controls = new DragControls.DragControls([particles], camera, renderer.domElement)

		function animate() {
			requestAnimationFrame(animate)
			renderer.render(scene, camera)
		}
		animate()
		if (this.settings.showGrid) this.renderThreeGrid(scene)
	}

	async renderContourMap(scene, xCoords, yCoords, zCoords, plot) {
		const data = xCoords.map((x, i) => ({ x, y: yCoords[i], z: zCoords[i] }))
		// Create the data URL
		const imageUrl = getContourImage(
			data,
			this.settings.svgw,
			this.settings.svgh,
			this.settings.colorContours,
			this.settings.contourBandwidth,
			this.settings.contourThresholds
		)
		const loader = new THREE.TextureLoader()
		loader.load(imageUrl, texture => {
			// Create a plane geometry
			const geometry = new THREE.PlaneGeometry(2, 2)
			// Create a material using the loaded texture
			// the transparent parameter is needed to keep the contours transparent, otherwise the background will be black
			// the color parameter is needed to make the contours darker, otherwise they are light gray
			const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: 0x141414 })
			// Create a mesh with the geometry and material
			const plane = new THREE.Mesh(geometry, material)
			// Add the plane to the scene
			scene.add(plane)
			plot.plane = plane
			plane.position.z = 0.00001 //makes the plane be on top of the particles
			plot.particles.add(plane) //makes the plane move with the particles
		})
	}

	renderThreeGrid(scene) {
		let x = -1
		// Line Geometry
		const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffd3d3d3 })

		const lines = 10
		const step = 2 / lines

		for (let i = 0; i < lines; i++) {
			let points = []
			points.push(new THREE.Vector3(x, 1.5, 0))
			points.push(new THREE.Vector3(x, -1.5, 0))
			let lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
			let line = new THREE.Line(lineGeometry, lineMaterial)
			line.position.z = 1

			scene.add(line)
			points = []
			points.push(new THREE.Vector3(-1.5, x, 0))
			points.push(new THREE.Vector3(1.5, x, 0))
			lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
			line = new THREE.Line(lineGeometry, lineMaterial)
			scene.add(line)
			x += step
			line.position.z = 1
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

export function getContourImage(data, width, height, colorContours, bandwidth, thresholds) {
	const svg = create('svg').attr('width', width).attr('height', height)

	renderContours(svg.append('g'), data, width, height, colorContours, bandwidth, thresholds)

	// Serialize the SVG element
	const svgString = new XMLSerializer().serializeToString(svg.node())

	// Encode the SVG string
	const encodedSvg = encodeURIComponent(svgString)

	// Create the data URL
	const imageUrl = 'data:image/svg+xml;charset=utf-8,' + encodedSvg
	return imageUrl
}

// Function to get mouse position in normalized device coordinates (-1 to +1)
export function getMouseNDC(event, rect) {
	//const rect = renderer.domElement.getBoundingClientRect()
	return new THREE.Vector2(
		((event.clientX - rect.left) / rect.width) * 2 - 1,
		(-(event.clientY - rect.top) / rect.height) * 2 + 1
	)
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
			hiddenClusters: {},
			settings: {
				singleCellPlot: settings,
				controls: { isOpen: false }
			},
			startColor: {},
			stopColor: {},
			plots,
			hidePlotFilter: true
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
		svgw: 600,
		svgh: 600,
		showGrid: true,
		sampleSize: 1.5,
		sampleSizeThree: 0.04,
		threeFOV: 60,
		opacity: 0.8,
		showNoExpCells: false,
		showContour: false,
		colorContours: false,
		contourBandwidth: 15,
		contourThresholds: 10,
		uiLabels: {
			// allow customized user interface labels (buttons, menus, etc) by dataset override,
			// for example in GDC, use 'Case' instead of 'Sample'
			// TODO: different plots should use the same uiLabels override,
			// should not need to define separately for matrix, single cell, etc
			Samples: 'Samples',
			samples: 'samples',
			Sample: 'Sample',
			sample: 'sample'
		},
		colorScaleMode: 'auto', // Default to automatic scaling based on data range
		// Other options: 'fixed' (user-defined range) or
		// 'percentile' (scale based on data distribution)

		colorScalePercentile: 95, // Default percentile for percentile mode
		// This means we'll scale colors based on values
		// up to the 95th percentile by default
		colorScaleMinFixed: null, // User-defined minimum value for fixed mode
		// Null indicates this hasn't been set yet
		colorScaleMaxFixed: null // User-defined maximum value for fixed mode
	}
}
