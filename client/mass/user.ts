import { getCompInit, type AppApi } from '#rx'
import type { Elem } from '../types/d3'
import type { MassUserOpts, MassUserDom } from './types/user'

/*
"user" tab will display following contents inside this.subheader:
- the user authorization information, if the dataset requires authorization
- the session save/open/download functionality, moved from sessionBtn.js

The nav tab label is 'USER' if the dataset requires authorization, otherwise 'SESSION'.
See getUserTabLabel().
*/

/** A dataset requires authorization if the server sent a non-empty termdbConfig.requiredAuth[] */
export function datasetRequiresAuth(termdbConfig: any): boolean {
	return !!termdbConfig?.requiredAuth?.length
}

export class MassUser {
	static type = 'user'

	type: string
	app: AppApi
	opts: MassUserOpts
	dom: MassUserDom
	state: any
	subheader: Elem
	/** The termdb route that is checked for a required credential */
	route = 'termdb'
	/** Matching termdbConfig.requiredAuth[] entry, with type 'jwt'. Enables saving sessions to the server */
	requiredAuth?: any

	constructor(opts: MassUserOpts) {
		this.opts = opts
		this.type = MassUser.type
		this.app = opts.app
		this.subheader = opts.subheader
		this.dom = {
			authDiv: this.subheader.append('div').attr('data-testid', 'sjpp-user-auth').style('margin', '10px'),
			sessionDiv: this.subheader.append('div').attr('data-testid', 'sjpp-user-session').style('margin', '10px')
		}
	}

	getState(appState: any) {
		return {
			termdbConfig: appState.termdbConfig,
			nav: appState.nav
		}
	}

	/** Render static contents once on launching mass ui */
	init(appState: any) {
		this.setRequiredAuth(appState.termdbConfig)
		this.initAuthInfo(appState.termdbConfig)
		this.initSessionControls()
	}

	async main() {
		// do not render unless the user tab is active
		// TODO: compare this.state.nav.activeTab against the index of the user tab, as in about.ts
		this.setRequiredAuth(this.state.termdbConfig)
		this.mayRenderAuthInfo()
	}

	setRequiredAuth(termdbConfig: any) {
		this.requiredAuth = termdbConfig?.requiredAuth?.find((a: any) => a.route == this.route && a.type == 'jwt')
	}

	/** Create the authorization display holder; hide it for a public dataset */
	initAuthInfo(termdbConfig: any) {
		this.dom.authDiv.style('display', datasetRequiresAuth(termdbConfig) ? 'block' : 'none')
	}

	initSessionControls() {
		//TODO
	}

	mayRenderAuthInfo() {
		if (!datasetRequiresAuth(this.state.termdbConfig)) return
		this.dom.authDiv.style('display', 'block')
	}
}

export const userInit = getCompInit(MassUser)
