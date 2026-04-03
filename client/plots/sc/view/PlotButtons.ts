import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, GeneSetEditUI } from '#dom'
import { digestMessage } from '#termsetting'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, TermTypeGroups } from '#shared/terms.js'

/** Rendering for the plot buttons that appear below the item
 * table.
 *
 * Notes:
 *  - The hierarchical clustering limits to the first 100 genes.
 *
 ******* TODOs:
 * - Update anywhere with 'CHANGEME' before prod
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
	settings?: any
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
			getPlotConfig: (f?: any) => any
		}[] = []

		for (const plots of this.scTermdbConfig?.data?.plots || []) {
			btns.push({
				label: plots.name,
				isVisible: () => true,
				getPlotConfig: async () => {
					return await this.getSingleCellConfig(plots.name)
				}
			})
		}
		btns.push(
			{
				label: 'Summary',
				isVisible: () => true,
				getPlotConfig: () => {
					return {
						chartType: 'dictionary'
					}
				}
			},
			{
				label: 'Gene expression',
				isVisible: () => true,
				open: this.geneSearchMenu,
				getPlotConfig: async geneLst => {
					if (!geneLst.length) {
						alert('No genes selected to launch gene expression subplot [PlotButtons.ts getChartBtnOpts()]')
						return
					}
					/** If 1 gene, launch violin
					 * If 2 genes, launch scatter
					 * If >2 genes, launch hier clustering */
					if (geneLst.length == 1) return await this.getViolinConfig(geneLst[0].gene)
					else if (geneLst.length == 2) return await this.getScatterConfig(geneLst)
					else return this.getClusteringConfig(geneLst)
				}
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
	//TODO: Use `client/dom/GeneExpChartMenu.ts` instead
	geneSearchMenu(plot: any, self: PlotButtons) {
		self.plotBtnsDom.tip.clear()

		new GeneSetEditUI({
			holder: self.plotBtnsDom.tip.d.append('div') as any,
			genome: self.interactions.app.opts.genome,
			vocabApi: {},
			callback: async result => {
				self.plotBtnsDom.tip.hide()
				const config = await plot.getPlotConfig(result.geneList)
				await self.interactions.createSubplot(config)
			}
		})
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
	async getViolinConfig(gene): Promise<object> {
		if (!this.item) throw new Error('No item selected')
		return {
			chartType: 'violin',
			term: {
				$id: await digestMessage(`${gene}-${this.item.sample}-${this.item.experiment}`),
				term: {
					type: SINGLECELL_GENE_EXPRESSION,
					id: gene,
					gene,
					name: gene,
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					}
				}
			},
			// term2: await this.makeScctTW(this.item, this.scTermdbConfig.data.plots[0])
			term2: {
				//CHANGE ME
				$id: await digestMessage(`CHANGEME-${this.item.sample}-${this.item.experiment}`),
				term: {
					type: SINGLECELL_CELLTYPE,
					id: 'cluster', //CHANGE ME, singlecell.data.plots.[i].colorColumns
					name: 'cluster', //CHANGE ME
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					},
					plot: 'UMAP' //CHANGEME
				}
			}
		}
	}

	async getScatterConfig(geneLst): Promise<object> {
		if (!this.item) throw new Error('No item selected')
		const gene1 = geneLst[0].gene
		const gene2 = geneLst[1].gene

		return {
			chartType: 'sampleScatter',
			term: {
				$id: await digestMessage(`${gene1}-${this.item.sample}-${this.item.experiment}`),
				term: {
					type: SINGLECELL_GENE_EXPRESSION,
					gene: gene1,
					id: gene1,
					name: gene1,
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					}
				},
				q: { mode: 'continuous' }
			},
			term2: {
				$id: await digestMessage(`${gene2}-${this.item.sample}-${this.item.experiment}`),
				term: {
					type: SINGLECELL_GENE_EXPRESSION,
					gene: gene2,
					id: gene2,
					name: gene2,
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					}
				},
				q: { mode: 'continuous' }
			}
		}
	}

	getClusteringConfig(geneLst): object {
		if (!this.item) throw new Error('No item selected')
		//limit to 100 genes for performance
		const tws = geneLst.slice(0, 100).map(g => {
			return {
				term: {
					gene: g.gene,
					name: `${g.gene} ${this.settings.hierCluster.unit}`,
					type: SINGLECELL_GENE_EXPRESSION,
					sample: this.item
				},
				q: {}
			}
		})

		return {
			chartType: 'hierCluster',
			termgroups: [{ lst: tws, type: 'hierCluster' }],
			dataType: 'geneExpression',
			settings: { hierCluster: this.settings.hierCluster }
		}
	}

	async getSingleCellConfig(plotName): Promise<object> {
		if (!this.item) throw new Error('No item selected')
		const plot = this.scTermdbConfig.data.plots.find(p => p.name == plotName)
		if (!plot) throw new Error(`No plot by name ${plotName} in data.plots [PlotButtons.ts getSingleCellConfig()]`)
		const config: any = {
			chartType: 'sampleScatter',
			singleCellPlot: {
				name: plotName,
				sample: {
					sID: this.item.sample,
					eID: this.item.experiment
				}
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
			sample: {
				sID: item.sample,
				eID: item.experiment
			}
		})
		const id = await digestMessage(`${plot.name}-${item.sample}-${item.experiment}`)
		return Object.assign({ $id: id }, { term })
	}
}
