/** Collect all interactivity here. Can use app and id to call app.dispatch() */
export class ManhattanInteractions {
	app: any
	id: string

	constructor(app, id) {
		this.app = app
		this.id = id
	}

	/** Launches the genome browser when clicking on
	 * significant data point in the plot. */
	launchGenomeBrowser() {
		console.log('launchGenomeBrowser')

		// this.app.dispatch({
		//     type: 'genomeBrowser',
		//     id: this.id,
		//     config
		// })
	}
}
