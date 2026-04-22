import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu } from '#dom'
import { digestMessage } from '#termsetting'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, TermTypeGroups } from '#shared/terms.js'
import type { SCSample } from '../SCTypes'
import type { Settings } from '../settings/Settings'

/** Rendering for the plot buttons that appear below the item
 * table. Plot buttons are rendered based on the available plots
 * for the selected sample, and the config defined in
 * termdbConfig.queries.singleCell.data.plots. Each plot config
 * in termdbConfig should define a name that matches the plot
 * names returned from the server, and can optionally define
 * colorColumns which will be used to apply color to the plot
 * if those columns are present in the data.
 *
 * Notes:
 *  - The hierarchical clustering limits to the first 100 genes.
 * */
export class PlotButtons {
	plotBtnsDom: {
		promptDiv: Div
		selectPrompt: Elem
		btnsDiv: Div
		tip: Menu
	}
	data?: any
	item?: SCSample
	interactions: SCInteractions
	scTermdbConfig: any
	settings!: Settings
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

	update(settings: Settings, data) {
		/** If the user has not selected a item yet but clicks
		 * the select item/plots btn above the table, the prompt appears
		 * unnecessarily */
		const item = settings.sc.item
		this.plotBtnsDom.promptDiv.style('display', !item ? 'none' : 'block')
		if (!item) return
		if (data != null && data.plots) this.data = data
		this.settings = settings
		this.item = item
		const name = item.sID
		this.plotBtnsDom.selectPrompt.text(` ${name}:`)
		this.renderChartBtns()
	}

	renderChartBtns() {
		// this.plotBtnsDom.btnsDiv.selectAll('*').remove()
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

		//Show buttons for plots with found data files (see note above).
		const availablePlots = new Set(this.data?.plots?.map((p: any) => p.name))

		for (const plot of this.scTermdbConfig?.data?.plots || []) {
			btns.push({
				label: plot.name,
				isVisible: () => availablePlots.has(plot.name),
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
					const sample = this.item!
					return {
						chartType: 'dictionary',
						sample,
						spawnConfig: {
							parentId: this.interactions.id,
							hidePlotFilter: true,
							headerText: `Sample: ${this.item!.sID}`,
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
				isVisible: () => this.scTermdbConfig?.geneExpression,
				getPlotConfig: () => {
					const sample = this.item!
					const headerText = `Sample: ${this.item!.sID}`
					return {
						chartType: 'GeneExpInput',
						termType: SINGLECELL_GENE_EXPRESSION,
						headerText,
						termProperties: { sample },
						sample,
						spawnConfig: {
							parentId: this.interactions.id,
							hidePlotFilter: true,
							headerText
						}
					}
				}
			},
			{
				label: 'Differential expression',
				isVisible: () => this.scTermdbConfig?.DEgenes,
				open: this.termDropdownMenu,
				getPlotConfig: value => {
					return {
						chartType: 'differentialAnalysis',
						termType: SINGLECELL_CELLTYPE,
						categoryName: `${value}`,
						headerText: `Sample: ${this.item!.sID} ${this.scTermdbConfig.DEgenes.termId} ${value}`,
						termId: this.scTermdbConfig.DEgenes.termId,
						sample: this.item!
					}
				}
			}
		)
		return btns
	}

	//********** Btn Menus **********/
	termDropdownMenu(plot: any, self: PlotButtons) {
		self.plotBtnsDom.tip.clear()
		//TODO: Planned server request here to get the available
		// clusters/termIds for the selected sample,
		// instead of using the clusters returned for the
		// plot which is currently hardcoded to a few options for testing.
		const _plot = self.data.plots[0]

		const wrapper = self.plotBtnsDom.tip.d.append('div').style('padding', '10px')
		wrapper
			.append('div')
			.style('display', 'block')
			.style('width', '300px')
			.text(`View differentially expressed genes of a ${self.scTermdbConfig.DEgenes.termId} versus rest of the cells:`)

		const select = wrapper
			.append('select')
			.style('margin', '10px 0')
			.style('width', 'auto')
			.style('padding', '5px')
			.on('change', async function () {
				self.plotBtnsDom.tip.hide()
				const value = select.node()!.value
				if (value.indexOf('Select') == 0) return //ignore prompt option
				const config = plot.getPlotConfig(value)
				await self.interactions.createSubplot(config)
			})

		//TODO: Replace this with planned server response for the clusters/termId.
		const regex = new RegExp(_plot.colorBy, 'g')
		_plot.clusters.unshift(`Select ${self.scTermdbConfig.DEgenes.termId}...`)
		for (const cluster of _plot.clusters) {
			select.append('option').attr('value', cluster.replace(regex, '').trim()).text(cluster)
		}
	}

	//********** Plot Config Helpers **********/
	async getSingleCellConfig(plotName: string): Promise<object> {
		if (!this.item) throw new Error('No item selected')
		const plot = this.scTermdbConfig.data.plots.find(p => p.name == plotName)
		if (!plot) throw new Error(`No plot by name ${plotName} in data.plots.`)
		const sample = this.item
		const config: any = {
			chartType: 'sampleScatter',
			name: `Sample: ${this.item.sID}`,
			sample,
			singleCellPlot: {
				name: plotName,
				sample
			}
		}
		if (plot.colorColumns?.[0]) {
			// apply optional color term. hardcodes to 1st of the array
			config.colorTW = await this.makeScctTW(sample, plot)
		}
		return config
	}

	// Quick fix. Eventually use the handler to get the proper term from the termdbConfig
	async makeScctTW(item: { sID: string; eID: string }, plot: any) {
		const colorColName = plot.colorColumns[0].name
		const savedTerm = this.scctTerms?.find(t => t.name == colorColName && t.plot == plot.name)
		if (!savedTerm)
			throw new Error(
				`No term found for colorColumn=${colorColName} in .termType2terms.[TermTypeGroups.SINGLECELL_CELLTYPE] for plot ${plot.name}`
			)
		const term = Object.assign(structuredClone(savedTerm), {
			sample: item
		})
		const id = await digestMessage(`${plot.name}-${item.sID}-${item.eID}`)
		return Object.assign({ $id: id }, { term })
	}
}
