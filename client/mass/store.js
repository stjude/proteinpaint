import { getStoreInit } from '../rx'
import { dofetch3 } from '../common/dofetch'
import { filterJoin, getFilterItemByTag, findItem, findParent } from '../filter/filter'

// to distinguish from IDs assigned by other code or users
const idPrefix =
	'_MASS_AUTOID_' +
	Math.random()
		.toString()
		.slice(-6)
let id = (+new Date()).toString().slice(-8)

function getId() {
	return idPrefix + '_' + id++
}

// state definition: https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit#

const defaultState = {
	nav: {
		header_mode: 'with_tabs',
		activeTab: 0
	},
	// will be ignored if there is no dataset termdb.selectCohort
	// or value will be set to match a filter node that has been tagged
	// as 'cohortfilter' in state.termfilter.filter
	activeCohort: 0,
	search: { isVisible: true },
	// default to showing a dictionary when there are no other plots to show;
	// this default plots value will be overriden completely if a
	// mass.state.plots[] is provided in the runpp argument
	plots: [
		{
			id: getId(),
			chartType: 'dictionary',
			config: {
				chartType: 'dictionary'
			}
		}
	],
	termfilter: {
		filter: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		}
	},
	reuse: {
		customTermQ: {
			byId: {},
			// non-dictionary terms do not have a term.id,
			// save by term.type + name?
			byName: {}
		}
	},
	autoSave: true
}

// one store for the whole MASS app
class TdbStore {
	constructor(opts) {
		this.type = 'store'
		this.defaultState = defaultState
		// use for assigning unique IDs where needed
		// may be used later to simplify getting component state by type and id
		this.prevGeneratedId = 0
		// when using rx.copyMerge, replace the object values
		// for these keys instead of extending them
		this.replaceKeyVals = ['term', 'term2', 'term0', 'q', 'divideBy']
	}

	validateOpts(opts) {
		const s = opts.state
		// assume that any vocabulary with a route
		// will require genome + dslabel
		if (s.vocab.dslabel) {
			if (!s.vocab.genome) throw '.state[.vocab].genome missing'
		} else {
			if (!Array.isArray(s.vocab.terms)) throw 'vocab.terms must be an array of objects'
		}
	}

	validateState() {
		// todo
	}

