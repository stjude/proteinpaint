import type { Elem, Div } from '../../types/d3'
import type { TableRow, TableColumn } from '#dom'
import type { Settings } from './settings/Settings'
import type { Filter } from '#types'

/** WIP config for the sc app */
export type SCConfig = {
	chartType: 'sc'
	/** Common settings and settings for each child component/plot */
	settings: Settings
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
	/** Holder for the manually created controls at the top page
	 * This is **not** the same as mass controls.*/
	controlsDiv: Div
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
export type SCSample = { sID: string; eID: string; isMetaResult?: boolean }

/** State retrieved from this.getState()
 * specific to SC chartType. ** NOT ** reflective
 * of the plot obj in the state! */
export type SCFormattedState = {
	config: SCConfig
	/** Filtered plots with parentId == this.id.
	 * Allows for non-nested plot objects in state.plots.
	 * This is ** not ** saved in the state */
	subplots: any[]
	termfilter: { filter: Filter; filter0?: Filter }
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

/** Normalized source-of-truth subplot entry managed by SubplotManager.
 * Represents an active subplot instance with its associated metadata and DOM elements. */
export type SCActiveSubplot = {
	/** Unique identifier for the plot */
	plotId: string
	/** Unique identifier for the sample */
	sampleId?: string
	/** Human-readable name of the plot */
	plotName: string
	/** Key identifying the section containing this subplot */
	sectionKey?: string
	/** The subplot instance or configuration object */
	subplot: any
	/** sandbox div */
	sandboxDiv?: any
	/** Whether this represents a meta-analysis result */
	isMetaResult?: boolean
}

/** Sample-table button payload grouped by sample id.
 * Represents a button control associated with a sample in the sample table. */
export type SCSampleSandbox = {
	plotId: string
	/** subplot sandbox div */
	div: any
	/** Human-readable name of the plot */
	plotName: string
}

export type SCTableData = {
	rows: TableRow[]
	columns: TableColumn[]
	selectedRows: number[]
	/** Column idx with sample IDs */
	sampleColIdx: number
}

/** Slightly modified from termdbConfig.queries.singleCell.samples.sampleColumns */
export type SampleColumn = { termid: string; label: string }
