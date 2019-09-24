import * as rx from "../rx.core"

const defaultState = {
	genome: "hg38",
	dslabel: "SJLife",
	tree: {
		currTerm: 'root',
		expandedTerms: [],
		plottedTerms: {},
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
		const plot = {id: action.id, config: action.config}
		this.state.tree.plottedTerms[action.id] = plot
	},

	plot_show(action) {
		const plot = this.state.tree.plottedTerms[action.id]
		plot.isVisible = true
	},

	plot_hide(action) {
		const plot = this.state.tree.plotttedTerms[action.id]
		if (plot) plot.isVisible = false
	}
}

exports.storeInit = rx.getInitFxn(TdbStore)
