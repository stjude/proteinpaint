import type { Selection } from 'd3'
import type { Div, Elem, Tr } from './d3'
import type { NormalizationMethodControl } from '../tracks/hic/controls/NormalizationMethodControl'
import type { MatrixTypeControl } from '../tracks/hic/controls/MatrixTypeControl'
import type { CutoffControl } from '../tracks/hic/controls/CutoffControl'

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

export type RestrictionEnzyme = 'none' | 'HindIII' | 'NcoI' | 'MboI' | 'DpnII' | 'BglII' | 'EcoRI' | 'BamHI'
