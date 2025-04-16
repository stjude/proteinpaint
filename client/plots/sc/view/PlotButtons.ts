import type { Div, Elem } from '../../../types/d3'
import { Menu, addGeneSearchbox } from '#dom'
import type { SCInteractions } from '../interactions/SCInteractions'

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
		const name = sample.sample //|| add ds specific keys/logic here
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
				isVisible: () => true, //TODO: implement data specific logic for this
				getPlotConfig: gene => {
					return {
						chartType: 'violin'
					}
				},
				open: this.showGeneSearch
			}
		]
	}

	//********** Btn Menus **********/
	//Use 'self' and not 'this' to avoid binding issues
	showGeneSearch(plot, self) {
		const row = self.plotBtnDom.tip.d.append('div')
		const geneSearch = addGeneSearchbox({
			row,
			tip: new Menu({ padding: '' }),
			searchOnly: 'gene',
			genome: self.interactions.genome,
			callback: async () => {
				const gene = geneSearch.geneSymbol
				self.plotBtnDom.tip.hide()
				await self.interactions.geneSearchboxCallback(gene, plot)
			}
		})
	}
}
