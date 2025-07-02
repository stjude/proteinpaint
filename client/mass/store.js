import { getStoreInit } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { getFilterItemByTag, findParent } from '#filter/filter'
import { getSamplelstTW, getFilter } from './groups.js'
import { TermTypes } from '#shared/terms.js'
import { rehydrateFilter } from '../filter/rehydrateFilter.js'

/*
tmp comment on plot state. later properly define it in typescript

a basic plot:
{
	chartType: string
	... other properties
	id?: dynamically assigned to identify this plot
}

when nested, a plot has sections with each section an array of plots
{
	id?: dynamically assigned to identify this nested plot
	sections: {
		plots: {
			chartType: string
			... other properties of this child plot
			parentId?: dynamically assigned to point to plot.id
		}[]
		... other properties of a section
	}[]
}
*/

// to distinguish from IDs assigned by other code or users
const idPrefix = '_MASS_AUTOID_' + Math.random().toString().slice(-6)
let id = (+new Date()).toString().slice(-8)

function getId() {
	return idPrefix + '_' + id++
}

const navHeaderModes = new Set([
	'with_tabs', // default, shows tabs cohort/charts/filter etc
	'hidden', // no header
	'search_only', // ?
	'hide_search', // ?
	'with_cohortHtmlSelect', // only show cohort toggle as <select>
	'only_buttons'
])

