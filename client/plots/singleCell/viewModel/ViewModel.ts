export class ViewModel {
	config: any
	viewData: object

	constructor(config) {
		this.config = config

		this.viewData = {
			actions: this.setActionData()
		}
	}

	setActionData() {
		const opts: any = {}
		if (this.config.plots.length) {
			opts.plots = this.config.plots.map(p => {
				return { name: p.name, selected: p.selected }
			})
		}

		return opts
	}
}
