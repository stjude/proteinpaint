import { getInitFxn, getCompInit, Bus } from '#rx'
import { Menu } from '#dom/menu'
import { vocabInit } from '#termdb/vocabulary'
import { setRenderers } from './filter.renderer'
import { setInteractivity } from './filter.interactivity'
import { findItem, findParent, getFilterItemByTag, getNormalRoot } from './filter.utils'
export * from './filter.utils'

const defaults = {
	joinWith: ['and', 'or']
}
/*
	opts{}
	.holder
	
	.callback()
		When a filter change (add, edit, remove) is made,
		the callback will receive the updated visible filter
		as argument
	
	.emptyLabel "+NEW"
		options to use a different label for the
		button or prompt to add the 
		first user-configurable filter item


	Coding convenience:
	- use $id for data binding to match  
	  existing DOM elements with the corresponding
	  data update
	- use ':scope > .cls' to limit a selection
		to immediate children -- important since the data
		at the current nesting level must not be bound to 
		non-child elements with the same classnames
*/
class Filter {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.dom = {
			holder: opts.holder,
			controlsTip: new Menu({
				padding: '0px',
				parent_menu: this.opts.holder.node() && this.opts.holder.node().closest('.sja_menu_div')
			}),
			treeTip: new Menu({
				padding: '5px',
				offsetX: 20,
				offsetY: -34,
				clearSelector: '.sja_term_src_body'
			})
		}
		this.durations = { exit: 500 }
		this.lastId = 0
		this.categoryData = {}
		this.pills = {}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		// default empty filter, in case this.api.main() is not called
		// in app-less initialization
		this.filter = {
			type: 'tvslst',
			tag: 'filterUiRoot',
			join: 'and',
			in: true,
			lst: []
		}
		this.promises = {}
	}

	validateOpts(opts) {
		const o = Object.assign({}, defaults, opts)
		if (!o.holder) throw '.holder missing'

		if (o.vocabApi) {
			this.vocabApi = o.vocabApi
		} else {
			if (!o.vocab) throw '.vocab missing'

			if (o.vocab.dslabel) {
				if (!o.vocab.genome) throw 'vocab.genome missing'
			} else {
				if (!o.vocab.terms) throw 'vocab.terms missing'
			}
		}

		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if (o.getVisibleRoot && typeof o.getVisibleRoot != 'function')
			throw '.getVisibleRoot() must be a function if set as an option'
		if (!o.emptyLabel) o.emptyLabel = '+NEW'
		// o.getCategoriesArguments is not validated and simply passed to tree UI then tvs
		return o
	}

	/*
		rawCopy'' JSON-stringified rawFilter object
		opts{}
		.activeCohort
	*/
	async main(rawCopy, opts = {}) {
		// replace the postRender promise ASAP to ensure that listeners
		// will not get a stale promise from a previous render
		// TODO: can move setting a postRender promise to rx?
		this.promises.postRender = new Promise((resolve, reject) => {
			this.mainResolve = resolve
			this.mainReject = reject
		})
		this.numProcessedItems = 0
		this.numExpectedItems = 0

		this.opts = Object.assign({}, this.opts, opts)
		this.activeCohort = this.opts.activeCohort
		this.rawCopy = rawCopy
		this.rawFilter = JSON.parse(this.rawCopy)
		this.validateFilter(this.rawFilter)
		this.filter = getFilterItemByTag(this.rawFilter, 'filterUiRoot')
		if (!this.filter) {
			this.filter = this.rawFilter
			this.filter.tag = 'filterUiRoot'
		}
		await this.resetActiveData(this.filter)

		// reset interaction-related styling
		this.removeBlankPill()
		this.dom.newBtn.style('display', this.opts.newBtn ? '' : this.filter.lst.length == 0 ? 'inline-block' : 'none')
		this.dom.holder.selectAll('.sja_filter_add_transformer').style('display', this.getAddTransformerBtnDisplay)
		//this.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		this.setVocabApi()
		this.updateUI(this.dom.filterContainer, this.filter)
		return this.promises.postRender
	}

	validateFilter(item) {
		// for reliably binding data to DOM elements
		// and associating updated data copy to
		// the currently bound data
		if (!('$id' in item)) item.$id = this.lastId++
		else if (this.lastId <= item.$id) this.lastId = item.$id + 1

		if (!('type' in item)) throw 'missing filter.type'
		if (item.type != 'tvs' && item.type != 'tvslst') throw 'invalid filter.type'
		//if (!('visibility' in item)) item.visibility = 'default'
		//if (!['default', 'collapsed', 'hidden'].includes(item.visibility)) throw 'invalid filter.visibility value'

		if (item.type != 'tvslst') return
		if (!Array.isArray(item.lst)) throw 'invalid or missing filter.lst[]'
		if (item.lst.length > 1) {
			if (item.join != 'and' && item.join != 'or') throw 'invalid filter.join value for lst.length > 1'
		} else if (item.join !== '') {
			throw 'filter.join must be an empty string when lst.length < 2'
		}
		if (!item.lst.length) item.in = true
		for (const [i, subitem] of item.lst.entries()) {
			this.validateFilter(subitem)
		}
	}
	resetActiveData(filter) {
		// clear menu click
		if (this.dom.controlsTip.d.style('display') == 'none') {
			this.activeData = { item: {}, filter: {} }
		} else {
			this.activeData = {
				item: findItem(filter, this.activeData.item.$id),
				filter: findItem(filter, this.activeData.filter.$id),
				menuOpt: this.activeData.menuOpt
			}
		}
	}
	refresh(filterUiRoot) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))
		delete rootCopy.tag
		filterUiRoot.tag = 'filterUiRoot'
		const rawParent = findParent(rootCopy, this.filter.$id)
		if (!rawParent || this.rawFilter.$id === this.filter.$id) {
			this.api.main(filterUiRoot)
			this.opts.callback(filterUiRoot)
		} else {
			const i = rawParent.lst.findIndex(f => f.$id == this.filter.$id)
			rawParent.lst[i] = filterUiRoot
			this.api.main(rootCopy)
			this.opts.callback(filterUiRoot)
		}
	}
	getId(item) {
		return item.$id
	}
	getFilterExcludingPill($id) {
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))
		const parentCopy = findParent(rootCopy, $id)
		const i = parentCopy.lst.findIndex(f => f.$id === $id)
		if (i == -1) return null
		parentCopy.lst.splice(i, 1)
		return getNormalRoot(rootCopy)
		/*
		!!! 
			The logic below incorectly assumes that there are at most 2 root tvslst.lst entries,
			a cohortFilter, ONE OTHER, or both
			- this is mostly true for a global filter
			- however, a local chart filter may have 3+ entries in its root tvslst: 
			  a cohortFilter tvs,  aterm filter tvslst, AND the local filter tvslst
		!!!
		const cohortFilter = getFilterItemByTag(rootCopy, 'cohortFilter')
		if (cohortFilter && !parentCopy.lst.find(d => d === cohortFilter)) {
			return getNormalRoot({
				type: 'tvslst',
				join: 'and',
				lst: [cohortFilter, parentCopy]
			})
		} else {
			return getNormalRoot(parentCopy)
		}
		*/
	}

	getAdjustedRoot($id, join) {
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))

		if (join == 'and') return rootCopy

		// join should be "or"

		// first find the optional cohortFilter, as it's used at multiple placed below
		const cohortFilter = getFilterItemByTag(rootCopy, 'cohortFilter')

		const parentCopy = findParent(rootCopy, $id)
		if (!parentCopy) {
			// if cohortFilter is present, must return it; otherwise return blank filter
			return { type: 'tvslst', in: true, join: 'and', lst: cohortFilter ? [cohortFilter] : [] }
		}

		const i = parentCopy.lst.findIndex(f => f.$id === parentCopy.$id)
		if (i == -1) return { type: 'tvslst', in: true, join: 'and', lst: cohortFilter ? [cohortFilter] : [] }

		parentCopy.lst.splice(i, 1)
		if (cohortFilter && !parentCopy.lst.find(d => d === cohortFilter)) {
			return getNormalRoot({
				type: 'tvslst',
				join: 'and',
				lst: [cohortFilter, parentCopy]
			})
		}

		return getNormalRoot(parentCopy)
	}

	setVocabApi() {
		if (!this.vocabApi) {
			const app = {
				getState: () => {
					const filter = JSON.parse(this.rawCopy)
					const cohortFilter = getFilterItemByTag(filter, 'cohortFilter')
					if (cohortFilter && this.opts.termdbConfig) {
						cohortFilter.tvs.values =
							this.activeCohort == -1 || this.activeCohort === undefined
								? []
								: this.opts.termdbConfig.selectCohort.values[this.activeCohort].keys.map(key => {
										return { key, label: key }
								  })
					}

					return {
						vocab: this.opts.vocab,
						termfilter: { filter },
						tree: { plots: {} }
					}
				}
			}
			const state = app.getState()
			const vocab = state.vocab || {
				genome: state.genome,
				dslabel: state.dslabel
			}
			if (!this.vocabApi) {
				this.vocabApi = vocabInit({
					app,
					state: { vocab }
				})
			}
		}

		this.vocabApi.main()
	}
	updatePromise = function (incr = 1) {
		if (!this.mainResolve) return
		this.numProcessedItems += incr
		if (this.numExpectedItems == this.numProcessedItems) {
			this.mainResolve()
			if (this.bus) this.bus.emit('postRender')
			delete this.mainResolve
		}
	}
}

