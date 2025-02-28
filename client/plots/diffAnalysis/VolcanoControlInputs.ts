/** Handles settings the controls in the menu based on the app
 * termType.
 *
 * Add additional term type specific controls similar to
 * addGeneExpressionControlInputs(), called in
 * getVolcanoControlInputs()
 *
 * If a controls out to show for multiple but not all term types,
 * then use the getDisplayStyle arg in the control object.
 * //getDisplayStyle: () => {}
 *
 * Preferably, keep all the display (e.g. colors, sizes, etc.) controls
 * at the bottom of the list or at least together
 */

export class VolcanoControlInputs {
	/** term type used to determine which controls to show */
	termType: string
	/** control inputs for controls init */
	inputs: any
	constructor(termType) {
		this.termType = termType
		//Populated with the default controls for the volcano plot
		this.inputs = [
			{
				label: 'P value significance (linear)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'pValue',
				title: 'The p-value threshold to determine statistical significance',
				min: 0,
				max: 1
			},
			{
				label: 'P value',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'pValueType',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'Adjusted', value: 'adjusted' },
					{ label: 'Original', value: 'original' }
				]
			},
			{
				label: 'Show P value table',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'showPValueTable',
				title: 'Show table with both original and adjusted p values for all significant genes',
				boxLabel: ''
			},
			//Preferably, keep all the display (e.g. colors, sizes, etc.) controls
			//at the bottom of the list or at least together
			{
				label: 'Plot height',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'height',
				title: 'Height of the plot in pixels',
				min: 300,
				max: 1000
			},
			{
				label: 'Plot width',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'width',
				title: 'Width of the plot in pixels',
				min: 300,
				max: 1000
			},
			{
				label: 'Significant value color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultSignColor'
			},
			{
				label: 'Non-significant value color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultNonSignColor'
			},
			{
				label: 'Highlight color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultHighlightColor'
			}
		]

		this.setVolcanoControlInputs()
	}

	setVolcanoControlInputs() {
		this.addGeneExpressionControlInputs()
	}

	addGeneExpressionControlInputs() {
		if (this.termType !== 'geneExpression') return
		const geInputs = [
			{
				label: 'Minimum read count',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minCount',
				title: 'The smallest number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'Minimum total read count',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minTotalCount',
				title: 'The smallest total number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'Fold change (log)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'foldChangeCutoff',
				title: 'The fold change threshold to determine biological significance',
				min: -10,
				max: 10
			},
			{
				label: 'Variable genes cutoff',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'varGenesCutoff',
				title: 'Top number of genes with the highest variability to include in analysis',
				min: 1000,
				max: 4000
			}
			//Not enabling this feature
			//needs more discussion
			//Better as a control above the volcano plot?
			// {
			// 	label: 'Gene Set Overrepresentation Analysis',
			// 	type: 'radio',
			// 	chartType: 'volcano',
			// 	settingsKey: 'geneORA',
			//     styles: { display: 'block' },
			// 	title: 'Toggle to check if certain gene sets are overrepresented among upregulated, downregulated, or both sets of genes',
			// 	options: [
			// 		{ label: 'Upregulated', value: 'upregulated' },
			// 		{ label: 'Downregulated', value: 'downregulated' },
			// 		{ label: 'Both', value: 'both' }
			// 	],
			//     getDisplayStyle: () => (this.app.opts.genome.termdbs ? '' : 'none')
			// },
		]

		this.inputs.splice(0, 0, ...geInputs)
	}
}
