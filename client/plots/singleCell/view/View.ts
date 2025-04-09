import { make_one_checkbox } from '#dom'

export class View {
	viewData?: any
	plotDom: any

	constructor(dom) {
		const controlsDiv = dom.holder
			.append('div')
			.attr('data-testid', 'sjpp-single-cell-controls')
			.style('display', 'inline-block')
		const holder = dom.holder.append('div').style('display', 'inline-block')
		this.plotDom = {
			controlsDiv,
			actionsDiv: holder
				.append('div')
				.attr('data-testid', 'sjpp-single-cell-actions')
				.style('padding', '0px 10px 10px 10px'),
			plotDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-plot')
		}
	}

	render(viewData) {
		if (!viewData) return
		this.viewData = viewData
		this.renderActions()
	}

	renderActions() {
		if (!this.viewData.actions) return
		if (this.viewData.actions.plots) {
			this.plotDom.actionsDiv
				.append('span')
				.style('font-size', '0.8em')
				.style('vertical-align', 'middle')
				.style('opacity', 0.7)
				.text('PLOTS: ')

			for (const plot of this.viewData.actions.plots) {
				make_one_checkbox({
					holder: this.plotDom.actionsDiv,
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
}
