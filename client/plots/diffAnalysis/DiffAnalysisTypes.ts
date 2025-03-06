import type { Elem } from '../../types/d3'
import type { Menu } from '#dom'
import type { PlotConfig } from '#mass/types/mass'
import type { TermWrapper } from '@sjcrh/proteinpaint-types'
import type { VolcanoSettings } from './VolcanoTypes'

/** TODO
 * - add comments
 * - fix types
 * - move types dir and volcano types to separate file
 */

export type DiffAnalysisDom = {
	/** Control panel to the left of the plot. Container is either provided or created */
	controls: Elem
	/** Holder */
	div: Elem
	/** Sandbox header, if provided */
	header?: {
		title: Elem
		fixed: Elem
	}
	/** Toggle volcano and gsea plots */
	tabsDiv: Elem
	/** Container for the plots */
	plots: Elem
	/** Shared tooltip */
	tip: Menu
}

/** Opts to init the DEanalysis plot */
export type DiffAnalysisOpts = {
	/** Container for the plot */
	holder: Elem
	/** Type of differential analysis, determined by available data */
	termType: string
	/** Optional container for the controls. */
	controls?: Elem
	/** Optional sandbox header */
	header?: Elem
	/** Settings overrides, in runpp() call */
	overrides?: Partial<VolcanoSettings>
	/** Data points highlighted in the volcano plot */
	highlightedData: string[]
}

//TODO: Fix this
export type DiffAnalysisPlotConfig = PlotConfig & {
	/** Data points highlighted in the volcano plot */
	highlightedData: string[]
	samplelst: {
		groups: {
			name: string
			samplelst: string[]
		}[]
	}
	/** Custom group term */
	tw: TermWrapper
	/** Determines the kind of diff analysis */
	termType: string
}
