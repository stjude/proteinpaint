import * as rx from '../common/rx.core'
import { root_ID } from './tree'
import { plotConfig } from './plot'
import { dofetch2 } from '../client'
import getterm from '../common/getterm'

// state definition: https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit#

const defaultState = {
	tree: {
		expandedTermIds: [],
		visiblePlotIds: [],
		plots: {}
	},
	termfilter: {
		terms: []
	},
	autoSave: true
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
		this.getterm = getterm

		this.app = app
		if (!app.opts.state) throw '.state{} missing'
		this.state = this.copyMerge(this.toJson(defaultState), app.opts.state)
		this.validateOpts()
		// when using rx.copyMerge, replace the object values
		// for these keys instead of extending them
		this.replaceKeyVals = ['term', 'term2', 'term0', 'q']
	}

	validateOpts() {
		const s = this.state
		if (!s.genome) throw '.state.genome missing'
		if (!s.dslabel) throw '.state.dslabel missing'
		if (s.tree.expandedTermIds.length == 0) {
			s.tree.expandedTermIds.push(root_ID)
		} else {
			if (s.tree.expandedTermIds[0] != root_ID) {
				s.tree.expandedTermIds.unshift(root_ID)
			}
		}
	}

	async rehydrate() {
		const lst = ['genome=' + this.state.genome + '&dslabel=' + this.state.dslabel]
		// maybe no need to provide term filter at this query
		for (const plotId in this.state.tree.plots) {
			const savedPlot = this.state.tree.plots[plotId]
			// .term{} is required, if missing, add with plotId
			if (!savedPlot.term) savedPlot.term = {}
			if (!savedPlot.term.id) savedPlot.term.id = plotId
			// .term2 and term0 are optional, but .id is required as that's a different term than plotId
			if (savedPlot.term2 && !savedPlot.term2.id) delete savedPlot.term2
			if (savedPlot.term0 && !savedPlot.term0.id) delete savedPlot.term0
			for (const t of ['term', 'term2', 'term0']) {
				if (!savedPlot[t]) continue
				if (!savedPlot[t].q) savedPlot[t].q = {}
				savedPlot[t].term = await this.getterm(savedPlot[t].id)
			}
			this.state.tree.plots[plotId] = plotConfig(savedPlot)
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
		this.state = this.copyMerge(this.toJson(this.state), action.state ? action.state : {}, this.replaceKeyVals)
	},
	tree_expand(action) {
		if (this.state.tree.expandedTermIds.includes(action.termId)) return
		this.state.tree.expandedTermIds.push(action.termId)
	},

	tree_collapse(action) {
		const i = this.state.tree.expandedTermIds.indexOf(action.termId)
		if (i == -1) return
		this.state.tree.expandedTermIds.splice(i, 1)
	},

	plot_show(action) {
		if (!this.state.tree.plots[action.id]) {
			this.state.tree.plots[action.term.id] = plotConfig({ id: action.id, term: { term: action.term } })
		}
		if (!this.state.tree.visiblePlotIds.includes(action.id)) {
			this.state.tree.visiblePlotIds.push(action.id)
		}
	},

	plot_hide(action) {
		const i = this.state.tree.visiblePlotIds.indexOf(action.id)
		if (i != -1) {
			this.state.tree.visiblePlotIds.splice(i, 1)
		}
	},

	plot_edit(action) {
		const plot = this.state.tree.plots[action.id]
		if (plot) this.copyMerge(plot, action.config, action.opts ? action.opts : {}, this.replaceKeyVals)
	},

	filter_add(action) {
		// if (this.state.termfilter.terms.includes(action.term)) return
		// this.state.termfilter.terms.push(action.term)
		const filter = this.state.termfilter.terms.find(d => d.id == action.termId)
		if (filter) {
			const valueData =
				filter.term.iscategorical || filter.term.iscondition
					? filter.values
					: filter.term.isfloat || filter.term.isinteger
					? filter.ranges
					: filter.grade_and_child
			// may need to add check if value is already present
			if (!valueData.includes(action.value)) valueData.push(action.value)
		} else {
			this.state.termfilter.terms.push(action.term)
		}
	},

	filter_grade_update(action) {
		const t = this.state.termfilter.terms.find(d => d.id == action.termId)
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
		const values = term.term.iscategorical || term.term.iscondition ? term.values : term.ranges
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

exports.storeInit = rx.getInitFxn(TdbStore)

/******* helper functions for fill-in q{} from term{}
term-type specific logic in doing the fill
for numeric term as term2, term.bins.less (if available) will be used but not term.bins.default
*/

function numeric_fill_q(q, b) {
	/*
	situation-specific logic
	when term is term1, will call as "numeric_fill_q( q, term.bins.default )"
	when term is term2 or term0 and has .bins.less, call as "numeric_fill_q( q, term.bins.less )"

	if q is already initiated, do not overwrite
	*/
	// not sure if it can work with partially declared state
	rx.copyMerge(q, b)
}

function categorycondition_fill_q(q, term) {
	// work for both categorical and condition term
	// term.groupsetting is required
	if (!term.iscategorical && !term.iscondition) throw 'term is not categorical or condition'
	if (!q.groupsetting) q.groupsetting = {}
	if (term.groupsetting.disabled) {
		q.groupsetting.disabled = true
		return
	}
	delete q.groupsetting.disabled
	if (!('inuse' in q.groupsetting)) q.groupsetting.inuse = false // do not apply by default
	if (!q.groupsetting.inuse) {
		// inuse:false is either from automatic setup or predefined in state
		// then no need for additional setup
		return
	}
	if (term.groupsetting.lst && term.groupsetting.useIndex >= 0 && term.groupsetting.lst[term.groupsetting.useIndex]) {
		q.groupsetting.predefined_groupset_idx = term.groupsetting.useIndex
	}
	if (term.iscondition) {
		if (q.value_by_max_grade || q.value_by_most_recent || q.value_by_computable_grade) {
			// need any of the three to be set
		} else {
			// set a default one
			q.value_by_max_grade = true
		}
		if (q.bar_by_grade || q.bar_by_children) {
		} else {
			q.bar_by_grade = true
		}
	}
}
