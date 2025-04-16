import type { Elem } from '../../../types/d3'

export class PlotButtons {
	plotBtnDom: {
		promptDiv: Elem
		selectPrompt: Elem
		btnsDiv: Elem
	}
	sample?: any

	constructor(holder) {
		const promptDiv = holder.append('div').style('padding', '10px 0').text('Select data from')
		this.plotBtnDom = {
			promptDiv,
			selectPrompt: promptDiv.append('span'),
			btnsDiv: holder.append('div')
		}
	}

	update(sample) {
		this.sample = sample
		const name = sample.sample
		this.plotBtnDom.selectPrompt.text(` ${name}:`)
		this.renderChartBtns()
	}

	renderChartBtns() {
		this.plotBtnDom.btnsDiv.selectAll('*').remove()
		const btns = this.getBtnOpts()
		for (const btn of btns) {
			this.makeBtn(btn)
		}
	}

	getBtnOpts() {
		return [
			{
				label: 'Violin',
				id: 'violin',
				isVisible: () => true, //TODO: implement data logic for this
				getPlotConfig: () => {
					return {
						chartType: 'violin',
						settings: {
							//TODO
						}
					}
				}
			}
		]
	}

	makeBtn(btn) {
		this.plotBtnDom.btnsDiv
			.append('button')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border', '1px solid rgb(237, 237, 237)')
			.style('background-color', '#CFE2F3')
			.style('margin', '10px')
			.style('cursor', 'pointer')
			.text(btn.label)
			.on('click', () => {
				//TODO: launch plot to sample section of dashboard
			})
	}
}
