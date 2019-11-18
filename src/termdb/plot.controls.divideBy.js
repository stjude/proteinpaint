import { getInitFxn } from '../common/rx.core'
import { termsettingInit } from '../common/termsetting'
import { initRadioInputs } from '../common/dom'
import { event } from 'd3-selection'

export class TdbDivideByInput {
	constructor(opts) {
		this.opts = opts
		setInteractivity(this)
		setRenderers(this)

		this.dom = {
			row: opts.holder,
			labelTd: opts.holder
				.append('td')
				.html('Divide by')
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}

		this.radio = initRadioInputs({
			name: 'pp-termdb-divide-by',
			holder: this.dom.inputTd,
			options: [
				{ label: 'None', value: 'none' },
				{ label: '', value: 'tree' }
				//{ label: 'Genotype', value: 'genotype' }
			],
			listeners: {
				input: this.setOptionVal
			}
		})

		this.api = {
			usestate: true,
			main: state => {
				this.state = state
				this.plot = state.config
				this.render()
				this.updatePill()
			}
		}
	}

	updatePill() {
		if (!this.pill) this.setPill()
		const o = {
			disable_terms: [this.plot.term.term.id],
			q: {},
			termfilter: this.state.termfilter // used later for computing kernel density of numeric term
		}
		if (this.plot.term2) o.disable_terms.push(this.plot.term2.term.id)
		const term0 = this.plot.settings.controls.term0
		if (term0) {
			o.disable_terms.push(term0.term.id)
			o.term = term0.term
			o.q = term0.q
		}
		this.pill.main(o)
	}

	setPill() {
		//add blue-pill for term0
		this.dom.pill_div = this.radio.dom.divs
			.filter(d => {
				return d.value == 'tree'
			})
			.append('div')
			.style('display', 'inline-block')

		this.pill = termsettingInit({
			holder: this.dom.pill_div,
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			callback: this.editTerm
		})
	}
}

export const divideByInputInit = getInitFxn(TdbDivideByInput)

function setRenderers(self) {
	self.render = () => {
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
		self.radio.dom.divs.style('display', self.radioDivDisplay)
	}

	self.radioDivDisplay = d => {
		if (d.value == 'max_grade_perperson' || d.value == 'most_recent_grade') {
			return self.plot.term.term.iscondition || (self.plot.term0 && self.plot.term0.term.iscondition) ? 'block' : 'none'
		} else {
			const block = 'block'
			return d.value != 'genotype' ? block : 'none'
		}
	}
}

function setInteractivity(self) {
	self.setOptionVal = d => {
		event.stopPropagation()
		const s = self.plot.settings
		if (d.value == 'none') {
			self.opts.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: {
					term0: null,
					settings: {
						barchart: { divideBy: d.value }
					}
				}
			})
		} else if (d.value == 'tree') {
			if (!s.controls.term0) {
				self.pill.showTree()
			} else {
				self.opts.dispatch({
					type: 'plot_edit',
					id: self.opts.id,
					config: {
						term0: s.controls.term0,
						settings: {
							barchart: { divideBy: d.value },
							controls: { term0: s.controls.term0 }
						}
					}
				})
			}
		} else if (d.value == 'genotype') {
			// to-do
		}
	}

	self.editTerm = term => {
		const term0 = term ? { id: term.id, term } : null
		self.opts.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
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
}
