import { select } from 'd3-selection'
import type { Report } from '../report.ts'
export class ReportView {
	opts: any
	dom: any
	report: Report

	constructor(report: Report) {
		this.opts = report.opts
		this.report = report

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
		const headerDiv = mainDiv.append('div').style('padding', '10px 0px 10px 0px')
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

		if (this.report.config.countryTW) {
			this.dom.headerDiv.append('label').text('Country: ')
			const select = this.dom.headerDiv.append('select')
			select.append('option').attr('value', '').text('')
			for (const value in this.report.config.countryTW.term.values) {
				const country = this.report.config.countryTW.term.values[value].label
				select.append('option').attr('value', country).text(country)
			}
			select.on('change', async () => {
				const country = select.property('value')
				await this.report.replaceGlobalFilter(country)
			})
		}
	}

	getControlInputs() {
		const inputs: any = []
		return inputs
	}
}
