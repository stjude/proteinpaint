import type { Elem } from '../../types/d3'
import type { GRIN2Settings } from './settings/Settings'

export interface GRIN2Dom {
	massControls: Elem
	/** Animated holder for the citation and config form. */
	inputPanel: any
	headerText: Elem
	/** Holder for the GRIN2 config form (owned by GRIN2ControlsView). */
	controls: any
	/** Shared row for the result-gated input toggle and Run button. */
	controlsToggle: any
	/** Holder for the analysis results (owned by GRIN2ResultsView). */
	div: any
	header?: any
}

export interface GRIN2Opts {
	/** Manhattan plot settings */
	plotWidth?: number
	plotHeight?: number
	pngDotRadius?: number
	yAxisX?: number
	yAxisY?: number
	yAxisSpace?: number
	fontSize?: number
	showLegend?: boolean
	legendItemWidth?: number
	legendDotRadius?: number
	legendRightOffset?: number
	legendTextOffset?: number
	legendVerticalOffset?: number
	legendFontSize?: number
	showInteractiveDots?: boolean
	interactiveDotRadius?: number
	interactiveDotStrokeWidth?: number
	showDownload?: boolean
	/** Override default settings */
	overrides?: Partial<GRIN2Settings>
	/** Any additional options */
	[key: string]: any
}

/** Per-data-type usage flag carried in config.settings.dtUsage. Keyed by dt numeric id. */
export type DtUsage = Record<number, { checked: boolean; label: string }>

/** Request body posted to the GRIN2 backend by the Model. */
export interface GRIN2RequestData {
	filter: any
	filter0?: any
	width?: number
	height?: number
	pngDotRadius?: number
	devicePixelRatio?: number
	maxGenesToShow?: number
	lesionTypeColors?: Record<string, string>
	qValueThreshold?: number
	maxCappedPoints?: number
	hardCap?: number
	binSize?: number
	snvindelOptions?: { consequences: string[]; mafFilter?: any; hyperMutator?: number }
	cnvOptions?: {
		lossThreshold?: number
		gainThreshold?: number
		maxSegLength: number
		cnvType?: string
		/** categorical cnv (ds.queries.cnv.type='category'): mclass keys of the cnv-segment types to include */
		cnvCategories?: string[]
		/** samples with more raw cnv segments than this are excluded from cnv (0 disables) */
		hyperMutator?: number
	}
	fusionOptions?: Record<string, any>
	svOptions?: Record<string, any>
	itdOptions?: Record<string, any>
	excludeOptions?: { blacklists?: string[]; overlapFrac?: number }
}

/** Raw response from vocabApi.getGrin2Data. */
export interface GRIN2Response {
	status: 'success' | 'error'
	error?: string
	pngImg?: any
	topGeneTable?: {
		columns: { label: string; width?: string }[]
		rows: any[][]
	}
	stats?: { lst: { name: string; rows: [string, any][] }[] }
}

/** Display-ready data shaped by the ViewModel and consumed by GRIN2ResultsView. */
export interface GRIN2ViewData {
	/** Pass-through payload for plotManhattan plus the manhattan settings slice. */
	manhattan: { plotData: GRIN2Response; settings: any } | null
	topGenes: {
		headerText: string
		columns: { label: string; width?: string }[]
		rows: { value?: any; html?: string }[][]
		/** Original (un-augmented) rows; needed by showResultsTable's matrix integration. */
		dataItems: any[]
	} | null
	/** Stats sections to render below the table (skipping the header section consumed by topGenes.headerText). */
	statsSections: { name: string; rows: [string, any][] }[]
}

/** Callbacks supplied by the controller to GRIN2ControlsView. */
export interface GRIN2ControlsCallbacks {
	onRun: () => void
}
