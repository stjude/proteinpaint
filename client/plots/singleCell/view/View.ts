import type { Elem } from '../../../types/d3'
import { make_one_checkbox } from '#dom'
import type { SingleCellViewData } from '../SingleCellTypes'
import { Plot } from './Plot'
/**
 * TODOs:
 * - add types
 * - add comments
 */
export class View {
	viewData?: SingleCellViewData
	plotsDom: {
		actionsDiv: Elem
		plotsDiv: Elem
	}

	constructor(dom) {
		const holder = dom.holder.append('div').style('display', 'inline-block')
		this.plotsDom = {
			actionsDiv: holder
				.append('div')
				.attr('data-testid', 'sjpp-single-cell-actions')
				.style('padding', '0px 10px 10px 10px'),
			plotsDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-plot')
		}
	}

	render(viewData) {
		if (!viewData) return
		this.viewData = viewData
		//TODO: move into init based on config instead of viewModel
		this.renderActions()
		//TODO: Move to update()
		this.renderPlots()
	}

	renderActions() {
		if (!this.viewData || !this.viewData.actions) return
		if (this.viewData.actions.plots) {
			this.plotsDom.actionsDiv
				.append('span')
				.style('font-size', '0.8em')
				.style('vertical-align', 'middle')
				.style('opacity', 0.7)
				.text('PLOTS: ')

			for (const plot of this.viewData.actions.plots) {
				make_one_checkbox({
					holder: this.plotsDom.actionsDiv,
					labeltext: plot.name,
					checked: plot.selected,
					id: `${plot.name}-checkbox`,
					divstyle: { display: 'inline-block', 'margin-right': '5px' },
					callback: () => {
						//TODO: interaction here
					}
				})
			}
		}
	}

	renderPlots() {
		if (!this.viewData || !this.viewData.plotsData) return
		this.plotsDom.plotsDiv.selectAll('*').remove()
		for (const plotData of this.viewData.plotsData) {
			new Plot(plotData, this.plotsDom.plotsDiv)
		}
	}
}
