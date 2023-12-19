import { getInitFxn, getCompInit, Bus } from '#rx'
import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { TVSInit } from './tvs'
import { vocabInit } from '#termdb/vocabulary'

const MENU_OPTION_HIGHLIGHT_COLOR = '#fff'

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

// will assign an incremented index to each filter UI instance
// to help namespace the body.on('click') event handler;
// other click handlers are specific to the rendered
// elements within instance.dom.holder, so no need for this index
let filterIndex = 0

function setRenderers(self) {
	self.initUI = async function () {
		if (self.opts.newBtn) {
			self.opts.newBtn.on('click.filter', self.displayTreeNew)
		} else {
			self.dom.newBtn = self.dom.holder
				.append('div')
				.attr('class', 'sja_new_filter_btn sja_menuoption')
				.html(self.opts.emptyLabel)
				.style('display', 'inline-block')
				.on('click', self.displayTreeNew)
		}

		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')

		self.dom.holder
			.selectAll('.sja_filter_add_transformer')
			.data(self.opts.joinWith)
			.enter()
			.append('div')
			.attr('class', 'sja_filter_add_transformer')
			.style('display', d => (self.filter && self.filter.join != d ? 'inline-block' : 'none'))
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border-radius', '5px')
			//.style('background-color', '#ececec')
			.style('cursor', 'pointer')
			.html(d => '+' + d.toUpperCase())
			.on('click', self.displayTreeNew)

		self.dom.table = self.dom.controlsTip.clear().d.append('table').style('border-collapse', 'collapse')

		const menuOptions = [
			{ action: 'edit', html: ['', 'Edit', '&rsaquo;'], handler: self.editTerm },
			{ action: 'join', html: ['&#10010;', '', '&rsaquo;'], handler: self.displayTreeMenu },
			{ action: 'switch', html: ['', 'Switch to', ''], handler: self.switchJoin },
			{ action: 'negate', html: ['', 'Negate', ''], handler: self.negateClause },
			{ action: 'remove', html: ['&#10006;', 'Remove', ''], handler: self.removeTransform }
		]

		// option to add a Replace option in the second row
		if (self.opts.vocab) {
			menuOptions.splice(1, 0, {
				action: 'replace',
				html: ['', 'Replace', '&rsaquo;'],
				handler: self.displayTreeMenu
			})
		}

		self.dom.table
			.selectAll('tr')
			.data(menuOptions)
			.enter()
			.append('tr')
			.attr('class', 'sja_menuoption')
			.on('click', self.handleMenuOptionClick)
			.selectAll('td')
			.data(d => d.html)
			.enter()
			.append('td')
			.style('padding', '5px')
			.style('border-top', 'solid 1px white')
			.style('color', (d, i) => (d == '&#10006;' ? '#a00' : i === 0 ? '#0a0' : '#111'))
			.style('opacity', (d, i) => (i === 0 ? 0.8 : 1))
			.html(d => d)

		self.dom.treeHead = self.dom.treeTip.d.append('div').attr('class', 'sja_tree_tip_head').style('padding', '3px')
		self.dom.termSrcDiv = self.dom.treeTip.d.append('div').attr('class', 'sja_term_src_body')

		self.dom.treeHeadTitle = self.dom.treeHead.append('div')

		select('body').on('mousedown.sja_filter_' + filterIndex++, event => {
			if (
				[
					'sja_filter_join_label',
					'sja_filter_clause_negate',
					'sja_filter_paren_open',
					'sja_filter_paren_close'
				].includes(event.target.className)
			)
				return
			self.dom.filterContainer?.selectAll('.sja_filter_grp').style('background-color', 'transparent')
			self.removeBlankPill()
			this.dom.holder?.selectAll('.sja_filter_add_transformer').style('display', this.getAddTransformerBtnDisplay)
		})
	}

	self.updateUI = async function (container, filter) {
		container.datum(filter).style('display', !filter.lst || !filter.lst.length ? 'none' : 'inline-block')
		const pills = container
			.selectAll(':scope > .sja_filter_grp')
			.style('background-color', 'transparent')
			.data([filter], self.getId)

		pills.exit().each(self.removeGrp)
		pills.each(self.updateGrp)
		pills.enter().append('div').attr('class', 'sja_filter_grp').style('margin', '5px').each(self.addGrp)

		self.updatePromise(0)
	}

	self.addGrp = function (item, i) {
		const filter = this.parentNode.__data__

		select(this).style('display', 'inline-block')

		select(this)
			.append('div')
			.attr('class', 'sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline-block')
			.style('color', 'rgb(102,0,0)')
			.style('font-weight', 500)
			.style('cursor', 'pointer')
			.html('NOT')
			.on('click', self.displayControlsMenu)

		select(this)
			.append('div')
			.attr('class', 'sja_filter_paren_open')
			.html('(')
			.style('display', 'none')
			.style('padding', '0 5px')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)

		const data = item.type == 'tvslst' ? item.lst : [item]
		const pills = select(this).selectAll(':scope > .sja_filter_item').data(data, self.getId)
		pills.enter().append('div').attr('class', 'sja_filter_item').each(self.addItem)

		if (self.opts.joinWith.length == 1) {
			self.dom.last_join_div = select(this)
				.append('div')
				.attr('class', 'sja_filter_last_join')
				.style('display', 'inline')
			self.dom.last_join_label = self.dom.last_join_div
				.append('div')
				.datum({ action: 'join', html: ['&#10010;', '', '&rsaquo;'], handler: self.displayTreeMenu })
				.attr('class', 'sja_filter_last_join_label')
				.style('padding', '0 5px')
				.style('display', filter.lst.length ? 'inline' : 'none')
				.style('font-weight', 500)
				.style('cursor', 'pointer')
				.html('+' + self.opts.joinWith[0].toUpperCase())
				.on('click', self.showLastJoinBlank)

			select('body').on('mousedown.sja_filter_last_join', () => {
				self.dom.last_join_label.style('display', 'inline')
			})
		}
		select(this)
			.append('div')
			.attr('class', 'sja_filter_paren_close')
			.style('padding', '0 5px')
			.html(')')
			.style('display', 'none')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)

		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style(
				'display',
				self.opts.joinWith.length < 2 || data.length < 2
					? 'none'
					: !filter.in || (data.length > 1 && filter.tag != 'filterUiRoot')
					? 'inline-block'
					: 'none'
			)
	}

	self.updateGrp = function (item, i) {
		const filter = this.parentNode.__data__

		select(this)
			.select(':scope > .sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline-block')

		const data = item.type == 'tvslst' ? item.lst : [item]

		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style(
				'display',
				self.opts.joinWith.length < 2 || data.length < 2
					? 'none'
					: !filter.in || (data.length > 1 && filter.tag != 'filterUiRoot')
					? 'inline-block'
					: 'none'
			)

		const pills = select(this).selectAll(':scope > .sja_filter_item').data(data, self.getId)

		pills.exit().each(self.removeItem)
		pills.each(self.updateItem)
		pills.enter().insert('div', ':scope > .sja_filter_paren_close').attr('class', 'sja_filter_item').each(self.addItem)

		select(this)
			.selectAll(':scope > .sja_filter_item')
			.sort((a, b) => data.indexOf(a) - data.indexOf(b))

		if (self.dom.last_join_label) {
			self.dom.last_join_div.datum(filter)
			this.insertBefore(self.dom.last_join_div.node(), select(this).select(':scope > .sja_filter_paren_close').node())
			self.dom.last_join_label.style('display', 'inline')
		}
	}

	self.removeGrp = function (item) {
		self.numExpectedItems += 1
		if (item.type == 'tvslst') {
			for (const subitem of item.lst) {
				if (subitem.lst) self.removeGrp(subitem)
				else {
					delete self.pills[subitem.$id]
				}
			}
		} else {
			delete self.pills[item.$id]
		}
		if (this instanceof Node) {
			select(this).selectAll('*').on('click', null)
			select(this).on('click', null).remove()
		}
		self.updatePromise()
	}

	self.addItem = async function (item, i) {
		const filter = this.parentNode.__data__

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
			self.addJoinLabel(this, filter, item)
			return
		}

		self.numExpectedItems += 1

		// holder for blue pill
		const holder = select(this)
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('white-space', 'nowrap')
			.append('div')
			.attr('class', 'sja_pill_wrapper')
			.style('display', 'inline-block')
			.style('margin', self.opts.joinWith.length > 1 ? '' : '2px')
			.on('click', item.renderAs === 'htmlSelect' ? null : self.displayControlsMenu)

		self.addJoinLabel(this, filter, item)
		if (item.renderAs == 'htmlSelect') {
			const values = getValuesForHtmlSelect(self, item)
			const selectElem = holder.append('select').on('change', function () {
				const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
				const filterCopy = findItem(filterUiRoot, filter.$id)
				const i = filter.lst.indexOf(item)
				if (i == -1) return
				const index = +this.value
				const itemCopy = JSON.parse(JSON.stringify(item))
				const keys = 'keys' in values[index] ? values[index].keys : [values[index].key]
				itemCopy.tvs.values = keys.map(key => {
					return { key, label: key } //may be missing list if term type is samplelst
				})
				filterCopy.lst[i] = itemCopy
				self.refresh(filterUiRoot)
			})

			const defaultVal = getDefaultValueForHtmlSelect(self, item)
			selectElem
				.selectAll('option')
				.data(values)
				.enter()
				.append('option')
				.property('value', (d, i) => i)
				.property('selected', (d, i) => i == defaultVal)
				.html(d => (d.shortLabel ? d.shortLabel : d.label ? d.label : d.key))
		} else {
			const pill = await TVSInit({
				vocabApi: self.vocabApi,
				holder,
				debug: self.opts.debug,
				getCategoriesArguments: self.opts.getCategoriesArguments,
				callback: tvs => {
					const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
					const filterCopy = findItem(filterUiRoot, filter.$id)
					const i = filter.lst.indexOf(item)
					if (i == -1) return
					// if tvs already present in the filterCopy just replace it rather than adding new one
					const item_i = filterCopy.lst.findIndex(t => t.$id == item.$id)
					if (item_i == -1) filterCopy.lst[i] = { $id: item.$id, type: 'tvs', tvs }
					else filterCopy.lst[item_i].tvs = tvs
					self.refresh(filterUiRoot)
				}
			})
			self.pills[item.$id] = pill
			await pill.main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
		}
		self.updatePromise()
	}

	self.updateItem = async function (item, i) {
		const filter = this.parentNode.__data__
		select(this)
			.select(':scope > .sja_filter_join_label')
			.style(
				'display',
				self.opts.joinWith.length > 1 && filter.lst.indexOf(item) < filter.lst.length - 1 ? 'inline-block' : 'none'
			)
			.style('margin', self.opts.joinWith.length > 1 ? '' : '2px')
			.html(filter.join == 'and' ? 'AND' : 'OR')

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
		} else if (item.renderAs === 'htmlSelect') {
			self.numExpectedItems += 1
			select(this)
				.select('select')
				.property('value', '' + getDefaultValueForHtmlSelect(self, item))
		} else {
			if (!self.pills[item.$id]) return
			self.numExpectedItems += 1
			await self.pills[item.$id].main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
		}
		self.updatePromise()
	}

	self.removeItem = function (item) {
		delete self.pills[item.$id]
		select(this).on('click', null).remove()
	}

	self.addJoinLabel = function (elem, filter, item) {
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_join_label')
			.style(
				'display',
				self.opts.joinWith.length > 1 && filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1
					? 'inline-block'
					: 'none'
			)
			.style('width', '50px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.html(filter.lst.length < 2 ? '' : filter.join == 'and' ? 'AND' : 'OR')
			.on('click', self.displayControlsMenu)
	}

	self.updateJoinLabel = function (item) {
		const filter = this.parentNode.parentNode.parentNode.__data__
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(this).style(
			'display',
			self.opts.joinWith.length > 1 && filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1
				? 'inline-block'
				: 'none'
		)
	}

	self.getAddTransformerBtnDisplay = function (d) {
		if (self.opts.joinWith.length < 2) {
			return 'none'
		} else if (self.filter && self.filter.lst.find(f => f.tag === 'cohortFilter')) {
			// assume that a cohortFilter is always joined via intersection with other filters
			return self.filter.lst.length == 1 && d == 'and' ? 'inline-block' : 'none'
		} else {
			return self.filter && self.filter.lst.length > 0 && (self.filter.join !== d || !self.filter.in)
				? 'inline-block'
				: 'none'
		}
	}
}

