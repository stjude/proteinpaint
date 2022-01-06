import { getAppInit, multiInit } from '../common/rx.core'
import { select } from 'd3-selection'
import { vocabInit } from './vocabulary'
import { treeInit } from './tree'
import { storeInit } from './store'
import { searchInit } from './search'
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
		this.type = 'termdb'
		if (!opts.holder) select('body').append('div')
		// do this in the constructor to have an dom.errdiv
		// available at any point during initialization
		const topbar = opts.holder.append('div')
		this.dom = {
			holder: opts.holder,
			topbar,
			searchDiv: topbar.append('div').style('display', 'inline-block'),
			filterDiv: topbar.append('div').style('display', 'inline-block'),
			errdiv: opts.holder.append('div'),
			tip: new Menu({ padding: '5px' })
		}
	}

	validateOpts(o) {
		if (!o.callbacks) o.callbacks = {}
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
			else if (o.tree.click_term2select_tvs) o.search.click_term = o.tree.click_term2select_tvs
			if (o.tree.disable_terms) o.search.disable_terms = o.tree.disable_terms
		}
		return o
	}

	async preApiFreeze(api) {
		api.vocabApi = await vocabInit({ app: this.api, state: this.opts.state, fetchOpts: this.opts.fetchOpts })
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
			this.components = await multiInit({
				search: searchInit({
					app: this.api,
					holder: this.dom.searchDiv
				}),
				tree: treeInit({
					app: this.api,
					holder: this.dom.holder.append('div')
				})
			})
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
	self.downloadView = id => {
		const components = app.getComponents('plots.' + opts.id)
		for (const name in self.components) {
			// the download function in each component will be called,
			// but should first check inside that function
			// whether the component view is active before reacting
			if (typeof self.components[name].download == 'function') {
				components[name].download()
			}
		}
	}

	self.showTermSrc = showTermSrc
}