	async init() {
		try {
			this.state.termdbConfig = await this.app.vocabApi.getTermdbConfig()
			await this.setTermfilter()
			// vocab.state.termfilter may be used in getPlotConfig() when rehydrating terms,
			// so manually set it here
			this.app.vocabApi.main({
				termfilter: JSON.parse(JSON.stringify(this.state.termfilter))
			})

			for (const [i, savedPlot] of this.state.plots.entries()) {
				const _ = await import(`../plots/${savedPlot.chartType}.js`)
				const plot = await _.getPlotConfig(savedPlot, this.app)
				this.state.plots[i] = plot
				if (!('id' in plot)) plot.id = `_AUTOID_${id++}_${i}`
			}
		} catch (e) {
			throw e
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

	async setTermfilter() {
		let filterUiRoot = getFilterItemByTag(this.state.termfilter.filter, 'filterUiRoot')
		if (!filterUiRoot) {
			this.state.termfilter.filter.tag = 'filterUiRoot'
			filterUiRoot = this.state.termfilter.filter
		}

		await Promise.all(rehydrateFilter(this.state.termfilter.filter, this.app.vocabApi))

		if (!this.state.termdbConfig.selectCohort) {
			this.state.activeCohort = -1
			// since the cohort tab will be hidden, default to making the filter tab active
			if (this.state.activeTab === 0) this.state.activeTab = 1
			if (this.state.nav.header_mode === 'with_cohortHtmlSelect') {
				console.warn(`no termdbConfig.selectCohort to use for nav.header_mode = 'with_cohortHtmlSelect'`)
				this.state.nav.header_mode = 'search_only'
			}
		} else {
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
		}
	}
}

function rehydrateFilter(filter, vocabApi, proms = []) {
	if (filter.type == 'tvslst') {
		for (const f of filter.lst) rehydrateFilter(f, vocabApi, proms)
	} else if (filter.type == 'tvs') {
		if (!filter.tvs.term.name)
			proms.push(
				vocabApi.getterm(filter.tvs.term.id).then(term => {
					filter.tvs.term = term
				})
			)
	} else {
		throw `cannot rehydrate filter.type='${filter.type}'`
	}
	return proms
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

	async plot_prep(action) {
		const plot = {
			id: 'id' in action ? action.id : getId()
		}
		if (!action.config) throw '.config{} missing for plot_prep'
		Object.assign(plot, action.config)
		this.state.plots.push(plot)
	},

	async plot_create(action) {
		const _ = await import(`../plots/${action.config.chartType}.js`)
		const plot = await _.getPlotConfig(action.config, this.app)
		if (!('id' in action)) action.id = getId()
		plot.id = action.id
		this.state.plots.push(plot)
	},

	plot_edit(action) {
		const plot = this.state.plots.find(p => p.id === action.id)
		if (!plot) throw `missing plot id='${action.id}' in store.plot_edit()`
		this.copyMerge(plot, action.config, action.opts ? action.opts : {}, this.replaceKeyVals)
		validatePlot(plot, this.app.vocabApi)

		if ('cutoff' in action.config) {
			plot.cutoff = action.config.cutoff
		} else {
			delete plot.cutoff
		}
	},

	plot_delete(action) {
		const i = this.state.plots.findIndex(p => p.id === action.id)
		if (i !== -1) this.state.plots.splice(i, 1)
	},

	plot_nestedEdits(action) {
		const plot = this.state.plots.find(p => p.id === action.id)
		if (!plot) throw `missing plot id='${action.id}' in store.plot_edit_nested`
		for (const edit of action.edits) {
			const lastKey = edit.nestedKeys.pop()
			const obj = edit.nestedKeys.reduce((obj, key) => obj[key], plot)
			obj[lastKey] = edit.value
		}
		validatePlot(plot, this.app.vocabApi)
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
	},

	cache_termq({ termId, q }) {
		// TODO: support caching by term.name
		if (!termId) throw `missing termId for caching custom term.q`
		if (!q?.reuseId) throw `missing or empty tw.q.reuseId as cache identifier for term='${termId}'`
		const cache = this.state.reuse.customTermQ.byId
		if (!cache[termId]) cache[termId] = {}
		cache[termId][q.reuseId] = q

		// apply this change to all plots that use the same term.q cache
		for (const plot of this.state.plots) {
			if (!(plot.chartType in getTwsByChartType)) continue
			const twlst = getTwsByChartType[plot.chartType](plot)
			for (const tw of twlst) {
				if (tw?.q?.reuseId === q.reuseId) tw.q = q
			}
		}
	},

	uncache_termq({ term, q }) {
		// TODO: support uncaching by term.name
		if (!term.id) throw `missing term.id for uncaching custom term.q`
		if (!q.reuseId) throw `missing qname as uncache identifier for term.id='${term.id}'`
		const cache = this.state.reuse.customTermQ.byId[term.id]
		if (!cache) throw `missing term.q cache for term.id='${term.id}`
		if (!(q.reuseId in cache)) console.warn(`q.reuseId='${q.cacheid}' not cached for term.id='${term.id}'`)
		else {
			delete cache[q.reuseId]
			// apply this change to all plots that use the same term.q cache
			for (const plot of this.state.plots) {
				if (!(plot.chartType in getTwsByChartType)) continue
				const twlst = getTwsByChartType[plot.chartType](plot)
				for (const tw of twlst) {
					if (tw.q.reuseId === q.reuseId) {
						delete tw.q.reuseId
						delete tw.q.name
					}
				}
			}
		}
	}
}

// each chartType should have a getter function
// to return all the term wrappers in the plot config
const getNestedChartSeriesDataTws = plot => [plot.term0, plot.term, plot.term2].filter(d => !!d)
const getTwsByChartType = {
	barchart: getNestedChartSeriesDataTws,
	survival: getNestedChartSeriesDataTws,
	cuminc: getNestedChartSeriesDataTws,
	regression: plot => [plot.outcome, ...plot.independent].filter(d => !!d),
	matrix: plot =>
		plot.termgroups.reduce((arr, grp) => {
			arr.push(...grp.lst)
			return arr
		}, [])
}

// must use the await keyword when using this storeInit()
export const storeInit = getStoreInit(TdbStore)

function validatePlot(p, vocabApi) {
	/*
	only work for hydrated plot object already in the state
	not for the saved state
	*/
	if (!('id' in p)) throw 'plot error: plot.id missing'
	try {
		if (p.chartType == 'regression') {
			validateRegressionPlot(p, vocabApi)
		} else if (p.chartType == 'matrix' || p.chartType == 'dataDownload') {
			if (!p.terms) throw `plot error: missing the config.terms for '${p.chartType}'`
			if (!Array.isArray(p.terms)) `plot error: config.terms must be an array '${p.chartType}'`
			for (const tw of p.terms) {
				validatePlotTerm(tw, vocabApi)
			}
		} else {
			validateGenericPlot(p, vocabApi)
		}
	} catch (e) {
		throw e
	}
}

function validateGenericPlot(p, vocabApi) {
	if (!p.term) throw 'plot error: plot.term{} not an object'
	try {
		validatePlotTerm(p.chartType == 'regression' ? p.outcome : p.term, vocabApi)
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

function validateRegressionPlot(p, vocabApi) {
	if (!p.outcome) throw 'plot error: plot.outcome{} not an object'
	try {
		validatePlotTerm(p.chartType == 'regression' ? p.outcome : p.term, vocabApi)
	} catch (e) {
		throw 'plot.outcome error: ' + e
	}

	if (p.independent) {
		for (const item of p.independent) {
			validatePlotTerm(item, vocabApi)
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
		case 'snplst':
		case 'snplocus':
		case 'geneVariant':
			break
		default:
			if (t.term.isgenotype) {
				// don't do anything for now
				console.log('to add in type:"genotype"')
				break
			}
			throw `unknown term type='${t.term.type}'`
	}
}