function setInteractivity(self) {
	self.displayControlsMenu = function (event) {
		event.stopPropagation() // in mass/group ui, to prevent pill-clicking to check/uncheck table rows

		if (!self.activeData) return
		const item = this.parentNode.__data__
		const filter = findParent(self.filter, item.$id)
		self.activeData = { item, filter, elem: this }
		self.removeBlankPill()
		self.resetGrpHighlights(this, filter)

		// disabled for now as it breaks CI
		if (item.noEdit)
			self.dom.table
				.selectAll('tr')
				.filter(d => d.action == 'edit')
				.style('display', 'none')

		self.dom.controlsTip.showunder(this)
	}

	self.resetGrpHighlights = function (elem, filter) {
		const cls = elem.className
		const grpAction = cls.includes('join') || cls.includes('negate') || cls.includes('paren')
		const menuRows = self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		menuRows.filter(d => d.action == 'edit' || d.action == 'replace').style('display', grpAction ? 'none' : 'table-row')
		menuRows
			.filter(d => /*d.action == 'negate' ||*/ d.action == 'remove')
			.style('display', cls.includes('_join_') && filter.lst.find(d => d.tag == 'cohortFilter') ? 'none' : 'table-row')

		menuRows
			.filter(d => d.action == 'join')
			.style(
				'display',
				self.opts.joinWith.length < 2 ||
					(filter.$id == self.filter.$id && filter.lst.length == 1) ||
					cls.includes('negate') ||
					cls.includes('paren')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(grpAction ? filter.join.toUpperCase() : filter.join == 'and' ? 'OR' : 'AND')

		menuRows
			.filter(d => d.action == 'switch')
			.style(
				'display',
				self.opts.joinWith.length < 2 ||
					(filter.$id == self.filter.$id && filter.lst.length == 1) ||
					!cls.includes('_join_')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(d => (filter.join == 'and' ? 'Switch to OR' : 'Switch to AND'))

		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (grpAction) {
			if (cls.includes('join')) elem.parentNode.parentNode.style.backgroundColor = '#ee5'
			else elem.parentNode.style.backgroundColor = '#ee5'
		}
	}

	self.handleMenuOptionClick = async function (event, d) {
		event.stopPropagation()
		if (d == self.activeData.menuOpt) return
		self.activeData.menuOpt = d
		if (self.activeData.elem.className.includes('join') && d.action !== 'join' && d.action != 'switch') {
			self.activeData.item = self.activeData.filter
			self.activeData.filter = findParent(self.filter, self.activeData.item)
		}
		self.resetBlankPill(d.action)
		self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		await d.handler(this, d)
	}

	self.resetBlankPill = function (action) {
		// clear any currently highlighted blank pill/parenthesis
		self.removeBlankPill()
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (action != 'join') return
		const elem = self.dom.last_join_div
			? self.dom.last_join_div.node()
			: self.activeData.elem.className.includes('join_label')
			? self.activeData.elem.parentNode.parentNode
			: self.activeData.item.type == 'tvs' || self.activeData.filter === self.filter
			? self.activeData.elem
			: self.activeData.elem.parentNode.parentNode
		const joiner =
			self.opts.joinWith.length === 1
				? self.opts.joinWith[0].toUpperCase()
				: self.activeData.elem.className.includes('join_label')
				? self.activeData.filter.join.toUpperCase()
				: self.activeData.btn && typeof self.activeData.btn.__data__ === 'string'
				? self.activeData.btn.__data__.toUpperCase()
				: self.activeData.item.type == 'tvslst'
				? self.activeData.filter.join.toUpperCase()
				: self.activeData.filter.join == 'or'
				? 'AND'
				: 'OR'

		if (
			self.activeData.item.type == 'tvs' &&
			//&& self.activeData.filter != self.filter
			!self.activeData.elem.className.includes('join_label')
		) {
			select(elem)
				.insert('div', 'div')
				.attr('class', 'sja_filter_paren_open')
				.style('display', self.opts.joinWith.length > 1 ? 'inline-block' : 'none')
				.style('padding', '0 5px')
				.style('font-weight', 500)
				.style('font-size', '24px')
				.style('cursor', 'pointer')
				.html('(')
		}

		const blank = select(elem)
			.insert('div', ':scope > .sja_filter_paren_close')
			.attr('class', 'sja_filter_blank_pill')
			.style('display', 'inline-block')
			//.style('width', '120px')
			.style('height', '20px')
			//.style('margin-right', '20px')
			.style('overflow', 'visible')

		blank
			.append('div')
			.style('display', 'inline-block')
			.style('width', '50px')
			.style('text-align', 'center')
			.html(joiner)

		blank
			.append('div')
			.style('position', 'relative')
			.style('top', '-7px')
			.style('display', 'inline-block')
			.style('width', '80px')
			.style('height', '22px')
			.style('margin-right', '5px')
			.style('border', '3px dashed #b8d3ea')
			.style('vertical-align', 'top')
			.style('background-color', '#ee5')

		if (
			self.activeData.item.type == 'tvs' &&
			//&& self.activeData.filter != self.filter
			!self.activeData.elem.className.includes('join_label')
		) {
			select(elem)
				.append('div')
				.attr('class', 'sja_filter_paren_close')
				.style('display', self.opts.joinWith.length > 1 ? 'inline-block' : 'none')
				.style('padding', '0 5px')
				.style('font-weight', 500)
				.style('font-size', '24px')
				.style('cursor', 'pointer')
				.html(')')
		}

		if (elem == self.dom.filterContainer.node()) {
			self.dom.filterContainer
				.selectAll(
					':scope > .sja_filter_grp > .sja_filter_paren_open, :scope > .sja_filter_grp > .sja_filter_paren_close'
				)
				.style('display', self.opts.joinWith.length > 1 && self.filter.lst.length > 1 ? 'inline-block' : 'none')
		}
	}

	self.removeBlankPill = function () {
		self.dom.holder
			?.selectAll(
				'.sja_filter_blank_pill, .sja_pill_wrapper > .sja_filter_paren_open, .sja_pill_wrapper > .sja_filter_paren_close'
			)
			.remove()

		// in case of potentially root filter subnesting, may have to
		// revert the visibility of root filter group parentheses
		// that subnest existing pill + blank pill
		if (self.filter.in && self.filter.lst.filter(f => f.type === 'tvslst').length < 1) {
			self.dom.filterContainer
				?.selectAll(
					':scope > .sja_filter_grp > .sja_filter_paren_open, :scope > .sja_filter_grp > .sja_filter_paren_close'
				)
				.style('display', 'none')
		}
	}

	// menu to add a new term
	self.displayTreeNew = async function (event, d) {
		event.stopPropagation() // in mass/group ui, to prevent pill-clicking to check/uncheck table rows

		if (self.opts.newBtn && this.className !== 'sja_filter_add_transformer' && self.filter.lst.length) return
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (self.filter.lst.length > 0) {
			self.activeData = {
				item: self.filter,
				filter: self.filter,
				elem: self.dom.filterContainer.node(), //.select(':scope > .sja_filter_grp').node()
				btn: this
			}
		}
		if (self.filter.lst.length) self.resetBlankPill('join')
		const blankPill = self.dom.filterContainer.select('.sja_filter_blank_pill').node()
		if (blankPill) {
			self.dom.holder.selectAll('.sja_filter_add_transformer').style('display', 'none')
			self.dom.treeTip.clear().showunder(blankPill)
		} else {
			self.dom.treeTip.clear().showunder(this)
		}

		const rootFilterCopy = self.activeData
			? self.getAdjustedRoot(self.activeData.filter.$id, d)
			: JSON.parse(self.rawCopy)

		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: self.vocabApi,
			holder: self.dom.termSrcDiv,
			getCategoriesArguments: self.opts.getCategoriesArguments,
			state: {
				activeCohort: self.activeCohort,
				termfilter: { filter: rootFilterCopy }
			},
			tree: {
				disable_terms:
					self.activeData && self.activeData.filter && self.activeData.filter.lst && d == 'and'
						? self.activeData.filter.lst
								.filter(d => d.type === 'tvs' && d.tvs.term.type !== 'condition')
								.map(d => d.tvs.term.id)
						: [],

				click_term2select_tvs(tvs) {
					self.editFilterRoot(d, [{ type: 'tvs', tvs }])
				}
			}
		})
	}

	/*
		Arguments: 
		d: the data bound to a button element like +New, AND, OR
		tvslst
	*/
	self.editFilterRoot = (d, tvslst) => {
		// NOTE: default to 'tvs' argument once bar_click_override is unsupported
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))

		if (!filterUiRoot.lst.length) {
			if (tvslst.length > 1) filterUiRoot.join = 'and'
			filterUiRoot.lst.push(...tvslst)
			self.refresh(filterUiRoot)
		} else if (d != 'or' && d != 'and') {
			throw 'unhandled new term(s): invalid appender join value'
		} else {
			if (!filterUiRoot.join) filterUiRoot.join = d // 'and' || 'or'

			if (filterUiRoot.join == d && filterUiRoot.in) {
				if (tvslst.length < 2 || filterUiRoot.join == 'and') {
					filterUiRoot.lst.push(...tvslst)
				} else {
					filterUiRoot.push({
						type: 'tvslst',
						in: true,
						join: 'and',
						lst: tvslst
					})
				}
				self.refresh(filterUiRoot)
			} else if (d == 'and' || tvslst.length < 2) {
				delete filterUiRoot.tag
				self.refresh({
					tag: 'filterUiRoot',
					type: 'tvslst',
					in: true,
					join: d,
					lst: [filterUiRoot, ...tvslst]
				})
			} else {
				delete filterUiRoot.tag
				self.refresh({
					tag: 'filterUiRoot',
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						filterUiRoot,
						{
							type: 'tvslst',
							in: true,
							join: 'and',
							lst: tvslst
						}
					]
				})
			}
		}
	}

	// menu to replace a term or add a subnested filter
	// elem: the clicked menu row option
	// d: elem.__data__
	self.displayTreeMenu = async function (elem, d) {
		select(elem).style('background-color', MENU_OPTION_HIGHLIGHT_COLOR)
		self.dom.holder.selectAll('.sja_filter_add_transformer').style('display', 'none')
		const blankPill = self.dom.filterContainer.select('.sja_filter_blank_pill').node()
		if (blankPill) {
			self.dom.controlsTip.hide()
			self.dom.treeTip.clear().showunder(blankPill)
		} else if (elem.lastChild instanceof HTMLElement) {
			self.dom.treeTip.clear().showunderoffset(elem.lastChild)
		} else {
			self.dom.treeTip.clear().showunder(elem)
		}
		const filter = self.activeData.filter

		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: self.vocabApi,
			holder: self.dom.termSrcDiv,
			getCategoriesArguments: self.opts.getCategoriesArguments,
			state: {
				activeCohort: self.activeCohort,
				header_mode: 'search_only',
				termfilter: { filter: self.getAdjustedRoot(filter.$id, filter.join) }
			},
			tree: {
				disable_terms:
					filter && filter.lst && filter.join == 'and'
						? filter.lst.filter(d => d.type === 'tvs' && d.tvs.term.type !== 'condition').map(d => d.tvs.term.id)
						: !self.activeData.item
						? []
						: self.activeData.item.type == 'tvs'
						? [self.activeData.item.tvs.term.id]
						: self.activeData.item.lst
						? self.activeData.item.lst.filter(f => f.type == 'tvs').map(f => f.tvs.term.id)
						: [],

				click_term2select_tvs:
					d.action == 'replace'
						? self.replaceTerm
						: !filter.join ||
						  !filter.lst.length ||
						  (self.activeData.elem && self.activeData.elem.className.includes('join'))
						? self.appendTerm
						: self.subnestFilter
			}
		})
	}

	self.editTerm = function (elem) {
		select(elem.parentNode).selectAll('tr').style('background-color', self.highlightEditRow)
		const holder = self.dom.termSrcDiv
		const item = self.activeData.item
		self.dom.treeTip.clear()
		self.pills[item.$id].showMenu(holder)
		self.dom.treeTip.showunderoffset(elem.lastChild)
	}

	self.highlightEditRow = function (d) {
		return d.action == 'edit' ? MENU_OPTION_HIGHLIGHT_COLOR : ''
	}

	self.handleNotLabelClick = function (event, d) {
		self.activeData = {
			item: this.__data__
		}
		self.negateClause()
	}

	self.negateClause = function () {
		//const filter = self.activeData.filter
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const item = findItem(filterUiRoot, self.activeData.item.$id)
		if (item.type == 'tvslst') item.in = !item.in
		else if (item.type == 'tvs' && item.tvs?.term?.type == 'geneVariant') {
			const modifiedGrp = item.tvs.values.filter(v => v.mclassExcludeLst.length > 0)[0]
			const tmp = modifiedGrp.mclassLst
			modifiedGrp.mclassLst = modifiedGrp.mclassExcludeLst
			modifiedGrp.mclassExcludeLst = tmp
			item.tvs.isnot = !item.tvs.isnot
		} else item.tvs.isnot = !item.tvs.isnot
		self.refresh(filterUiRoot)
	}

	self.replaceTerm = _tvs_ => {
		// NOTE: default to type: 'tvs' argument once bar_click_override is unsupported
		const tvslst = Array.isArray(_tvs_) ? _tvs_ : [{ type: 'tvs', tvs: _tvs_ }]
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === self.activeData.item.$id)
		// FIXME: will replace with just one tvs, once bar_click_override is unsupported
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.splice(i, 1, ...tvslst)
		} else {
			filterCopy.lst[i] = {
				// transform from tvs to tvslst
				in: !_tvs_.isnot,
				type: 'tvslst',
				join: 'and',
				lst: tvslst
			}
		}
		self.refresh(filterUiRoot)
	}

	self.appendTerm = _tvs_ => {
		// FIXME: default to type: 'tvs' argument once bar_click_override is unsupported
		const tvslst = Array.isArray(_tvs_) ? _tvs_ : [{ type: 'tvs', tvs: _tvs_ }]
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		// FIXME: will just push one tvs, once bar_click_override is unsupported
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.push(...tvslst)
			if (filterCopy.join == '' && self.opts.joinWith.length === 1) filterCopy.join = self.opts.joinWith[0]
		} else {
			filterCopy.lst.push({
				// transform from tvs to tvslst
				in: true,
				type: 'tvslst',
				join: 'and',
				lst: tvslst
			})
		}
		self.refresh(filterUiRoot)
	}

	self.subnestFilter = t => {
		let tvslst
		if (Array.isArray(t)) {
			tvslst = t
		} else {
			tvslst = [{ type: 'tvs', tvs: t }]
		}

		const item = self.activeData.item
		const filter = self.activeData.filter
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		// transform from tvs to tvslst
		filterCopy.lst[i] = {
			in: true,
			type: 'tvslst',
			join: filter.join == 'or' ? 'and' : 'or',
			lst: [item, ...tvslst]
		}
		self.refresh(filterUiRoot)
	}

	self.removeTransform = function (elem, t) {
		const item = t.action || typeof t !== 'object' ? self.activeData.item : findItem(self.filter, t.$id)
		const filter = findParent(self.filter, item.$id) //self.activeData.filter
		if (item == filter) {
			self.refresh(getWrappedTvslst([], '', item.$id))
			return
		}
		const i = filter.lst.findIndex(t => t.$id === item.$id)
		if (i == -1) return
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, filter.$id)
		filterCopy.lst.splice(i, 1)
		if (filterCopy.lst.length === 1) {
			const parent = findParent(filterUiRoot, filterCopy.$id)
			if (filterCopy.lst[0].type == 'tvslst') {
				if (parent == filterUiRoot) {
					filterCopy.lst[0].tag = 'filterUiRoot'
					self.refresh(filterCopy.lst[0])
				} else {
					const j = parent.lst.findIndex(t => t.$id == filterCopy.$id)
					if (filterCopy.lst[0].join == parent.join) {
						parent.lst.splice(j, 1, ...filterCopy.lst[0].lst)
						self.refresh(filterUiRoot)
					} else {
						parent.lst[j] = filterCopy.lst[0]
						self.refresh(filterUiRoot)
					}
				}
			} else {
				filterCopy.join = ''
				const j = parent.lst.findIndex(t => t.$id === filterCopy.$id)
				parent.lst[j] = filterCopy.lst[0]
				if (!filterCopy.in) {
					parent.lst[j].tvs.isnot = !parent.lst[j].tvs.isnot
					if (parent == filterUiRoot) parent.in = true
				}
				self.refresh(filterUiRoot)
			}
		} else {
			self.refresh(filterUiRoot)
		}
	}

	self.showLastJoinBlank = function (event, d) {
		event.stopPropagation()
		const elem = self.dom.last_join_div.node()
		self.dom.last_join_label.style('display', 'none')
		const filter = this.parentNode.__data__
		self.activeData = { item: filter, filter, elem }
		self.resetBlankPill(d.action)
		self.displayTreeMenu(elem, d)
	}

	self.switchJoin = function (event, d) {
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		if (filterCopy.join < 2) return
		filterCopy.join = filterCopy.join == 'and' ? 'or' : 'and'
		self.refresh(filterUiRoot)
	}
}

