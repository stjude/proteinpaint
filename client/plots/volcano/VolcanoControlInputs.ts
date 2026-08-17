import type { ControlInputEntry } from '#mass/types/mass'
import type { VolcanoPlotConfig } from './VolcanoTypes'
import { getSampleNum } from './settings/defaults'
import { PROTEOME_DAP, DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#types'

/** Handles settings the controls in the menu based on the app
 * termType.
 *
 * Add additional term type specific controls similar to
 * addGeneExpressionControlInputs(), called in
 * getVolcanoControlInputs(). Add the type to settings/Settings.ts
 *
 * If control should show for multiple but not all term types,
 * then use the getDisplayStyle arg in the control object.
 * //getDisplayStyle: () => {}
 *
 * Preferably, keep all the display (e.g. colors, sizes, etc.) controls
 * at the bottom of the list or at least together
 */

export class VolcanoControlInputs {
	config: any
	sampleNum?: number
	/** term type used to determine which controls to show */
	termType: string
	/** control inputs for controls init */
	inputs: ControlInputEntry[]
	/** Regulatory-element classes this dataset can test, from
	 * termdbConfig.queries.dnaMethylation.elementTypes. Empty or single-entry means
	 * there is nothing to choose between, and the element picker stays hidden. */
	elementTypes: { key: string; label: string }[]
	constructor(config: VolcanoPlotConfig, termType: string, elementTypes?: { key: string; label: string }[]) {
		this.config = config
		if (this.config.termType == GENE_EXPRESSION) this.sampleNum = getSampleNum(config)
		this.termType = termType
		this.elementTypes = elementTypes || []
		//Populated with the default controls for the volcano plot
		this.inputs = [
			{
				// DAP volcanoes threshold a single FDR (adjusted p-value); other term types
				// threshold a p-value.
				label: this.config.termType == PROTEOME_DAP ? 'FDR significance (-log₁₀)' : 'P value significance (-log₁₀)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'pValue',
				title:
					this.config.termType == PROTEOME_DAP
						? 'The FDR threshold to determine statistical significance'
						: 'The p-value threshold to determine statistical significance',
				min: 0,
				// 5e-324 is the smallest positive number greater than 0 representable
				// in IEEE 64-bit floating point (i.e. javascripts native Number.MIN_VALUE)
				// -Math.log10(5e-324) = 323.3
				max: 323.3,
				step: 1
			},
			{
				label: 'P value',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'pValueType',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				// DAP files carry only a single FDR, so there is nothing to toggle between.
				getDisplayStyle: () => (this.config.termType == PROTEOME_DAP ? 'none' : ''),
				options: [
					{ label: 'Adjusted', value: 'adjusted' },
					{ label: 'Original', value: 'original' }
				]
			},
			{
				label: 'Fold change (log₂)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'foldChangeCutoff',
				title: 'The fold change threshold to determine biological significance',
				min: -10,
				max: 10
			},
			{
				label: 'Max interactive dots',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'maxInteractiveDots',
				title:
					'Cap on the number of top-significant points the server returns as interactive overlay circles. The PNG still shows every dot.',
				min: 0,
				max: 20000,
				step: 100
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
				title: 'Default color for significant data points.',
				settingsKey: 'defaultSignColor',
				getDisplayStyle: () => {
					if (this.config.termType == SINGLECELL_CELLTYPE) return 'none'
					const controlColor = this.config.tw?.term?.values?.[this.config.samplelst.groups[0].name]?.color
					const caseColor = this.config.tw?.term?.values?.[this.config.samplelst.groups[1].name].color
					if (controlColor && caseColor) return 'none'
					else return ''
				}
			},
			{
				label: 'Non-significant value color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for non-significant data points.',
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
		this.addGeneExpControlInputs()
		this.addDNAMethControlInputs()
		this.addSingleCellCTControlInputs()
	}

	addGeneExpControlInputs() {
		if (this.termType !== GENE_EXPRESSION) return
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
				label: 'CPM cutoff',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'cpmCutoff',
				title: 'The minimum normalized expression threshold to retain only genes with sufficient expression',
				min: 0
			},
			{
				label: 'Method',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'method',
				title: 'Toggle between analysis methods',
				options: this.getMethodOptions()
			}
			// {
			// 	label: 'Rank Genes by',
			// 	type: 'radio',
			// 	chartType: 'volcano',
			// 	settingsKey: 'rankBy',
			// 	title: 'Rank genes by either the absolute value of the fold change or the variance',
			// 	options: [
			// 		{ label: 'abs(Fold Change)', value: 'abs(foldChange)' },
			// 		{ label: 'Variance', value: 'variance' }
			// 	],
			// 	//TODO: will enable this feature when there is backhand support
			// 	getDisplayStyle: () => 'none'
			// }
		]

		this.inputs.splice(0, 0, ...geInputs)
	}

	addDNAMethControlInputs() {
		if (this.termType !== DNA_METHYLATION) return
		const dmInputs: any[] = [
			/* Element class comes FIRST because it is categorically different from the
			controls below it: those tune how the test is run, this one changes what is
			being tested. Promoters, eQTM blocks, and cCRE classes are different genomic
			features with different coordinates and different test counts, so switching
			produces a different analysis rather than a refined one.

			Hidden unless the dataset offers a genuine choice -- a single class means
			there is nothing to pick, and a dataset using the legacy promoter-only config
			gets no new UI at all. */
			...(this.elementTypes.length > 1
				? [
						{
							label: 'Element class',
							type: 'dropdown',
							chartType: 'volcano',
							settingsKey: 'elementType',
							options: this.elementTypes.map(e => ({ value: e.key, label: e.label })),
							title:
								'Which regulatory elements to test. This changes the features being analysed, not just the thresholds: promoters are TSS windows, eQTM blocks are runs of CpGs whose methylation correlates with a gene, and cCRE classes are ENCODE annotations. Hit counts are not comparable across classes because the number of tests differs.'
						}
				  ]
				: []),
			{
				label: 'Min samples per group',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minSamplesPerGroup',
				title: 'Minimum non-NA samples required per group for a promoter to be tested',
				min: 1,
				max: 100
			},
			{
				label: 'Exclude sex chromosomes',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'excludeSexChr',
				boxLabel: '',
				title:
					'Drop chrX/chrY promoters. Recommended for mixed-sex cohorts — X-inactivation makes chrX methylation strongly sex-dependent, so a sex-imbalanced comparison reports sex rather than the grouping variable.'
			},
			{
				label: 'Mean-variance trend',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'eBayesTrend',
				boxLabel: '',
				title:
					'limma eBayes(trend=TRUE): fit the prior variance as a function of average M-value instead of assuming one constant prior. M-value variance is mean-dependent — promoters at intermediate methylation are much noisier than fully methylated or unmethylated ones.'
			},
			{
				label: 'Robust variance moderation',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'eBayesRobust',
				boxLabel: '',
				title:
					'limma eBayes(robust=TRUE): down-weight promoters whose variance is a gross outlier when estimating hyperparameters, so a few wild rows cannot drag the prior. Recommended together with the mean-variance trend when the two groups are very unbalanced.'
			},
			{
				label: 'Per-sample weights',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'arrayWeights',
				boxLabel: '',
				title:
					'limma arrayWeights(): estimate one weight per sample and down-weight consistently noisy samples. Unlike the two options above this acts across samples, not across promoters, and it does change fold-changes. Use it when a group is small enough that one aberrant sample could dominate it, or when the two arms may have unequal variance. Slowest of the three — it runs an iterative REML fit.'
			}
		]
		this.inputs.splice(0, 0, ...dmInputs)
	}

	addSingleCellCTControlInputs() {
		if (this.termType !== SINGLECELL_CELLTYPE) return

		const scctInputs = []

		this.inputs.splice(0, 0, ...scctInputs)
	}

	getMethodOptions() {
		if (this.termType !== GENE_EXPRESSION) return
		const settings = this.config.settings.volcano
		const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
		if (features?.runDE_methods?.length) {
			const opts: { label: string; value: string }[] = []
			for (const m of features.runDE_methods) {
				opts.push({ label: m, value: m.toLowerCase() })
			}
			return opts
		}
		if (this.sampleNum! < settings!.sampleNumCutoff) {
			return [
				{ label: 'edgeR', value: 'edgeR' },
				{ label: 'Wilcoxon', value: 'wilcoxon' },
				{ label: 'Limma', value: 'limma' }
			]
		} else return [{ label: 'Wilcoxon', value: 'wilcoxon' }]
	}
}
