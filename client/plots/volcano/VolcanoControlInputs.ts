import type { ControlInputEntry } from '#mass/types/mass'
import type { VolcanoPlotConfig } from './VolcanoTypes'
import { getSampleNum } from './settings/defaults'
import { PROTEOME_DAP, DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE, DMR_SCAN_ELEMENT_TYPE } from '#types'

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

/** Whether the plot's current element class is the de novo DMR scan. Read from the live plot
 * config the controls are re-rendered with, not the config captured at construction, so the scan
 * knobs appear and disappear as the class picker changes. */
const isScan = (plot: any) => plot?.settings?.volcano?.elementType == DMR_SCAN_ELEMENT_TYPE

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
	/** Major chromosomes of the genome, for the DMR scan's region picker. */
	chromosomes: string[]
	constructor(
		config: VolcanoPlotConfig,
		termType: string,
		elementTypes?: { key: string; label: string }[],
		chromosomes?: string[]
	) {
		this.config = config
		if (this.config.termType == GENE_EXPRESSION) this.sampleNum = getSampleNum(config)
		this.termType = termType
		this.elementTypes = elementTypes || []
		this.chromosomes = chromosomes || []
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
				// DAP files carry only a single FDR, and a DMR scan a single p, so there is nothing to
				// toggle between
				getDisplayStyle: (plot: any) => (this.config.termType == PROTEOME_DAP || isScan(plot) ? 'none' : ''),
				options: [
					{ label: 'Adjusted', value: 'adjusted' },
					{ label: 'Original', value: 'original' }
				]
			},
			/* Hidden for differential methylation: a DM run plots and thresholds on delta-beta,
			so a log2 cutoff would set a limit in units the plot never shows. Every other term
			type still gets it. */
			...(this.termType === DNA_METHYLATION
				? []
				: [
						{
							label: 'Fold change (log₂)',
							type: 'number',
							chartType: 'volcano',
							settingsKey: 'foldChangeCutoff',
							title: 'The fold change threshold to determine biological significance',
							min: -10,
							max: 10
						}
				  ]),
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
		const scanOnly = (plot: any) => (isScan(plot) ? '' : 'none')
		const notScan = (plot: any) => (isScan(plot) ? 'none' : '')
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
								'Which regulatory elements to test. This changes the features being analysed, not just the thresholds: promoters are TSS windows (-1500/+500 bp, the 450K array definition), cCRE promoters are the ~349 bp ENCODE promoter-like elements (the CpG-island core, no shores), eQTM blocks are runs of CpGs whose methylation correlates with a gene, and the other cCRE classes are ENCODE enhancer and CTCF annotations. Hit counts are not comparable across classes because the number of tests and the genes covered both differ. Narrow elements recover focal signal that a wide window averages away; wide windows do better on broad marks.'
						}
				  ]
				: []),
			/* The scan's own knobs, shown only while the scan is the selected class. The chromosome
			picker is a plain dropdown rather than the region search box: string2pos() turns a bare
			"chr20" into a 20kb window at the chromosome midpoint, which would silently scan 0.005% of
			the target. chrM is left out -- 16.5 kb of circular DNA that cannot carry a domain. */
			{
				label: 'Scan',
				type: 'dropdown',
				chartType: 'volcano',
				settingsKey: 'scanChromosome',
				getDisplayStyle: scanOnly,
				options: [
					{ value: '', label: 'Whole genome' },
					...this.chromosomes.filter(c => c != 'chrM' && c != 'chrMT').map(c => ({ value: c, label: c }))
				],
				title:
					'Call DMRs de novo across the whole genome, or across one chromosome. A whole-genome scan takes a minute or two the first time and is cached after that.'
			},
			{
				label: 'Correct for background drift',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'backgroundCorrection',
				boxLabel: '',
				getDisplayStyle: scanOnly,
				title:
					'Score each DMR against width- and CpG-density-matched intergenic background instead of against zero, so the y axis asks "did this region move MORE than a region like it drifts" rather than "did it move". On a cohort whose whole genome shifts, the two questions have different answers -- on MMRF NSD2-high the hyper:hypo direction inverts. DMRs whose stratum holds too little background to score are counted in Statistics but not plotted. Roughly doubles the scan time.'
			},
			{
				label: 'Min CpGs per DMR',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minCpgs',
				getDisplayStyle: scanOnly,
				min: 1,
				max: 1000,
				title:
					'Drop DMRs called from fewer CpGs. Two-CpG calls carry the largest effect sizes and no direction (51.5% hyper on MMRF chr1, a coin flip, against 58% for 10+ CpG calls), so a Δβ-sorted table would lead with the rows that mean least. Applied to the cached scan, so changing it redraws rather than refits.'
			},
			{
				/* Display width for the methylome-wide profile only. The metric is the 100 kb bin and
				the Statistics rows stay on it whatever this says -- this is here because 29,000 dots
				over 1,000 px overlap however small the dot, so the native figure reads as a band. */
				label: 'Profile bin width',
				type: 'dropdown',
				chartType: 'volcano',
				settingsKey: 'profileBinBp',
				getDisplayStyle: scanOnly,
				options: [
					{ value: 100_000, label: '100 Kb (native)' },
					{ value: 500_000, label: '500 Kb' },
					{ value: 1_000_000, label: '1 Mb' },
					{ value: 5_000_000, label: '5 Mb' }
				],
				// a <select> hands back its value as a string; the setting is a width in bp
				processInput: (v: string) => Number(v),
				title:
					'How wide a bin the methylome-wide profile draws. 100 kb is the width the metric is computed and reported at (Zhou 2018); the coarser widths average neighbouring bins into one dot, weighted by the CpGs each rests on, so a genome-wide shift is legible instead of hidden in a band of overlapping dots. Display only: the Statistics rows and the fraction-of-bins-moved figures stay on the 100 kb bins, and changing this redraws the cached scan rather than refitting it. The most extreme 1,000 bins per direction stay hoverable at any width.'
			},
			{
				label: 'Min samples per group',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minSamplesPerGroup',
				title: 'Minimum non-NA samples required per group for a promoter to be tested',
				// the scan resolves its own groups (3+ per group, fixed) and has no per-element NA filter
				getDisplayStyle: notScan,
				min: 1,
				max: 100
			},
			{
				label: 'Exclude sex chromosomes',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'excludeSexChr',
				boxLabel: '',
				// the scan has its own chromosome picker, and chrX is a track of its own on the map
				getDisplayStyle: notScan,
				title:
					'Drop chrX/chrY promoters. Recommended for mixed-sex cohorts — X-inactivation makes chrX methylation strongly sex-dependent, so a sex-imbalanced comparison reports sex rather than the grouping variable.'
			},
			{
				label: 'Center Δβ on median',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'centerDeltaBeta',
				boxLabel: '',
				// the background correction is the scan's version of this question
				getDisplayStyle: notScan,
				title:
					'Move the Δβ origin to the median across all tested elements, so 0 is the typical element rather than no change. Use it to ask "which elements moved MORE than the typical one" — at a symmetric cutoff, a contrast whose whole distribution sits off zero clears the hyper threshold more easily than the hypo one, which skews the hyper:hypo ratio on its own. Leave it off to ask "which elements gained or lost methylation", since a genuine genome-wide shift is itself a result and centering would subtract it. The Δβ values in the table and its download are unaffected either way.'
			},
			{
				label: 'Min Δβ',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'deltaBetaCutoff',
				title:
					'Effect-size cutoff for differential methylation, applied to Δβ. 0.1 is a 10-percentage-point change in methylation, the conventional floor for calling a region differentially methylated. Kept separate from the log₂ cutoff because the two are not interchangeable.',
				min: 0,
				max: 1,
				step: 0.01
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
