import { getCompInit } from '#rx'

class LoadingOverlay {
	type: 'loadingOverlay'

	constructor() {
		this.type = 'loadingOverlay'
	}

	main() {
		console.log('LoadingOverlay launched')
	}
}

export const loadingInit = getCompInit(LoadingOverlay)
