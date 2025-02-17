import type { MassState } from '#mass/types/mass'
import { RxComponentInner } from '../../types/rx.d'
// import { Model } from './model/Model'
// import { View } from './view/View'
// import { ViewModel } from './viewModel/ViewModel'

export class DEanalysis extends RxComponentInner {
	readonly type = 'DEanalysis2' // This will change to 'DEanalysis' after this version is stable
	components: { controls: any }

	constructor() {
		super()
		this.components = {
			controls: {}
		}
	}

	getState(appState: MassState) {
		return appState
	}
}

export function getPlotConfig() {
	console.log('getPlotConfig')
}
