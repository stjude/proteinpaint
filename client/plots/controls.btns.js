import { getCompInit, multiInit } from '../rx'
import { icons as icon_functions } from '../dom/control.icons'

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
				debug,
				title: opts.title
			}),
			downloadbtn: downloadBtnInit({
				id: opts.id,
				holder: this.dom.holder.insert('div'),
				callback: opts.downloadHandler,
				debug
			}),
			helpbtn: helpBtnInit({
				id: opts.id,
				holder: this.dom.holder.insert('div'),
				callback: opts.helpHandler,
				debug
			})
		})
	}

	getState(appState) {
		return {
			config: appState.plots.find(p => p.id === this.id),
			isOpen: this.opts.isOpen()
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = this.opts.isOpen()
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
	const burguerDiv = opts.holder.style('margin', '10px 0px 10px 10px')
	icon_functions['burguer'](burguerDiv, { handler: opts.callback, title: opts.title || 'Settings' })

	const self = {
		dom: {
			btn: burguerDiv
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

function helpBtnInit(opts) {
	const infoDiv = opts.holder.style('margin', '10px')

	icon_functions['help'](infoDiv, { handler: opts.callback, title: 'Documentation' })

	const self = {
		plotTypes: [
			'profilePolar',
			'profileBarchart',
			'profileRadar',
			'profileRadarFacility',
			'boxplot',
			'correlationVolcano',
			'differentialAnalysis'
		],
		dom: {
			btn: infoDiv
		}
	}

	const api = {
		main(isOpen, plot) {
			if (self.plotTypes.includes(plot.chartType) || self.plotTypes.includes(plot.childType))
				self.dom.btn.style('display', isOpen ? 'inline-block' : 'block')
			else self.dom.btn.style('display', 'none')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function downloadBtnInit(opts) {
	const downloadDiv = opts.holder.style('margin-left', '10px')
	icon_functions['download'](downloadDiv, { handler: opts.callback, title: opts.title })

	const self = {
		plotTypes: ['summary', 'boxplot', 'scatter', 'brainImaging'],
		dom: {
			btn: downloadDiv
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
