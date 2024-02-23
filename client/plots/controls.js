import { getCompInit, multiInit } from '../rx'
import { topBarInit } from './controls.btns'
import { configUiInit } from './controls.config'

/*
constructor options:

.inputs = []
	see an example

*/

const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'
let i = 0 // track controls "instances" for assigning unambiguous unique input names

class TdbPlotControls {
	constructor(opts) {
		this.opts = opts
		this.type = 'plotControls'
		this.customEvents = ['downloadClick', 'infoClick', 'helpClick']
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		try {
			this.setDom()
			this.components = await multiInit({
				topbar: topBarInit({
					app: this.app,
					id: this.id,
					holder: this.dom.topbar,
					callback: this.toggleVisibility,
					downloadHandler: () => this.bus.emit('downloadClick'),
					infoHandler: isOpen =>
						this.app.dispatch({
							type: 'plot_edit',
							id: this.opts.id,
							config: {
								settings: {
									termInfo: {
										isVisible: isOpen
									}
								}
							}
						}),
					helpHandler: () => this.bus.emit('helpClick')
				}),
				config: configUiInit({
					app: this.app,
					id: this.id,
					holder: this.dom.config_div,
					tip: this.app.tip,
					inputs: this.opts.inputs
				})
			})
		} catch (e) {
			throw e
		}
	}

	setDom() {
		const topbar = this.opts.holder.append('div')
		const config_div = this.opts.holder.append('div')

		this.dom = {
			holder: this.opts.holder.style('vertical-align', 'top').style('transition', '0.5s'),
			// these are listed in the displayed top-down order of input elements
			topbar,
			config_div
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found.`
		}
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config
		}
	}

	main(arg) {
		if (!this.state) return
		this.isOpen = this.state.config.settings.controls.isOpen
		this.render()
		for (const name in this.features) {
			this.features[name].main(this.state, this.isOpen)
		}
	}
}

export const controlsInit = getCompInit(TdbPlotControls)

function setRenderers(self) {
	self.render = function () {
		self.dom.holder.style('background', self.isOpen ? panel_bg_color : '')
	}
}

function setInteractivity(self) {
	self.toggleVisibility = () => {
		const isOpen = !self.isOpen
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					controls: { isOpen }
				}
			},
			_scope_: 'none',
			// TODO: may combine _scope_ with _skipNotification_, optimal approach tbd
			_skipNotification_(componentApi) {
				// do not notify a plot of this dispatched action, to avoid unnecessary rerender
				// but all child components of a plot will still be notified
				return self.app.getState().plots.find(p => p.type === componentApi.type || p.chartType === componentApi.type)
			}
		})
	}
}
