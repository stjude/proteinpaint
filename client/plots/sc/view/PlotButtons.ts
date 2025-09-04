import type { Div, Elem } from '../../../types/d3'
import type { SCInteractions } from '../interactions/SCInteractions'
import { Menu, addGeneSearchbox } from '#dom'

/** Rendering for the plot buttons that appear below the sample
 * table.
 *
 * TODOs:
 * - Implement ds specific keys or logic for sample name
 * */
export class PlotButtons {
	plotBtnDom: {
		promptDiv: Div
		selectPrompt: Elem
		btnsDiv: Div
		tip: Menu
	}
	sample?: { [key: string]: any }
	interactions: SCInteractions

	constructor(interactions: SCInteractions, holder: Div) {
		const promptDiv = holder.append('div').style('padding', '10px 0').text('Select data from')
		this.plotBtnDom = {
			promptDiv,
			selectPrompt: promptDiv.append('span'),
			btnsDiv: holder.append('div'),
			tip: new Menu({ padding: '' })
		}
		this.interactions = interactions
	}

	update(sample: { [key: string]: any }) {
		this.sample = sample
		const name = sample.sample // add ds specific keys/logic here
		this.plotBtnDom.selectPrompt.text(` ${name}:`)
		this.renderChartBtns()
	}

	renderChartBtns() {
		this.plotBtnDom.btnsDiv.selectAll('*').remove()
		const btns = this.getBtnOpts()

		this.plotBtnDom.btnsDiv
			.selectAll('button')
			.data(btns)
			.enter()
			.append('button')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border', '1px solid rgb(237, 237, 237)')
			.style('background-color', '#CFE2F3')
			.style('margin', '10px')
			.style('cursor', 'pointer')
			.text(b => b.label)
			.on('click', (e, plot) => {
				if (plot.open) {
					this.plotBtnDom.tip.clear().showunder(e.target)
					plot.open(plot, this)
				}
			})
	}

	getBtnOpts() {
		return [
			{
				label: 'Violin',
				id: 'violin',
				/** TODO: btns will be visible based on available data
				 * Need to build a route or change existing route to support
				 */
				isVisible: () => true,
				getPlotConfig: () => {
					return {
						chartType: 'violin'
						//TODO: Finish config
					}
				},
				open: this.geneSearchMenu
			}
			//More plot buttons here: single cell, etc.
		]
	}

	//********** Btn Menus **********/
	//Use 'self' and not 'this' to avoid binding issues
	geneSearchMenu(plot: any, self: PlotButtons) {
		const row = self.plotBtnDom.tip.d.append('div')
		const geneSearch = addGeneSearchbox({
			row,
			tip: new Menu({ padding: '' }),
			searchOnly: 'gene',
			genome: self.interactions.genome,
			callback: async () => {
				const gene = geneSearch.geneSymbol
				if (!gene) return
				self.plotBtnDom.tip.hide()
				await self.interactions.geneSearchboxCallback(gene, plot)
			}
		})
	}
}
