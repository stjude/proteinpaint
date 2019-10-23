import * as rx from '../rx.core'
import { root_ID } from './tree'
import { plotConfig } from './plot'
import { dofetch2 } from '../client'

const defaultState = {
	// genome: "", // must be supplied
	// dslabel: "", // must be supplied
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
	app_refresh(action = {}) {
		// optional action.state{} may be full or partial overrides
		// to the current state
		//
		// when constructing an app, app_refresh() is called
		// without action.state as the current state at the
		// initial render is not meant to be modified yet
		//
		this.copyMerge(this.state, action.state ? action.state : {})
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

	plot_rehydrate(action) {
		const config = action.id in this.state.tree.plots[action.id] ? this.state.tree.plots[action.id] : {}
		this.state.tree.plots[action.id] = rx.copyMerge(config, plotConfig(action.config))
	},

	plot_add(action) {
		const config = action.config ? action.config : {}
		this.state.tree.plots[action.id] = config
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
		// if (this.state.termfilter.terms.includes(action.term)) return
		// this.state.termfilter.terms.push(action.term)
		const filter = this.state.termfilter.terms.find(d=>d.id == action.termId)
        if (filter) {
			const valueData = filter.term.iscategorical || filter.term.iscondition
			? filter.values
			: filter.term.isfloat || filter.term.isinteger
			? filter.ranges
			: filter.grade_and_child
			// may need to add check if value is already present
			if(!valueData.includes(action.value))
            valueData.push(action.value)
        } else {
            this.state.termfilter.terms.push(action.term)
        }
	},

	filter_grade_update(action) {
		const t = this.state.termfilter.terms.find(d=>d.id == action.termId)
		if (!t) return
		t.bar_by_grade = action.updated_term.bar_by_grade
		t.bar_by_children = action.updated_term.bar_by_children
		t.value_by_max_grade = action.updated_term.value_by_max_grade
		t.value_by_most_recent = action.updated_term.value_by_most_recent
		t.value_by_computable_grade = action.updated_term.value_by_computable_grade
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
		term.term.iscategorical ? term.values.push(action.value) : term.ranges.push(action.value)
	},

	filter_value_change(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		term.term.iscategorical || term.term.iscondition 
			? (term.values[action.valueId] = action.value) 
			: (term.ranges[action.valueId] = action.value)
	},

	filter_value_remove(action) {
		const i = this.state.termfilter.terms.findIndex(d => d.id == action.termId)
		if (i == -1) return
		const term = this.state.termfilter.terms[i]
		const values = term.term.iscategorical || term.term.iscondition 
			? term.values : term.ranges
		values.splice(action.valueId, 1)
		if (values.length == 0) {
			this.state.termfilter.terms.splice(i, 1)
		}
	}, 

	filter_replace(action) {
		this.state.termfilter.terms = []
		this.state.termfilter.terms.push(action.term)

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
