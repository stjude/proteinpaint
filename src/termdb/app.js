import * as rx from '../rx/core'
import { select } from 'd3-selection'
import { treeInit } from './tree'
import { storeInit } from './store'
import { filterInit } from './filter'
import { recoverInit } from '../rx/recover'
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
component specific callbacks and customizations


******************* modifiers

a set of predefined keys, each pointing to a callback so as to supply user selected term or tvs to that callback
will also alter the appearance and behavior of UIs, so components need to access this

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

Compared to previous version:
ssid is no longer a modifier, but as a customization attribute for barchart

*/

class TdbApp {
	constructor(parentApp, opts) {
		this.type = 'app'
		this.opts = this.initOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = parentApp ? rx.getComponentApi(this) : rx.getAppApi(this)
		this.app = parentApp ? parentApp : this.api

		this.dom = {
			holder: opts.holder.style('margin', '10px'),
			topbar: opts.holder
				.append('div')
				.style('position', 'sticky')
				.style('top', '12px')
				.style('right', '20px')
				.style('margin', '5px')
				.style('text-align', 'right'),

			errdiv: opts.holder.append('div')
		}

		// catch initialization error
		try {
			if (!parentApp) this.store = storeInit(this.api)
			const modifiers = this.validateModifiers(this.opts.modifiers)
			this.components = {}
			if (modifiers.click_term || modifiers.tvs_select) {
				// has modifier
			} else {
				// no modifier, show these components
				const recoverOpts = { holder: this.dom.holder, appType: 'termdb' }
				if (this.opts.recover) rx.copyMerge(recoverOpts, this.opts.recover)
				this.components.recover = recoverInit(this.app, recoverOpts)

				const filterOpts = { holder: this.dom.holder.append('div') }
				if (this.opts.filter) rx.copyMerge(filterOpts, this.opts.filter)
				this.components.terms = filterInit(this.app, filterOpts)
			}
			const treeOpts = { holder: this.dom.holder.append('div'), modifiers }
			if (this.app.opts.tree) Object.assign(treeOpts, this.app.opts.tree)
			this.components.tree = treeInit(this.app, treeOpts)
		} catch (e) {
			this.printError(e)
		}

		this.eventTypes = ['postInit', 'postRender']

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
	async main() { //console.log(this.state.tree.expandedTermIds)
		// may add other logic here or return data as needed,
		// for example request and cache metadata that maybe throughout
		// the app by many components; the metadata may be exposed
		// later via something like app.api.lookup, to-do
		// if (this.projectName) this.saveState()
	}*/

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
	recover: {
		get(appState) {
			return appState
		}
	},
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
				termfilter: appState.termfilter,
				bar_click_menu: appState.bar_click_menu
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
	tvs: {
		// no need to duplicate in here the parent
		// component's subState.filter.reactsTo{} filter
		get(appState, sub) {
			return {
				genome: appState.genome,
				dslabel: appState.dslabel,
				termfilter: appState.termfilter
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
	},
	plot: {
		reactsTo: {
			prefix: ['filter'],
			type: ['plot_show', 'plot_edit', 'app_refresh'],
			fxn: (action, sub) => {
				if (!action.type.startsWith('plot')) return true
				if (!('id' in action) || action.id == sub.id) return true
			}
		},
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found.`
			}
			const config = appState.tree.plots[sub.id]
			return {
				genome: appState.genome,
				dslabel: appState.dslabel,
				termfilter: appState.termfilter,
				config
			}
		}
	},
	barchart: {
		// no need to duplicate in here the parent
		// component's subState.plot.reactsTo{} filter
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			}
			const config = appState.tree.plots[sub.id]
			return {
				isVisible: config.settings.currViews.includes('barchart'),
				config: {
					term: config.term,
					term0: config.term0,
					term2: config.term2,
					settings: {
						common: config.settings.common,
						barchart: config.settings.barchart
					}
				}
			}
		}
	},
	table: {
		// no need to duplicate in here the parent
		// component's subState.plot.reactsTo{} filter
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			}
			const config = appState.tree.plots[sub.id]
			return {
				isVisible: config.settings.currViews.includes('table'),
				config: {
					term: config.term,
					term2: config.term2,
					settings: {
						common: config.settings.common,
						table: config.settings.table
					}
				}
			}
		}
	},
	boxplot: {
		// no need to duplicate in here the parent
		// component's subState.plot.reactsTo{} filter
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			}
			const config = appState.tree.plots[sub.id]
			return {
				isVisible: config.settings.currViews.includes('boxplot'),
				config: {
					term: config.term,
					term2: config.term2,
					settings: {
						common: config.settings.common,
						boxplot: config.settings.boxplot
					}
				}
			}
		}
	},
	scatter: {
		// no need to duplicate in here the parent
		// component's subState.plot.reactsTo{} filter
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			}
			const config = appState.tree.plots[sub.id]
			return {
				isVisible: config.settings.currViews.includes('scatter'),
				config: {
					term: config.term,
					term0: config.term0,
					term2: config.term2,
					settings: {
						common: config.settings.common,
						scatter: config.settings.scatter
					}
				}
			}
		}
	},
	termsetting: {
		// no need to duplicate in here the parent
		// component's subState.plot.reactsTo{} filter
		get(appState, sub) {
			if (!(sub.id in appState.tree.plots)) {
				throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			}
			const config = appState.tree.plots[sub.id]
			return {
				config: {
					term: config.term,
					term0: config.term0,
					term2: config.term2
				}
			}
		}
	}
}

exports.appInit = rx.getInitFxn(TdbApp)
