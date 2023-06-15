import { getCompInit } from '../rx'
import { termsettingInit } from '#termsetting'
import { Menu } from '../src/client'
import { getNormalRoot } from '#filter'

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
		this.type = 'divideByInput'
		this.dom = { tr: opts.holder }
		setRenderers(this)
		this.initUI()
		this.usedTerms = [] // array of {term, q}
	}
	validateOpts(o) {
		if (!('id' in o)) throw 'opts.id missing' // plot id?
		if (!o.holder) throw 'opts.holder missing'
	}
	initPill() {
		this.pill = termsettingInit({
			vocabApi: this.app.vocabApi,
			vocab: this.state.vocab,
			usecase: this.opts.usecase,
			activeCohort: this.state.activeCohort,
			holder: this.dom.pilldiv,
			use_bins_less: true,
			debug: this.opts.debug,
			menuOptions: 'all', // to show edit/replace/remove menu upon clicking pill
			defaultQ4fillTW: this.opts.defaultQ4fillTW,
			getBodyParams: this.opts.getBodyParams,
			callback: term0 => {
				// term0 is {term,q} and can be null
				if (term0) {
					term0.id = term0.term.id
				}
				this.app.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: { term0: term0 }
				})
			}
		})
	}
	getState(appState) {
		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: appState.plots.find(p => p.id === this.id)
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}
	main() {
		this.dom.tip.hide()
		this.mayRegisterTerm(this.state.config.term0)
		this.updateUI()
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
			activeCohort: this.state.activeCohort,
			filter: this.state.filter,
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

export const divideInit = getCompInit(Divide)

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
		self.dom.tr.style('display', '')

		if (plot?.term?.term?.type == 'geneVariant' || plot?.term2?.term?.type == 'geneVariant') {
			//when term1 or term2 is a geneVariant term, hide the divide by option
			self.dom.tr.style('display', 'none')
		}

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
		self.pill.showTree(self.dom.menuBtn.node())
	}
}
