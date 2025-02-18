export function getDEanalysisControls() {
	const inputs = [
		{
			label: 'Minimum Read Count',
			type: 'number',
			chartType: 'DEanalysis',
			settingsKey: 'min_count',
			title: 'The smallest number of reads required for a gene to be considered in the analysis',
			min: 0,
			max: 10000
		},
		{
			label: 'Minimum Total Read Count',
			type: 'number',
			chartType: 'DEanalysis',
			settingsKey: 'min_total_count',
			title: 'The smallest total number of reads required for a gene to be considered in the analysis',
			min: 0,
			max: 10000
		}
	]

	return inputs
}
