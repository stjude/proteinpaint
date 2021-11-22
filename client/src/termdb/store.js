import * as rx from '../common/rx.core'
import { root_ID } from './tree'
import { dofetch3 } from '../client'
import { filterJoin, getFilterItemByTag, findItem, findParent } from '../common/filter'

// state definition: https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit#

const defaultState = {
	nav: {
		header_mode: 'search_only',
		activeTab: 0
	},
	// will be ignored if there is no dataset termdb.selectCohort
	// or value will be set to match a filter node that has been tagged
	// as 'cohortfilter' in state.termfilter.filter
	activeCohort: 0,
	tree: {
		exclude_types: [],
		expandedTermIds: []
	},
	infos: {},
	search: { isVisible: true },
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
	constructor(opts) {
		this.type = 'store'
		this.defaultState = defaultState
		// set this.app, .opts, .api, expected store methods,
		// and the initial non-rehydrated state with overrides
		rx.prepStore(this, opts)
		// use for assigning unique IDs where needed
		// may be used later to simplify getting component state by type and id
		this.prevGeneratedId = 0
		// when using rx.copyMerge, replace the object values
		// for these keys instead of extending them
		this.replaceKeyVals = ['term', 'term2', 'term0', 'q']
	}

	validateOpts(opts) {
		if (!opts.state) throw '.state{} missing'
		const s = opts.state
		// assume that any vocabulary with a route
		// will require genome + dslabel
		if (s.vocab.route) {
			if (!s.vocab.genome) throw '.state[.vocab].genome missing'
			if (!s.vocab.dslabel) throw '.state[.vocab].dslabel missing'
		} else {
			if (!Array.isArray(s.vocab.terms)) throw 'vocab.terms must be an array of objects'
		}
	}

	validateState() {
		const s = this.state
		if (s.tree.expandedTermIds.length == 0) {
			s.tree.expandedTermIds.push(root_ID)
		} else {
			if (s.tree.expandedTermIds[0] != root_ID) {
				s.tree.expandedTermIds.unshift(root_ID)
			}
		}
	}

	async init() {
		this.state.termdbConfig = await this.app.vocabApi.getTermdbConfig()

		// maybe no need to provide term filter at this query
		let filterUiRoot = getFilterItemByTag(this.state.termfilter.filter, 'filterUiRoot')
		if (!filterUiRoot) {
			this.state.termfilter.filter.tag = 'filterUiRoot'
			filterUiRoot = this.state.termfilter.filter
		}

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
			// since the cohort tab will be hidden, default to making the filter tab active
			if (this.state.activeTab === 0) this.state.activeTab = 1
			if (this.state.nav.header_mode === 'with_cohortHtmlSelect') {
				console.warn(`no termdbConfig.selectCohort to use for nav.header_mode = 'with_cohortHtmlSelect'`)
				this.state.nav.header_mode = 'search_only'
			}
		}
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

	search_visibility_change(action) {
		this.state.search.isVisible = action.search_show
	},

	info_expand(action) {
		if (!this.state.infos[action.term.id]) {
			this.state.infos[action.term.id] = { term: action.term, isVisible: true }
		}
		this.state.infos[action.term.id].isVisible = true
	},

	info_collapse(action) {
		this.state.infos[action.term.id].isVisible = false
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

// must use the await keyword when using this storeInit()
export const storeInit = rx.getInitFxn(TdbStore)

function validatePlot(p, vocabApi) {
	/*
	only work for hydrated plot object already in the state
	not for the saved state
	*/
	if (!p.id) throw 'plot error: plot.id missing'
	if (!p.term) throw 'plot error: plot.term{} not an object'
	try {
		validatePlotTerm(p.term, vocabApi)
	} catch (e) {
		throw 'plot.term error: ' + e
	}
	if (p.term2) {
		try {
			validatePlotTerm(p.term2, vocabApi)
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
			validatePlotTerm(p.term0, vocabApi)
		} catch (e) {
			throw 'plot.term0 error: ' + e
		}
	}
}

function validatePlotTerm(t, vocabApi) {
	/*
	for p.term, p.term2, p.term0
	{ id, term, q }
	*/

	// somehow plots are missing this
	if (!t.term) throw '.term{} missing'
	if (!vocabApi.graphable(t.term)) throw '.term is not graphable (not a valid type)'
	if (!t.term.name) throw '.term.name missing'
	t.id = t.term.id

	if (!t.q) throw '.q{} missing'
	// term-type specific validation of q
	switch (t.term.type) {
		case 'integer':
		case 'float':
		case 'survival':
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
