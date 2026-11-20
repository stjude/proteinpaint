import { roundValue } from '#shared/roundValue.js'
// the sample limits of a run, shared with the server, which enforces them
import { sampleLimitAlert } from '#shared'
import { findVolcanoHandler, getSampleNum } from '../handlers'
import type { ValidatedVolcanoSettings, DefaultVolcanoSettings } from '../settings/Settings'

/* The settings of a data type live in its handler (../handlers/). These are exported here too, for
the code that imports them from the volcano's settings. */
export {
	DMRCATE_DEFAULTS,
	SCAN_Y_AXIS_OPTIONS,
	onDeltaBetaAxis,
	getSpliceMethodOptions,
	scaleDsFilters,
	getSampleNum
} from '../handlers'

/*********** Set default settings per termType ***********/
export function getDefaultVolcanoSettings(overrides = {}, opts: any): ValidatedVolcanoSettings {
	const defaults = {
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0.3,
		height: 400,
		pValue: roundValue(-Math.log10(0.05), 2),
		pValueType: 'adjusted',
		showPValueTable: false,
		width: 400,
		maxInteractiveDots: 5000,
		maxTooltipGenes: 5
	} satisfies DefaultVolcanoSettings

	// the settings of the data type, from its handler
	findVolcanoHandler(opts.termType)?.addDefaultSettings?.(defaults, opts)

	return Object.assign(defaults, overrides)
}

/*********** Setting Validation Functions ***********
 * Validates user input settings after merging with defaults */
export function validateVolcanoSettings(config: any, opts: any) {
	// a data type that compares no groups of its own, such as a precomputed analysis, keeps its settings
	const handler = findVolcanoHandler(config.termType)
	if (!handler?.comparesGroups) return
	if (!config.settings.volcano) return

	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	const limitAlert = sampleLimitAlert(sampleNum)
	if (limitAlert) throw new Error(limitAlert)

	handler.validateSettings?.(settings, opts)
}
