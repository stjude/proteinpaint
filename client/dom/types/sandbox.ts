import { Div } from '../../types/d3'

/** Renders forms in a specific format */
export type RenderSandboxForm = [
	/** inputdiv */
	Div,
	/** gselect.node(): genome dropdown */
	HTMLSelectElement | null,
	/** fileDiv: for file select, pathway input, etc */
	Div,
	/** sayDiv: for error messages */
	Div,
	/** visualDiv: for displaying output */
	Div
]

export type NewSandboxOpts = {
	/**.beforePlotId: optional insertion position, a key in the plotIdToSandboxId tracker */
	beforePlotId: string
	/**.plotId: optional plot.id, for which a sandbox div ID will be assigned, should not be an 'empty' value (null , undefined, 0) */
	plotId: string
	style: {
		width: string
	}
	/**.close: optional callback to trigger when the sandbox is closed */
	close: () => void
}

export type NewSandbox = {
	/** Creates a div to insert the new sandbox before all other sandboxes*/
	app_div: Div
	/** Header text only */
	header: Div
	/** Entire header div for adding buttons, additional text, etc. */
	header_row: Div
	/** Content of the sandbox, below the header */
	body: Div
	/** dom element id created for identifying the sandbox */
	id: string
}
