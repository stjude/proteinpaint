import { getInitFxn } from '../common/rx.core'
import { overlayInit } from './plot.controls.overlay'
import { term1uiInit } from './plot.controls.term1'
import { divideInit } from './plot.controls.divide'
import { initRadioInputs } from '../common/dom'

class TdbConfigUiInit {
	constructor(opts) {
		this.opts = opts
		this.id = opts.id
		setInteractivity(this)

		const dispatch = opts.dispatch
		const table = this.setDom()
		const debug = opts.debug
		this.inputs = {
			term1: term1uiInit({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			overlay: overlayInit({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			view: setViewOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			orientation: setOrientationOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			scale: setScaleOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			divideBy: divideInit({ holder: table.append('tr'), dispatch, id: this.id, debug })
		}

		this.api = {
			main: (state, isOpen) => {
				this.render(isOpen)
				if (!state) return
				const plot = state.config
				for (const name in this.inputs) {
					const o = this.inputs[name]
					o.main(o.usestate ? state : plot)
				}
			}
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

		return this.dom.table
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

export const configUiInit = getInitFxn(TdbConfigUiInit)

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
		name: 'pp-termdb-condition-unit',
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
		name: 'pp-termdb-scale-unit',
		holder: self.dom.inputTd,
		options: [
			{ label: 'Absolute', value: 'abs' },
			{ label: 'Log', value: 'log' },
			{ label: 'Proportion', value: 'pct' }
		],
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

	self.radio = initRadioInputs({
		name: 'pp-termdb-display-mode', // elemName
		holder: self.dom.inputTd,
		options: [
			{ label: 'Barchart', value: 'barchart' },
			{ label: 'Table', value: 'table' },
			{ label: 'Boxplot', value: 'boxplot' },
			{ label: 'Scatter', value: 'scatter' }
		],
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
			self.dom.row.style('display', plot.term2 ? 'table-row' : 'none')
			const currValue = plot.settings.currViews.includes('table')
				? 'table'
				: plot.settings.currViews.includes('boxplot')
				? 'boxplot'
				: plot.settings.currViews.includes('scatter')
				? 'scatter'
				: 'barchart'

			self.radio.main(currValue)
			self.radio.dom.divs.style('display', d =>
				d.value == 'barchart'
					? 'inline-block'
					: d.value == 'table' && plot.term2
					? 'inline-block'
					: d.value == 'boxplot' && plot.term2 && plot.term2.term.isfloat
					? 'inline-block'
					: d.value == 'scatter' && plot.term.term.isfloat && plot.term2 && plot.term2.term.isfloat
					? 'inline-block'
					: 'none'
			)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
