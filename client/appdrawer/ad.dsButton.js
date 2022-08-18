import { getInitFxn } from '../rx'
import * as utils from './utils'

class AppDrawerButton {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.holder = opts.holder
		setInteractivity(this)
		setRenderers(this)
		this.initBtn()
	}

	validateOpts(opts) {
		if (!opts.element.name) throw `Button name is missing`
		if (!opts.element.section) throw `.section is missing for button=${opts.element.name}`
		if (!opts.element.sandboxJson && !opts.element.sandboxHtml)
			throw `Either .sandboxJson or .sandboxHtml is missing for button=${opts.element.name}`
		return opts
	}
}

export const buttonInit = getInitFxn(AppDrawerButton)

function setRenderers(self) {
	self.initBtn = function () {
		utils.makeButton(self.holder, self.opts.element.name)
	}
}

function setInteractivity(self) {}