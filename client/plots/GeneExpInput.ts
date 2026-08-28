import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { typeGroup } from '#shared/terms.js'
import { GENE_EXPRESSION, PSEUDOBULK, SINGLECELL_GENE_EXPRESSION, SSGSEA } from '#types'
import { getGEunit } from '../tw/geneExpression'
import { getSCGEunit } from '../tw/singleCellGeneExpression'
import { addGeneSearchbox, GeneSetEditUI, Menu, sayerror, Tabs, make_radios } from '#dom'
import type { ClientGenome } from '../types/clientGenome'
import { getCurrentCohortChartTypes } from '../mass/charts.js'
import { importPlot } from '#plots/importPlot.js'

type GeneExpInputOpts = {
	/** sandbox header
	 * Normally this is optional but there's no reason to launch this plot
	 * sans sandbox. */
	header: any
	/** Optional text to display in the header before the term type */
	headerText?: string
	termProperties?: { [key: string]: any }
	spawnConfig?: { [key: string]: any }
}

/** Transient plot for users to pick gene(s) of interest and launch
 * the appropriate plot. */
export class GeneExpInput extends PlotBase implements RxComponent {
	static type = 'GeneExpInput'

	type: string
	components: { plots: { [key: string]: any } }
	genome!: ClientGenome
	/** Undefined until the user picks a data type, when more than one is possible */
	termType?: string
	/** termType dependent */
	unit!: string
	dom!: { [index: string]: any }
	tabs!: any

	constructor(opts: GeneExpInputOpts, api: ComponentApi) {
		super(opts, api)
		this.type = GeneExpInput.type
		this.components = { plots: {} }
	}

	makeTerm(_term) {
		const termProperties = this.state.config?.termProperties || {}
		const term = { ..._term, ...termProperties, type: this.termType, unit: this.unit }
		return term
	}

	makeConfig(_config) {
		const spawnConfig = this.state.config?.spawnConfig || {}
		const tmp = { ..._config, ...spawnConfig }
		return tmp
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const subplots = appState.plots.filter(p => p.parentId === this.id)
		return {
			config,
			termdbConfig: appState.termdbConfig,
			subplots
		}
	}

	async init(appState) {
		const state = this.getState(appState)
		this.genome = this.app.opts.genome
		this.termType = state.config.termType
		this.dom = this.initDom()

		if (!this.termType) {
			this.renderTermTypeSelect(state.config.possTermTypes)
			return
		}

		await this.renderTermTypeUI(state)
	}

	initDom() {
		const headerText = this.opts.headerText ? `${this.opts.headerText} ` : ''
		const dom: { [index: string]: any } = {
			holder: this.opts.holder,
			header: {
				title: this.opts.header
					.append('span')
					.style('padding-right', '5px')
					.text(headerText)
					.attr('data-testid', 'sjpp-gene-exp-input-headerText'),
				plot: this.opts.header
					.append('span')
					.text(this.termType ? typeGroup[this.termType].toUpperCase() : '')
					.style('font-size', '0.7em')
					.style('opacity', '0.6')
					.attr('data-testid', 'sjpp-gene-exp-input-termType')
			},
			tabs: this.opts.holder
				.append('div')
				.style('margin', '10px')
				.attr('data-testid', 'sjpp-gene-exp-input-tabs-wrapper')
		}

		return dom
	}

