import type { RxAppApi } from '../../types/rx'
import type { Menu } from '#dom'
import type { Elem } from '../../types/d3'
import type { ClientCopyGenome } from 'types/global'
import type { BoxPlotSettings } from '../../plots/boxplot/BoxPlotTypes'
import type { CorrVolcanoSettings } from '#plots/corrVolcano/CorrelationVolcanoTypes.ts'
import type { VolcanoSettings } from '../../plots/volcano/VolcanoTypes.ts'
import type { GRIN2Settings } from '#plots/grin2/GRIN2Types.ts'
//import { TermWrapper } from '#types'

export type MassAppApi = RxAppApi & {
	Inner: MassApp
	printError: (e: string) => void
	tip: Menu
	opts: {
		/** TODO!! -> {} */
		callbacks: any
		debug: boolean
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
		/** printError() message appear above the plot sandboxes */
		errdiv: Elem
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
		displaySampleIds?: (clientAuthResult: any) => boolean
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
		matrixplots?: any[]
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
	grin2?: GRIN2Settings
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

export type ControlInputEntry = {
	label: string
	type: 'number' | 'radio' | 'checkbox' | 'term' | 'color' | string
	/** Either the chartType or childType */
	chartType: string
	/** Must correspond to an existing [chartType]settings key */
	settingsKey: string
	/** Aria label shown on hover */
	title: string
	/** Lower limit for user input in numeric fields */
	min?: number
	/** Upper limit for user input in numeric fields */
	max?: number
	/** Step size for numeric fields */
	step?: number
	/** Radio type only. Options for the radio buttons */
	options?: { label: string; value: string; checked?: boolean }[]
	/** Checkbox type only. Label shown next to the checkbox. */
	boxLabel?: string
	getDisplayStyle?(...args: any): any
	processConfig?(...args: any): any
}

export type MassAppActions = {
	/** Actions defined in the mass store (i.e. 'plot_edit'). See TdbStore.prototype.actions  */
	type: string
	/** The plot's this.id */
	id: string
	/** Matching config for the plot */
	config: any
}
