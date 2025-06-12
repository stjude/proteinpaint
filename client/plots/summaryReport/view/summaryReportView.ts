import { select } from 'd3-selection'
import type { SummaryReport } from '../summaryReport'
export class SummaryReportView {
	opts: any
	dom: any
	summaryReport: SummaryReport
	loading: any
	loadingDiv: any

	constructor(summaryReport: SummaryReport) {
		this.opts = summaryReport.opts
		this.summaryReport = summaryReport

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
			this.dom.header.html(this.summaryReport.config.name || 'Summary Report')
		}
		document.addEventListener('scroll', () => this?.dom?.tooltip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', () => this.dom.tooltip.hide())
	}

	getControlInputs() {
		const inputs: any = []
		return inputs
	}
}
