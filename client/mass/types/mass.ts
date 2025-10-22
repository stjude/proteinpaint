import type { AppApi } from '#rx'
import type { BoxPlotSettings } from '../../plots/boxplot/BoxPlotTypes'
import type { CorrVolcanoSettings } from '#plots/corrVolcano/CorrelationVolcanoTypes.ts'
import type { VolcanoSettings } from '../../plots/volcano/VolcanoTypes.ts'
import type { GRIN2Settings } from '#plots/grin2/GRIN2Types.ts'
import type { ChatSettings } from '#plots/chat/chatTypes.ts'
//import { TermWrapper } from '#types'

export type MassAppApi = AppApi /*& {
	//Inner: MassApp
	printError: (e: string) => void
	tip: Menu
}*/

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
	filter?: any
	parentId?: string
	controlLabels?: any
}

type PlotSettings = {
	barchart?: any
	boxplot?: BoxPlotSettings
	common?: any
	controls?: any
	correlationVolcano?: CorrVolcanoSettings
	grin2?: GRIN2Settings
	chat?: ChatSettings
	geneORA?: any
	gsea?: any
	sampleScatter?: any
	violin?: any
	volcano?: VolcanoSettings
}

export type PlotConfig = BasePlotConfig & {
	term0?: any
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
