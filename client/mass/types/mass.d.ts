import { RxAppApi } from '../../types/rx'
import { Menu } from '#dom'
import { Elem } from '../../types/d3'
import { ClientCopyGenome } from 'types/global'

export type MassAppApi = RxAppApi & {
	Inner: MassApp
	printError: (e: string) => void
	tip: Menu
	opts: {
		/** TODO!! -> {} */
		callbacks: any
		genome: ClientCopyGenome
		holder: Elem
		/** Current release version. See https://github.com/stjude/proteinpaint/releases */
		pkgver: string
		/** TODO!! These are probably defined somehwere else */
		state: {
			vocab: {
				dslabel: string
				genome: string
			}
		}
	}
	/** Should be a type for TermdbVocab or Frontend Vocab later */
	vocabApi: any
}
type MassApp = {
	api: MassAppApi
	/** TODO */
	bus: any
	components: {
		nav: any
		plots: any
	}
	eventTypes: ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
	dom: {
		holder: Elem
		topbar: Elem
		/** printError() message appear above the plots */
		errdiv: Elem
		/** plots appear below the tabs and button controls */
		plotDiv: Elem
	}
	/** TODO */
	opts: any
	plotIdToSandboxId: any
	/** TODO */
	state: any
	/** TODO */
	store: any
	/** required app type */
	type: 'app'
}

/** TODO: Start of all possible options for the mass state */
type MassState = {
	nav: MassNav
}

type MassNav = {
	/** Default is 0. Shows the tabs in this order depending on
	 * dataset -> about > cohort > charts tab */
	activeTab: number
	/** -1: unselected, 0,1,2...: selected */
	activeCohort: number
	header_mode:
		| 'only_buttons'
		| 'with_tabs'
		| 'search_only'
		| 'hidden'
		| 'hide_search'
		| 'with_cohortHtmlSelect'
		| 'with_cohort_select'
}
