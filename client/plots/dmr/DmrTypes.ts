import type { Elem } from '../../types/d3'
import type { DMRSettings } from './settings/Settings'
import type { DmrDiagnostic, DmrScanYAxis, SampleFilterGroup } from '#types'

/** Config shape passed via plot_create from VolcanoInteractions */
export type DmrConfig = {
	chartType: 'dmr'
	id: string
	headerText: string
	/** each group as the list of its samples, or as the filter that defines it */
	group1: { sampleId: number | string; sample?: string }[] | SampleFilterGroup
	group2: { sampleId: number | string; sample?: string }[] | SampleFilterGroup
	group1Name?: string
	group2Name?: string
	settings: { dmr: DMRSettings }
	/** The chromosomes of the scan this view was opened from; see TermdbDmrRequest.scanChromosomes */
	scanChromosomes?: string[]
	/** That scan's background correction and CpG floor; see TermdbDmrRequest */
	backgroundCorrection?: boolean
	minCpgs?: number
	yAxis?: DmrScanYAxis
	/** The app's cohort filter when that scan ran; see TermdbDmrRequest.filter0 */
	filter0?: any
	/** Mean reads per CpG of each group in that scan, so the view can say when a DMR may be read depth */
	readDepth?: { control: number; case: number }
	/** Set by onBlockCoordinateChange when user pans/zooms the genome browser */
	coordinateOverride?: { chr: string; start: number; stop: number }
}

export type DmrDom = {
	header: Elem
	holder: Elem
	loadingOverlay: Elem
	/** written only by the framework's printError; the rx update loop hides and empties it before
	 * every main(), so nothing the plot wants to keep may go in here */
	error: Elem
	/** notes that should survive an update, e.g. the zoom-in hint */
	note: Elem
	loading: Elem
	diagnosticPanel: Elem
}

export type BedItem = {
	chr: string
	start: number
	stop: number
	color: string
	/** drawn on the item by the bedj track when it fits */
	name?: string
}

export type LegendItem = {
	text: string
	color: string
	/** 'square' (default), 'dashed' for dashed line, or 'shaded' for shaded region */
	style?: 'square' | 'dashed' | 'shaded'
}

export type LegendRow = {
	label: string
	items: LegendItem[]
}

export type DmrViewData = {
	tklst: any[]
	legendRows: LegendRow[]
	diagnostic?: DmrDiagnostic
	dmrs?: { start: number; stop: number; direction: string; min_smoothed_fdr: number }[]
	dmrBedItems: BedItem[]
	/** Whether LOESS curves are shown in the current view */
	showLoess: boolean
	/** Whether individual per-CpG dots are shown (false for large regions) */
	showDots: boolean
	/** plain sentences shown under the plot: what the gray DMRs are, when to zoom in */
	notes: string[]
}
