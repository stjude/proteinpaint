import { AppApi, multiInit, type RxApp, type ComponentApi } from '#rx'
import { AppBase } from '#plots/AppBase.ts'
import { storeInit } from './store'
import { vocabInit } from './vocabulary'
import { treeInit } from './tree'
import { TermTypeSearchInit } from './TermTypeSearch'
import { submenuInit } from './submenu'
import { searchInit } from './search'
import { select } from 'd3-selection'
import { Menu, sayerror } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { mayRenderFractionSelection } from './handlers/termCollectionFractionSelection.ts'

/*
opts{}
	state{}
		required, will fill-in or override store.defaultState
	app{}
	tree{}
		disable_terms[]
		click_term2select_tvs()
		click_term()
		backToSelectionText:str
		minTermsToSubmit:int
			used with submit_lst; submit button stays disabled until this many terms are selected (default 1)
	search{}
	vocabApi
	getCategoriesArguments{}
*/

class TdbApp extends AppBase implements RxApp {
	static type = 'app'
	// expected RxApp, some are already declared/set in AppBase
	api: AppApi
	type = 'app'
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	wasDestroyed = false
	store: any
	bus!: any

	// expected class-specific props

	constructor(opts, api) {
		super(opts)
		this.opts = this.validateOpts(this.opts)
		this.api = api
		this.dom = this.getDom(this.opts)
	}

	// override AppBase.validateOpts()
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

					if (this.state.termdbConfig.isGeneSetTermdb) {
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

					// a numeric term collection, such as an adhoc splice junction event listed under
					// "Custom Variables", must be reduced to a scalar fraction for certain use cases;
					// prompt for the numerator/denominator before calling back with a fraction tw
					if (this.mayShowFractionSelection(term, o.tree)) return

					// call the click callback
					o.tree.click_term(term)
				}
			}

			if (o.tree.disable_terms) o.search.disable_terms = o.tree.disable_terms
		}
		if (o.app) {
			for (const [k, v] of Object.entries(o.app)) {
				o[k] = v
			}
			delete o.app
		}
		return o
	}

	getDom(opts) {
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
			.on('click', () =>
				// state is frozen, must submit non-frozen copies
				this.opts.tree?.submit_lst(this.state.selectedTerms.map(t => structuredClone(t)))
			)

		const topbar = opts.holder.append('div')
		const termTypeSearchDiv = topbar.append('div').style('display', 'inline-block')
		const treeDiv = topbar.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		// shown in place of the tree, when a selected term requires additional configuration
		const fractionDiv = opts.holder.append('div').style('display', 'none')

		return {
			topbar,
			fractionDiv,
			holder: opts.holder,
			termTypeSearchDiv,
			searchDiv: treeDiv.append('div'),
			treeDiv: treeDiv.append('div'),
			customTermDiv: treeDiv.append('div').style('margin', '10px'),
			submitDiv,
			submitBtn,
			filterDiv: topbar.append('div').style('display', 'none'),
			errdiv: opts.holder.append('div'),
			tip: new Menu({ padding: '5px' })
		}
	}

	/* Render the numerator/denominator chooser for a numeric term collection that was clicked
	in the tree or dictionary search, matching what the term search handlers do for the same
	collection types. Returns true when the chooser is shown, in which case the click callback
	is deferred until the user submits a selection.

	term: the clicked term
	treeOpts: opts.tree{}, supplies termCollectionSelectionMode and the click_term() callback
	*/
	mayShowFractionSelection(term, treeOpts) {
		return mayRenderFractionSelection({
			term,
			selectionMode: treeOpts.termCollectionSelectionMode,
			// the tree is hidden, not destroyed, so that the user may back out and select another term
			listDiv: this.dom.topbar,
			fractionDiv: this.dom.fractionDiv,
			callback: tw => treeOpts.click_term(tw)
		})
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
			this.components = await this.initComponents()
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
		}
	}

	async initComponents() {
		const header_mode = this.state.nav?.header_mode
		const compPromises: { [name: string]: Promise<ComponentApi> } = {
			search: searchInit({
				app: this.api,
				holder: this.dom.searchDiv,
				isVisible: header_mode !== 'hide_search'
			}),
			termTypeSearch: TermTypeSearchInit({
				app: this.api,
				holder: this.dom.termTypeSearchDiv,
				topbar: this.dom.topbar,
				genome: this.opts.vocabApi?.app?.opts?.genome,
				click_term: this.opts.tree?.click_term,
				submit_lst: this.opts.tree?.submit_lst,
				termCollectionSelectionMode: this.opts.tree?.termCollectionSelectionMode,
				submitDiv: this.dom.submitDiv
			}),
			tree: treeInit({
				app: this.api,
				holder: this.dom.treeDiv,
				headerDiv: this.dom.headerDiv,
				expandAll: header_mode == 'hide_search'
			})
		}
		if (this.opts.tree && this.opts.tree.click_term2select_tvs) {
			compPromises.submenu = submenuInit({
				app: this.api,
				holder: this.dom.holder.append('div').style('display', 'none')
			})
		}

		return multiInit(compPromises)
	}

	async main() {
		this.api.vocabApi.main()
		const n = this.state.selectedTerms.length
		// minimum number of terms required before submit is enabled (default 1)
		const min = this.opts.tree?.minTermsToSubmit || 1
		this.dom.submitBtn
			.property('disabled', n < min)
			.text(
				!n
					? 'Search or click term(s)'
					: n < min
					? `Select at least ${min} ${min > 1 ? 'terms' : 'term'}`
					: `Submit ${n} ${n > 1 ? 'terms' : 'term'}`
			)

		this.dom.holder.selectAll('search, .termbtn, button').attr('tabindex', 0)
		this.dom.holder.selectAll('.termbtn').on('keyup', event => {
			if (event.key == 'Enter') event.target.click()
		})
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

// must use the await keyword when using this appInit()
export const appInit = AppApi.getInitFxn(TdbApp)
