/** User interactions for the wsi plot; each one dispatches a plot_edit so the
 change flows through app state and main() re-renders. */
export class WsiInteractions {
	constructor(readonly app: any, readonly id: string) {}

	/** a sample row was picked in the table */
	selectSample(index: number) {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { settings: { wsi: { selectedSampleIndex: index } } }
		})
	}
}
