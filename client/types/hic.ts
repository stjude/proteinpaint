import { BaseTrackArgs } from './tracks.ts'
import { Div, Elem, Input } from '../types/d3'

type SharedArgs = {
	/** HiC file path from tp/ */
	file?: string
	/** Remote HiC file URL */
	url?: string
}

type RestrictionEnzyme = 'Dpnll' | 'EcoRl' | 'Hindlll' | 'MboI' | 'Ncol'

export type HicRunProteinPaintTrackArgs = BaseTrackArgs &
	SharedArgs & {
		/** Specifies the track type
		 * TODO: maybe move 'type' to BaseBlockArgs
		 */
		type: 'hicstraw'
		name: string
		percentile_max: number
		mincutoff: number
		/** Indicates whether the tip of the track points up or down */
		pyramidup: number | boolean
		enzyme: RestrictionEnzyme
		/** Normalization method for the queried data */
		normalizationmethod: string | string[]
	}

export type HicstrawArgs = SharedArgs & {
	jwt: any
	pos1: string
	pos2: string
	/** Normalization method for the queried data */
	nmeth: string[]
	resolution: number
	isfrag?: boolean
}

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
	controlsDiv: {
		/** Equivalent of hic.nmethselect. May render as 'NONE' or dropdown */
		nmeth: Elem
		/** User input for cutoff */
		inputBpMaxv: Input
		/** Text display of resolution */
		resolution: Elem
		/** Hardcoded display of 'observed' matrix type. Change to dropdown in future. */
		matrixType: Elem
		/** Displays text of the user's current view and buttons for other views (except in genome view) */
		view: Elem
		/** Self explanatory */
		viewBtnDiv: Elem
		/** Returns user to the whole genome view from the chr-chr or detailed view*/
		wholegenomebutton: Elem
		/** Returns user to the chr-chr pair view from the detailed view */
		chrpairviewbutton: Elem
		/** Opens a pop up of the 2 chr genome browser view in the detailed view */
		horizontalViewBtn: Elem
		/** Div for zoom buttons visible in the detailed view */
		zoomDiv: Elem
		/** Zoom in button whilst in the detailed view */
		zoomIn: Elem
		/** Zoom out button whilst in the detailed view */
		zoomOut: Elem
	}
	plotDiv: MainPlotDiv
	/** Pop up menu */
	tip: any
}

export type WholeGenomeView = {
	/** # pixel per bin, may set according to resolution */
	binpx: number
	bpmaxv: number
	layer_map: any //dom
	layer_sv: any //dom
	lead2follow?: any //Map<string, Map<string, { x: number, y: number }>>
	nmeth: string
	/** Eventually there should be Menu type for client */
	pica_x: any
	/** Eventually there should be Menu type for client */
	pica_y: any
	resolution: number
	svg: any //dom
}

export type ChrPairView = {
	axisx: any //dom
	axisy: any //dom
	binpx: number
	canvas?: any //dom
	chrx: string
	chry: string
	ctx: any //dom
	data: any
	nmeth: string
	resolution: number
}

export type DetailView = {
	bbmargin: number
	canvas?: any //dom
	ctx: any //dom
	frag?: {
		xid2coord: any
		xstartfrag: number
		xstopfrag: number
		yid2coord: any
		ystartfrag: number
		ystopfrag: number
	}
	nmeth: string
	xb: DetailedViewAxis
	yb: DetailedViewAxis
}

export type DetailedViewAxis = {
	leftheadw: number
	rightheadw: number
	lpad: number
	rpad: number
	width?: number
	rglst?: any
	panning: (f: number) => void
	pannedby: (f: number) => void
	zoomblock: (a: number, b: boolean) => void
}

export type HicstrawInput = {
	atdev: boolean
	bpresolution: number[]
	chrlst: string[]
	chrorder: string[]
	enzyme: string
	enzymefile: string
	file: string
	fragresolution: number[]
	genome: {
		chrlookup: string[]
		hicenzymefragment: number
		majorchrorder: string[]
	}
	hostURL: string
	inwholegenome: boolean
	inchrpair: boolean
	indetail: boolean
	inlineview: boolean
	/** TODO: define this somewhere */
	jwt: any
	name: string
	nochr: boolean
	normalization: string[]
	sv: {
		file: string
		header: string
		items: any
	}
	/** TODO: corresponds to eventual TrackEntry shared type */
	tklst: any
	url: string
	version: string
}
