import { setRenderers } from './filter.renderer'
import { setInteractivity } from './filter.interactivity'
import { findItem, findParent, getFilterItemByTag, getNormalRoot, filterJoin } from './filter.utils'
import { vocabInit } from '#termdb/vocabulary'
import { Menu } from '#dom/menu'

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

export class Filter {
	constructor(opts) {
		this.opts = this.validateOpts(opts)

		const parent_menu = this.opts.holder.node()?.closest('.sja_menu_div')

		const controlsTip = new Menu({
			padding: '0px',
			parent_menu
		})

		this.dom = {
			holder: opts.holder,
			controlsTip,
			treeTip: new Menu({
				padding: '5px',
				offsetX: 20,
				offsetY: -34,
				clearSelector: '.sja_term_src_body',
				parent_menu: controlsTip.d.node(),
				ancestor_menus: [parent_menu]
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
	// The method below is used to get correct categories + sample counts in the pill edit menu,
	// so that all values of the pill term, including filtered-out values, will still show up
	// as checkbox inputs/range option. The other filter data entries will still be applied.
	getFilterExcludingPill($id) {
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))
		const parentCopy = findParent(rootCopy, $id)
		const i = parentCopy.lst.findIndex(f => f.$id === $id)
		if (i == -1) return null
		parentCopy.lst.splice(i, 1)
		if (parentCopy.lst.length < 2) parentCopy.join = ''
		const globalFilter = this.app?.getState().termfilter?.filter
		return getNormalRoot(!globalFilter ? rootCopy : filterJoin([rootCopy, globalFilter]))
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

	destroy() {
		this.dom.holder.remove()
		this.dom.controlsTip.destroy()
		this.dom.treeTip.destroy()
	}
}
