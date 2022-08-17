import { getInitFxn } from '../rx'

class AppDrawerButton {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.holder = opts.holder
		setInteractivity(this)
		setRenderers(this)
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

function setInteractivity(self) {}

function setRenderers(self) {
	self.makeButton = function(div, text) {
		const button = div
			.append('button')
			.attr('type', 'submit')
			.style('background-color', '#cfe2f3')
			.style('margin', '20px 20px 0px 20px')
			.style('padding', '8px')
			.style('border', 'none')
			.style('border-radius', '3px')
			.style('display', 'inline-block')
			.text(text)

		return button
	}

	self.makeButton(self.holder, self.opts.element.name)
}
