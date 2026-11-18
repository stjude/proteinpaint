import type { ControlInputEntry } from '#mass/types/mass'
import type { VolcanoPlotConfig } from './VolcanoTypes'
import { findVolcanoHandler, isScanPlot as isScan } from './handlers'

/** Handles settings the controls in the menu based on the app
 * termType.
 *
 * The controls of a data type come from its handler's getControlInputs(), listed before the
 * shared ones here, and a handler may leave out a shared one (leavesOutControls). Add the type's
 * settings to settings/Settings.ts
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
		this.termType = termType
		this.elementTypes = elementTypes || []
		this.chromosomes = chromosomes || []
		/* Found, not required: the controls are built before the volcano requests its data, which is
		where an unsupported data type fails. */
		const handler = findVolcanoHandler(this.termType)
		/* A DAP volcano thresholds a single FDR (adjusted p-value); other data types threshold a
		p-value. */
		const fdrOnly = !!handler?.fdrOnly
		//Populated with the default controls for the volcano plot
		this.inputs = [
			{
				label: fdrOnly ? 'FDR significance (-log₁₀)' : 'P value significance (-log₁₀)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'pValue',
				title: fdrOnly
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
				getDisplayStyle: (plot: any) => (fdrOnly || isScan(plot) ? 'none' : ''),
				options: [
					{ label: 'Adjusted', value: 'adjusted' },
					{ label: 'Original', value: 'original' }
				]
			},
			// left out by a data type that plots another effect size, such as delta-beta
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
		].filter(i => !handler?.leavesOutControls?.includes(i.settingsKey!)) as ControlInputEntry[]

		// the controls of the data type come first
		this.inputs.splice(
			0,
			0,
			...(handler?.getControlInputs?.({ elementTypes: this.elementTypes, chromosomes: this.chromosomes }) || [])
		)
	}
}
