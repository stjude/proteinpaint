import type { Elem, Div } from '../../types/d3'
import type { TableRow, TableColumn } from '#dom'
import type { SCSettings } from './settings/Settings'

/** WIP config for the sc app */
export type SCConfig = {
	chartType: 'sc'
	/** Common settings and settings for each child component/plot */
	settings: SCSettings
}

/** Opts defined in getPlotConfig() */
export type SCConfigOpts = {
	/** TODO: Fix this. It should be settings and not overrides.
	 * Settings overrides */
	overrides?: any
}

/** Layout defined in the parent sc component */
export type SCDom = {
	/** Main div */
	div: Div
	/** When visible, shows a loading spinner */
	loading: Div
	/** Holder for the 'select' btn at the top page */
	selectBtnDiv: Div
	/** Holder for the sample table */
	tableDiv: Div
	/** Holder for the dynamically generated plot buttons for each sample */
	plotsBtnsDiv: Div
	/** Holder for the sections that contain the plots */
	sectionsDiv: Div
	/** Sandbox header, if provided */
	header?: Elem
}

/** Standardized sample identifier used throughout the SC app */
export type SCSample = { sID: string; eID: string }

/** State retrieved from this.getState()
 * specific to SC chartType. ** NOT ** reflective
 * of the plot obj in the state! */
export type SCFormattedState = {
	config: SCConfig
	/** Filtered plots with parentId == this.id.
	 * Allows for non-nested plot objects in state.plots.
	 * This is ** not ** saved in the state */
	subplots: any[]
	termfilter: any //Filter
	termdbConfig: any
	vocab: {
		dslabel: string
		genome: string
	}
}

/** Opts for the SCViewer class */
export type SCViewerOpts = {
	holder: Elem
	controls: Elem
	header: Elem
}

/** On init() only the table is rendered.
 * This data is static and not subject to change like
 * the (eventual) viewData. */
export type SCTableData = {
	rows: TableRow[]
	columns: TableColumn[]
	selectedRows: number[]
}

/** Slightly modified from termdbConfig.queries.singleCell.samples.sampleColumns */
export type SampleColumn = { termid: string; label: string }
