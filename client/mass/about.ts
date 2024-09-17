import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassAppApi } from './types/mass'

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

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.holder = opts.holder
		this.features = opts.features
	}

	init() {
		this.holder.append('div').style('padding', '10px').html(this.features.html)
	}
}

export const aboutInit = getCompInit(MassAbout)
