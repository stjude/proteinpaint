import * as rx from '../common/rx.core'
import { overlayInit } from './plot.controls.overlay'
import { term1uiInit } from './plot.controls.term1'
import { divideInit } from './plot.controls.divide'
import { initRadioInputs } from '../common/dom'

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

class TdbConfigUiInit {
	constructor(app, opts) {
		this.type = 'controlsConfig'
		this.opts = opts
		this.id = opts.id
		this.app = app
		this.instanceNum = instanceNum++
		setInteractivity(this)

		const dispatch = app.dispatch
		const table = this.setDom()
		const debug = opts.debug
		this.inputs = {
			view: setViewOpts({
				holder: this.dom.viewTr,
				dispatch,
				id: this.id,
				debug,
				instanceNum: this.instanceNum,
				isleaf: opts.isleaf,
				iscondition: opts.iscondition,
				survivalplot: opts.survivalplot
			}),
			orientation: setOrientationOpts({
				holder: this.dom.orientationTr,
				dispatch,
				id: this.id,
				debug,
				instanceNum: this.instanceNum
			}),
			scale: setScaleOpts({ holder: this.dom.scaleTr, dispatch, id: this.id, debug }),
			grade: setCumincGradeOpts({
				holder: this.dom.cumincGradeTr,
				dispatch,
				id: this.id,
				debug
			})
		}
		this.components = {
			term1: term1uiInit(app, { holder: this.dom.term1Tr, id: this.id, debug }),
			overlay: overlayInit(app, { holder: this.dom.overlayTr, id: this.id, debug }),
			divideBy: divideInit(app, { holder: this.dom.divideTr, id: this.id, debug })
		}

		this.api = rx.getComponentApi(this)
		this.eventTypes = ['postInit', 'postRender']
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
		this.dom.cumincGradeTr = this.dom.table.append('tr') //.style('display', 'none')
		this.dom.scaleTr = this.dom.table.append('tr')
		this.dom.divideTr = this.dom.table.append('tr')

		return this.dom.table
	}

	getState(appState) {
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: appState.tree.plots[this.id],
			survivalplot: appState.termdbConfig.survivalplot
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = plot.settings.controls.isOpen

		this.render(isOpen)
		for (const name in this.inputs) {
			const o = this.inputs[name]
			o.main(o.usestate ? this.state : plot)
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

export const configUiInit = rx.getInitFxn(TdbConfigUiInit)

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
		main(plot) {
			self.dom.row.style('display', plot.settings.currViews.includes('barchart') ? 'table-row' : 'none')
			self.radio.main(plot.settings.barchart.orientation)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setScaleOpts(opts) {
	const self = {
		dom: {
			row: opts.holder,
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
		main(plot) {
			self.dom.row.style('display', plot.settings.currViews.includes('barchart') ? 'table-row' : 'none')
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
			row: opts.holder,
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
		main(plot) {
			self.dom.row.style('display', plot.settings.currViews.includes('cuminc') ? 'table-row' : 'none')
			self.dom.select.property('value', plot.settings.cuminc.gradeCutoff)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setViewOpts(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTd: opts.holder
				.append('td')
				.html('Display mode')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	const options = [
		{ label: 'Barchart', value: 'barchart' },
		{ label: 'Table', value: 'table' },
		{ label: 'Boxplot', value: 'boxplot' },
		{ label: 'Scatter', value: 'scatter' }
	]

	if (opts.iscondition) {
		options.push({ label: 'Cumulative Incidence', value: 'cuminc' })
	}

	if (opts.survivalplot) {
		options.push({ label: 'Survival', value: 'survival' })
	}

	self.radio = initRadioInputs({
		name: 'pp-termdb-display-mode-' + opts.instanceNum, // elemName
		holder: self.dom.inputTd,
		options,
		listeners: {
			input(d) {
				const currViews = d.value == 'barchart' ? ['barchart', 'stattable'] : [d.value]
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: { currViews }
					}
				})
			}
		}
	})

	const api = {
		main(plot) {
			self.dom.row.style('display', opts.survivalplot || opts.iscondition || plot.term2 ? 'table-row' : 'none')
			const currValue = plot.settings.currViews.includes('table')
				? 'table'
				: plot.settings.currViews.includes('boxplot')
				? 'boxplot'
				: plot.settings.currViews.includes('scatter')
				? 'scatter'
				: plot.settings.currViews.includes('cuminc')
				? 'cuminc'
				: plot.settings.currViews.includes('survival')
				? 'survival'
				: 'barchart'

			const numericTypes = ['integer', 'float']

			self.radio.main(currValue)
			self.radio.dom.divs.style('display', d =>
				d.value == 'barchart' || d.value == 'cuminc' || (d.value == 'survival' && opts.survivalplot)
					? 'inline-block'
					: d.value == 'table' && plot.term2
					? 'inline-block'
					: d.value == 'boxplot' && plot.term2 && numericTypes.includes(plot.term2.term.type)
					? 'inline-block'
					: d.value == 'scatter' &&
					  numericTypes.includes(plot.term.term.type) &&
					  plot.term2 &&
					  numericTypes.includes(plot.term2.term.type)
					? 'inline-block'
					: 'none'
			)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
