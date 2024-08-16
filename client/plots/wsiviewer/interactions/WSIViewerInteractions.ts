export class WSIViewerInteractions {
	thumbnailClickListener: (index: number) => void

	constructor(wsiApp: any, opts: any) {
		this.thumbnailClickListener = (index: number) => {
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: { displayedImageIndex: index }
				}
			})
		}
	}
}
