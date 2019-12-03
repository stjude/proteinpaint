import * as rx from '../common/rx.core'
import { termsettingInit } from '../common/termsetting'
import { Menu } from '../client'

/*
model after overlay2.js
still use a menu 

options for term0:
1) none
2) term (as term0, also is different from plot.term and plot.term2)
possibly more options may be added later

pill is only for altering between (1) and (2)
*/

class Divide {
	constructor(opts) {
		this.validateOpts(opts)
		setRenderers(this)
		this.initUI()
		this.usedTerms = [] // array of {term, q}
		this.api = {
			usestate: true,
			main: state => {
				this.state = state
				this.mayRegisterTerm(state.config.term0)
				this.updateUI()
			}
		}
		if (opts.debug) this.api.Inner = this
	}
	validateOpts(o) {
		if (!('id' in o)) throw 'opts.id missing' // plot id?
		if (!o.holder) throw 'opts.holder missing'
		if (typeof o.dispatch != 'function') throw 'opts.dispath() is not a function'
		this.opts = o
		this.dom = { tr: o.holder }
	}
	initPill() {
		this.pill = termsettingInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.pilldiv,
			use_bins_less: true,
			debug: this.opts.debug,
			callback: term0 => {
				// term0 is {term,q} and can be null
				if (term0) {
					term0.id = term0.term.id
				}
				this.opts.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: { term0: term0 }
				})
			}
		})
	}
	mayRegisterTerm(term) {
		if (!term || !term.term) return
		if (term.term.id == this.state.config.term.id) return
		if (this.usedTerms.find(i => i.term.id == term.term.id)) return // already had
		this.usedTerms.push({ term: term.term, q: term.q })
	}
	updatePill() {
		// after updating this.state, call pill.main() to update info in pill
		const plot = this.state.config
		const a = {
			disable_terms: [plot.term.id]
		}
		if (plot.term0) {
			a.term = plot.term0.term
			a.q = plot.term0.q
			a.disable_terms.push(plot.term0.id)
		}
		if (plot.term2) a.disable_terms.push(plot.term2.id)
		if (!this.pill) this.initPill()
		this.pill.main(a)
	}
}

exports.divideInit = rx.getInitFxn(Divide)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.tr
			.append('td')
			.text('Divide by')
			.attr('class', 'sja-termdb-config-row-label')
		const td = self.dom.tr.append('td')
		self.dom.menuBtn = td
			.append('div')
			.attr('class', 'sja_clbtext2')
			.on('click', self.showMenu)
		self.dom.pilldiv = td.append('div')
		self.dom.tip = new Menu({ padding: '0px' })
	}
	self.updateUI = function() {
		const plot = this.state.config
		if (plot.settings.currViews.includes('table') || plot.settings.currViews.includes('boxplot')) {
			self.dom.tr.style('display', 'none')
			return
		}
		self.dom.tr.style('display', '')
		// only show pill for (2), not at the other cases
		if (!plot.term0) {
			// (1)
			self.dom.pilldiv.style('display', 'none')
			self.dom.menuBtn.style('display', 'inline-block')
			// update pill so it knows which terms to disable
			self.updatePill()
			return self.dom.menuBtn.html('None &#9660;')
		}
		// case (2) show pill
		self.dom.menuBtn.style('display', 'none')
		self.dom.pilldiv.style('display', 'inline-block')
		self.updatePill()
	}
	self.showMenu = function() {
		self.dom.tip.clear().showunder(self.dom.menuBtn.node())
		const term0 = self.state.config.term0

		// option (1) none
		if (term0) {
			// term0 is not null, allow to change to none
			// right now this option will not be shown, as termsetting pill menu generates the cancel button to delete term0
			// will be used when additional term0 options are used
			self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text('None')
				.on('click', () => {
					self.dom.tip.hide()
					self.opts.dispatch({
						type: 'plot_edit',
						id: self.opts.id,
						config: {
							term0: null
						}
					})
				})
		}

		for (const t of self.usedTerms) {
			self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text('Term: ' + t.term.name)
				.on('click', () => {
					self.dom.tip.hide()
					self.opts.dispatch({
						type: 'plot_edit',
						id: self.opts.id,
						config: {
							term0: {
								id: t.term.id,
								term: t.term,
								q: t.q
							}
						}
					})
				})
		}
		// option (4)
		self.dom.tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Select a new term')
			.on('click', () => {
				self.dom.tip.hide()
				self.pill.showTree(self.dom.menuBtn.node())
			})
	}
}
