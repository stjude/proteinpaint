// import { BaseTrackArgs } from './tracks.ts'
import { Selection } from 'd3'
import { Div, Elem, Tr } from './d3'
import { NormalizationMethodControl } from '../tracks/hic/controls/NormalizationMethodControl'
import { MatrixTypeControl } from '../tracks/hic/controls/MatrixTypeControl'
import { CutoffControl } from '../tracks/hic/controls/CutoffControl'

// type SharedArgs = {
// 	/** HiC file path from tp/ */
// 	file?: string
// 	/** Remote HiC file URL */
// 	url?: string
// }

// type RestrictionEnzyme = 'Dpnll' | 'EcoRl' | 'Hindlll' | 'MboI' | 'Ncol'

// export type HicRunProteinPaintTrackArgs = BaseTrackArgs &
// 	SharedArgs & {
// 		/** Specifies the track type
// 		 * TODO: maybe move 'type' to BaseBlockArgs
// 		 */
// 		type: 'hicstraw'
// 		name: string
// 		percentile_max: number
// 		mincutoff: number
// 		/** Indicates whether the tip of the track points up or down */
// 		pyramidup: number | boolean
// 		enzyme: RestrictionEnzyme
// 		/** Normalization method for the queried data */
// 		normalizationmethod: string | string[]
// 	}

// export type HicstrawArgs = SharedArgs & {
// 	matrixType: 'observed' | 'expected' | 'oe'
// 	pos1: string
// 	pos2: string
// 	/** Normalization method for the queried data */
// 	nmeth: string[]
// 	resolution: number
// 	isfrag?: boolean
// }

export type MainPlotDiv = {
	append: (s: string) => any
	/** SVG plot display */
	plot: Elem
	/** Reuseable x axis div*/
	xAxis: Elem
	/** Reuseable y axis div*/
	yAxis: Elem
	/** Left blank to avoid rendering issues on resize */
	blank: Elem
}

export type HicstrawDom = {
	/** Placeholder div for displaying errors to the user */
	errorDiv: Elem
	/** Control panel. Appears as a collapsible burger menu*/
	controlsDiv: HicControlsDom
	/** Information display for the user */
	infoBarDiv: Div
	/** Holds the cloak when the view is loading. */
	loadingDiv: Div
	/** Holder for the plot and axes */
	plotDiv: MainPlotDiv
	/** Pop up menu */
	tip: any
}

export type HicControlsDom = {
	/** Used to hide row when horizonal view is active */
	normalizationRow: Tr
	/** Equivalent of hic.nmethselect. May render as 'NONE' or dropdown */
	nmeth: NormalizationMethodControl
	/** Used to hide row when horizonal view is active */
	minCutoffRow: Tr
	/** User input for minimum cutoff */
	inputBpMinV: CutoffControl
	/** Used to hide row when horizonal view is active */
	maxCutoffRow: Tr
	/** User input for maximum cutoff */
	inputBpMaxV: CutoffControl
	/** Used to hide row when horizonal view is active */
	matrixTypeRow: Tr
	/** User select matrix type. Returns straw values based on selected type. */
	matrixType: MatrixTypeControl
	/** Displays text of the user's current view and buttons for other views (except in genome view) */
	view: Elem
	/** Self explanatory */
	viewBtnDiv: Elem
	/** Returns user to the whole genome view from the chr-chr or detailed view*/
	genomeViewBtn: Elem
	/** Returns user to the chr-chr pair view from the any other view besides whole genome */
	chrpairViewBtn: Elem
	/** Returns user to the 2 chr genome browser view (subpanels) in the detailed view */
	horizontalViewBtn: Elem
	/** Displays the detail x/y view, replacing the horizontal view */
	detailViewBtn: Elem
	/** Div for zoom buttons visible in the detailed view */
	zoomDiv: Tr
	/** Zoom in button whilst in the detailed view */
	zoomIn: Selection<HTMLButtonElement, any, any, any>
	/** Zoom out button whilst in the detailed view */
	zoomOut: Selection<HTMLButtonElement, any, any, any>
}

export type ReturnedItems = { items: number[][] }

export type CoordinatesData = { items: [number, number, number][] }

export type ChrPosition = { chr: string; start: number; stop: number }

// export type HicstrawInput = {
// 	atdev: boolean
// 	bpresolution: number[]
// 	chrlst: string[]
// 	chrorder: string[]
// 	enzyme: string
// 	enzymefile: string
// 	file: string
// 	fragresolution: number[]
// 	genome: {
// 		chrlookup: string[]
// 		hicenzymefragment: number
// 		majorchrorder: string[]
// 	}
// 	hostURL: string
// 	/** TODO: define this somewhere */
// 	jwt: any
// 	name: string
// 	nochr: boolean
// 	normalization: string[]
// 	sv: {
// 		file: string
// 		header: string
// 		items: any
// 	}
// 	/** TODO: corresponds to eventual TrackEntry shared type */
// 	tklst: any
// 	url: string
// 	version: string
// }
