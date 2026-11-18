import type { VolcanoHandler } from './types'
import { maxSampleCutoff } from '#shared'
import { countGroupSamples } from './shared'
import { geneExpressionHandler } from './geneExpression'
import { dnaMethylationHandler } from './dnaMethylation'
import { junctionHandler } from './junction'
import { singleCellCellTypeHandler } from './singleCellCellType'
import { proteomeDAPHandler } from './proteomeDAP'

export type {
	VolcanoHandler,
	VolcanoRequestContext,
	EffectAxis,
	VolcanoAction,
	VolcanoRunContext,
	VolcanoColumn,
	TooltipRow,
	SharedTooltipRows
} from './types'
export type { ControlContext, RowActionContext, MethodOption, PreAnalysisHandler } from './types'
export { getPlottedEffect, countGroupSamples } from './shared'
export {
	DMRCATE_DEFAULTS,
	BACKGROUND_CORRECTION_TITLE,
	SCAN_Y_AXIS_OPTIONS,
	onDeltaBetaAxis,
	isScanPlot
} from './dnaMethylation'
export { getSpliceMethodOptions, scaleDsFilters } from './junction'

/* One handler per data type of a differential analysis, keyed by config.termType. A Map, not a
plain object, so a termType such as '__proto__' or 'toString' finds no handler.
SINGLECELL_GENE_EXPRESSION is enabled in diffAnalysis/enabledTermTypes but has no route yet, so it
has no handler. */
const handlers = new Map<string, VolcanoHandler>(
	[geneExpressionHandler, dnaMethylationHandler, junctionHandler, singleCellCellTypeHandler, proteomeDAPHandler].map(
		h => [h.termType, h]
	)
)

/** the handler of a data type, or undefined when the volcano does not support it. For code that
 * runs before any data is requested, such as the controls and the tabs, where an unsupported type
 * fails later, when the volcano requests its data */
export function findVolcanoHandler(termType: string): VolcanoHandler | undefined {
	return handlers.get(termType)
}

/** the handler of a data type, or a throw when the volcano does not support it */
export function getVolcanoHandler(termType: string): VolcanoHandler {
	const handler = handlers.get(termType)
	if (!handler) throw new Error(`Volcano plot does not support route for termType='${termType}'`)
	return handler
}

/** The samples that a run compares, for the sample limit: those of the groups of a data type that
 * compares groups. Any other data type is not limited, and reports the limit itself */
export function getSampleNum(config: any): number {
	return findVolcanoHandler(config.termType)?.comparesGroups
		? countGroupSamples(config.samplelst.groups)
		: maxSampleCutoff
}