/***********************
 Utilities
*************************/

// find the first filter item that has a matching term.id
export function findItemByTermId(item, id) {
	if (item.type === 'tvs' && item.tvs.term.id === id) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = findItemByTermId(subitem, id)
		if (matchingItem) return matchingItem
	}
}

// find filter item by the sequential $id
// assigned at the time of adding a filter entry
export function findItem(item, $id) {
	if (item.$id === $id) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = findItem(subitem, $id)
		if (matchingItem) return matchingItem
	}
}

export function findParent(parent, $id) {
	if (parent.$id === $id) return parent
	if (!parent.lst) return
	for (const item of parent.lst) {
		if (item.$id === $id) return parent
		else if (item.type == 'tvslst') {
			const matchingParent = findParent(item, $id)
			if (matchingParent) return matchingParent
		}
	}
}

export function getFilterItemByTag(item, tag) {
	if (item.tag === tag) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = getFilterItemByTag(subitem, tag)
		if (matchingItem) return matchingItem
	}
}

function getWrappedTvslst(lst = [], join = '', $id = null) {
	const filter = {
		type: 'tvslst',
		in: true,
		join,
		lst
	}
	if ($id !== null && filter.$id !== undefined) filter.$id = $id
	return filter
}

/*
	get valid filter data to be used for server requests
	will use normalizeFilter recursively as needed

	.filter{} the raw filter root
*/
export function getNormalRoot(rawFilter) {
	if (!rawFilter) return getWrappedTvslst([])
	const filter = JSON.parse(JSON.stringify(rawFilter))
	const processedFilter = normalizeFilter(filter)
	return processedFilter.type == 'tvslst' ? processedFilter : getWrappedTvslst([processedFilter])
}

