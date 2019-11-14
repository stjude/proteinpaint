import { termsettingInit } from '../common/termsetting'
import { initRadioInputs } from '../common/dom'
import { event } from 'd3-selection'

export function divideByInputInit(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTd: opts.holder
				.append('td')
				.html('Divide by')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		},
		render() {
			// hide all options when opened from genome browser view
			const s = self.plot.settings
			self.dom.row.style(
				'display',
				!s.currViews.includes('barchart') && !s.currViews.includes('scatter') ? 'none' : 'table-row'
			)
			// do not show genotype divideBy option when opened from stand-alone page
			/* not needed ?
			if (!s.barchart.divideBy) {
				s.barchart.divideBy = app.opts.modifier_ssid_barchart ? 'genotype' : plot.term0 ? 'tree' : 'none'
			}
			*/
			self.radio.main(s.barchart.divideBy)
			self.radio.dom.divs.style('display', d => {
				if (d.value == 'max_grade_perperson' || d.value == 'most_recent_grade') {
					return self.plot.term.term.iscondition || (plot.term0 && plot.term0.term.iscondition) ? 'block' : 'none'
				} else {
					const block = 'block'
					return d.value != 'genotype' ? block : 'none'
				}
			})
		},
		updatePill() {
			if (!self.pill) self.setPill()

			const o = {
				disable_terms: [self.plot.term.term.id],
				q: {},
				termfilter: self.state.termfilter // used later for computing kernel density of numeric term
			}
			if (self.plot.term2) o.disable_terms.push(self.plot.term2.term.id)
			const term0 = this.plot.settings.controls.term0
			if (term0) {
				o.disable_terms.push(term0.term.id)
				o.term = term0.term
				o.q = term0.q
			}
			this.pill.main(o)
		},
		setPill() {
			//add blue-pill for term0
			self.dom.pill_div = self.radio.dom.divs
				.filter(d => {
					return d.value == 'tree'
				})
				.append('div')
				.style('display', 'inline-block')

			self.pill = termsettingInit({
				holder: self.dom.pill_div,
				genome: self.state.genome,
				dslabel: self.state.dslabel,
				callback: term => {
					const term0 = term ? { id: term.id, term } : null
					opts.dispatch({
						type: 'plot_edit',
						id: opts.id,
						config: {
							term0: term0 ? { term: term0 } : undefined,
							settings: {
								barchart: {
									divideBy: term0 ? 'tree' : 'none'
								},
								controls: { term0 }
							}
						}
					})
				}
			})
		},
		setOptionVal(d) {
			event.stopPropagation()
			const s = self.plot.settings
			if (d.value == 'none') {
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						term0: null,
						settings: {
							//currViews: ['barchart'],
							barchart: { divideBy: d.value }
						}
					}
				})
			} else if (d.value == 'tree') {
				if (!s.controls.term0) {
					self.pill.showTree()
				} else {
					opts.dispatch({
						type: 'plot_edit',
						id: opts.id,
						config: {
							term0: s.controls.term0,
							settings: { barchart: { overlay: d.value } }
						}
					})
				}
			} else if (d.value == 'genotype') {
				// to-do
			}
		}
	}

	self.radio = initRadioInputs({
		name: 'pp-termdb-divide-by',
		holder: self.dom.inputTd,
		options: [
			{ label: 'None', value: 'none' },
			{ label: '', value: 'tree' }
			//{ label: 'Genotype', value: 'genotype' }
		],
		listeners: {
			input: self.setOptionVal
		}
	})

	const api = {
		main(state) {
			self.state = state
			self.plot = state.config
			self.render()
			self.updatePill()
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
