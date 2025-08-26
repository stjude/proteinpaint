import { getCompInit, multiInit } from '../rx'
import { topBarInit } from './controls.btns'
import { configUiInit } from './controls.config'
import { TermTypes } from '#shared/terms.js'

/*
constructor options:

.inputs = []
	see an example

*/

const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'
let i = 0 // track controls "instances" for assigning unambiguous unique input names
// defaultQ for term0/term2
export const term0_term2_defaultQ = {
	[TermTypes.GENE_VARIANT]: { type: 'predefined-groupset' },
	[TermTypes.GENE_EXPRESSION]: { mode: 'discrete' },
	[TermTypes.METABOLITE_INTENSITY]: { mode: 'discrete' }
}

class TdbPlotControls {
	constructor(opts) {
		this.opts = opts
		this.type = 'plotControls'
		this.customEvents = ['downloadClick', 'infoClick', 'helpClick']
		this.isOpen = false
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		try {
			this.setDom()
			// not using this.components since these will be manually updated later in main(),
			// instead of updating these via notifyComponents() from app.dispatch
			this.features = await multiInit({
				topbar: topBarInit({
					app: this.app,
					id: this.id,
					holder: this.dom.topbar,
					callback: this.toggleVisibility,
					isOpen: () => this.isOpen,
					downloadHandler: holder => this.bus.emit('downloadClick', this.dom.topbar),
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
					helpHandler: () => this.bus.emit('helpClick'),
					title: this.opts.title
				}),
				config: configUiInit({
					app: this.app,
					id: this.id,
					holder: this.dom.config_div,
					isOpen: () => this.isOpen,
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

	main(isOpen = undefined) {
		if (!this.state) return
		if (typeof isOpen == 'boolean') this.isOpen = isOpen
		else {
			const controls = this.state.config.settings.controls
			if (controls && 'isOpen' in controls) this.isOpen = controls.isOpen
		}

		this.render()
		const appState = this.app.getState()
		for (const name in this.features) {
			this.features[name].update({ state: this.state, appState })
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
		const controls = self.state.config.settings.controls
		if (controls && 'isOpen' in controls) {
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					settings: {
						controls: { isOpen: !controls.isOpen }
					}
				},
				_scope_: 'none'

				// may be used to limit the dispatch notification, if it is reliably known that
				// no components above or outside the _notificationRoot_ should react to this action
				//_notificationRoot_: [self.api]
			})
		} else {
			self.main(!self.isOpen)
		}
	}
}

export function renderTerm1Label(tw) {
	if (!tw || !Object.keys(tw).length) return ''
	switch (tw.term.type) {
		case TermTypes.CATEGORICAL:
			return 'Group categories'
		case TermTypes.INTEGER:
		case TermTypes.FLOAT:
			return tw.q.mode == 'discrete' ? 'Customize bins' : 'Customize'
		case TermTypes.GENE_VARIANT:
			return 'Group variants'
		case TermTypes.SNP:
			return 'Group genotypes'
		default:
			return 'Customize'
	}
}
