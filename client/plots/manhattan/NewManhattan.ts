import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import type { Elem } from '../../types/d3'

/** Temp file for the manhattan plot in mvvm architecture
 *
 * TODOs:
 *  - Change importPlot() to Manhattan.ts when manhattan.ts is deleted
 * and this file is renamed to Manhattan.ts
 */

export class Manhattan extends PlotBase implements RxComponent {
	static type = 'manhattan'
	type: string
	dom: {
		header: Elem | null
	}
	parentId?: string

	//Always leave a space between the
	constructor(opts, api) {
		super(opts, api)
		this.type = Manhattan.type
		this.dom = {
			header: null
		}

		if (this.opts.parentId) this.parentId = this.opts.parentId //Don't worry about this for now. Its for integration with the grin2 plot
		if (this.opts.header) this.dom.header = this.opts.header
	}

	/** Only runs once! Add anything to this function that initalizes the plot
	 * For example, if you expect an element to render once, fetch data only once,
	 * init components only once, etc. include that code here.
	 *
	 * You can also use this function for the initial render and use main()
	 * as an update
	 */
	init(appState): any {
		console.log('init manhattan', appState)
	}

	/** .main() is called everytime app.dispatch is called
	 * Anything that is updated or re-rendered should be in here.
	 */
	main() {
		console.log('main manhattan')
	}
}

export const manhattanInit = getCompInit(Manhattan)
export const componentInit = manhattanInit

/** Set the default settings here. The key will be used as
 * the settingsKey for the input option in controlsInit().
 */
function getDefaultManhattanSettings(overrides) {
	const defaults = {}

	return Object.assign({}, defaults, overrides)
}

/** This function creates, hydrates, and validates the config
 * Use this function to fill in term wrappers, check for missing
 * config properties, and set defaults.
 */
export function getPlotConfig(opts) {
	// if (!opts.specialSomethingForThisPlot) throw Error('Must provide specialSomethingForThisPlot to plot config')
	const config = {
		//Add more here
		settings: getDefaultManhattanSettings({})
	}

	return copyMerge(config, opts)
}
