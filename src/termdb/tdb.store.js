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
		this.setters.plot.call(this, action)
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

/*
	methods to set the initial state for a 
	to-be-added subcomponent in an app
*/
TdbStore.prototype.setters = {
	plot(action) {
		if (action.id in this.state.tree.plots) return
		this.state.tree.plots[action.id] = {
			id: action.id,
			isVisible: true,
			term: { term: action.term, q: action.term.q ? action.term.q : {} },
			term0: action.term0 ? { term: action.term0, q: action.term0.q ? action.term0.q : {} } : null,
			term2: action.term2
				? { term: action.term2, q: action.term2.q ? action.term2.q : {} }
				//: action.obj.modifier_ssid_barchart
				//? { mname: action.obj.modifier_ssid_barchart.mutation_name }
				: null,
			//unannotated: action.unannotated ? action.unannotated : "" // not needed?
			settings: {
				currViews: ["barchart"],
				controls: {
					isVisible: false // control panel is hidden by default
				},
				common: {
					use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
					use_percentage: false,
					barheight: 300, // maximum bar length
					barwidth: 20, // bar thickness
					barspace: 2 // space between two bars
				},
				boxplot: {
					toppad: 20, // top padding
					yaxis_width: 100,
					label_fontsize: 15,
					barheight: 400, // maximum bar length
					barwidth: 25, // bar thickness
					barspace: 5 // space between two bars
				},
				bar: {
					orientation: "horizontal",
					unit: "abs",
					overlay: "none",
					divideBy: "none"
				}
			}
		}
	}
}


exports.storeInit = rx.getInitFxn(TdbStore)
