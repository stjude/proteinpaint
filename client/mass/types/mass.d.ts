import { RxApp } from '../../types/rx'
import { Menu } from '../../dom/menu'
import { Elem } from '../../types/d3'

export type MassApp = RxApp & {
	Inner: {
		eventTypes: ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
		dom: {
			holder: Elem
			topbar: Elem
			errdiv: Elem
			plotDiv: Elem
		}
		opts: any
		plotIdToSandboxId: any
		state: any
		store: any
		type: 'app'
	}
	printError: (e: string) => void
	tip: Menu
	type: 'app'
	/** Should be a type for TermdbVocab or Frontend Vocab later */
	vocabApi: any
}

/** TODO: Start of all possible options for the mass state */
type MassState = {
	nav: {
		activeTab: number
	}
}
