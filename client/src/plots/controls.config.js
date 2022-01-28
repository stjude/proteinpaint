import { getCompInit, multiInit } from '../common/rx.core'
import { overlayInit } from './controls.overlay'
import { term1uiInit } from './controls.term1'
import { divideInit } from './controls.divide'
import { initRadioInputs } from '../dom/radio2'

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

class TdbConfigUiInit {
	constructor(opts) {
		this.type = 'controlsConfig'
		this.app = opts.app
		this.id = opts.id
		this.instanceNum = instanceNum++
		setInteractivity(this)
	}

	async init() {
		try {
			const dispatch = this.app.dispatch
			const table = this.setDom()
			const debug = this.opts.debug
			this.inputs = {} // non-rx notified
			const componentPromises = {} // rx-notified

			for (const key of this.opts.inputs) {
				if (key in initByInput) {
					this.inputs[key] = initByInput[key]({
						holder: this.dom[`${key}Tr`],
						dispatch,
						id: this.id,
						instanceNum: this.instanceNum,
						debug: this.opts.debug,
						parent: this
					})
				} else if (key in initByComponent) {
					componentPromises[key] = initByComponent[key]({
						app: this.app,
						holder: this.dom[`${key}Tr`],
						id: this.id,
						debug: this.opts.debug
					})
				} else {
					throw `unsupported opts.inputs[] entry of '${key}' for controlsInit()`
				}
			}

			this.components = await multiInit(componentPromises)
		} catch (e) {
			throw e
		}
	}

	setDom() {
		this.dom = {
			holder: this.opts.holder
				.style('max-width', '50px')
				.style('height', 0)
				.style('vertical-align', 'top')
				.style('transition', '0.2s ease-in-out')
				.style('overflow', 'hidden')
				.style('visibility', 'hidden')
				.style('transition', '0.2s')
		}

		this.dom.table = this.dom.holder
			.append('table')
			.attr('cellpadding', 0)
			.attr('cellspacing', 0)
			.style('white-space', 'nowrap')
		// specify input row order
		this.dom.term1Tr = this.dom.table.append('tr')
		this.dom.overlayTr = this.dom.table.append('tr')
		this.dom.viewTr = this.dom.table.append('tr')
		this.dom.orientationTr = this.dom.table.append('tr')
		this.dom.gradeTr = this.dom.table.append('tr') //.style('display', 'none')
		this.dom.ciTr = this.dom.table.append('tr')
		this.dom.scaleTr = this.dom.table.append('tr')
		this.dom.divideByTr = this.dom.table.append('tr')

		return this.dom.table
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config,
			displayAsSurvival: config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival')
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = plot.settings.controls.isOpen
		this.render(isOpen)
		for (const name in this.inputs) {
			const o = this.inputs[name]
			o.main(o.usestate ? this.state : plot, this.state.displayAsSurvival)
		}
	}

	render(isOpen) {
		this.dom.holder
			.style('visibility', isOpen ? 'visible' : 'hidden')
			.style('max-width', isOpen ? '660px' : '50px')
			.style('height', isOpen ? '' : 0)

		this.dom.table
			.selectAll('tr')
			.filter(this.rowIsVisible)
			.selectAll('td')
			.style('border-top', '2px solid #FFECDD')
			.style('padding', '5px 10px')
	}
}

export const configUiInit = getCompInit(TdbConfigUiInit)

function setInteractivity(self) {
	self.rowIsVisible = function() {
		return this.style.display != 'none'
	}
}

function setOrientationOpts(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTdb: opts.holder
				.append('td')
				.html('Orientation')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.radio = initRadioInputs({
		name: 'pp-termdb-condition-unit-' + opts.instanceNum,
		holder: self.dom.inputTd,
		options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }],
		listeners: {
			input(d) {
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: {
							barchart: {
								orientation: d.value
							}
						}
					}
				})
			}
		}
	})

	const api = {
		main(plot, displayAsSurvival = false) {
			self.dom.row.style('table-row')
			self.radio.main(plot.settings.barchart.orientation)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setScaleOpts(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html('Scale')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.radio = initRadioInputs({
		name: 'pp-termdb-scale-unit-' + opts.instanceNum,
		holder: self.dom.inputTd,
		options: [{ label: 'Linear', value: 'abs' }, { label: 'Log', value: 'log' }, { label: 'Proportion', value: 'pct' }],
		listeners: {
			input(d) {
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: {
							barchart: {
								unit: d.value
							}
						}
					}
				})
			}
		}
	})

	const api = {
		main(plot, displayAsSurvival = false) {
			self.radio.main(plot.settings.barchart.unit)
			self.radio.dom.divs.style('display', d => {
				if (d.value == 'log') {
					return plot.term2 ? 'none' : 'inline-block'
				} else if (d.value == 'pct') {
					return plot.term2 ? 'inline-block' : 'none'
				} else {
					return 'inline-block'
				}
			})
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setCumincGradeOpts(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html('Cutoff Grade')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.select = self.dom.inputTd.append('select').on('change', () => {
		opts.dispatch({
			type: 'plot_edit',
			id: opts.id,
			config: {
				settings: {
					cuminc: {
						gradeCutoff: self.dom.select.property('value')
					}
				}
			}
		})
	})

	self.dom.select
		.selectAll('option')
		.data([1, 2, 3, 4, 5])
		.enter()
		.append('option')
		.attr('value', d => d)
		.attr('selected', d => d === 3)
		.html(d => '&nbsp;' + d + '&nbsp;')

	const api = {
		main(plot, displayAsSurvival = false) {
			self.dom.select.property('value', plot.settings.cuminc.gradeCutoff)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setCIOpts(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTdb: opts.holder
				.append('td')
				.html('95% CI')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	const label = self.dom.inputTd.append('label')

	self.dom.input = label
		.append('input')
		.attr('type', 'checkbox')
		.on('change', () => {
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						survival: {
							ciVisible: self.dom.input.property('checked')
						}
					}
				}
			})
		})

	label
		.append('span')
		.html('&nbsp;Visible')
		.attr('type', 'checkbox')

	const api = {
		main(plot, displayAsSurvival = false) {
			self.dom.input.property('checked', plot.settings.survival.ciVisible)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

const initByInput = {
	orientation: setOrientationOpts,
	scale: setScaleOpts,
	grade: setCumincGradeOpts,
	ci: setCIOpts
}

const initByComponent = {
	term1: term1uiInit,
	overlay: overlayInit,
	divideBy: divideInit
}