class FilterStateless extends Filter {
	constructor(opts) {
		super(opts)
		this.api = {
			// make sure to bind the 'this' context to the filter instance
			// instead of to the this.api object
			main: this.main.bind(this),
			/*
				WARNING!!!
				When using this filter.api.getNormalRoot(),
				make sure this instance has been updated before the caller,
				otherwise the normalized root will be stale

				or for reliability, import getNormalRoot() directly 
				from the common/filter.js component and supply the 
				caller's known raw filter state
			*/
			getNormalRoot: () => getNormalRoot(this.rawFilter),
			getPromise: name => this.promises[name]
		}

		if (opts.callbacks) {
			this.events = ['postInit', 'postRender', 'firstRender']
			this.bus = new Bus(this.api, this.events, opts.callbacks)
		}
	}

	async main(rawFilter, opts = {}) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const activeCohort = 'activeCohort' in opts ? opts.activeCohort : this.activeCohort
		const rawCopy = JSON.stringify(rawFilter)
		// if the filter data and active cohort has not changed, do not trigger a re-render
		if (this.rawCopy == rawCopy && JSON.stringify(this.activeCohort) == JSON.stringify(activeCohort)) return
		await super.main(rawCopy, opts)
	}
}

export const filterInit = getInitFxn(FilterStateless)

