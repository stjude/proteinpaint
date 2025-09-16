import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, GeneSetEditUI } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { digestMessage } from '#termsetting'

/** Rendering for the plot buttons that appear below the sample
 * table.
 *
 * TODOs:
 * - Implement ds specific keys or logic for sample name
 * - Update anywhere with 'CHANGEME' before prod
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

	update(sample: { [key: string]: any }) {
		if (!sample) return
		this.sample = sample
		const name = sample.sample // add ds specific keys/logic here
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
			.on('click', (e, plot) => {
				if (plot.open) {
					this.chartBtnsDom.tip.clear().showunder(e.target)
					plot.open(plot, this)
				}
			})
	}

	/** TODOs:
	 * 1. btns will be visible based on available data. Need to build a route or change existing route to support
	 * 2. Implement logic for tsne, umap, etc.
	 */
	getChartBtnOpts() {
		return [
			{
				label: 'Gene expression',
				id: 'geneExpression',
				isVisible: () => true,
				getPlotConfig: async geneLst => {
					if (!geneLst.length) {
						console.warn('No genes selected to launch gene exp subplot [PlotButtons.ts getChartBtnOpts()]')
						return
					}
					if (geneLst.length == 1) return await this.getViolinConfig(geneLst[0].gene)
					else if (geneLst.length == 2) return this.getScatterConfig(geneLst)
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
	//In Dev: using 'cluster' as overlay
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
					id: 'cluster', //CHANGE ME
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

	getScatterConfig(geneLst) {
		console.log('TODO: enable scatter plot', geneLst)
	}

	getClusteringConfig(geneLst) {
		console.log('TODO: enable clustering plot', geneLst)
	}
}
