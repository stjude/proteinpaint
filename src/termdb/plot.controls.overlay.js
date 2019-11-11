import * as rx from '../common/rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import { termsettingInit } from './termsetting-xin'
import { initRadioInputs } from '../common/dom'

class TdbOverlayInput {
	constructor(app, opts) {
		this.type = 'overlayInput'
		this.app = app
		this.opts = opts
		this.controls = opts.controls
		this.dom = {
			holder: opts.holder.append('tr')
		}
		setInteractivity(this)
		setRenderers(this)

		this.setUI()
		this.components = {}
		this.api = rx.getComponentApi(this)
	}

	main({ state, data, obj }) {
		this.state = state
		this.plot = state.config
		this.data = data
		this.obj = obj ? obj : this.opts.obj ? this.opts.obj : {}
		if (!this.components.pill) this.setPill()

		// hide all options when opened from genome browser view
		this.dom.holder.style('display', this.obj.modifier_ssid_barchart ? 'none' : 'table-row')

		const plot = this.plot
		// do not show genotype overlay option when opened from stand-alone page
		if (!plot.settings.barchart.overlay) {
			plot.settings.barchart.overlay = this.obj.modifier_ssid_barchart
				? 'genotype'
				: plot.term2 && plot.term2.term.id != plot.term.term.id
				? 'tree'
				: 'none'
		}

		this.radio.main(plot.settings.barchart.overlay)
		this.radio.dom.labels.html(this.updateRadioLabels)
		this.radio.dom.divs.style('display', this.getDisplayStyle)

		const disable_terms = [plot.term.term.id]
		if (plot.term0) disable_terms.push(plot.term0.term.id)
		return { data, term: plot.term2, disable_terms }
	}

	setPill() {
		this.components.pill = termsettingInit(this.app, {
			holder: this.pill_div,
			plot: this.plot,
			term_id: 'term2',
			id: this.controls.id,
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			callback: term => {
				console.log(term)
				this.controls.dispatch({ term2: term ? { id: term.id, term } : null })
			}
		})
	}
}

export const overlayInputInit = rx.getInitFxn(TdbOverlayInput)

function setRenderers(self) {
	self.setUI = function() {
		const tr = self.dom.holder

		tr.append('td')
			.html('Overlay with')
			.attr('class', 'sja-termdb-config-row-label')

		const td = tr.append('td')

		this.radio = initRadioInputs({
			name: 'pp-termdb-overlay-' + this.controls.index,
			holder: td,
			options: [
				{ label: 'None', value: 'none' },
				{ label: 'Subconditions', value: 'bar_by_children' },
				{ label: 'Grade', value: 'bar_by_grade' },
				{ label: '', value: 'tree' },
				{ label: 'Genotype', value: 'genotype' }
			],
			listeners: {
				input: self.setOptionVal,
				click: self.showTree
			}
		})

		//add blue-pill for term2
		const treeInput = this.radio.dom.inputs
			.filter(d => {
				return d.value == 'tree'
			})
			.style('margin-top', '2px')

		this.pill_div = d3select(treeInput.node().parentNode.parentNode)
			.append('div')
			.style('display', 'inline-block')
	}

	self.updateRadioLabels = function(d) {
		const term1 = self.plot.term.term
		if (!term1.iscondition) return '&nbsp;' + d.label
		if (d.value == 'bar_by_children') return '&nbsp;' + term1.id + ' subconditions'
		if (d.value == 'bar_by_grade') return '&nbsp;' + term1.id + ' grades'
		return '&nbsp;' + d.label
	}

	self.getDisplayStyle = function(d) {
		const term1 = self.plot.term.term
		if (d.value == 'bar_by_children') {
			return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_grade ? 'block' : 'none'
		} else if (d.value == 'bar_by_grade') {
			return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_children ? 'block' : 'none'
		} else {
			const block = 'block' //term1.q.iscondition || (plot.term2 && plot.term2.term.iscondition) ? 'block' : 'inline-block'
			return d.value != 'genotype' || self.obj.modifier_ssid_barchart ? block : 'none'
		}
	}
}

function setInteractivity(self) {
	self.setOptionVal = d => {
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value == 'none') {
			self.controls.dispatch({
				term2: undefined,
				settings: {
					currViews: ['barchart'],
					barchart: { overlay: d.value }
				}
			})
		} else if (d.value == 'tree') {
			if (!self.termuiObj.termsetting.term) {
				// should launch the blue pill's term tree menu
			} else {
				self.controls.dispatch({
					['term2']: { id: self.termuiObj.termsetting.term.id, term: self.termuiObj.termsetting.term },
					settings: { barchart: { overlay: d.value } }
				})
			}
		} else if (d.value == 'genotype') {
			// to-do
			console.log('genotype overlay to be handled from term tree portal', d, d3event.target)
		} else if (d.value == 'bar_by_children') {
			if (plot.term.q.bar_by_children) {
				console.log('bar_by_children term1 should not allow subcondition overlay')
				return
			}
			const q = { bar_by_grade: 1 }
			self.controls.dispatch({
				term2: {
					term: plot.term.term,
					q: {
						bar_by_children: 1
					}
				},
				settings: { barchart: { overlay: d.value } }
			})
		} else if (d.value == 'bar_by_grade') {
			if (plot.term.q.bar_by_grade) {
				console.log('bar_by_grade term1 should not allow grade overlay')
				return
			}
			self.controls.dispatch({
				term2: {
					term: plot.term.term,
					q: {
						bar_by_grade: 1
					}
				},
				settings: { barchart: { overlay: d.value } }
			})
		} else {
			console.log('unhandled click event', d, d3event.target)
		}
	}

	self.showTree = d => {
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value != 'tree' || d.value != plot.settings.barchart.overlay) return
		self.obj.showtree4selectterm([plot.term.id, plot.term2 ? plot.term2.term.id : null], tr.node(), term2 => {
			console.log(term2)
			self.obj.tip.hide()
			self.controls.dispatch({ term2: { term: term2 } })
		})
	}
}
