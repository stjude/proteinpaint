import { getInitFxn } from '../common/rx.core'
import { overlayInputInit } from './plot.controls.overlay'
import { initRadioInputs } from '../common/dom'

class TdbConfigUiInit {
	constructor(opts) {
		this.opts = opts
		this.id = opts.id
		setInteractivity(this)

		const dispatch = opts.dispatch
		const table = this.setDom()
		this.inputs = {
			//barsAs: setBarsAsOpts({ holder: table.append('tr'), label: 'Bars as' }),
			overlay: overlayInputInit({ holder: table.append('tr'), dispatch, id: this.id }),
			view: setViewOpts({ holder: table.append('tr'), dispatch, id: this.id }),
			orientation: setOrientationOpts({ holder: table.append('tr'), dispatch, id: this.id }),
			scale: setScaleOpts({ holder: table.append('tr'), dispatch, id: this.id })
			//bin: setBinOpts({ holder: table.append('tr'), label: 'Primary Bins' }),
			//divideBy: setDivideByOpts({ holder: table.append('tr') })
		}

		this.api = {
			main: (state, isOpen) => {
				this.render(isOpen)
				const plot = state.config
				for (const name in this.inputs) {
					if (name == 'overlay') this.inputs[name].main(state)
					else this.inputs[name].main(plot) //, data)
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
				console.log('test')
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

function setDivideByOpts(app, opts, controls) {
	const self = {
		dom: {
			row: opts.holder,
			labelTd: row
				.append('td')
				.html('Divide by')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.radio = initRadioInputs({
		name: 'pp-termdb-divide-by',
		holder: td,
		options: [{ label: 'None', value: 'none' }, { label: '', value: 'tree' }, { label: 'Genotype', value: 'genotype' }],
		listeners: {
			input(d) {
				d3event.stopPropagation()
				if (d.value == 'none') {
					opts.dispatch({ type: 'plot_edit', id: opts.id, term0: undefined })
				} else if (d.value == 'tree') {
					opts.dispatch({
						term0: { type: 'plot_edit', id: opts.id, term: termuiObj.termsetting.term }
					})
				} else if (d.value == 'genotype') {
					// to-do
				}
			}
		}
	})

	//add blue-pill for term0
	self.dom.pill_div = d3select(
		radio.dom.divs
			.filter(d => {
				return d.value == 'tree'
			})
			.node()
	)
		.append('div')
		.style('display', 'inline-block')

	function termuiCallback(term0) {
		controls.dispatch({
			type: 'plot_edit',
			id: opts.id,
			config: {
				term0: term0 ? { term: term0 } : undefined,
				settings: {
					barchart: {
						divideBy: term0 ? 'tree' : 'none'
					}
				}
			}
		})
	}

	termSettingInit(app, { holder: pill_div, plot, term_id: 'term0', id: controls.id })

	return {
		main(plot) {
			if (!self.termuiObj) {
				self.termuiObj = getTermuiObj(app, plot, pill_div, 'Select term', 'term0', termuiCallback)
			}

			// hide all options when opened from genome browser view
			tr.style(
				'display',
				app.opts.modifier_ssid_barchart ||
					(!plot.settings.currViews.includes('barchart') && !plot.settings.currViews.includes('scatter'))
					? 'none'
					: 'table-row'
			)
			// do not show genotype divideBy option when opened from stand-alone page
			if (!plot.settings.barchart.divideBy) {
				plot.settings.barchart.divideBy = app.opts.modifier_ssid_barchart ? 'genotype' : plot.term0 ? 'tree' : 'none'
			}
			radio.main(plot.settings.barchart.divideBy)

			radio.dom.divs.style('display', d => {
				if (d.value == 'max_grade_perperson' || d.value == 'most_recent_grade') {
					return plot.term.term.iscondition || (plot.term0 && plot.term0.term.iscondition) ? 'block' : 'none'
				} else {
					const block = 'block'
					return d.value != 'genotype' || app.opts.modifier_ssid_barchart ? block : 'none'
				}
			})

			if (plot.term0 && plot.term0.term != termuiObj.termsetting.term) {
				termuiObj.termsetting.term = plot.term0.term
				// termuiObj.update_ui()
			}
		}
	}
}

function setBarsAsOpts(opts) {
	const tr = opts.holder
	const plot = app.getState({ type: controls.type, id: controls.id })
	tr.append('td')
		.html(opts.label)
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')

	function termuiCallback(term) {
		controls.dispatch({ term, id: opts.id })
	}

	termSettingInit(app, { holder: td.append('div'), plot, term_id: 'term1', id: controls.id })

	return {
		main(plot) {
			if (!self.termuiObj) {
				self.termuiObj = getTermuiObj(app, plot, td.append('div'), '', 'term', termuiCallback)
			}
			tr.style('display', plot.term && plot.term.term.iscondition ? 'table-row' : 'none')
			// termuiObj.update_ui()
		}
	}
}

function setBinOpts(app, opts, controls) {
	const tr = opts.holder
	tr.append('td')
		.html(opts.label)
		.attr('class', 'sja-termdb-config-row-label')
	const bin_edit_td = tr.append('td')

	bin_edit_td
		.append('div')
		.attr('class', 'sja_edit_btn')
		.style('margin-left', '0px')
		.html('EDIT')
		.on('click', () => {
			// click to show ui and customize binning
			const term = plot[opts.termNum]
			numeric_bin_edit(app.tip, term.term, term.q, true, q => {
				controls.dispatch({ term: { term: term.term, q } })
			})
		})

	let plot
	return {
		main(_plot) {
			plot = _plot
			const term = plot[opts.termNum]
			tr.style('display', term && (term.term.isfloat || term.term.isinteger) ? 'table-row' : 'none')
		}
	}
}
