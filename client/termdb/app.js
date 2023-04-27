import { getAppInit, multiInit } from '#rx'
import { storeInit } from './store'
import { vocabInit } from './vocabulary'
import { treeInit } from './tree'
import { submenuInit } from './submenu'
import { searchInit } from './search'
import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { sayerror } from '#dom/error'
import { dofetch3 } from '#common/dofetch'
import { isUsableTerm } from '#shared/termdb.usecase'

/*
opts{}
.state{}
	required, will fill-in or override store.defaultState
.app{} .tree{} etc
see doc for full spec
https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit
git branch 
*/

class TdbApp {
	constructor(opts) {
		this.type = 'app'
		if (!opts.holder) select('body').append('div')

		// do this in the constructor to have an dom.errdiv
		// available at any point during initialization
		const submitDiv = opts.holder
			.append('div')
			.style('display', opts.tree?.submit_lst ? '' : 'none')
			.style('text-align', 'center')
			.style('margin', '10px 5px')

		const submitBtn = submitDiv
			.append('button')
			.property('disabled', true)
			.text(this.noSelectionPrompt)
			.on('click', () => this.opts.tree?.submit_lst(this.state.selectedTerms))

		const topbar = opts.holder.append('div')
		this.dom = {
			holder: opts.holder,
			treeDiv: opts.holder.append('div'),
			customTermDiv: opts.holder.append('div').style('margin', '10px'),
			submitDiv,
			submitBtn,
			topbar,
			searchDiv: topbar.append('div').style('display', 'inline-block'),
			filterDiv: topbar.append('div').style('display', 'none'),
			errdiv: opts.holder.append('div'),
			tip: new Menu({ padding: '5px' })
		}
	}

	validateOpts(o) {
		if (o.vocabApi) {
			// verify it is an object returned by vocabInit()
		} else if (o.state && o.state.vocab) {
			if (typeof o.state.vocab != 'object') throw 'opts.state.vocab{} is not an object'
		} else if (o.state && o.state.genome) {
			const s = o.state
			if (!s.vocab) s.vocab = {}
			s.vocab.genome = s.genome
			delete s.genome
			if (s.dslabel) {
				s.vocab.dslabel = s.dslabel
				delete s.dslabel
			}
		} else {
			throw 'neither state.vocab{} or opts.vocabApi provided'
		}
		if (o.tree) {
			if (
				o.tree.disable_terms &&
				!o.tree.click_term &&
				!o.tree.click_term2select_tvs &&
				(!o.barchart || !o.barchart.bar_click_override)
			) {
				throw `opts.tree.disable_terms is used only when opts.tree.click_term, opts.tree.click_term2select_tvs, or opts.barchart.bar_click_override is set`
			}

			// opts.search{} is required, possibly in search.js
			if (!o.search) o.search = {}

			if (o.tree.click_term2select_tvs) {
				// create the callback on o.search{} so search.js code does not break
				// FIXME dispatch('submenu_set') is coded twice (also in tree.js)
				o.search.click_term = term =>
					this.api.dispatch({
						type: 'submenu_set',
						submenu: { term, type: 'tvs' }
					})
			}

			if (o.tree.click_term) {
				// no need to create extra on

				o.tree.click_term_wrapper = async term => {
					// this function wraps user-defined click_term, to encapsulate some logic

					if (this.state.termdbConfig.termMatch2geneSet) {
						/*
						the dataset is special-purpose that will map terms to gene sets (e.g. msigdb)
						do this hardcoded behavior that upon clicking a term, it fetches the list of genes for this term
						and attaches to the term object as an ad-hoc attribute
						the same behaviors are maintained in that the click_term() callback gets the term obj as well as the genes
						*/
						const geneset = await dofetch3('termdb', {
							body: {
								genome: this.state.vocab.genome,
								dslabel: this.state.vocab.dslabel,
								genesetByTermId: term.id
							}
						})
						term._geneset = geneset
					}

					// call the click callback
					o.tree.click_term(term)
				}
			}

			if (o.tree.disable_terms) o.search.disable_terms = o.tree.disable_terms
		}
		return o
	}

	async preApiFreeze(api) {
		try {
			if (this.opts.vocabApi) {
				api.vocabApi = this.opts.vocabApi
			} else {
				const state = {
					vocab: this.opts.state.vocab || {
						genome: this.opts.state.genome,
						dslabel: this.opts.state.dslabel
					}
				}
				api.vocabApi = await vocabInit({ app: this.api, state, fetchOpts: this.opts.fetchOpts })
			}
			api.appInit = appInit
		} catch (e) {
			console.log(e)
			throw e
		}
	}

	async init() {
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			await this.setComponents()
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
		}
	}

	async setComponents() {
		try {
			const header_mode = this.state.nav?.header_mode
			const compPromises = {
				/*
			 	TODO: may need to handle a cohort filter option as an OPTIONAL component 
			  filter: filterInit({
					app: this.api,
					holder: this.dom.filterDiv
			  }),
				***/
				search: searchInit({
					app: this.api,
					holder: this.dom.searchDiv,
					isVisible: header_mode !== 'hide_search'
				}),
				tree: treeInit({
					app: this.api,
					holder: this.dom.treeDiv,
					expandAll: header_mode == 'hide_search'
				})
			}
			if (this.opts.tree && this.opts.tree.click_term2select_tvs) {
				compPromises.submenu = submenuInit({
					app: this.api,
					holder: this.dom.holder.append('div').style('display', 'none')
				})
			}

			this.components = await multiInit(compPromises)
		} catch (e) {
			throw e
		}
	}

	async main() {
		this.api.vocabApi.main()
		const n = this.state.selectedTerms.length
		this.dom.submitBtn
			.property('disabled', !n)
			.text(!n ? 'Search or click term(s)' : `Submit ${n} term${n > 1 ? 's' : ''}`)

		await this.mayShowCustomTerms()
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}

	async mayShowCustomTerms() {
		// only run once, upon initiating this tree ui
		const tws = await this.api.vocabApi.getCustomTerms()

		if (!Array.isArray(tws) || tws.length == 0) return this.dom.customTermDiv.style('display', 'none')

		// filter for display terms with usecase
		const useTerms = []
		for (const tw of tws) {
			const uses = isUsableTerm(tw.term, this.state.tree.usecase)
			if (uses.has('plot')) useTerms.push(tw)
		}
		if (useTerms.length == 0) return this.dom.customTermDiv.style('display', 'none')

		// has usable terms to display
		this.dom.customTermDiv.selectAll('*').remove()
		this.dom.customTermDiv
			.append('div')
			.text('CUSTOM VARIABLES')
			.style('font-size', '.7em')
		for (const tw of useTerms) {
			this.dom.customTermDiv
				.append('div')
				.style('margin-bottom', '3px')
				.append('div')
				.text(tw.term.name)
				.attr('class', 'sja_filter_tag_btn')
				.style('padding', '3px 6px')
				.style('border-radius', '6px')
				.on('click', () => {
					if (!this.opts.tree) return // click callbacks are all under tree{}
					if (this.opts.tree.click_term) {
						this.opts.tree.click_term(tw)
						return
					}
					if (this.opts.tree.click_term2select_tvs) {
						this.api.dispatch({
							type: 'submenu_set',
							submenu: { term: tw.term, type: 'tvs' }
						})
						return
					}
				})
		}
	}
}

// must use the await keyword when using this appInit()
export const appInit = getAppInit(TdbApp)

function setInteractivity(self) {
	// set optional event handlers
}
