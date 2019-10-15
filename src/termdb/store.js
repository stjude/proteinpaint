import * as rx from '../rx.core'
import { root_ID } from './tree'

const defaultState = {
	tree: {
		expandedTerms: [],
		plots: {}
	},
	termfilter: {
		terms: []
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
		if (!app.opts.state) throw '.state{} missing'
		this.state = this.copyMerge(this.toJson(defaultState), app.opts.state)
		this.validateOpts()
	}

	validateOpts() {
		const s = this.state
		if (!s.genome) throw '.state.genome missing'
		if (!s.dslabel) throw '.state.dslabel missing'
		if (s.tree.expandedTerms.length == 0) {
			s.tree.expandedTerms.push(root_ID)
		} else {
			if (s.tree.expandedTerms[0] != root_ID) {
				s.tree.expandedTerms.unshift(root_ID)
			}
		}
	}
}

/*
	To clearly indicate the allowed store actions,
	supply a literal "actions" object on the 
	constructor prototype
*/
TdbStore.prototype.actions = {
	tree_update(action) {
		// note: attributes of this action will be modified
		if (action.expandedTerms) {
			// copy expandedTerms array since original is frozen/not mutable
			this.state.tree.expandedTerms = action.expandedTerms.slice()
		}
		if (action.onlyPlotTermID) {
			// to only show plot of one term, and hide all the other previously open plots
			// turn all existing plots to invisible
			for (const id in this.state.tree.plots) {
				this.state.tree.plots[id].isVisible = false
			}
			const p = this.state.tree.plots[action.onlyPlotTermID]
			if (p) {
				p.isVisible = true
			} else {
				action.plotTermIds = [action.onlyPlotTermID]
			}
		}
		// only show plot of a given id
	},
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
	},

	plot_edit(action) {
		const plot = this.state.tree.plots[action.id]
		if (plot) this.copyMerge(plot, action.config)
	},

	filter_add(action) {
		if (this.state.termfilter.terms.includes(action.term)) return
		this.state.termfilter.terms.push(action.term)
	},

	filter_remove(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		this.state.termfilter.terms.splice(i, 1)
	},

	filter_negate(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		term.isnot = term.isnot ? false : true
	},

	filter_value_add(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		term.term.iscategorical ? term.values.push(action.value) : term.ranges.push(action.value.range)
	},

	filter_value_change(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		term.values[action.valueId] = action.value
	},

	filter_value_remove(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		term.values.splice(action.valueId, 1)
		if (term.values.length == 0) {
			this.state.termfilter.terms.splice(i, 1)
		}
	}
}

/*
	methods to get coarse-grained partial state
	that is relevant to a subcomponent type, id
*/
TdbStore.prototype.getters = {
	plot(sub) {
		if (!(sub.id in this.state.tree.plots)) {
			return //throw `No plot with id='${sub.id}' found.`
		}
		return this.copyMerge('{}', this.state.tree.plots[sub.id])
	}
}

exports.storeInit = rx.getInitFxn(TdbStore)
