import type { ControlInputEntry } from '#mass/types/mass'
import type { VolcanoPlotConfig } from './VolcanoTypes'
import { getSampleNum } from './Volcano'

/** Handles settings the controls in the menu based on the app
 * termType.
 *
 * Add additional term type specific controls similar to
 * addGeneExpressionControlInputs(), called in
 * getVolcanoControlInputs()
 *
 * If control should show for multiple but not all term types,
 * then use the getDisplayStyle arg in the control object.
 * //getDisplayStyle: () => {}
 *
 * Preferably, keep all the display (e.g. colors, sizes, etc.) controls
 * at the bottom of the list or at least together
 */

export class VolcanoControlInputs {
	config: VolcanoPlotConfig
	sampleNum: number
	/** term type used to determine which controls to show */
	termType: string
	/** control inputs for controls init */
	inputs: ControlInputEntry[]
	constructor(config: VolcanoPlotConfig, termType: string) {
		this.config = config
		this.sampleNum = getSampleNum(config)
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
				max: 1,
				step: 0.05
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
				settingsKey: 'defaultSignColor',
				getDisplayStyle: () => {
					const controlColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[0].name]?.color
					const caseColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[1].name].color
					if (controlColor && caseColor) return 'none'
					else return ''
				}
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

	/** Add more term type specific controls here. */
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
				label: 'Method',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'method',
				title: 'Toggle between analysis methods',
				options: this.getMethodOptions()
			},
			{
				label: 'Rank Genes by',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'rankBy',
				title: 'Rank genes by either the absolute value of the fold change or the variance',
				options: [
					{ label: 'abs(Fold Change)', value: 'abs(foldChange)' },
					{ label: 'Variance', value: 'variance' }
				],
				//TODO: will enable this feature when there is backhand support
				getDisplayStyle: () => 'none'
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

	getMethodOptions() {
		if (this.termType !== 'geneExpression') return
		const settings = this.config.settings.volcano
		if (this.sampleNum < settings!.sampleNumCutoff) {
			return [
				{ label: 'edgeR', value: 'edgeR' },
				{ label: 'Wilcoxon', value: 'wilcoxon' },
				{ label: 'Limma', value: 'limma' }
			]
		} else return [{ label: 'Wilcoxon', value: 'wilcoxon' }]
	}
}
