import { getCompInit } from '../rx'
import { termsettingInit } from '#termsetting'
import { Menu } from '#dom/menu'
import { getNormalRoot } from '#filter'
import { TermTypes, isDictionaryType } from '#shared/terms'

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
		this.type = 'overlayInput'
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
		if (!this.opts.defaultQ4fillTW) this.opts.defaultQ4fillTW = {}
		this.opts.defaultQ4fillTW[TermTypes.GENE_VARIANT] = { type: 'predefined-groupset' }
		this.opts.defaultQ4fillTW[TermTypes.GENE_EXPRESSION] = { mode: 'discrete' }
		this.opts.defaultQ4fillTW[TermTypes.METABOLITE_INTENSITY] = { mode: 'discrete' }

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

			// overlay term can be continous for bar/violin; but not for cuminc plot, thus the option
			numericEditMenuVersion: this.opts.numericEditMenuVersion || ['continuous', 'discrete'],

			// edit menu of geneVariant term should only display
			// groupsetting options
			geneVariantEditMenuOnlyGrp: true,

			callback: term2 => {
				// term2 is {term,q} and can be null
				this.app.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: { term2 },
					usecase: this.opts.usecase
				})
			}
		})
	}
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found.`
		}
		const state = {
			allowedTermTypes: appState.termdbConfig.allowedTermTypes,
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			config,
			ssid: appState.ssid
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}
	main() {
		this.dom.tip.hide()
		this.mayRegisterTerm(this.state.config.term2)
		this.dom.tr.style('display', 'table-row')
		this.updateUI()
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
			activeCohort: this.state.activeCohort,
			filter: this.state.filter,
			disable_terms: [plot.term]
		}
		{
			// if cohort selection is enabled
			const s = this.app.getState()
			if (s.activeCohort != undefined) {
				a.activeCohort = s.activeCohort
			}
		}

		if (plot.term2) {
			const isDictTerm = isDictionaryType(plot.term2.term.type)
			// assume that dictionary tw are complete after fillTermWrapper(),
			// whereas non-dictionary terms may require additional term/q properties
			// to be added when the pill edit UI is opened, so term/q must not be frozen
			a.term = isDictTerm ? plot.term2.term : structuredClone(plot.term2.term)
			a.q = isDictTerm ? plot.term2.q : structuredClone(plot.term2.q || {})
			a.disable_terms.push(plot.term2)
		}
		if (plot.term0) a.disable_terms.push(plot.term0)
		if (!this.pill) this.initPill()
		this.pill.main(a)
	}
}

export const overlayInit = getCompInit(Overlay)

function setRenderers(self) {
	self.initUI = function () {
		self.dom.tr.append('td').text('Overlay').attr('class', 'sja-termdb-config-row-label')
		const td = self.dom.tr.append('td')
		self.dom.menuBtn = td.append('div').attr('class', 'sja_clbtext2').on('click', self.showMenu)
		self.dom.pilldiv = td.append('div')
		self.dom.tip = new Menu({ padding: '0px' })
	}
	self.updateUI = function () {
		if (this.state.ssid) {
			/*
			quick fix --
			state has ssid, only display variant name at handle and not operable
			there lacks a way to manage the multiple overlaying choices
			wait for next version of termdb-chart
			*/
			self.dom.menuBtn.style('display', 'none')
			self.dom.pilldiv.style('display', 'inline-block')
			self.dom.pilldiv.text(this.state.ssid.mutation_name)
			return
		}
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
					'Max grade <span style="font-size:.7em;text-transform:uppercase;opacity:.6">' +
						plot.term.term.name +
						'</span> &#9660;'
				)
			}
			if (plot.term2.q.bar_by_children) {
				// (4)
				return self.dom.menuBtn.html(
					'Sub-conditions <span style="font-size:.7em;text-transform:uppercase;opacity:.6">' +
						plot.term.term.name +
						'</span> &#9660;'
				)
			}
			return self.dom.menuBtn.html('ERROR: unknown type of overlay &#9660;')
		}
		// case (2) show pill
		self.dom.menuBtn.style('display', 'none')
		self.dom.pilldiv.style('display', 'inline-block')
		self.updatePill()
	}
	self.showMenu = function () {
		self.pill.showTree(self.dom.menuBtn.node())
	}
}
