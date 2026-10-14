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
	/** Optional. Only set when launched from a `mass-session-id` URL. Enables exporting that session */
	sessionId?: string | null
}

export type MassUserDom = {
	/** Shows the user authorization info. Only rendered when the dataset requires authorization */
	authDiv: Div
	/** Holds the session open/save/share/delete controls */
	sessionDiv: Div
	/** Holds the session option buttons */
	optionsDiv: Div
	/** Where the selected session option renders. Replaces the popup menu of the former session button */
	contentDiv: Div
	/** Confirmation tip for the copied session link */
	copytip: any
}

/** Where a session is cached: in this browser's localStorage or on the server */
export type SessionLocation = 'browser' | 'server'

export type SessionOption = {
	label: string
	title: string
	callback: () => void | Promise<any>
}
