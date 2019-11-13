import * as rx from '../common/rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import { termsettingInit } from '../common/termsetting'
import { initRadioInputs } from '../common/dom'

/*
a wrapper component of termsettingInit
bi-directional information flow

####################                        ###############
#                  #   ====== A ========>   #             #
# controls.overlay #                        # termsetting #
#                  #   <===== B =========   #             #
####################                        ###############

A: when overlay is notified, overlay.main() is called, which also calls pill.main() to propagate updated term2 data
B: user interaction at termsetting UI updates term2 data, and sends back to overlay via callback.



opts{}
.holder
.index (of the plot control)
.id (of the plot control)

FIXME should show existing term2 upon init
*/

class TdbOverlayInput {
	constructor(opts) {
		this.type = 'overlayInput'
		this.opts = opts
		this.dom = { holder: opts.holder }
		setInteractivity(this)
		setRenderers(this)

		this.setUI()
		this.api = {
			main: state => {
				this.state = state
				this.plot = state.config
				this.render(state)
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
		if (this.plot.term0) o.disable_terms.push(this.plot.term0.term.id)
		const term2 = this.plot.settings.controls.term2
		if (term2) {
			o.disable_terms.push(term2.term.id)
			o.term = term2.term
			o.q = term2.q
		}
		this.pill.main(o)
	}

	setPill() {
		// requires this.state, so can only call in main()
		this.pill = termsettingInit({
			holder: this.dom.pill_div,
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			callback: term => {
				const term2 = term ? { id: term.id, term } : null
				this.opts.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: {
						term2,
						settings: {
							barchart: {
								overlay: term2 ? 'tree' : 'none'
							},
							controls: { term2 }
						}
					}
				})
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
			name: 'pp-termdb-overlay-' + this.opts.index,
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

		this.dom.pill_div = d3select(treeInput.node().parentNode.parentNode)
			.append('div')
			.style('display', 'inline-block')
	}

	self.render = function() {
		// hide all options when opened from genome browser view
		// self.dom.holder.style('display', self.obj.modifier_ssid_barchart ? 'none' : 'table-row')

		const plot = self.plot
		// do not show genotype overlay option when opened from stand-alone page
		if (!plot.settings.barchart.overlay) {
			plot.settings.barchart.overlay = self.obj.modifier_ssid_barchart
				? 'genotype'
				: plot.term2 && plot.term2.term.id != plot.term.term.id
				? 'tree'
				: 'none'
		}

		self.radio.main(plot.settings.barchart.overlay)
		self.radio.dom.labels.html(self.updateRadioLabels)
		self.radio.dom.divs.style('display', self.getDisplayStyle)
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
			//return d.value != 'genotype' || self.obj.modifier_ssid_barchart ? block : 'none'
		}
	}
}

function setInteractivity(self) {
	self.setOptionVal = d => {
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value == 'none') {
			self.opts.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: {
					term2: undefined,
					settings: {
						currViews: ['barchart'],
						barchart: { overlay: d.value }
					}
				}
			})
		} else if (d.value == 'tree') {
			if (!plot.settings.controls.term2) {
				self.pill.showTree()
			} else {
				self.opts.dispatch({
					type: 'plot_edit',
					id: self.opts.id,
					config: {
						term2: plot.settings.controls.term2,
						settings: { barchart: { overlay: d.value } }
					}
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
			self.opts.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: {
					term2: {
						term: plot.term.term,
						q: {
							bar_by_children: 1
						}
					},
					settings: { barchart: { overlay: d.value } }
				}
			})
		} else if (d.value == 'bar_by_grade') {
			if (plot.term.q.bar_by_grade) {
				console.log('bar_by_grade term1 should not allow grade overlay')
				return
			}
			self.opts.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: {
					term2: {
						term: plot.term.term,
						q: {
							bar_by_grade: 1
						}
					},
					settings: { barchart: { overlay: d.value } }
				}
			})
		} else {
			console.log('unhandled click event', d, d3event.target)
		}
	}

	self.showTree2 = d => {
		// FIXME should not be needed, duplicate functionality with common/termsetting
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value != 'tree' || d.value != plot.settings.barchart.overlay) return
		/*self.obj.showtree4selectterm([plot.term.id, plot.term2 ? plot.term2.term.id : null], tr.node(), term2 => {
			self.obj.tip.hide()
			self.opts.dispatch({ term2: { term: term2 } })
		})*/
	}
}
