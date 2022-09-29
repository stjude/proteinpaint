module.exports = {
	isMds3: true,
	genome: 'hg38',

	cohort: {
		// data downloading is disabled, can reenable later
		allowedChartTypes: ['barchart', 'matrix'],

		db: { file: 'files/hg38/ALL-pharmacotyping/clinical/db' },
		termdb: {}
	}
}
