import { getCompInit } from '#rx'

class LoadingOverlay {
	type: 'loadingOverlay'
	app: any
	loadingDiv: any
	hasStatePreMain = true

	constructor(opts) {
		this.type = 'loadingOverlay'
		this.app = opts.app
		this.loadingDiv = opts.loadingDiv
	}

	reactsTo(action: any) {
		if (action.type.startsWith('loading')) return true
		else return false
	}

	getState(appState: any) {
		return appState
	}

	init() {
		this.loadingDiv.append('div').attr('class', 'sjpp-spinner').style('display', '')
	}

	main(appState) {
		const loading = this.app.getState(appState).loading
		this.loadingDiv.style('display', loading ? '' : 'none')
	}
}

export const loadingInit = getCompInit(LoadingOverlay)
