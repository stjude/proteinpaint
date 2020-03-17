import * as rx from '../common/rx.core'
import { root_ID } from './tree'
import { plotConfig } from './plot'
import { dofetch2 } from '../client'
import { getterm } from '../common/termutils'
import { graphable } from '../common/termutils'
import { filterJoin, getFilterItemByTag, findItem, findParent } from '../common/filter'

// state definition: https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit#

const defaultState = {
	nav: {
		show_tabs: false,
		activeTab: 0
	},
	// will be ignored if there is no dataset termdb.selectCohort
	// or value will be set to match a filter node that has been tagged
	// as 'cohortfilter' in state.termfilter.filter
	activeCohort: 0,
	tree: {
		expandedTermIds: [],
		visiblePlotIds: [],
		plots: {}
	},
	termfilter: {
		filter: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		}
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
		//this.fromJson = rx.fromJson // used in store.api.state()
		this.toJson = rx.toJson // used in store.api.state()
		this.getterm = getterm
		this.prevGeneratedId = 0 // use for assigning unique IDs where needed

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
				savedPlot[t].term = await this.getterm(savedPlot[t].id)
			}
			this.state.tree.plots[plotId] = plotConfig(savedPlot)
		}

		let filterUiRoot = getFilterItemByTag(this.state.termfilter.filter, 'filterUiRoot')
		if (!filterUiRoot) {
			this.state.termfilter.filter.tag = 'filterUiRoot'
			filterUiRoot = this.state.termfilter.filter
		}

		this.state.termdbConfig = await this.getTermdbConfig()
		if (this.state.termdbConfig.selectCohort) {
			let cohortFilter = getFilterItemByTag(this.state.termfilter.filter, 'cohortFilter')
			if (!cohortFilter) {
				// support legacy state.termfilter and test scripts that
				// that does not specify a cohort when required;
				// will use state.activeCohort if not -1
				cohortFilter = {
					tag: 'cohortFilter',
					type: 'tvs',
					tvs: {
						term: JSON.parse(JSON.stringify(this.state.termdbConfig.selectCohort.term)),
						values:
							this.state.activeCohort == -1
								? []
								: this.state.termdbConfig.selectCohort.values[this.state.activeCohort].keys.map(key => {
										return { key, label: key }
								  })
					}
				}
				this.state.termfilter.filter = {
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [cohortFilter, filterUiRoot]
				}
			} else {
				const sorter = (a, b) => (a < b ? -1 : 1)
				cohortFilter.tvs.values.sort((a, b) => (a.key < b.key ? -1 : 1))
				const keysStr = JSON.stringify(cohortFilter.tvs.values.map(v => v.key).sort(sorter))
				const i = this.state.termdbConfig.selectCohort.values.findIndex(
					v => keysStr == JSON.stringify(v.keys.sort(sorter))
				)
				if (this.state.activeCohort !== -1 && this.state.activeCohort !== 0 && i !== this.state.activeCohort) {
					console.log('Warning: cohortFilter will override the state.activeCohort due to mismatch')
				}
				this.state.activeCohort = i
			}
		} else {
			this.state.activeCohort = -1
			if (this.state.activeTab === 0) this.state.activeTab = 1
		}
	}

	async getTermdbConfig() {
		const data = await dofetch2(
			'termdb?genome=' + this.state.genome + '&dslabel=' + this.state.dslabel + '&gettermdbconfig=1'
		)
		// note: in case of error such as missing dataset, supply empty object
		return data.termdbConfig || {}
	}

	fromJson(str) {
		const obj = JSON.parse(str)
		return obj
	}

	setId(item) {
		item.$id = this.prevGeneratedId++
		if (item.$lst) {
			for (const subitem of item.$lst) {
				this.setId(subitem)
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
		this.state = this.copyMerge(this.toJson(this.state), action.state ? action.state : {}, this.replaceKeyVals)
	},
	tab_set(action) {
		this.state.nav.activeTab = action.activeTab
	},
	cohort_set(action) {
		this.state.activeCohort = action.activeCohort
		const cohort = this.state.termdbConfig.selectCohort.values[action.activeCohort]
		const cohortFilter = getFilterItemByTag(this.state.termfilter.filter, 'cohortFilter')
		if (!cohortFilter) throw `No item tagged with 'cohortFilter'`
		cohortFilter.tvs.values = cohort.keys.map(key => {
			return { key, label: key }
		})
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
		if (plot) {
			this.copyMerge(plot, action.config, action.opts ? action.opts : {}, this.replaceKeyVals)
			validatePlot(plot)
		}
	},

	filter_replace(action) {
		const replacementFilter = action.filter ? action.filter : { type: 'tvslst', join: '', in: 1, lst: [] }
		if (!action.filter.tag) {
			this.state.termfilter.filter = replacementFilter
		} else {
			const filter = getFilterItemByTag(this.state.termfilter.filter, action.filter.tag)
			if (!filter) throw `cannot replace missing filter with tag '${action.filter.tag}'`
			const parent = findParent(this.state.termfilter.filter, filter.$id)
			if (parent == filter) {
				this.state.termfilter.filter = replacementFilter
			} else {
				const i = parent.lst.indexOf(filter)
				parent.lst[i] = replacementFilter
			}
		}
	}
}

exports.storeInit = rx.getInitFxn(TdbStore)

function validatePlot(p) {
	/*
	only work for hydrated plot object already in the state
	not for the saved state
	*/
	if (!p.id) throw 'plot error: plot.id missing'
	if (!p.term) throw 'plot error: plot.term{} not an object'
	try {
		validatePlotTerm(p.term)
	} catch (e) {
		throw 'plot.term error: ' + e
	}
	if (p.term2) {
		try {
			validatePlotTerm(p.term2)
		} catch (e) {
			throw 'plot.term2 error: ' + e
		}
		if (p.term.term.type == 'condition' && p.term.id == p.term2.id) {
			// term and term2 are the same CHC, potentially allows grade-subcondition overlay
			if (p.term.q.bar_by_grade && p.term2.q.bar_by_grade)
				throw 'plot error: term2 is the same CHC, but both cannot be using bar_by_grade'
			if (p.term.q.bar_by_children && p.term2.q.bar_by_children)
				throw 'plot error: term2 is the same CHC, but both cannot be using bar_by_children'
		}
	}
	if (p.term0) {
		try {
			validatePlotTerm(p.term0)
		} catch (e) {
			throw 'plot.term0 error: ' + e
		}
	}
}

function validatePlotTerm(t) {
	/*
	for p.term, p.term2, p.term0
	{ id, term, q }
	*/

	// somehow plots are missing this
	if (!t.term) throw '.term{} missing'
	if (!graphable(t.term)) throw '.term is not graphable (not a valid type)'
	if (!t.term.name) throw '.term.name missing'
	t.id = t.term.id

	if (!t.q) throw '.q{} missing'
	// term-type specific validation of q
	switch (t.term.type) {
		case 'integer':
		case 'float':
			// t.q is binning scheme, it is validated on server
			break
		case 'categorical':
			if (t.q.groupsetting && !t.q.groupsetting.disabled) {
				// groupsetting allowed on this term
				if (!t.term.values) throw '.values{} missing when groupsetting is allowed'
				// groupsetting is validated on server
			}
			// term may not have .values{} when groupsetting is disabled
			break
		case 'condition':
			if (!t.term.values) throw '.values{} missing'
			if (!t.q.bar_by_grade && !t.q.bar_by_children) throw 'neither q.bar_by_grade or q.bar_by_children is set to true'
			if (!t.q.value_by_max_grade && !t.q.value_by_most_recent && !t.q.value_by_computable_grade)
				throw 'neither q.value_by_max_grade or q.value_by_most_recent or q.value_by_computable_grade is true'
			break
		default:
			if (t.term.isgenotype) {
				// don't do anything for now
				console.log('to add in type:"genotype"')
				break
			}
			throw 'unknown term type'
	}
}
