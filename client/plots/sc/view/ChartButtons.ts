import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, GeneSetEditUI } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { digestMessage } from '#termsetting'

/** Rendering for the plot buttons that appear below the sample
 * table.
 *
 * Notes:
 *  - The hierarchical clustering limits to the first 100 genes.
 *
 ******* TODOs:
 * - Implement ds specific keys or logic for sample name
 * - Update anywhere with 'CHANGEME' before prod
 * - Disable all chart btns until plot loads for performance??
 *
 ******* Scatter plot implementation TODOs:
 * - Check that the proper single cell data is used
 * - Configure tooltip to use 'cell' and not 'sample'
 * - term2 in the config is currently defined in
 * queries.singlecell.data.plots.[i].colorColumns. Need to 1. change that dataset obj and
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
export class ChartButtons {
	chartBtnsDom: {
		promptDiv: Div
		selectPrompt: Elem
		btnsDiv: Div
		tip: Menu
	}
	sample?: { [key: string]: any }
	interactions: SCInteractions
	settings?: any

	constructor(interactions: SCInteractions, holder: Div) {
		holder.style('padding', '10px')
		const promptDiv = holder.append('div').style('padding', '10px 0').text('Select data from')
		this.chartBtnsDom = {
			promptDiv,
			selectPrompt: promptDiv.append('span'),
			btnsDiv: holder.append('div'),
			tip: new Menu({ padding: '' })
		}
		this.interactions = interactions
	}

	update(settings) {
		/** If the user has not selected a sample yet but clicks
		 * the select sample/plots btn above the table, the prompt appears
		 * unnecessarily */
		this.chartBtnsDom.promptDiv.style('display', !settings.sc.sample ? 'none' : 'block')
		if (!settings.sc.sample) return
		this.settings = settings
		this.sample = settings.sc.sample
		const name = settings.sc.sample.sample // add ds specific keys/logic here
		this.chartBtnsDom.selectPrompt.text(` ${name}:`)
		this.renderChartBtns()
	}

	renderChartBtns() {
		this.chartBtnsDom.btnsDiv.selectAll('*').remove()
		const btns = this.getChartBtnOpts()

		this.chartBtnsDom.btnsDiv
			.selectAll('button')
			.data(btns.filter(b => b.isVisible()))
			.enter()
			.append('button')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border', '1px solid rgb(237, 237, 237)')
			.style('background-color', '#CFE2F3')
			.style('margin', '0 10px')
			.style('cursor', 'pointer')
			.text(b => b.label)
			.on('click', async (e, plot) => {
				if (plot.open) {
					this.chartBtnsDom.tip.clear().showunder(e.target)
					plot.open(plot, this)
				}
				// else {
				// 	// const config = plot.getPlotConfig()
				// 	// await this.interactions.createSubplot(config)
				// }
			})
	}
	getChartBtnOpts() {
		return [
			// {
			// 	label: 'UMAP',
			// 	// id: 'umap',
			// 	isVisible: () => true,
			// 	getPlotConfig: async () => {
			// 		return {

			// 		}
			// 	}
			// },
			{
				label: 'Gene expression',
				// id: 'geneExpression',
				isVisible: () => true,
				getPlotConfig: async geneLst => {
					/** If 1 gene is selected, show violin
					 * If 2 genes are selected, show scatter
					 * If >2 genes are selected, show hier clustering */
					if (!geneLst.length) {
						alert('No genes selected to launch gene expression subplot [PlotButtons.ts getChartBtnOpts()]')
						return
					}
					if (geneLst.length == 1) return await this.getViolinConfig(geneLst[0].gene)
					else if (geneLst.length == 2) return await this.getScatterConfig(geneLst)
					else return this.getClusteringConfig(geneLst)
				},
				open: this.geneSearchMenu
			}
			//More plot buttons here: single cell, etc.
		]
	}

	//********** Btn Menus **********/
	geneSearchMenu(plot: any, self: ChartButtons) {
		self.chartBtnsDom.tip.clear()

		new GeneSetEditUI({
			holder: self.chartBtnsDom.tip.d.append('div') as any,
			genome: self.interactions.genome,
			vocabApi: {},
			callback: async result => {
				self.chartBtnsDom.tip.hide()
				const config = await plot.getPlotConfig(result.geneList)
				await self.interactions.createSubplot(config)
			}
		})
	}

	//********** Plot Config Helpers **********/
	async getViolinConfig(gene) {
		if (!this.sample) throw new Error('No sample selected')
		return {
			chartType: 'violin',
			term: {
				$id: await digestMessage(`${gene}-${this.sample.sample}-${this.sample.experiment}`),
				term: {
					/** NOTE: There are no term handlers for the single cell types */
					type: TermTypes.SINGLECELL_GENE_EXPRESSION,
					id: gene,
					gene,
					name: gene,
					sample: {
						sID: this.sample.sample,
						eID: this.sample.experiment
					}
				}
			},
			term2: {
				//CHANGE ME
				$id: await digestMessage(`CHANGEME-${this.sample.sample}-${this.sample.experiment}`),
				term: {
					/** NOTE: There are no term handlers for the single cell types */
					type: TermTypes.SINGLECELL_CELLTYPE,
					id: 'cluster', //CHANGE ME, singlecell.data.plots.[i].colorColumns
					name: 'cluster', //CHANGE ME
					sample: {
						sID: this.sample.sample,
						eID: this.sample.experiment
					},
					plot: 'UMAP' //CHANGEME
				}
			}
		}
	}

	async getScatterConfig(geneLst) {
		if (!this.sample) throw new Error('No sample selected')
		const gene1 = geneLst[0].gene
		const gene2 = geneLst[1].gene

		return {
			chartType: 'sampleScatter',
			term: {
				$id: await digestMessage(`${gene1}-${this.sample.sample}-${this.sample.experiment}`),
				term: {
					type: TermTypes.SINGLECELL_GENE_EXPRESSION,
					gene: gene1,
					id: gene1,
					name: gene1,
					q: { mode: 'continuous' },
					sample: {
						sID: this.sample.sample,
						eID: this.sample.experiment
					}
				}
			},
			term2: {
				$id: await digestMessage(`${gene2}-${this.sample.sample}-${this.sample.experiment}`),
				term: {
					type: TermTypes.SINGLECELL_GENE_EXPRESSION,
					gene: gene2,
					id: gene2,
					name: gene2,
					q: { mode: 'continuous' },
					sample: {
						sID: this.sample.sample,
						eID: this.sample.experiment
					}
				}
			}
		}
	}

	getClusteringConfig(geneLst) {
		//limit to 100 genes for performance
		const tws = geneLst.slice(0, 100).map(g => {
			return {
				term: {
					gene: g.gene,
					name: `${g.gene} ${this.settings.hierClusterUnit}`,
					type: TermTypes.SINGLECELL_GENE_EXPRESSION,
					sample: this.sample
				},
				q: {}
			}
		})

		return {
			chartType: 'hierCluster',
			termgroups: [{ lst: tws, type: 'hierCluster' }],
			dataType: TermTypes.GENE_EXPRESSION,
			settings: { hierCluster: this.settings.hierCluster }
		}
	}
}
