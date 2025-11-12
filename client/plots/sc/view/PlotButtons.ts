import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, GeneSetEditUI } from '#dom'
import { digestMessage } from '#termsetting'

/** Rendering for the plot buttons that appear below the item
 * table.
 *
 * Notes:
 *  - The hierarchical clustering limits to the first 100 genes.
 *
 ******* TODOs:
 * - Implement ds specific keys or logic for item name
 * - Update anywhere with 'CHANGEME' before prod
 * - Disable all plot btns until plot loads for performance??
 *
 ******* Scatter plot implementation TODOs:
 * - Check that the proper single cell data is used
 * - Configure tooltip to use 'cell' and not 'sample'
 * - term2 in the config is currently defined in
 * queries.singlecell.data.plots.[i].colorColumns. Need to:
 * 1. change that dataset obj and
 * 2. use new obj in the config
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
			getPlotConfig: (f?: any, g?: any) => any
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
					//TODO: refine this config
					return {
						chartType: 'differentialAnalysis',
						termType: 'singleCellCellType',
						//Eventually category will be updated to a term
						// term: {
						// 	name: term
						// },
						categoryName: `${value}`,
						columnName: this.data.plots[0].colorBy || 'Cluster', //CHANGEME
						sample: this.item!.experiment || this.item!.sample
					}
				}
			}
		)
		return btns
	}

	//********** Btn Menus **********/
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

	/** CHANGEME: This elem is a placeholder for now
	 * Ideally this will call the tree with singleCellCellTerms.
	 * That term type is not implemented yet. Once it is,
	 * refactor this workflow to use the tree. */
	termDropdownMenu(plot: any, self: PlotButtons) {
		//CHANGEME: This ds obj needs to be defined as a term, not column name
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
					/** NOTE: There are no term handlers for the single cell types */
					type: 'singleCellGeneExpression',
					id: gene,
					gene,
					name: gene,
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					}
				}
			},
			term2: {
				//CHANGE ME
				$id: await digestMessage(`CHANGEME-${this.item.sample}-${this.item.experiment}`),
				term: {
					/** NOTE: There are no term handlers for the single cell types */
					type: 'singleCellCellType',
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
					type: 'singleCellGeneExpression',
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
					type: 'singleCellGeneExpression',
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
					type: 'singleCellGeneExpression',
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
		const cfg: any = {
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
			cfg.colorTW = {
				$id: await digestMessage(`${plot.name}-${this.item.sample}-${this.item.experiment}`),
				term: {
					type: 'singleCellCellType',
					name: plot.colorColumns[0].name,
					sample: {
						sID: this.item.sample,
						eID: this.item.experiment
					},
					plot: plotName
				}
			}
		}
		return cfg
	}
}