	renderTermTypeSelect(possTermTypes: string[]) {
		const holder = this.dom.tabs
		holder.append('div').style('padding-bottom', '5px').text('Please select the data type:')
		make_radios({
			holder: holder.append('div').style('padding-left', '10px'),
			options: possTermTypes.map(termType => ({ value: termType, label: typeGroup[termType] })),
			callback: async value => {
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { termType: value }
				})
			}
		})
	}

	/** Render the termType-dependent gene-selection tabs, once termType is known. */
	async renderTermTypeUI(state) {
		this.termType = state.config.termType
		this.unit = getUnit(this.termType, this.app.vocabApi)

		this.dom.header.plot.text(typeGroup[this.termType as string].toUpperCase())
		this.dom.tabs.selectAll('*').remove()

		const chartTypes = new Set(getCurrentCohortChartTypes(this.app.getState()))
		this.tabs = this.getTabOpts(state, chartTypes)

		const chartTabs = new Tabs({
			holder: this.dom.tabs,
			tabs: this.tabs,
			tabsPosition: 'vertical'
		})
		await chartTabs.main()
	}

	getTabOpts(state, chartTypes) {
		return [
			{
				label: 'One gene',
				isVisible: () => true,
				callback: async (event, tab) => {
					if (this.termType === PSEUDOBULK) {
						await this.renderPseudobulkSearch(tab.contentHolder)
					}
					else this.renderGeneSelect(tab)
					delete tab.callback
				}
			},
			{
				label: 'Two genes',
				/** TODO: Does this make sense to enable for pseudobulk? */
				isVisible: () => this.termType !== PSEUDOBULK,
				callback: (event, tab) => {
					this.renderTwoGeneSelect(tab)
					delete tab.callback
				}
			},
			{
				label: 'Hierarchical clustering',
				isVisible: () => chartTypes.has('matrix'),
				callback: (event, tab) => {
					if (this.termType !== GENE_EXPRESSION && typeof this.termType === 'string') {
						tab.contentHolder.append('div')
							.style('padding', '15px')
							.text(`Hierarchical clustering for ${typeGroup[this.termType]} data is currently in development. Please check back later.`)
					}
					else this.renderGeneMultiSelect(tab)
					delete tab.callback
				}
			},
			{
				label: `Differential ${typeGroup[this.termType as string].toLowerCase()} analysis`,
				//Only enabling for gene expression for now
				chartType: 'DEinput',
				//TODO: add whether or not a total file is available for pseudobulk to enable DA
				isVisible: () => chartTypes.has('DA') && (this.termType === GENE_EXPRESSION /*|| this.termType === PSEUDOBULK*/),
				callback: async (event, tab) => {
					await this.app.dispatch({
						type: 'plot_create',
						parentId: this.id,
						config: {
							chartType: 'DEinput',
							parentId: this.id,
							/** ' ' overrides the default 'hide_search' mode in DEInput.
							 * 'hide_search' by default expands all terms. */
							header_mode: ' '
						}
					})
					delete tab.callback
				}
			},
			{
				label: typeGroup[SSGSEA],
				isVisible: () => {
					return this.termType === GENE_EXPRESSION && state.termdbConfig?.allowedTermTypes?.includes(SSGSEA)
				},
				callback: async (event, tab) => {
					await this.renderSSGSEA(tab)
					delete tab.callback
				}
			}
		]
	}

	async main() {
		const state = this.getState(this.app.getState())

		if (!this.tabs && state.config.termType) await this.renderTermTypeUI(state)

		for (const subplot of state.subplots || []) {
			if (!this.components.plots[subplot.id]) await this.initSubplotInTab(subplot)
		}
	}

	renderGeneSelect(tab) {
		const row = tab.contentHolder.style('padding', '15px')
		row.append('span').style('padding', '5px').text('Select a gene:')
		const geneSearch = addGeneSearchbox({
			row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				const tw = {
					term: this.makeTerm({
						gene: geneSearch.geneSymbol,
						name: `${geneSearch.geneSymbol} ${this.unit}`
					})
				}
				const config = this.makeConfig({
					chartType: 'summary',
					term: tw
				})
				await this.dispatchEdits(config)
			}
		})
	}

	async renderPseudobulkSearch(holder) {
		const _ = await import('../termdb/handlers/pseudobulk.ts')
		const searchHandler = new _.SearchHandler()
		await searchHandler.init({
			holder: holder.style('padding-left', '10px'),
			app: this.app,
			genomeObj: this.genome,
			usecase: { target: 'GeneExpInput', detail: 'pseudobulk' },
			callback: async _term => {
				const tw = { term: this.makeTerm(_term) }
				const config = this.makeConfig({
					chartType: 'summary',
					term: tw
				})
				await this.dispatchEdits(config)
			}
		})
	}

	/** Guide the user to select the first gene then
	 * a second to launch the summary plot on submit.*/
	renderTwoGeneSelect(tab) {
		const term: any = {}
		const term2: any = {}

		const holder = tab.contentHolder.style('padding', '10px')

		const gene1row = holder.append('div').style('padding', '5px')
		const gene2row = holder.append('div').style('padding', '5px').style('display', 'none')
		const submitButton = holder.append('button').attr('type', 'button').attr('disabled', true)

		gene1row.append('span').text('Select the first gene:')
		const geneSearch1 = addGeneSearchbox({
			row: gene1row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				gene2row.style('display', 'block')
				if (!geneSearch1.geneSymbol) throw new Error('First gene result is required')
				term.gene = geneSearch1.geneSymbol
				term.name = `${geneSearch1.geneSymbol} ${this.unit}`
			}
		})

		gene2row.append('span').text('Select the second gene:')
		const geneSearch2 = addGeneSearchbox({
			row: gene2row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				if (!geneSearch2.geneSymbol) throw new Error('Second gene result is required')
				term2.gene = geneSearch2.geneSymbol
				term2.name = `${geneSearch2.geneSymbol} ${this.unit}`
				submitButton.attr('disabled', null)
			}
		})

		submitButton
			.text('Submit')
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.on('click', async () => {
				if (!term.name || !term.gene) {
					sayerror(holder, 'Missing first gene. Please provide a valid gene.')
					return
				}
				if (!term2.name || !term2.gene) {
					sayerror(holder, 'Missing second gene. Please provide a valid gene.')
					return
				}

				const config = this.makeConfig({
					chartType: 'summary',
					term: { term: this.makeTerm(term) },
					term2: { term: this.makeTerm(term2) }
				})
				await this.dispatchEdits(config)
			})
	}
	 /** Render the GeneSetEdit UI for selection and then
	  * launch the hierarchical clustering on submit.*/
	renderGeneMultiSelect(tab) {
		const holder = tab.contentHolder.style('padding', '10px')
		const grpWrapper = holder.append('div').style('padding', '10px')
		grpWrapper.append('span').style('font-weight', 'bold').text('Group name:')

		let customName: string = 'New custom group'
		const input = grpWrapper
			.append('input')
			.style('margin', '2px 5px')
			.style('width', '210px')
			.attr('placeholder', 'Group Name')
			.on('input', () => {
				customName = input.property('value')
			})

		new GeneSetEditUI({
			holder: holder.append('div'),
			/** running hier clustering and the editing group
			 * is the group used for clustering pass this mode
			 * value to inform ui to support the optional button
			 * "top variably exp gene" this is hardcoded for
			 * the purpose of gene expression and should be improved. */
			genome: this.genome,
			mode: 'geneExpression',
			vocabApi: this.app.vocabApi,
			callback: async ({ geneList, name }) => {
				if (geneList.length <= 2) {
					return alert('At least three genes are required for hierarchical clustering. Please select more genes.')
				}

				const group: { name: string; lst: { [index: string]: any }[]; type: string } = {
					name: name || customName,
					lst: [],
					type: 'hierCluster'
				}
				const tws = await Promise.all(
					geneList.map((d: any) => {
						const gene: string = d.symbol || d.gene
						const name = `${gene} ${this.unit}`
						const term = this.makeTerm({ gene, name })
						return { term, q: {} }
					})
				)
				group.lst = [...tws]

				const config = this.makeConfig({
					chartType: 'hierCluster',
					termgroups: [group],
					//TODO: Need to allow singleCellGeneExpression as well
					dataType: GENE_EXPRESSION
				})

				await this.dispatchEdits(config)
			}
		})
	}

	async renderSSGSEA(tab) {
		const holder = tab.contentHolder.style('padding', '10px')
		const _ = await import('../termdb/handlers/ssGSEA.ts')
		const searchHandler = new _.SearchHandler()
		await searchHandler.init({
			holder,
			app: this.app,
			genomeObj: this.genome,
			callback: async term => {
				const config = this.makeConfig({
					chartType: 'summary',
					term: { term: term }
				})
				await this.dispatchEdits(config)
			}
		})
	}

	async initSubplotInTab(subplot) {
		const holder = this.tabs.find(tab => tab.chartType === subplot.chartType)?.contentHolder
		if (!holder) throw new Error(`No tab found for chart type ${subplot.chartType}`)

		const opts = Object.assign({}, subplot, {
			holder,
			app: this.app,
			parentId: this.id,
			id: subplot.id
		})

		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[subplot.id] = await componentInit(opts)
	}

	async dispatchEdits(config) {
		await this.app.dispatch({
			type: 'app_refresh',
			subactions: [
				{
					type: 'plot_create',
					config
				},
				{
					type: 'plot_delete',
					id: this.id
				}
			]
		})
	}
}

