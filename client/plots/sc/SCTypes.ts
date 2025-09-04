import type { Elem, Div } from '../../types/d3'
import type { PlotConfig } from '#mass/types/mass'
import type { TableRow, TableColumn } from '#dom'

/** WIP config for the sc app */
export type SCConfig = PlotConfig & {
	chartType: 'sc'
	/** TBD: Eventually the config for multiple plots
	 * will be stored in this array. */
	/** Common settings and settings for each child component/plot */
	settings: {
		sc: SCSettings
	}
	sample: string
}

/** Opts defined in getPlotConfig() */
export type SCConfigOpts = {
	subplots?: PlotConfig[]
	/** Settings overrides */
	overrides?: any
}

/** Layout defined in the parent sc component */
export type SCDom = {
	/** Main div */
	div: Div
	/** Holder for the 'select' btn at the top page */
	selectBtnDiv: Div
	/** Holder for the sample table */
	tableDiv: Div
	/** Holder for the dynamically generated plot buttons for each sample */
	plotBtnsDiv: Div
	/** Dashboard/multiple plot holder */
	plotsDiv: Div
	/** Sandbox header, if provided */
	header?: Elem
}

export type SCSettings = {
	columns: {
		sample: string
	}
}

/** State retrieved from this.app.getState()
 * specific to SC chartType. */
export type SCState = {
	config: SCConfig
	subplots: PlotConfig[]
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
