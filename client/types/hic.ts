import { BaseTrackArgs } from './tracks.ts'
import { Div, Elem, Input, Svg, SvgG } from '../types/d3'
import { Selection } from 'd3-selection'

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
	matrixType: 'observed' | 'expected' | 'oe'
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
		/** User select matrix type. Returns straw values based on selected type. */
		matrixType: Elem
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
		zoomDiv: Elem
		/** Zoom in button whilst in the detailed view */
		zoomIn: Elem
		/** Zoom out button whilst in the detailed view */
		zoomOut: Elem
	}
	/** Information display for the user */
	infoBarDiv: {
		/** Text to be hidden in horizontal view */
		colorScaleLabel: Elem
		/** Color scale container. Hidden in horizontal view */
		colorScaleDiv: Div
		/** Text display of resolution */
		resolution: Elem
	}
	/** Holds the cloak when the view is loading. */
	loadingDiv: Div
	/** Holder for the plot and axes */
	plotDiv: MainPlotDiv
	/** Pop up menu */
	tip: any
}

export type WholeGenomeView = {
	/** # pixel per bin, may set according to resolution */
	binpx: number
	/** Appears as the max cutoff value for the user in the menu */
	bpmaxv: number
	/** Arrays of hicdata response [pos1, pos2, and value] reformatted for rendering */
	data: number[]
	/** heatmap layer underneath svg */
	layer_map: SvgG
	/** second g layer underneath the svg */
	layer_sv: SvgG
	/** SVG elements and data for individual canvases */
	lead2follow?: Map<
		string,
		Map<
			string,
			Partial<{
				canvas: Elem
				canvas2?: Elem
				x: number
				y: number
				data: number[][]
				img: Elem
				img2?: Elem
			}>
		>
	>
	/** Normalization method tied to this view. Intended to render independently of other views */
	nmeth: string
	/** Matrix type specific to this view. Value from dropdown and relates to 1st straw parameter. */
	matrixType: 'observed' | 'expected' | 'oe' | 'log(oe)'
	/** Displays the chr on the x axis to the user next to the cell's upper left corner.
	 * Eventually there should be Menu type for client */
	pica_x: any
	/** Displays the chr on the y axis to the user next to the cell's upper left corner.
	 * Eventually there should be Menu type for client */
	pica_y: any
	/** Calculated resolution. Displayed in menu for user */
	resolution: number
	/** Not entirely sure why SVGElement wasn't sufficient. Maybe this is a typescript bandaid?? */
	svg: Selection<SVGSVGElement, any, HTMLElement, any>
}

export type ChrPairView = {
	axisx?: Svg
	axisy?: Svg
	binpx: number
	canvas: any //dom
	ctx: any //dom
	data: number[][]
	/** Matrix type specific to this view. Value from dropdown and relates to 1st straw parameter. */
	matrixType: 'observed' | 'expected' | 'oe' | 'log(oe)'
	/** Normalization method tied to this view. Intended to render independently of other views */
	nmeth: string
	/** Calculated resolution. Displayed in menu for user */
	resolution: number
}

export type HorizontalView = {
	/** args for runpp(). Define this later */
	args: {
		hostURL: string
		jwt: any
		genome: string
		nobox: boolean | number
	}
	/** Nonfunctional at the moment */
	nmeth: string
}

export type DetailView = {
	bbmargin: number
	canvas?: any //dom
	ctx: any //dom
	frag?: {
		xid2coord: Map<string, { x: number; y: number }>
		xstartfrag: number
		xstopfrag: number
		yid2coord: Map<string, { x: number; y: number }>
		ystartfrag: number
		ystopfrag: number
	}
	/** Matrix type specific to this view. Value from dropdown and relates to 1st straw parameter. */
	matrixType: 'observed' | 'expected' | 'oe' | 'log(oe)'
	/** Normalization method tied to this view. Intended to render independently of other views */
	nmeth: string
	/** Calculated resolution. Displayed in menu for user */
	resolution: number
	xb: DetailViewAxis
	yb: DetailViewAxis
}

export type DetailViewAxis = {
	leftheadw: number
	rightheadw: number
	lpad: number
	rpad: number
	width?: number
	rglst?: any
	/** The following methods were required to avoid a type error. Maybe better to separate the canvas
	 * from rendering args in future
	 */
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