/* 
	Potentially
	- restructure the filter data in a shape 
	allowed by the server, such as by
  removing an empty tvslst or converting a 
	single-entry tvslst into a tvs
	- also will remove unnecessary filter properties
	via normalizeProps()

	.filter{} the raw filter root or a subnested filter
*/
function normalizeFilter(filter) {
	delete filter.$id
	delete filter.tag
	if (filter.type != 'tvslst') return filter

	const lst = filter.lst
		// keep non-tvslst entries or tvslst with non-empty lst.length
		.filter(f => f.type !== 'tvslst' || f.lst.length > 0)
		// do not reformat an entry unless it is a tvslst with only one entry,
		// in which case just return that filter's first lst entry instead
		// of the filter itself
		.map(f => (f.type !== 'tvslst' || f.lst.length > 1 ? f : f.lst[0]))

	lst.forEach(normalizeProps)

	if (!lst.length) {
		// return a default empty filter = {type: 'tvslst', lst:[], ...}
		return getWrappedTvslst([], '', filter.$id)
	} else if (lst.length == 1) {
		// return the only lst entry after normalizing
		if (lst[0].type === 'tvslst') {
			return normalizeFilter(lst[0])
		} else {
			return normalizeProps(lst[0])
		}
	} else {
		// reset and fill-in filter.lst with normalized entries
		filter.lst = []
		for (const item of lst) {
			if (item.type === 'tvslst') {
				const normalItem = normalizeFilter(item)
				if (normalItem.type !== 'tvslst' || normalItem.join != filter.join || normalItem.in != filter.in) {
					filter.lst.push(normalItem)
				} else if (normalItem.lst.length) {
					// can flatten and level up the subnested filter.lst items with matching join, in
					filter.lst.push(...normalItem.lst)
				}
			} else {
				filter.lst.push(item)
			}
		}
		return filter
	}
}

