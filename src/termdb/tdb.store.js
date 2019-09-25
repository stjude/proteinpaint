import * as rx from '../rx.core'
import { dofetch2 } from '../client'

const defaultState = {
	genome: 'hg38',
	dslabel: 'SJLife',
	tree: {
		currTerm: 'root',
		expandedTerms: [],
		plots: {}
	}
}

// one store for the whole tdb app
class TdbStore {
	constructor(app) {
		this.api = rx.getStoreApi(this)
		this.copyMerge = rx.copyMerge
		this.deepFreeze = rx.deepFreeze
		// see rx.core comments on when not to reuse rx.fromJson, rx.toJson
		this.fromJson = rx.fromJson // used in store.api.state()
		this.toJson = rx.toJson // used in store.api.state()

		this.app = app
		this.state = this.copyMerge(this.toJson(defaultState), app.opts.state)
	}
}

/*
	To clearly indicate the allowed store actions,
	supply a literal "actions" object on the 
	constructor prototype
*/
TdbStore.prototype.actions = {
	tree2_hideterm(action) {
		this.state.tree.expandedTerms.splice(this.state.tree.expandedTerms.indexOf(action.termid), 1)
	},
	tree2_expandterm(action) {
		this.state.tree.expandedTerms.push(action.termid)
	},
	async tree_getchildterm(action) {
		const url =
			'genome=' +
			this.state.genome +
			'&dslabel=' +
			this.state.dslabel +
			'&' +
			// __isroot is hardcoded in tree.js, thinking maybe more reliable than term.id=="root"
			(action.term.__isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + action.term.id)
		const data = await dofetch2('termdb?' + url, {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!Array.isArray(data.lst) || data.lst.length == 0) throw 'no children terms for ' + action.term.id
		action.childterms = data.lst // add to action and pass back to tree.js
		if (!action.term.__isroot && !this.state.tree.expandedTerms.includes(action.term.id)) {
			// not root and not in expanded term list; add to list
			this.state.tree.expandedTerms.push(action.term.id)
		}
	},

	plot_add(action) {
		this.state.tree.plots[action.id] = action.config
	},

	plot_show(action) {
		const plot = this.state.tree.plots[action.id]
		if (plot) plot.isVisible = true
	},

	plot_hide(action) {
		const plot = this.state.tree.plots[action.id]
		if (plot) plot.isVisible = false
	}
}

/*
	methods to get coarse-grained partial state
	that is relevant to a subcomponent type, id
*/
TdbStore.prototype.getters = {
	plot(sub) {
		if (!(sub.id in this.state.tree.plots)) {
			throw `No plot with id='${sub.id}' found.`
		}
		return this.copyMerge('{}', this.state.tree.plots[sub.id])
	}
}

exports.storeInit = rx.getInitFxn(TdbStore)