const defaultState = {
	nav: {
		header_mode: 'with_tabs',
		activeTab: 0 // -1 for no active tab and all closed
	},
	// will be ignored if there is no dataset termdb.selectCohort
	// or value will be set to match a filter node that has been tagged
	// as 'cohortfilter' in state.termfilter.filter
	activeCohort: 0,
	search: { isVisible: true },
	plots: [],
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
	groups: [], // element: {name=str, filter={}}, to show in Groups tab
	customTerms: [], // element: {name=str, term={}}, able to attach more attr to object if needed
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
		// nav.header_mode should always be present
		if (!navHeaderModes.has(this.state.nav.header_mode)) throw 'invalid state.nav.header_mode'
	}

	async init() {
		try {
			this.state.termdbConfig = await this.app.vocabApi.getTermdbConfig()
			await this.setTermfilter()
			await this.rehydrateGroups()

			// vocab.state.termfilter may be used in getPlotConfig() when rehydrating terms,
			// so manually set it here
			await this.app.vocabApi.main({
				termfilter: JSON.parse(JSON.stringify(this.state.termfilter)),
				termdbConfig: this.state.termdbConfig
			})
			const invalidPlots = []
			for (const [i, savedPlot] of this.state.plots.entries()) {
				let plot
				try {
					const _ = await import(`../plots/${savedPlot.chartType}.js`)
					// this.state{} is already fully set with initial state, thus okay to pass to getPlotConfig()
					plot = await _.getPlotConfig(savedPlot, this.app, this.state.activeCohort)
				} catch (e) {
					this.app.printError(e)
					console.error(`getPlotConfig() failed: ${e}`)
				}
				if (!plot) {
					invalidPlots.push(i)
					continue
				}
				this.state.plots[i] = plot
				if (!('id' in plot)) plot.id = `_AUTOID_${id++}_${i}`
				if (plot.mayAdjustConfig) plot.mayAdjustConfig(plot)
			}
			if (invalidPlots.length) {
				for (const i of invalidPlots) {
					this.state.plots.splice(i, 1)
				}
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

	async rehydrateGroups() {
		// rehydrate filter terms of each group
		const lst = []
		for (const g of this.state.groups) {
			lst.push(...rehydrateFilter(g.filter, this.app.vocabApi))
		}
		await Promise.all(lst)
	}
}

/*
	To clearly indicate the allowed store actions,
	supply a literal "actions" object on the 
	constructor prototype
*/
TdbStore.prototype.actions = {
	async app_refresh(action = {}) {
		// optional action.state{} may be full or partial overrides
		// to the current state
		//
		// when constructing an app, app_refresh() is called
		// without action.state as the current state at the
		// initial render is not meant to be modified yet
		//
		this.state = this.copyMerge(this.toJson(this.state), action.state || {})

		// Subactions cause existing action methods to be called in parallel,
		// to update unrelated parts of the state.
		//
		// Note that an alternative approach of pre-merging actions payloads into
		// one "write" step or action is not as reliable, since that approach may leave
		// out custom logic that are required and already coded in existing actions.
		//
		const subactionPlotIds = new Set()
		const promises = []
		if (action.subactions) {
			for (const a of action.subactions) {
				promises.push(this.actions[a.type].call(this, a))
				if (a.type.startsWith('plot_')) subactionPlotIds.add(a.id)
			}
		}
		await Promise.all(promises)

		for (const plot in this.state.plots) {
			if (plot.mayAdjustConfig && !subactionPlotIds.has(plot.id)) {
				// assume that mayAdjustConfig() is not async
				plot.mayAdjustConfig(plot, action.config)
			}
		}
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

	// dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
	// example: table, scatterplot which requires user to select two terms
	async plot_prep(action) {
		const plot = {
			id: 'id' in action ? action.id : getId()
		}
		if (!action.config) throw '.config{} missing for plot_prep'
		if (action.config.chartType && Object.keys(action.config).length == 1) {
			const _ = await import(`../plots/${action.config.chartType}.js`)
			const config = await _.getPlotConfig(action.config, this.app)
			action.config = Object.assign(config, action.config)
		}
		Object.assign(plot, action.config)
		this.state.plots.push(plot)
	},

	async plot_create(action) {
		const _ = await import(`../plots/${action.config.chartType}.js`)
		const plot = await _.getPlotConfig(action.config, this.app)
		if (!('id' in action)) action.id = getId()
		plot.id = action.id
		if (plot.mayAdjustConfig) {
			plot.mayAdjustConfig(plot, action.config)
		}
		this.state.plots.push(plot)
		// Parent plots may have child plots, organized in sections to ease the visualization and analysis. For example the sjcares report,
		//has the sections Demographics, Diagnosis and Stagind with their respective plots. We go over the plots for each section to add them
		// to the state.plots array, so that they can be treated as regular plots and be embedded in a parent plot
		if (plot.sections) {
			// this is handled for embedder convenience,
			// ideally app state.plots would already have all the plot entries
			// instead of having nested plot.sections[] with plots per section in a session state to be rehydrated;
			//
			// nested plot entries are harder to manage:
			// - store methods will need to look in different places
			//   to process a dispatched plot_* action
			// - a plot's `getState()` method will also need to look in different places for the plot config, such as
			// getState(appState) {
			//   const config = appState.plots.find(p => p.id === this.id || (p.id === this.parentId && p.plots?.find(p => p.id === this.id)))
			//    ...
			// }
			for (const section of plot.sections) {
				for (const p of section.plots) {
					// by tracking a child plot's parentId, it makes it easier to
					// - find a plot's config in the app state
					// - prevent the app from rendering each child plot in it's own sandbox
					// - prevent counting child plots separately in CHARTS tab
					p.parentId = plot.id
					if (!p.id) p.id = getId() // fill in missing child plot id
					const _ = await import(`../plots/${p.chartType}.js`)
					const config = await _.getPlotConfig(p, this.app)
					// Move nested state.plot[i].plots[] into the root state.plots[] array
					this.state.plots.push(config)
				}
			}
		}
	},

	plot_edit(action) {
		const plot = this.state.plots.find(p => p.id === action.id)
		if (!plot) throw `missing plot id='${action.id}' in store.plot_edit()`
		this.copyMerge(plot, action.config, action.opts ? action.opts : {})
		if (plot.mayAdjustConfig) {
			plot.mayAdjustConfig(plot, action.config)
		}

		if (action.config && 'cutoff' in action.config) {
			plot.cutoff = action.config.cutoff
		} else {
			delete plot.cutoff
		}

		// action.parentId may be used in reactsTo() code
		if (!action.parentId && plot.parentId) action.parentId = plot.parentId
	},

	plot_delete(action) {
		const i = this.state.plots.findIndex(p => p.id === action.id)
		if (i !== -1) this.state.plots.splice(i, 1)
		// action.parentId may be used in reactsTo() code
		if (!action.parentId && plot.parentId) action.parentId = plot.parentId
	},

	plot_nestedEdits(action) {
		const plot = this.state.plots.find(p => p.id === action.id)
		if (!plot) throw `missing plot id='${action.id}' in store.plot_edit_nested`
		for (const edit of action.edits) {
			const lastKey = edit.nestedKeys.pop()
			const obj = edit.nestedKeys.reduce((obj, key) => obj[key], plot)
			obj[lastKey] = edit.value
		}
		// action.parentId may be used in reactsTo() code
		if (!action.parentId && plot.parentId) action.parentId = plot.parentId
	},

	// TODO: delete this action? does not seem to be used
	async plot_splice(action) {
		for (const a of action.subactions) {
			// need to await in case the sequence of subactions is relevant
			await this.actions[a.type].call(this, a)
		}
	},

	filter_replace(action) {
		if ('filter0' in action) {
			// quick fix since rx.copyMerge() does not work for filter0,
			// as used in app_refresh() and dispatched from GDC matrixApi.update()
			this.state.termfilter.filter0 = action.filter0
			return
		}

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
		//In the profile runproteinpaint this function is passed to clear the local filters when the global filter changes
		if (this.app.opts.app?.onFilterChange) this.app.opts.app.onFilterChange(this.state.plots)
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
	},

	add_customTerm(action) {
		this.state.customTerms.push(action.obj)
	},

	delete_customTerm({ name }) {
		const i = this.state.customTerms.findIndex(i => i.name == name)
		if (i != -1) this.state.customTerms.splice(i, 1)
	},

	add_group(action) {
		if (this.state.nav.header_mode != 'hidden') {
			const group = action.obj
			const name = `Group ${this.state.groups.length + 1}`

			const samplelstTW = getSamplelstTW([group])
			const appGroup = {
				name: name,
				filter: getFilter(samplelstTW),
				plotId: group.plotId
			}
			this.state.groups.push(appGroup)
			this.state.nav.activeTab = 1
		} else if ('plotId' in action.obj) {
			const plot = this.state.plots.find(p => p.id == action.obj.plotId)
			if (plot.groups) {
				action.obj.index = plot.groups.length
				action.obj.name = `Group ${plot.groups.length + 1}`
				plot.groups.push(action.obj)
			}
		}
	},

	rename_group(action) {
		const index = action.index
		const newName = action.newName
		if (this.state.nav.header_mode != 'hidden') {
			this.state.groups[index].name = newName
		} else {
			for (const plot of this.state.plots) {
				if (plot?.groups) {
					plot.groups[index].name = newName
				}
			}
		}
	},

	change_color_group(action) {
		const index = action.index
		const newColor = action.newColor
		if (this.state.nav.header_mode != 'hidden') {
			this.state.groups[index].color = newColor
		} else {
			for (const plot of this.state.plots) {
				if (plot?.groups) {
					plot.groups[index].color = newColor
				}
			}
		}
	},

	delete_group({ name }) {
		if (this.state.nav.header_mode != 'hidden') {
			const i = this.state.groups.findIndex(i => i.name == name)
			if (i != -1) this.state.groups.splice(i, 1)
		} else {
			for (const plot of this.state.plots) {
				if (plot?.groups) {
					const j = plot.groups.findIndex(j => j.name == name)
					if (j != -1) plot.groups.splice(j, 1)
				}
			}
		}
	}
}

// each chartType should have a getter function
// to return all the term wrappers in the plot config
const getNestedChartSeriesDataTws = plot => [plot.term0, plot.term, plot.term2].filter(d => !!d)
const getTwsByChartType = {
	summary: getNestedChartSeriesDataTws,
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
