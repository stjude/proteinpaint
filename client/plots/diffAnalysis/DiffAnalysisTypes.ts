import type { Elem } from '../../types/d3'
import type { Menu } from '#dom'
import type { PlotConfig } from '#mass/types/mass'
import type { TermWrapper } from '#types'

export type DiffAnalysisDom = {
	/** Control panel to the left of the plot. Container is either provided or created */
	controls: Elem
	/** Holder */
	div: Elem
	/** Sandbox header, if provided */
	header?: {
		/** If tw.term.name is present, show in header */
		terms: Elem
		/** Updates plot titl per provided opts.termType */
		title: Elem
	}
	/** Toggle between plots */
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
	/** A numerical term type that determines the type of data used in this analysis */
	termType: string
	/** Optional container for the controls. */
	controls?: Elem
	/** Optional sandbox header */
	header?: Elem
	/** Settings overrides, in runpp() call */
	overrides?: any
	/** Data points highlighted in the volcano plot */
	highlightedData: string[]
}

//TODO: Fix this
//Should be separated by termType and then used in the volcano plot config
export type DiffAnalysisPlotConfig = PlotConfig & {
	childType: string
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
