import type { SummaryReport } from '../summaryReport.js'

export class SummaryReportModel {
	summaryReport: SummaryReport

	constructor(summaryReport: SummaryReport) {
		this.summaryReport = summaryReport
	}
}
