import type { Report } from '../report.ts'
import { icons as icon_functions } from '#dom/control.icons'

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
		const headerDiv = mainDiv.append('div').style('padding', '10px')

		const downloadDiv = headerDiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding-left', '10px')
			.style('vertical-align', 'middle')
		icon_functions['pdf'](downloadDiv, {
			handler: () => this.report.downloadReport(),
			title: 'Download the report',
			width: 20,
			height: 20
		})

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
	}

	getControlInputs() {
		const inputs: any = []
		return inputs
	}
}
