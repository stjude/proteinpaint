import type { Elem, Div } from '../../types/d3'
import type { PlotConfig } from '#mass/types/mass'

/** TODO:
 * - Add comments/documentation
 */
export type SCConfig = PlotConfig & {
	chartType: 'sc'
	subplots: PlotConfig[]
	/** Common settings and settings for each child component/plot */
	settings: object
}

export type SCConfigOpts = {
	/** Settings overrides */
	overrides?: any
}

export type SCDom = {
	div: Div
	selectBtnDiv: Div
	tableDiv: Div
	plotBtnsDiv: Div
	plotsDiv: Div
	header?: Elem
}

/** State retrieved from this.app.getState()
 * specific to SC chartType. */
export type SCState = {
	config: SCConfig
	termfilter: any
	termdbConfig: any
	vocab: {
		dslabel: string
		genome: string
	}
}

export type SCViewerOpts = {
	holder: Elem
	controls: Elem
	header: Elem
}