class FilterRxComp extends Filter {
	constructor(opts) {
		super(opts)
		this.type = 'filter'
		this.initHolder()
		// rx.getCompInit() will create this.opts, this.api
	}

	async preApiFreeze(api) {
		api.main = this.main.bind(this)
		api.getNormalRoot = () => getNormalRoot(this.rawFilter)
	}

	getState(appState) {
		return {
			termfilter: appState.termfilter,
			activeCohort: appState.activeCohort
		}
	}

	async main(rawFilter = null) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const f = this.state && this.state.termfilter
		if (!f) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')
		const rawCopy = JSON.stringify(rawFilter || f.filter)
		super.main(rawCopy, { activeCohort: this.state.activeCohort })
	}

	initHolder() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('position', 'relative')
			.style('width', 'fit-content')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'table')
			.style('border', this.opts.hideLabel ? 'none' : 'solid 1px #ddd')

		if (this.opts.hideLabel) {
			this.dom.filterDiv = div.style('display', 'inline-block').style('padding', '5px 10px')
		} else {
			div.append('span').text('Filter').style('padding', '0 10px')

			this.dom.filterDiv = div.append('div').style('display', 'inline-block').style('padding', '5px 10px')
		}
	}
}

export const filterRxCompInit = getCompInit(FilterRxComp)

class FilterPrompt extends Filter {
	constructor(opts) {
		super(opts)
		this.api = {
			// make sure to bind the 'this' context to the filter instance
			// instead of to the this.api object
			main: this.main.bind(this),
			/*
				WARNING!!!
				When using this filter.api.getNormalRoot(),
				make sure this instance has been updated before the caller,
				otherwise the normalized root will be stale

				or for reliability, import getNormalRoot() directly 
				from the common/filter.js component and supply the 
				caller's known raw filter state
			*/
			getNormalRoot: () => getNormalRoot(this.rawFilter),
			getPromise: name => this.promises[name]
		}
	}

	async main(rawFilter, opts = {}) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const activeCohort = 'activeCohort' in opts ? opts.activeCohort : this.activeCohort
		const filterUiRoot = getFilterItemByTag(rawFilter, 'filterUiRoot')
		// always replace the filterUiRoot with a tvslst object that has an empty lst,
		// so that the prompt will always be displayed
		if (filterUiRoot) delete filterUiRoot.tag
		rawFilter.lst.push({
			tag: 'filterUiRoot',
			type: 'tvslst',
			join: '',
			lst: []
		})
		rawFilter.join = rawFilter.lst.length > 1 ? 'and' : ''
		const rawCopy = JSON.stringify(rawFilter)
		// if the filter data and active cohort has not changed, do not trigger a re-render
		if (this.rawCopy == rawCopy && JSON.stringify(this.activeCohort) == JSON.stringify(activeCohort)) return
		// call the parent's main() method
		await super.main(rawCopy, opts)
	}

	refresh(filterUiRoot) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))
		const rawParent = findParent(rootCopy, this.filter.$id)
		if (!rawParent || this.rawFilter.$id === this.filter.$id) {
			this.opts.callback(rootCopy)
		} else {
			const i = rawParent.lst.findIndex(f => f.$id == this.filter.$id)
			rawParent.lst[i] = filterUiRoot
			this.opts.callback(rootCopy)
		}
		// remove the filled-in filterUiRoot from this filter prompt,
		// so that the selected filter data does not get carried over
		// to future selections from this prompt
		const i = rootCopy.lst.findIndex(f => f.$id === filterUiRoot.$id)
		rootCopy.lst.splice(i, 1)
		this.main(rootCopy)
	}
}

export const filterPromptInit = getInitFxn(FilterPrompt)
