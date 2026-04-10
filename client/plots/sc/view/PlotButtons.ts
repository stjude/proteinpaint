import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, /*GeneSetEditUI,*/ GeneExpChartMenu } from '#dom'
import { digestMessage } from '#termsetting'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, TermTypeGroups } from '#shared/terms.js'
import type { SCSettings } from '../SCTypes'

/** Rendering for the plot buttons that appear below the item
 * table.
 *
 * Notes:
 *  - The hierarchical clustering limits to the first 100 genes.
 *
 ******* TODOs:
 * - Disable all plot btns until plot loads for performance??
 *
 ******* Hier clustering implenentation TODOs and questions:
 * The matrix ** does not ** properly pull single cell data yet.
 * This implementation works as a placeholder for now.
 * Need to revisit before production.
 *
 * Questions:
 * - Limit to 100 genes or no?
 * - What settings to use for hier cluster?
 * */
export class PlotButtons {
	plotBtnsDom: {
		promptDiv: Div
		selectPrompt: Elem
		btnsDiv: Div
		tip: Menu
	}
	data?: any
	item?: { [key: string]: any }
	interactions: SCInteractions
	scTermdbConfig: any
	settings!: SCSettings
	scctTerms?: any[]

	constructor(interactions: SCInteractions, holder: Div) {
		holder.style('padding', '10px')
		const promptDiv = holder.append('div').style('padding', '10px 0').text('Select data from')
		this.plotBtnsDom = {
			promptDiv,
			selectPrompt: promptDiv.append('span'),
			btnsDiv: holder.append('div'),
			tip: new Menu({ padding: '' })
		}
		this.interactions = interactions
		const state = this.interactions.getState as any
		this.scctTerms = state.termdbConfig?.termType2terms?.[TermTypeGroups.SINGLECELL_CELLTYPE]
		this.scTermdbConfig = state.termdbConfig.queries.singleCell
	}

	update(settings, data) {
		/** If the user has not selected a item yet but clicks
		 * the select item/plots btn above the table, the prompt appears
		 * unnecessarily */
		const item = settings.sc.item
		this.plotBtnsDom.promptDiv.style('display', !item ? 'none' : 'block')
		if (!item) return
		if (data != null && data.plots) this.data = data
		this.settings = settings
		this.item = item
		const name = item.sample // add ds specific keys/logic here
		this.plotBtnsDom.selectPrompt.text(` ${name}:`)
		this.renderChartBtns()
	}

	renderChartBtns() {
		this.plotBtnsDom.btnsDiv.selectAll('*').remove()
		const btns = this.getChartBtnOpts()

		this.plotBtnsDom.btnsDiv
			.selectAll('button')
			.data(btns.filter(b => b.isVisible()))
			.enter()
			.append('button')
			.attr('type', 'button')
			.attr('data-testid', b => `sjpp-sc-plot-btn-${b.label.toLowerCase().replace(/\s/g, '-')}`)
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', 'transparent')
			.style('background-color', '#CFE2F3')
			.style('margin', '0 10px')
			.style('cursor', 'pointer')
			.text(b => b.label)
			.on('click', async (e, plot) => {
				if (plot.open) {
					this.plotBtnsDom.tip.clear().showunder(e.target)
					plot.open(plot, this)
				} else {
					if (!plot.getPlotConfig)
						throw new Error(`No getPlotConfig function defined for this plot button = ${plot.label}`)
					const config = await plot.getPlotConfig()
					await this.interactions.createSubplot(config)
				}
			})
	}

	getChartBtnOpts() {
		const btns: {
			label: string
			isVisible: () => boolean
			open?: (plot: any, self: PlotButtons) => void
			getPlotConfig?: (f?: any) => any
		}[] = []

		for (const plot of this.scTermdbConfig?.data?.plots || []) {
			btns.push({
				label: plot.name,
				isVisible: () => true,
				getPlotConfig: async () => {
					return await this.getSingleCellConfig(plot.name)
				}
			})
		}
		btns.push(
			{
				label: 'Summary',
				isVisible: () => true,
				getPlotConfig: () => {
					const sample = this.makeSampleObj()
					return {
						chartType: 'dictionary',
						spawnConfig: {
							parentId: this.interactions.id,
							hidePlotFilter: true,
							sample
						},
						tree: {
							usecase: {
								target: 'dictionary',
								specialCase: {
									type: 'singleCell',
									config: { sample }
								}
							}
						}
					}
				}
			},
			{
				label: 'Gene expression',
				isVisible: () => this.scTermdbConfig.geneExpression,
				open: this.geneExpMenu
			},
			{
				label: 'Differential expression',
				isVisible: () => this.scTermdbConfig.DEgenes,
				open: this.termDropdownMenu,
				getPlotConfig: value => {
					return {
						chartType: 'differentialAnalysis',
						termType: SINGLECELL_CELLTYPE,
						categoryName: `${value}`,
						termId: this.scTermdbConfig.DEgenes.termId,
						sample: this.item!.experiment || this.item!.sample
					}
				}
			}
		)
		return btns
	}

