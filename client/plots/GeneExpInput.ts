import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION, typeGroup } from '#shared/terms.js'
import { getGEunit } from '../tw/geneExpression'
import { getSCGEunit } from '../tw/singleCellGeneExpression'
import { addGeneSearchbox, GeneSetEditUI, Menu, sayerror, Tabs } from '#dom'
import type { ClientGenome } from '../types/clientGenome'
import { getCurrentCohortChartTypes } from '../mass/charts.js'
import { importPlot } from '#plots/importPlot.js'

type GeneExpInputOpts = {
	/** sandbox header
	 * Normally this is optional but there's no reason to launch this plot
	 * sans sandbox. */
	header: any
	/** Override default text for sanbox header */
	headerTextOverride?: string
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
	termType!: string
	/** termType dependent */
	unit!: string
	dom!: { [index: string]: any }
	tabs!: any
	/** Helper function to create term with any additional properties */
	makeTerm: (term: any) => object
	/** Helper function to create config or the spawning plot with
	 * any additional properties. Used in the violin, scatter, and hierCluster */
	makeConfig: (config: any) => object

	constructor(opts: GeneExpInputOpts, api: ComponentApi) {
		super(opts, api)
		this.type = GeneExpInput.type
		this.opts = opts
		this.components = {
			plots: {}
		}

		const termProperties = opts?.termProperties || {}
		this.makeTerm = term => ({ ...term, ...termProperties, type: this.termType, unit: this.unit })

		const spawnConfig = opts?.spawnConfig || {}
		this.makeConfig = config => {
			const tmp = { ...config, ...spawnConfig }
			/** TODO: Single cell terms cannot be filtered. */
			if (this.termType === SINGLECELL_GENE_EXPRESSION) tmp.hidePlotFilter = true
			return tmp
		}
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
		this.unit = this.getUnit()
		this.dom = this.initDom()

		const chartTypes = new Set(getCurrentCohortChartTypes(appState))

		this.tabs = [
			{
				label: 'One gene',
				isVisible: () => true,
				callback: (event, tab) => {
					this.renderGeneSelect(tab)
					delete tab.callback
				}
			},
			{
				label: 'Two gene',
				isVisible: () => true,
				callback: (event, tab) => {
					this.renderTwoGeneSelect(tab)
					delete tab.callback
				}
			},
			{
				label: 'Hierarchical clustering',
				isVisible: () => chartTypes.has('matrix') && this.termType === GENE_EXPRESSION, // hierarchical clustering doesn't support scge
				callback: (event, tab) => {
					this.renderGeneMultiSelect(tab)
					delete tab.callback
				}
			},
			{
				label: `Differential ${typeGroup[this.termType].toLowerCase()} analysis`,
				//Only enabling for gene expression for now
				chartType: 'DEinput',
				isVisible: () => false,
				// TODO: Sorting out server response error in another PR.
				// Will enable when fixed. For now hiding from UI to avoid confusion.
				// isVisible: () => chartTypes.has('DA') && this.termType === GENE_EXPRESSION,
				callback: async (event, tab) => {
					await this.app.dispatch({
						type: 'plot_create',
						parentId: this.id,
						config: {
							chartType: 'DEinput',
							parentId: this.id
						}
					})
					delete tab.callback
				}
			}
		]

		const chartTabs = new Tabs({
			holder: this.dom.tabs,
			tabs: this.tabs,
			tabsPosition: 'vertical'
		})
		await chartTabs.main()
	}

	getUnit() {
		return this.termType === GENE_EXPRESSION ? getGEunit(this.app.vocabApi) : getSCGEunit(this.app.vocabApi)
	}

	initDom() {
		const headerText = this.opts?.headerTextOverride || `${typeGroup[this.termType]}`

		const dom: { [index: string]: any } = {
			header: this.opts.header.text(headerText).attr('data-testid', 'sjpp-gene-exp-input-header'),
			tabs: this.opts.holder
				.append('div')
				.style('margin', '10px')
				.attr('data-testid', 'sjpp-gene-exp-input-tabs-wrapper')
		}

		return dom
	}

	async main() {
		const state = this.getState(this.app.getState())

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

	/** Guide the user to select the first gene then
	 * a second to launch the summary plot on submit.*/
	renderTwoGeneSelect(tab) {
		const term: any = {}
		const term2: any = {}

		const holder = tab.contentHolder.style('padding', '10px')

		const gene1row = holder.append('div').style('padding', '5px')
		const gene2row = holder.append('div').style('padding', '5px').style('display', 'none')
		const submitButton = holder.append('button').attr('type', 'button').attr('disabled', true)

		gene1row.append('span').text('Select 1st gene:')
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

		gene2row.append('span').text('Select 2nd gene:')
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
	// /** Render the GeneSetEdit UI for selection and then
	//  * launch the hierarchical clustering on submit.*/
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

export const geneExpInputInit = getCompInit(GeneExpInput)
export const componentInit = geneExpInputInit

//Sanity check
const enabledTermTypes = new Set([GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION])

export function getPlotConfig(opts) {
	if (!opts?.termType) throw new Error('termType is required in opts')
	if (!enabledTermTypes.has(opts.termType)) throw new Error(`Invalid termType: ${opts.termType}`)

	const config = {
		chartType: 'GeneExpInput',
		termType: opts.termType,
		hidePlotFilter: true
	}

	return copyMerge(config, opts)
}
