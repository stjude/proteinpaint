import type { RxAppApi } from '../../types/rx'
import type { Menu } from '#dom'
import type { Elem } from '../../types/d3'
import type { ClientCopyGenome } from 'types/global'
import type { BoxPlotSettings } from '../../plots/boxplot/BoxPlot'
import type { CorrVolcanoSettings } from '#plots/corrVolcano/CorrelationVolcanoTypes.ts'
import type { VolcanoSettings } from '../../plots/diffAnalysis/VolcanoTypes.ts'
//import { TermWrapper } from '#types'

export type MassAppApi = RxAppApi & {
	Inner: MassApp
	printError: (e: string) => void
	tip: Menu
	opts: {
		/** TODO!! -> {} */
		callbacks: any
		genome: ClientCopyGenome
		holder: Elem
		/** Current release version. See https://github.com/stjude/proteinpaint/releases */
		pkgver: string
		/** Server restart date and time */
		launchDate: string
		/** TODO!! These are probably defined somehwere else */
		state: {
			vocab: {
				dslabel: string
				genome: string
			}
		}
	}
	/** Should be a type for TermdbVocab or Frontend Vocab later */
	vocabApi: any
}
type MassApp = {
	api: MassAppApi
	/** TODO */
	bus: any
	components: {
		nav: any
		plots: any
	}
	eventTypes: ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
	dom: {
		holder: Elem
		topbar: Elem
		/** printError() message appear above the plots */
		errdiv: Elem
		/** plots appear below the tabs and button controls */
		plotDiv: Elem
	}
	/** TODO */
	opts: any
	plotIdToSandboxId: any
	state: MassState
	/** TODO */
	store: any
	/** required app type */
	type: 'app'
}

/** TODO: Start of all possible options for the mass state
 * Combine with shared types later
 */
export type MassState = {
	nav: MassNav
	activeCohort: number
	customTerms?: any[]
	groups: any[]
	plots: BasePlotConfig[]
	termfilter: any
	termdbConfig: {
		allowedChartTypes: string[]
		allowedTermTypes: string[]
		displaySampleIds?: boolean
		correlationVolcano?: any
		massSessionDuration: number
		queries?: any
		requiredAuth?: any
		sampleTypes?: any
		scatterplots?: any[]
		supportedChartTypes: { [index: string]: string[] }
		title?: {
			text: string
		}
	}
	reuse?: {
		customTermQ?: {
			byId?: any
			byName?: any
		}
	}
	search: {
		isVisible?: boolean
	}
	vocab: {
		genome: string
		dslabel: string
	}
}

type MassNav = {
	/** Default is 0, the about tab */
	activeTab: number
	/** -1: unselected, 0,1,2...: selected */
	activeCohort: number
	header_mode: 'with_tabs' | 'search_only' | 'hidden' | 'hide_search' | 'with_cohortHtmlSelect'
}

export type BasePlotConfig = {
	chartType: string
	groups?: any[]
	id: string
	term?: any //TermWrapper
	term2?: any //
	settings: PlotSettings
}

type PlotSettings = {
	barchart?: any
	boxplot?: BoxPlotSettings
	common?: any
	controls?: any
	correlationVolcano?: CorrVolcanoSettings
	DEanalysis?: any
	geneORA?: any
	gsea?: any
	sampleScatter?: any
	violin?: any
	volcano?: VolcanoSettings
}

export type PlotConfig = BasePlotConfig & {
	term: any
	term0?: any
	term2?: any
}
