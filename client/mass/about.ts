import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassApp } from './types/mass'

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

	main() {
		const messageDiv = this.holder
		messageDiv.html(this.obj.html)
	}
}

export const aboutInit = getCompInit(MassAbout)