	//********** Btn Menus **********/
	geneExpMenu(plot: any, self: PlotButtons) {
		const opts = {
			termType: SINGLECELL_GENE_EXPRESSION as string,
			termProperties: { sample: self.makeSampleObj() },
			spawnConfig: {
				hidePlotFilter: true,
				parentId: self.interactions.id,
				scItem: self.makeSampleObj(),
				/** It's not ideal to always pass the hierCluster settings here, but it's required for the current implementation */
				settings: { hierCluster: self.settings.hierCluster }
			}
		}
		new GeneExpChartMenu(self.interactions.app, self.plotBtnsDom.tip, opts)
	}

	//TODO: Change this to use the term from termdbConfig
	// and return to getPlotConfig
	termDropdownMenu(plot: any, self: PlotButtons) {
		self.plotBtnsDom.tip.clear()
		const _plot = self.data.plots[0]

		const wrapper = self.plotBtnsDom.tip.d.append('div').style('padding', '10px')

		wrapper
			.append('div')
			.style('display', 'block')
			.style('width', '300px')
			.text(`View differentially expressed genes of a ${_plot.colorBy.toLowerCase()} versus rest of the cells:`)

		const select = wrapper
			.append('select')
			.style('margin', '10px 0')
			.style('width', 'auto')
			.style('padding', '5px')
			.on('change', async function () {
				self.plotBtnsDom.tip.hide()
				const value = select.node()!.value
				if (value.indexOf('Select') == 0) return //ignore prompt option
				const config = plot.getPlotConfig(value, _plot.colorBy)
				await self.interactions.createSubplot(config)
			})

		const regex = new RegExp(_plot.colorBy, 'g')
		_plot.clusters.unshift(`Select ${_plot.colorBy}...`)
		for (const cluster of _plot.clusters) {
			select.append('option').attr('value', cluster.replace(regex, '').trim()).text(cluster)
		}
	}

	//********** Plot Config Helpers **********/
	async getSingleCellConfig(plotName): Promise<object> {
		if (!this.item) throw new Error('No item selected')
		const plot = this.scTermdbConfig.data.plots.find(p => p.name == plotName)
		if (!plot) throw new Error(`No plot by name ${plotName} in data.plots.`)
		const config: any = {
			chartType: 'sampleScatter',
			singleCellPlot: {
				name: plotName,
				sample: this.makeSampleObj()
			}
		}
		if (plot.colorColumns?.[0]) {
			// apply optional color term. hardcodes to 1st of the array
			config.colorTW = await this.makeScctTW(this.item, plot)
		}
		return config
	}

	// Quick fix. Eventually use the handler to get the proper term from the termdbConfig
	async makeScctTW(item, plot) {
		const colorColName = plot.colorColumns[0].name
		const savedTerm = this.scctTerms?.find(t => t.name == colorColName && t.plot == plot.name)
		if (!savedTerm)
			throw new Error(
				`No term found for colorColumn=${colorColName} in .termType2terms.[TermTypeGroups.SINGLECELL_CELLTYPE] for plot ${plot.name}`
			)
		const term = Object.assign(structuredClone(savedTerm), {
			sample: this.makeSampleObj()
		})
		const id = await digestMessage(`${plot.name}-${item.sample}-${item.experiment}`)
		return Object.assign({ $id: id }, { term })
	}

	/** Creates a sample object for the current item.
	 * Part of the effort to normalize sample objects across
	 * native and gdc datasets. */
	makeSampleObj() {
		return {
			sID: this.item!.sample,
			eID: this.item!.experiment
		}
	}
}
