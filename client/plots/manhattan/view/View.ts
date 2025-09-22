import type { ManhattanInteractions } from '../interactions/ManhattanInteractions'
/** Accepts the formatted data from the ViewModel
 * Pass the interactions here to add interactivity to the rendered elements.
 */

export class View {
	interactions: ManhattanInteractions

	constructor(interactions) {
		this.interactions = interactions
	}

	/** Either launch this in the constructor or separately
	 * Can init the View in Manhattan.init() and call this.render() in main()
	 * or view.render()
	 */
	render() {
		console.log('render manhattan view')
		//this.interactions.launchGenomeBrowser() for the click event
	}
}
