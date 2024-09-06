import { getCompInit } from '../rx'
import { Div, Elem } from '../types/d3'
import { MassApp } from './types/mass'
import { newSandboxDiv } from '#dom/sandbox'

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

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.holder = opts.holder
		this.obj = opts.obj
	}

	init() {
		const sandbox = newSandboxDiv(this.holder, {})
		//nice name here as well?
		sandbox.header_row.append('div').text('About')
		sandbox.body.html(this.obj.html)
	}
}

export const aboutInit = getCompInit(MassAbout)
