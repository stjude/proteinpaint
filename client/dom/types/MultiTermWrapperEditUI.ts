import type { Button, Elem, Div } from '../../types/d3'
import type { TermWrapper } from '#types'
import type { MassAppApi, MassState } from '#mass/types/mass'

/** Elements created by the UI, save the holder */
export type MultiTermWrapperDom = {
	/** Div containing optional bottom text, next to the
	 * submit button */
	footer: Div
	holder: Elem | Div
	/** Div containing optional top or header text */
	header: Div
	/** Contains all the pills */
	tws: Div
	/** Submit button */
	submitBtn: Button
}

/** Multiple opts match the opts for termsettingInit()
 * See opts for termsettingInit() for more info */
export type MultiTermWrapperUIOpts = {
	app: MassAppApi
	/** Customizable label for the 'submit' button.
	 * Default is 'Submit' */
	buttonLabel?: string
	/** Called when bottom/'submit' button is clicked */
	callback: (terms: string[]) => void
	/** If special termsetting opts are needed, define those as an object.
	 * The opts will be passed to termsetting init. The inputs in this object
	 * overrides the defaults in rendering code. */
	customInputs?: object
	holder: Elem
	/** If provided, limit the number of term wrappers
	 * the user can select. */
	maxNum?: number
	/** Provide the state for additional termsetting opts */
	state?: MassState
	/** Text appearing above the term selection div
	 * Add directions or other information here */
	headerText?: string
	/** Term wrappers already in use on init */
	twList?: TermWrapper[]
	/** Specific terms to disable. Will be combined with the running twlist.  */
	disable_terms?: string[]
}
