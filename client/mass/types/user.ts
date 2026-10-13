import type { AppApi } from '#rx'
import type { Elem, Div } from '../../types/d3'

export type MassUserOpts = {
	/** Required. Provided from nav component */
	app: AppApi
	/** Required. .dom.subheader.user in nav component, assigned to this.subheader */
	subheader: Elem
	/** Optional. Duration of a saved server session, from the nav opts */
	massSessionDuration?: number
	/** Optional. Only set when launched from a `mass-session-id` URL */
	sessionDaysLeft?: number | null
}

export type MassUserDom = {
	/** Shows the user authorization info. Only rendered when the dataset requires authorization */
	authDiv: Div
	/** Holds the session save/open/download controls */
	sessionDiv: Div
}
