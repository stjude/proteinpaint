import type { SummaryReport } from '../summaryReport.js'

export class SummaryReportViewModel {
	summaryReport: SummaryReport

	constructor(summaryReport: SummaryReport) {
		this.summaryReport = summaryReport
	}
}
