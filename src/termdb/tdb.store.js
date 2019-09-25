import * as rx from "../rx.core"

const defaultState = {
	genome: "hg38",
	dslabel: "SJLife",
	tree: {
		currTerm: 'root',
		expandedTerms: [],
		plots: {},
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
	tree_expand(action) {
		if (this.state.tree.expandedTerms.includes(action.termId)) return
		this.state.tree.expandedTerms.push(action.termId)
	},

	tree_collapse(action) {
		const i = this.state.tree.expandedTerms.indexOf(action.termId)
		if (i == -1) return
		this.state.tree.expandedTerms.splice(i, 1)
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
