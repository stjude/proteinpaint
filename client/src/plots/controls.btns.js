import { getCompInit, multiInit } from '../common/rx.core'

class TdbControlsTopBar {
	constructor(opts) {
		this.type = 'controlsTopBar'
	}

	async init() {
		const opts = this.opts

		this.dom = {
			holder: opts.holder,
			burger_div: opts.holder.append('div'),
			button_bar: opts.holder.append('div')
		}

		const debug = this.opts.debug
		this.features = await multiInit({
			burgerbtn: burgerBtnInit({
				holder: this.dom.burger_div,
				callback: opts.callback,
				debug
			}),
			downloadbtn: downloadBtnInit({
				id: opts.id,
				holder: this.dom.button_bar.append('div'),
				callback: opts.downloadHandler,
				debug
			})
		})
	}

	getState(appState) {
		return {
			config: appState.plots.find(p => p.id === this.id)
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = plot.settings.controls.isOpen
		this.dom.button_bar.style('display', isOpen ? 'inline-block' : 'block').style('float', isOpen ? 'right' : 'none')

		for (const name in this.features) {
			this.features[name].main(isOpen, plot)
		}
	}
}

export const topBarInit = getCompInit(TdbControlsTopBar)

function setInteractivity(self) {
	self.toggleVisibility = isVisible => {
		self.isVisible = isVisible
		self.main()
	}
}

function burgerBtnInit(opts) {
	const self = {
		dom: {
			btn: opts.holder
				.style('margin', '10px')
				.style('margin-left', '20px')
				.style('font-family', 'verdana')
				.style('font-size', '28px')
				.style('cursor', 'pointer')
				.style('transition', '0.5s')
				.html('&#8801;')
				.on('click', opts.callback)
		}
	}

	const api = {
		main(isOpen) {
			self.dom.btn.style('display', isOpen ? 'inline-block' : 'block')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function downloadBtnInit(opts) {
	const self = {
		plotTypes: ['barchart', 'boxplot', 'scatter'],
		dom: {
			btn: opts.holder
				.style('margin', '10px')
				.style('margin-top', '15px')
				.style('margin-left', '24px')
				.style('font-family', 'verdana')
				.style('font-size', '18px')
				.style('cursor', 'pointer')
				.html('&#10515;')
				.on('click', opts.callback)
		}
	}

	const api = {
		main(isOpen, plot) {
			self.dom.btn.style('display', isOpen ? 'inline-block' : 'block')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
