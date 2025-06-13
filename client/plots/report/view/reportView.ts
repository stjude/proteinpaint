import { select } from 'd3-selection'
import type { Report } from '../report.ts'
export class ReportView {
	opts: any
	dom: any
	report: Report
	loading: any
	loadingDiv: any

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

		this.dom = {
			mainDiv,
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			controlsHolder
		}

		if (this.dom.header) {
			this.dom.header.html(this.report.config.name || 'Summary Report')
		}
		document.addEventListener('scroll', () => this?.dom?.tooltip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', () => this.dom.tooltip.hide())
	}

	getControlInputs() {
		const inputs: any = []
		return inputs
	}
}
