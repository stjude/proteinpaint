import { getInitFxn } from '../common/rx.core'
import { overlayInputInit } from './plot.controls.overlay'
import { divideByInputInit } from './plot.controls.divideBy'
import { initRadioInputs } from '../common/dom'
// temporarily use legacy termui_display to prototype the barsAs input
import { numeric_bin_edit, display as termui_display } from '../mds.termdb.termsetting.ui'
import { termSettingInit } from './termsetting'

class TdbConfigUiInit {
	constructor(opts) {
		this.opts = opts
		this.id = opts.id
		setInteractivity(this)

		const dispatch = opts.dispatch
		const table = this.setDom()
		const debug = opts.debug
		this.inputs = {
			barsAs: setBarsAsOpts({
				holder: table.append('tr'),
				label: 'Bars as',
				dispatch,
				tip: opts.tip,
				id: this.id,
				debug
			}),
			overlay: overlayInputInit({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			view: setViewOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			orientation: setOrientationOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			scale: setScaleOpts({ holder: table.append('tr'), dispatch, id: this.id, debug }),
			bin: setBinOpts({
				holder: table.append('tr'),
				label: 'Primary Bins',
				dispatch,
				id: this.id,
				tip: opts.tip,
				termNum: 'term',
				debug
			}),
			divideBy: divideByInputInit({ holder: table.append('tr'), dispatch, id: this.id, debug })
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

function setBarsAsOpts(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		},
		async setPill() {
			// temporarily use the legacy termui_display to prototype the barsAs input
			// to be replaced by common/termsetting initializer
			const q = self.plot.term.q ? self.plot.term.q : {}
			self.pill = {
				holder: self.dom.inputTd,
				genome: self.state.genome,
				mds: self.state.mds,
				tip: opts.tip,
				currterm: self.term,
				termsetting: { term: Object.assign({}, self.plot.term.term, { q }), q },
				is_term1: true,
				callback: self.editTerm,
				isCoordinated: true
				// update_ui: will be attached by term_display
			}
			await termui_display(self.pill)
		},
		editTerm(term) {
			//self.plot.term = Object.assign({}, self.plot.term, {q: term.q})
			console.log(term)
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: { term: { id: term.id, term, q: term.q ? term.q : {} } }
			})
		}
	}

	const api = {
		usestate: true,
		async main(state) {
			self.state = state
			self.plot = state.config
			if (!self.plot.term || !self.plot.term.term.iscondition) {
				self.dom.row.style('display', 'none')
				return
			}
			self.dom.row.style('display', 'table-row')
			if (!self.pill) {
				await self.setPill()
			} else {
				const q = self.plot.term.q ? self.plot.term.q : {}
				self.pill.termsetting = {
					term: Object.assign({}, self.plot.term.term, { q }),
					q
				}
				self.pill.update_ui()
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setBinOpts(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		},
		edit() {
			// click to show ui and customize binning
			const term = self.plot[opts.termNum]
			numeric_bin_edit(opts.tip, term.term, term.q, true, q => {
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						term: { term: term.term, q }
					}
				})
			})
		}
	}

	self.dom.inputTd
		.append('div')
		.attr('class', 'sja_edit_btn')
		.style('margin-left', '0px')
		.html('EDIT')
		.on('click', self.edit)

	const api = {
		main(plot) {
			self.plot = plot
			const term = self.plot[opts.termNum]
			opts.holder.style('display', term && (term.term.isfloat || term.term.isinteger) ? 'table-row' : 'none')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
