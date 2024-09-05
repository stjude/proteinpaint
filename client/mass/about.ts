import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassApp } from './types/mass'

type MassAboutOpts = {
	app: MassApp
	holder: Elem
}

class MassAbout {
	type: string
	app: MassApp
	holder: Elem

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.holder = opts.holder
	}
}

export const aboutInit = getCompInit(MassAbout)
