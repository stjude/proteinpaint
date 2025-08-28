import { StoreApi, StoreBase, type AppApi, type RxStoreInner } from '#rx'
import { root_ID } from './tree'
import { getFilterItemByTag, findParent } from '#filter'
import { isUsableTerm } from '#shared/termdb.usecase.js'

// state definition: https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit#

const defaultState = {
	header_mode: 'search_only',
	// will be ignored if there is no dataset termdb.selectCohort
	// or value will be set to match a filter node that has been tagged
	// as 'cohortfilter' in state.termfilter.filter
	activeCohort: 0,
	tree: {
		usecase: {},
		expandedTermIds: []
	},
	submenu: {
		// type: 'tvs', may add other types later
		// term: {} or undefined
	},
	search: { isVisible: true },
	selectedTerms: [],
	termfilter: {
		filter: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		}
	}
}

// one store for the whole tdb app
class TdbStore extends StoreBase implements RxStoreInner {
	static type = 'store'

	// expected RxStoreInner, some are already declared/set in StoreBase
	app: AppApi
	api: StoreApi
	type: string

	// expected class-specific props
	actions!: {
		[actionType: string]: (action: { type: string; [prop: string]: any }) => void | Promise<void>
	}

	defaultState = defaultState

	constructor(opts, api) {
		super(opts)
		this.type = 'store'
		this.app = opts.app
		this.api = api
		this.state = this.copyMerge(this.toJson(defaultState), opts.state) // opts.state
		// use for assigning unique IDs where needed
		// may be used later to simplify getting component state by type and id
		this.prevGeneratedId = 0
	}

	validateOpts(opts) {
		if (!opts.state) throw '.state{} missing'
		const s = opts.state
		if (s.vocab) {
			/*** !!! May not need to duplicate the validation steps in vocabulary.js ??? ***/
			// assume that any vocabulary with a route
			// will require genome + dslabel
			if (s.vocab.dslabel) {
				if (!s.vocab.genome) throw '.state[.vocab].genome missing'
			} else if (s.vocab.genome) {
				if (!s.vocab.dslabel) throw '.state[.vocab].dslabel missing'
			} else {
				if (!Array.isArray(s.vocab.terms)) throw 'vocab.terms must be an array of objects'
			}
		}
		return opts
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
			if (this.state.header_mode === 'with_cohortHtmlSelect') {
				console.warn(`no termdbConfig.selectCohort to use for state.header_mode = 'with_cohortHtmlSelect'`)
				this.state.header_mode = 'search_only'
			}
		}
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
	app_refresh(this: TdbStore, action) {
		// optional action.state{} may be full or partial overrides
		// to the current state
		//
		// when constructing an app, app_refresh() is called
		// without action.state as the current state at the
		// initial render is not meant to be modified yet
		//
		this.state = this.copyMerge(this.toJson(this.state), action.state ? action.state : {})
	},
	cohort_set(this: TdbStore, action) {
		this.state.activeCohort = action.activeCohort
		const cohort = this.state.termdbConfig.selectCohort.values[action.activeCohort]
		const cohortFilter = getFilterItemByTag(this.state.termfilter.filter, 'cohortFilter')
		if (!cohortFilter) throw `No item tagged with 'cohortFilter'`
		cohortFilter.tvs.values = cohort.keys.map(key => {
			return { key, label: key }
		})
	},
	tree_expand(this: TdbStore, action) {
		if (this.state.tree.expandedTermIds.includes(action.termId)) return
		this.state.tree.expandedTermIds.push(action.termId)
	},

	tree_collapse(this: TdbStore, action) {
		const i = this.state.tree.expandedTermIds.indexOf(action.termId)
		if (i == -1) return
		this.state.tree.expandedTermIds.splice(i, 1)
	},

	filter_replace(this: TdbStore, action) {
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
	},

	submenu_set(this: TdbStore, action) {
		const term = action.submenu && action.submenu.term
		if (!term) {
			this.state.submenu = {}
			this.state.tree.expandedTermIds = [root_ID]
		} else {
			const expandedTermIds = [root_ID]
			if (term.__ancestors) {
				expandedTermIds.push(...term.__ancestors)
			}

			if (isUsableTerm(term, {}, this.state.termdbConfig).has('plot')) {
				Object.assign(this.state.submenu, action.submenu)
			} else {
				expandedTermIds.push(term.id)
				delete this.state.submenu.term
			}

			this.state.tree.expandedTermIds = expandedTermIds
		}
	},

	set_term_type_group(this: TdbStore, { value }) {
		this.state.termTypeGroup = value
	}
}

// must use the await keyword when using this storeInit()
export const storeInit = StoreApi.getInitFxn(TdbStore)
