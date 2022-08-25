import { getInitFxn } from '#rx'
import * as utils from './utils'
import { event } from 'd3-selection'
import { openSandbox } from './adSandbox'

class AppDrawerButton {
	constructor(opts) {
		this.type = 'button' // works for 'dsButton'. May expand to other button types
		this.opts = this.validateOpts(opts)
		this.holder = opts.holder
		this.pageArgs = opts.pageArgs
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
	main() {}
}

export const buttonInit = getInitFxn(AppDrawerButton)

function setRenderers(self) {
	const btn = utils.makeButton({ div: self.holder, text: self.opts.element.name, margin: '20px 20px 0px' })
	btn.attr('class', 'sjpp-appdrawer-dataset-btn').on('click', async () => {
		event.stopPropagation()
		self.opts.pageArgs.apps_off()
		await openSandbox(self.opts.element, self.opts.pageArgs)
	})
}

function setInteractivity(self) {}
