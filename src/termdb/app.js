import * as rx from '../rx/core'
import { select } from 'd3-selection'
import { treeInit } from './tree'
import { storeInit } from './store'
import { filterInit } from './filter'
import { sayerror, Menu } from '../client'

/*
opts{}
.state{}
	required, will fill-in or override store.defaultState
	https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit
.modifiers{}
	optional
	contains key-fxn() pairs
	a component will consume a specific modifier (addressed by its key) to alter its behavior
	can run the callback supplied with results to other apps (e.g. click a term in tree)
	app and components will refer to the same frozen object of "modifiers{}", in a read-only way
}


******************* modifiers
< no modifier >
tree: display all terms under a parent, just show name;
non-leaf terms will have a +/- button in the front
graphable terms will have a VIEW button at the back

< modifiers.click_term >
tree: display graphable terms as blue buttons for selecting, no VIEW button
as in selecting term2 in barchart
tree.search: display found terms as blue buttons

< modifiers.tvs_select >
at barchart, click a bar to select to a tvs

< modifiers.ssid_barchart >
TODO

*/

class TdbApp {
	constructor(parentApp, opts) {
		this.opts = this.initOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = parentApp ? rx.getComponentApi(this) : rx.getAppApi(this)
		this.app = parentApp ? parentApp : this.api

		this.dom = {
			holder: opts.holder.style('margin', '10px').style('border', '1px solid #aaa'),
			errdiv: opts.holder.append('div')
		}

		// catch initialization error
		try {
			if (!parentApp) this.store = storeInit(this.api)
			//this.state = parentApp ? this.app.getState() : this.store.copyState({rehydrate:true})
			const modifiers = this.validateModifiers(this.opts.modifiers)
			this.components = {
				tree: treeInit(this.app, { holder: this.dom.holder.append('div'), modifiers }),
				terms: filterInit(this.app, { holder: this.dom.holder.append('div') })
			}
		} catch (e) {
			this.printError(e)
		}

		this.bus = new rx.Bus('app', ['postInit', 'postRender'], opts.callbacks, this.api)
		this.bus.emit('postInit')
		if (this.store) {
			// trigger the initial render after initialization, store state is ready
			this.store
				.copyState({ rehydrate: true })
				.then(state => {
					this.state = state
				})
				.then(() => this.api.dispatch())
				.catch(e => this.printError(e))
		}
	}

	/*
	async main(state) {
		// may add other logic here or return data as needed,
		// for example request and cache metadata that maybe throughout
		// the app by many components; the metadata may be exposed
		// later via something like app.api.lookup, to-do
		return
	}
	*/

	initOpts(o) {
		if (!o.fetchOpts) o.fetchOpts = {}
		if (!o.fetchOpts.serverData) o.fetchOpts.serverData = {}
		return o
	}

	validateModifiers(tmp = {}) {
		for (const k in tmp) {
			if (typeof tmp[k] != 'function') throw 'modifier "' + k + '" not a function'
		}
		return Object.freeze(tmp)
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

/*
	subState: 
	- a collection of action filters and 
	methods grouped by component type. 

	The subStates are defined here since the "app"
	should know about the structure of the store.state
	and the expected arguments to sub-components, so that
	it can reshape the state by component type. 

	[component.type]: {}
	.reactsTo{}
		.prefix
		.type
		.match

		see rx.core getAppApi().state() on how
		these key-values are used as coarse-grained filters 
		to avoid unnecessary state recomputations or 
		component updates

	.get() 
		a method to get coarse-grained partial state
	  that is relevant to a subcomponent type, id
*/
TdbApp.prototype.subState = {
	tree: {
		passThrough: {
			type: ['plot_edit']
		},
		reactsTo: {
			prefix: ['tree', 'filter'],
			type: ['app_refresh', 'plot_show', 'plot_hide']
		},
		get(appState, sub) {
			const plots = appState.tree.plots
			return {
				genome: appState.genome,
				dslabel: appState.dslabel,
				expandedTermIds: appState.tree.expandedTermIds,
				visiblePlotIds: appState.tree.visiblePlotIds,
				termfilter: appState.termfilter
			}
		}
	},
	filter: {
		reactsTo: {
			prefix: ['filter'],
			type: ['app_refresh']
		},
		get(appState, sub) {
			return {
				genome: appState.genome,
				dslabel: appState.dslabel,
				termfilter: appState.termfilter
			}
		}
	},
	plot: {
		reactsTo: {
			prefix: ['filter'],
			type: ['plot_add', 'plot_show', 'plot_edit', 'app_refresh'],
			fxn: (action, sub) => {
				if (!action.type.startsWith('plot')) return true
				if (!('id' in action) || action.id == sub.id) return true
			}
		},
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				return //throw `No plot with id='${sub.id}' found.`
			}
			return {
				genome: appState.genome,
				dslabel: appState.dslabel,
				termfilter: appState.termfilter,
				config: appState.tree.plots[sub.id]
			}
		}
	},
	search: {
		reactsTo: {
			prefix: ['search']
		},
		get(appState, sub) {
			return {
				genome: appState.genome,
				dslabel: appState.dslabel
			}
		}
	}
}

exports.appInit = rx.getInitFxn(TdbApp)
