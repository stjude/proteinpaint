import { getAppInit, multiInit } from '../common/rx.core'
import { storeInit } from './store'
import { vocabInit } from './vocabulary'
import { treeInit } from './tree'
import { submenuInit } from './submenu'
import { searchInit } from './search'
import { select } from 'd3-selection'
import { sayerror, Menu } from '../client'

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
		const topbar = opts.holder.append('div')
		this.dom = {
			holder: opts.holder,
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
			if (!o.search) o.search = {}
			if (o.tree.click_term) o.search.click_term = o.tree.click_term
			else if (o.tree.click_term2select_tvs) {
				o.search.click_term = term =>
					this.api.dispatch({
						type: 'submenu_set',
						submenu: { term, type: 'tvs' }
					})
			}

			if (o.tree.disable_terms) o.search.disable_terms = o.tree.disable_terms
		}
		return o
	}

	async preApiFreeze(api) {
		api.vocabApi = this.opts.vocabApi
			? this.opts.vocabApi
			: await vocabInit({ app: this.api, state: this.opts.state, fetchOpts: this.opts.fetchOpts })
		api.tip = this.dom.tip
		api.appInit = appInit
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
					holder: this.dom.searchDiv
				}),
				tree: treeInit({
					app: this.api,
					holder: this.dom.holder.append('div').style('display', 'block')
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
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

// must use the await keyword when using this appInit()
export const appInit = getAppInit(TdbApp)

function setInteractivity(self) {
	// set optional event handlers
}
