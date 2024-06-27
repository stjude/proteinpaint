import { getCompInit } from '../rx'
import { termsettingInit } from '#termsetting'
import { getNormalRoot } from '#filter'
import { TermTypes } from '#shared/terms'

/*
for configuring term1; wraps termsetting

execution flow:

1. constructor builds and returns this.api{} via getInitFxn
2. no state available for constructor so cannot do term-type specific things in constructor
3. upon notified by plot.controls.config.js and api.main() is called, this.state is ready
4. then call this.render() to:
4.1 if plot.term cannot be configured, quit
4.2 initiate this.pill if missing
4.3 call this.pill.main() to send {term,q} to pill

*/

class Term1ui {
	constructor(opts) {
		this.type = 'term1Input'
		this.dom = { tr: opts.holder }
		setRenderers(this)
		this.initUI()
	}
	validateOpts(o) {
		if (!('id' in o)) throw 'opts.id missing'
		if (!o.holder) throw 'opts.holder missing'
	}
	getState(appState) {
		const plot = appState.plots.find(p => p.id === this.id)
		if (!plot) {
			throw `No plot with id='${this.id}' found.`
		}
		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			plot
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}
	async main() {
		this.dom.tr.style('display', 'table-row')
		await this.render()
	}
	setPill() {
		// can only call after getting this.state
		this.pill = termsettingInit({
			vocabApi: this.app.vocabApi,
			vocab: this.state.vocab,
			usecase: this.opts.usecase,
			activeCohort: this.state.activeCohort,
			holder: this.dom.td2.append('div').style('display', 'inline-block'),
			debug: this.opts.debug,

			// temp change to enable toggling between continuous/discrete for numeric term1
			numericEditMenuVersion: ['continuous', 'discrete'],

			callback: data => {
				// data is object with only one needed attribute: q, never is null
				if (!data.q) throw 'data.q{} missing from pill callback'
				this.app.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: {
						term: {
							/* though the purpose is only to update plot.term.q,
							must specifiy plot.term as {id, term, q}
							but not just {q}
							which copyMerge( plot, {term:{q:{...}}}, ['term']) won't allow to work
							will replace plot.term with {q}
							*/
							isAtomic: true,
							term: JSON.parse(JSON.stringify(this.state.plot.term.term)),
							q: data.q
						}
					}
				})
			}
		})
	}
}

export const term1uiInit = getCompInit(Term1ui)

function setRenderers(self) {
	self.initUI = function () {
		// label to be updated later after getting plot state via api.main()
		// <td> left
		self.dom.td1 = self.dom.tr.append('td').attr('class', 'sja-termdb-config-row-label')
		// <td> right
		self.dom.td2 = self.dom.tr.append('td')
	}
	self.render = async function () {
		/* state and plot are frozen from app.state
		 */
		const plot = this.state.plot
		if (!plot.term) throw 'state.plot.term{} is missing'
		if (!plot.term.q) throw 'state.plot.term.q{} is missing'

		if (plot.term.q.groupsetting && plot.term.q.groupsetting.disabled) {
			///////////////////////////////////
			//
			// the term is not configurable. as plot term1 cannot be replaced, just quit
			//
			///////////////////////////////////
			this.dom.tr.style('display', 'none')
			return
		}

		switch (plot.term.term.type) {
			case 'categorical':
				self.dom.td1.text('Group categories')
				// may replace generic "categories" with term-specifics, e.g. cancer diagnosis
				break
			case 'condition':
				self.dom.td1.text('Customize')
				break
			case 'integer':
			case 'float':
				self.dom.td1.text('Customize bins')
				break
			case 'survival':
				break
			case 'geneVariant':
				self.dom.td1.text('Group variants')
				break
			case 'samplelst':
				break
			case TermTypes.GENE_EXPRESSION:
				break
			case TermTypes.METABOLITE_INTENSITY:
				break
			case TermTypes.SINGLECELL_GENE_EXPRESSION:
				break
			case TermTypes.CELLTYPE:
				break
			default:
				throw 'unknown term type'
		}
		if (!self.pill) self.setPill()
		await self.pill.main({
			term: plot.term.term,
			q: plot.term.q,
			activeCohort: this.state.activeCohort,
			filter: this.state.filter
			// no need for disable_terms as pill won't show tree
		})
	}
}