export function getUnit(termType, vocabApi) {
	return termType === GENE_EXPRESSION ? getGEunit(vocabApi) : getSCGEunit(vocabApi)
}

export const geneExpInputInit = getCompInit(GeneExpInput)
export const componentInit = geneExpInputInit

//Sanity check
const enabledTermTypes = new Set([GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION, PSEUDOBULK])

/** termType is optional: when more than one data type is available for the
 * current cohort, the sandbox will prompt the user to choose one. */
export function getPlotConfig(opts, app) {
	if (opts?.termType && !enabledTermTypes.has(opts.termType)) throw new Error(`Invalid termType: ${opts.termType}`)

	const possTermTypes = opts.possTermTypes || getSelectableGETermTypes(app.vocabApi.termdbConfig)
	/** Allow scge to be passed even though it's not a selectable type */
	if (!possTermTypes.length && !opts?.termType) throw new Error('No gene expression data types are available for this cohort')

	const config = {
		chartType: 'GeneExpInput',
		termType: opts?.termType || (possTermTypes.length === 1 ? possTermTypes[0] : undefined),
		possTermTypes,
		hidePlotFilter: true
	}

	return copyMerge(config, opts)
}

/** Scge is enabled for this but sequestered to only the sc app. 
 * Scge terms require a sample obj which is supplied in the SC app. */
export function getSelectableGETermTypes(termdbConfig) {
	return Array.from(enabledTermTypes).filter(termtype => termtype !== SINGLECELL_GENE_EXPRESSION && (termdbConfig?.allowedTermTypes || [])?.includes(termtype))
}