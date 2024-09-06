import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassAppApi } from './types/mass'
import { newSandboxDiv } from '../dom/sandbox' //Do not use #dom. Will look for .js file
import { NewSandbox } from '../dom/types/sandbox' //Do not use #dom. Will look for .js file

/** --In development--
 * Only .html property enabled from ds.cohort.termdb.about
 * Later may add other properties
 */
type AboutObj = {
	html: string
}

type MassAboutOpts = {
	app: MassAppApi
	holder: Elem
	features: AboutObj
}

class MassAbout {
	type: string
	app: MassAppApi
	holder: Elem
	features: AboutObj
	sandbox: NewSandbox
	readonly id = `${Math.random() * (1 - 0) + 1}`

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.holder = opts.holder
		this.features = opts.features
		this.sandbox = newSandboxDiv(this.holder, { plotId: this.id })
	}

	init() {
		this.sandbox.app_div.style('display', 'none')
		this.sandbox.header.append('div').text('About').style('color', 'rgb(85, 85, 85)')
		this.sandbox.body.append('div').style('padding', '10px').html(this.features.html)
	}

	getState(appState) {
		return {
			nav: appState.nav
		}
	}

	main() {
		this.sandbox.app_div.style('display', this.app.Inner.state.nav.activeTab == 0 ? '' : 'none')
	}
}

export const aboutInit = getCompInit(MassAbout)
