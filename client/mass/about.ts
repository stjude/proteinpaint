import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassApp } from './types/mass'
import { newSandboxDiv } from '#dom/sandbox'
import { NewSandbox } from '#dom/types/sandbox'

type MassAboutOpts = {
	app: MassApp
	holder: Elem
	obj: any
}

class MassAbout {
	type: string
	app: MassApp
	holder: Elem
	obj: any
	sandbox: NewSandbox
	readonly id = `${Math.random() * (1 - 0) + 1}`

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.holder = opts.holder
		this.obj = opts.obj
		this.sandbox = newSandboxDiv(this.holder, { plotId: this.id })
	}

	init() {
		this.sandbox.app_div.style('display', 'none')
		this.sandbox.header.append('div').text('About').style('color', 'rgb(85, 85, 85)')
		this.sandbox.body.append('div').style('padding', '10px').html(this.obj.html)
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
