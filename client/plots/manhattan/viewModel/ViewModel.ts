export class ViewModel {
	/** Set any predefined constants at the top with a note
	 * and use for multiple calculations.
	 *
	 * For example:
	 * Top padding of the plot in pixels
	 */
	readonly topPad = 20
	readonly bottomPad = 40
	readonly horizPad = 120
	marginPercent: number

	constructor(opts) {
		if (!opts.marginPercent) throw Error('Must provide marginPercent to ViewModel')
		this.marginPercent = opts.marginPercent
		// this.actualWidth = this.settings.width * (1 + this.marginPercent)

		this.formatData()
	}

	/** Either call in the constructor or separately
	 * Use the constants defined above and any calculated numbers,
	 * like the actual width in your case, to format the data for
	 * rendering.
	 */
	formatData() {
		console.log('formatData() called')
	}
}
