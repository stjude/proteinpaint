import { select } from 'd3-selection'
import type { Report } from '../report.ts'

export class ReportView {
	opts: any
	dom: any
	report: Report

	constructor(report: Report) {
		this.opts = report.opts
		this.report = report
		this.opts.holder.style('transform', 'scale(0.85)').style('transform-origin', '0 0')
		const leftDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		const controlsHolder = leftDiv
			.insert('div')
			.style('display', 'inline-block')
			.attr('class', 'pp-termdb-plot-controls')
		const mainDiv = this.opts.holder
			.insert('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '20px')
		const headerDiv = mainDiv.append('div')
		const plotsDiv = mainDiv.append('div')

		this.dom = {
			headerDiv,
			plotsDiv,
			header: this.opts.header,
			//holder,
			controlsHolder
		}

		if (this.dom.header) {
			this.dom.header.html(this.report.config.name || 'Summary Report')
		}
		document.addEventListener('scroll', () => this?.dom?.tooltip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', () => this.dom.tooltip.hide())
		this.dom.filterSelects = []
		if (this.report.config.filterTWs) {
			headerDiv.style('padding', '20px 0px 20px 0px')
			for (const tw of this.report.config.filterTWs) {
				this.dom.headerDiv.append('label').text(` ${tw.term.name}: `).style('vertical-align', 'top')
				let timeoutId
				const select = this.dom.headerDiv.append('select').property('multiple', true).attr('size', '5')

				select.on('change', async () => {
					clearTimeout(timeoutId)
					timeoutId = setTimeout(() => {
						const values = Array.from(select.node().selectedOptions).map((o: any) => o.value)
						this.report.settings[tw.term.id] = values
						this.report.replaceFilter()
					}, 1000)
				})
				this.dom.filterSelects.push(select)
			}
		}
	}

	getControlInputs() {
		const inputs: any = []
		return inputs
	}
}
