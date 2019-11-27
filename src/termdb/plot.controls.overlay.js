import * as rx from '../common/rx.core'
import { termsettingInit } from '../common/termsetting'
import { Menu } from '../client'

/*
options for term2:
1) none
2) term (as term2, also is different from plot.term)
3) grade (plot.term2 is same as term1, CHC)
4) subcondition (same as term1)

pill is only for altering between 1 and 2.

only show pill for (2)
all other cases just text label


*/

class Overlay {
	constructor(opts) {
		this.validateOpts(opts)
		setRenderers(this)
		this.initUI()
		this.usedTerms = [] // array of {term, q}
		this.api = {
			usestate: true,
			main: state => {
				this.state = state
				this.mayRegisterTerm(state.config.term2)
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
			callback: term2 => {
				// term2 is {term,q} and can be null
				if (term2) {
					term2.id = term2.term.id
				}
				this.opts.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: {
						term2: term2
					}
				})
			}
		})
	}
	mayRegisterTerm(term) {
		if (!term || !term.term) return // no term2
		if (term.term.id == this.state.config.term.id) return // same as term1
		if (this.usedTerms.find(i => i.term.id == term.term.id)) return // already had
		this.usedTerms.push({ term: term.term, q: term.q })
	}
	updatePill() {
		// after updating this.state, call pill.main() to update info in pill
		const plot = this.state.config
		const a = {
			disable_terms: [plot.term.id]
		}
		if (plot.term2) {
			a.term = plot.term2.term
			a.q = plot.term2.q
			a.disable_terms.push(plot.term2.id)
		}
		if (plot.term0) a.disable_terms.push(plot.term0.id)
		if (!this.pill) this.initPill()
		this.pill.main(a)
	}
}

exports.overlayInit = rx.getInitFxn(Overlay)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.tr
			.append('td')
			.text('Overlay')
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
		// only show pill for (2), not at the other cases
		if (!plot.term2 || (plot.term2 && plot.term2.term.iscondition && plot.term2.id == plot.term.id)) {
			// case (1) (3) (4), just text label
			self.dom.pilldiv.style('display', 'none')
			self.dom.menuBtn.style('display', 'inline-block')
			if (!plot.term2) {
				// (1)
				// update pill so it knows which terms to disable
				self.updatePill()
				return self.dom.menuBtn.html('None &#9660;')
			}
			if (plot.term2.q.bar_by_grade) {
				// (3)
				return self.dom.menuBtn.html(
					'Max grade <span style="font-size:.7em">' + plot.term.term.name + '</span> &#9660;'
				)
			}
			if (plot.term2.q.bar_by_children) {
				// (4)
				return self.dom.menuBtn.html(
					'Sub-conditions <span style="font-size:.7em">' + plot.term.term.name + '</span> &#9660;'
				)
			}
			return self.dom.menuBtn.html('ERROR: unknown type of overlay &#9660;')
		}
		// case (2) show pill
		self.dom.menuBtn.style('display', 'none')
		self.dom.pilldiv.style('display', 'inline-block')
		self.updatePill()
	}
	self.showMenu = function() {
		self.dom.tip.clear().showunder(self.dom.menuBtn.node())
		const term2 = self.state.config.term2

		// option (1) none
		if (term2) {
			// term2 is not null, allow to change to none
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
							term2: null
						}
					})
				})
		}

		{
			const t1 = self.state.config.term
			if (t1.term.iscondition && !t1.term.isleaf) {
				/* term1 is non-leaf CHC
				meet the need for allowing grade-subcondition overlay
				no longer uses bar_choices
				*/
				if (t1.q.bar_by_grade || (term2 && term2.term.id == t1.id && term2.q.bar_by_grade)) {
					// not to show (3)
				} else {
					// show (3)
					self.dom.tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html(
							'Max grade <span style="font-size:.7em;text-transform:uppercase;opacity:.6">' + t1.term.name + '</span>'
						)
						.on('click', () => {
							self.dom.tip.hide()
							self.opts.dispatch({
								type: 'plot_edit',
								id: self.opts.id,
								config: {
									term2: {
										id: t1.id,
										term: t1.term,
										q: { bar_by_grade: true, value_by_max_grade: true }
									}
								}
							})
						})
				}
				if (t1.q.bar_by_children || (term2 && term2.term.id == t1.id && term2.q.bar_by_children)) {
					// not to show (4)
				} else {
					// show (4)
					self.dom.tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html(
							'Sub-condition <span style="font-size:.7em;text-transform:uppercase;opacity:.6">' +
								t1.term.name +
								'</span>'
						)
						.on('click', () => {
							self.dom.tip.hide()
							self.opts.dispatch({
								type: 'plot_edit',
								id: self.opts.id,
								config: {
									term2: {
										id: t1.id,
										term: t1.term,
										q: { bar_by_children: true, value_by_max_grade: true }
									}
								}
							})
						})
				}
			}
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
							term2: {
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