/*
	will remove unnecessary filter properties
	that are not expected in a server request

	.filter{} the raw filter root or a subnested filter
*/
export function normalizeProps(filter, callback = null) {
	delete filter.$id
	if (typeof callback == 'function') callback(filter)
	if (filter.type == 'tvslst') {
		for (const item of filter.lst) {
			normalizeProps(item, callback)
		}
	}
	return filter
}

/* join a list of filters into the first filter with "and", return joined filter
to be used by caller app to join hidden filters into a visible filter

lst:[]
  a list of filters
  the function returns a (modified) copy of the first filter, and will not modify it
  rest of the array will be joined to the first one under "and"
*/
export function filterJoin(lst) {
	if (!lst || lst.length == 0) return
	let f = JSON.parse(JSON.stringify(lst[0]))
	if (lst.length == 1) return f
	// more than 1 item, will join
	if (f.lst.length < 2) {
		if (f.join !== '') throw 'filter.join must be an empty string "" when filter.lst.length < 2'
		f.join = 'and'
	} else if (f.join == 'or') {
		// f is "or", wrap it with another root layer of "and"
		f = {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [f]
		}
	} else if (f.join != 'and') {
		throw 'filter.join must be either "and" or "or" when .lst length > 1'
	}
	// now, f.join should be "and"
	// if the argument lst[0].join == "and",
	// then the f.in boolean value is reused
	for (let i = 1; i < lst.length; i++) {
		const f2 = JSON.parse(JSON.stringify(lst[i]))
		if (f2.join == 'or') f.lst.push(f2)
		else f.lst.push(...f2.lst)
	}
	// if f ends up single-tvs item (from joining single tvs to empty filter), need to set join to '' per filter spec
	if (f.lst.length == 1 && f.lst[0].type == 'tvs') {
		f.join = ''
	}
	return f
}

function getValuesForHtmlSelect(self, item) {
	return item.selectOptionsFrom == 'selectCohort'
		? self.opts.termdbConfig.selectCohort.values
		: Array.isArray(item.tvs.term.values)
		? item.tvs.term.values
		: Object.values(item.tvs.term.values)
}

function getDefaultValueForHtmlSelect(self, item) {
	const values = getValuesForHtmlSelect(self, item)
	const defaultKey = JSON.stringify(item.tvs.values.map(o => o.key).sort())
	const i = values.findIndex(d => (d.keys ? defaultKey === JSON.stringify(d.keys.sort()) : d.key === defaultKey))
	return i
}
