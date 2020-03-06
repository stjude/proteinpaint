import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

const MENU_OPTION_HIGHLIGHT_COLOR = '#fff'

/*
	opts{}
	.holder
	
	.callback()
		When a filter change (add, edit, remove) is made,
		the callback will receive the updated visible filter
		as argument
	
	.getVisibleRoot()
	  optional method that returns the raw filter's level/item 
	  to use as the visible filter root to render; defaults
	  to the raw filter root object
	
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
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.nav = opts.nav
		this.dom = {
			holder: opts.holder,
			controlsTip: new Menu({ padding: '0px' }),
			treeTip: new Menu({
				padding: '5px',
				offsetX: 20,
				offsetY: -34,
				clearSelector: '.sja_tree_tip_body'
			})
		}
		this.durations = { exit: 500 }
		this.lastId = 0
		this.categoryData = {}
		this.pills = {}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		this.api = {
			main: async (rawFilter, opts = {}) => {
				//console.log(65, 'filter.main', rawFilter.$id)
				/*
				rawFilter{}
				  the raw filter data structure
				*/

				const tempOpts = Object.assign({}, this.opts, opts)
				// to-do: should use deepEquals as part of rx.core
				const rawCopy = JSON.stringify(rawFilter)
				if (this.rawCopy == rawCopy && JSON.stringify(this.nav) == JSON.stringify(tempOpts.nav)) return
				this.opts = tempOpts
				this.nav = tempOpts.nav
				this.rawCopy = rawCopy
				this.rawFilter = JSON.parse(this.rawCopy)
				this.validateFilter(this.rawFilter)
				this.filter = this.opts.getVisibleRoot ? this.opts.getVisibleRoot(this.rawFilter) : this.rawFilter
				this.resetActiveData(this.filter)

				// reset interaction-related styling
				this.removeBlankPill()
				this.dom.newBtn.style('display', this.opts.newBtn ? '' : this.filter.lst.length == 0 ? 'inline-block' : 'none')
				this.dom.holder
					.selectAll('.sja_filter_add_transformer')
					.style('display', d => (this.filter.lst.length > 0 && this.filter.join !== d ? 'inline-block' : 'none'))

				//this.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
				this.updateUI(this.dom.filterContainer, this.filter)
			},
			/*
				WARNING!!!
				When using this filter.api.getNormalRoot(),
				make sure this instance has been updated before the caller,
				otherwise the normalized root will be stale

				or for reliability, import getNormalRoot() directly 
				from the common/filter.js component and supply the 
				caller's known raw filter state
			*/
			getNormalRoot: () => getNormalRoot(this.rawFilter)
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if (o.getVisibleRoot && typeof o.getVisibleRoot != 'function')
			throw '.getVisibleRoot() must be a function if set as an option'
		if (!o.emptyLabel) o.emptyLabel = '+NEW'
		return o
	}
	validateFilter(item) {
		// for reliably binding data to DOM elements
		// and associating updated data copy to
		// the currently bound data
		if (!('$id' in item)) item.$id = this.lastId++
		else if (this.lastId < item.$id) this.lastId = item.$id + 1

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
			this.dom.isNotInput.property('checked', false)
		} else {
			this.activeData = {
				item: this.findItem(filter, this.activeData.item.$id),
				filter: this.findItem(filter, this.activeData.filter.$id),
				menuOpt: this.activeData.menuOpt
			}
		}
	}
	refresh(filter) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const rawParent = this.findParent(this.rawFilter, this.filter.$id)
		if (!rawParent || rawParent.$id === this.filter.$id) {
			this.api.main(filter)
			this.opts.callback(filter)
		} else {
			const i = rawParent.lst.findIndex(f => f.$id == this.filter.$id)
			rawParent.lst[i] = filter
			this.api.main(rawParent)
			this.opts.callback(filter)
		}
	}
	getId(item) {
		return item.$id
	}
	getFilterExcludingPill($id) {
		const rootCopy = JSON.parse(JSON.stringify(this.filter))
		const parentCopy = this.findParent(rootCopy, $id)
		const i = parentCopy.lst.findIndex(f => f.$id === $id)
		if (i == -1) return null
		parentCopy.lst.splice(i, 1)
		return getNormalRoot(rootCopy)
	}
}

exports.filterInit = rx.getInitFxn(Filter)

// will assign an incremented index to each filter UI instance
// to help namespace the body.on('click') event handler;
// other click handlers are specific to the rendered
// elements within instance.dom.holder, so no need for this index
let filterIndex = 0

function setRenderers(self) {
	self.initUI = function() {
		if (self.opts.newBtn) {
			self.dom.newBtn = self.opts.newBtn.on('click.filter', self.displayTreeNew)
		} else {
			self.dom.newBtn = self.dom.holder
				.append('div')
				.attr('class', 'sja_new_filter_btn')
				.html(self.opts.emptyLabel)
				.style('display', 'inline-block')
				.style('margin', '2px 10px 2px 2px')
				.style('padding', '5px')
				.style('border-radius', '5px')
				.style('background-color', '#ececec')
				.style('cursor', 'pointer')
				.on('click', self.displayTreeNew)
		}

		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')

		self.dom.holder
			.selectAll('.sja_filter_add_transformer')
			.data(['and', 'or'])
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

		self.dom.table = self.dom.controlsTip
			.clear()
			.d.append('table')
			.style('border-collapse', 'collapse')

		self.dom.table
			.selectAll('tr')
			.data([
				{ action: 'edit', html: ['', 'Edit', '&rsaquo;'], handler: self.editTerm },
				{
					action: 'replace',
					html: ['', 'Replace', '&rsaquo;'],
					handler: self.displayTreeMenu,
					bar_click_override: self.replaceTerm
				},
				{ action: 'join', html: ['&#10010;', '', '&rsaquo;'], handler: self.displayTreeMenu },
				{ action: 'negate', html: ['', 'Negate', ''], handler: self.negateClause },
				{ action: 'remove', html: ['&#10006;', 'Remove', ''], handler: self.removeTransform }
			])
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

		self.dom.treeHead = self.dom.treeTip.d
			.append('div')
			.attr('class', 'sja_tree_tip_head')
			.style('padding', '3px')
		self.dom.treeBody = self.dom.treeTip.d.append('div').attr('class', 'sja_tree_tip_body')

		self.dom.treeHeadTitle = self.dom.treeHead.append('div')
		const isNotLabels = self.dom.treeHead
			.selectAll('label')
			.data([{ label: 'Exclude', value: 'false', checked: false }])
			.enter()
			.append('label')
			.style('margin', '0 5px')
		self.dom.isNotInput = isNotLabels
			.append('input')
			.attr('type', 'checkbox')
			.attr('name', 'sja_filter_isnot_input')
			.attr('value', d => d.value)
			.property('checked', d => d.checked)
			.style('vertical-align', 'top')
			.style('margin-right', '3px')
		isNotLabels
			.append('span')
			.style('margin-right', '5px')
			.style('vertical-align', 'top')
			.html(d => d.label)

		select('body').on('mousedown.sja_filter_' + filterIndex++, () => {
			if (
				[
					'sja_filter_join_label',
					'sja_filter_clause_negate',
					'sja_filter_paren_open',
					'sja_filter_paren_close'
				].includes(event.target.className)
			)
				return
			self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
			self.removeBlankPill()
		})
	}

	self.updateUI = function(container, filter) {
		container.datum(filter).style('display', !filter.lst || !filter.lst.length ? 'none' : 'inline-block')

		const pills = container
			.selectAll(':scope > .sja_filter_grp')
			.style('background-color', 'transparent')
			.data([filter], self.getId)

		pills.exit().each(self.removeGrp)
		pills.each(self.updateGrp)
		pills
			.enter()
			.append('div')
			.attr('class', 'sja_filter_grp')
			.style('margin', '5px')
			.each(self.addGrp)
	}

	self.addGrp = function(item, i) {
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
			.style('display', filter.$id === self.filter.$id && filter.in ? 'none' : 'inline-block')
			.style('padding', '0 5px')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)

		const data = item.type == 'tvslst' ? item.lst : [item]
		const pills = select(this)
			.selectAll(':scope > .sja_filter_item')
			.data(data, self.getId)

		pills
			.enter()
			.append('div')
			.attr('class', 'sja_filter_item')
			.each(self.addItem)

		select(this)
			.append('div')
			.attr('class', 'sja_filter_paren_close')
			.style('padding', '0 5px')
			.html(')')
			.style('display', filter.$id === self.filter.$id && filter.in ? 'none' : 'inline')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)
	}

	self.updateGrp = function(item, i) {
		const filter = this.parentNode.__data__

		select(this)
			.select(':scope > .sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline-block')

		const data = item.type == 'tvslst' ? item.lst : [item]
		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style('display', (filter.$id !== self.filter.$id || !filter.in) && data.length > 1 ? 'inline-block' : 'none')

		const pills = select(this)
			.selectAll(':scope > .sja_filter_item')
			.data(data, self.getId)

		pills.exit().each(self.removeItem)
		pills.each(self.updateItem)
		pills
			.enter()
			.insert('div', ':scope > .sja_filter_paren_close')
			.attr('class', 'sja_filter_item')
			.each(self.addItem)

		select(this)
			.selectAll(':scope > .sja_filter_item')
			.sort((a, b) => data.indexOf(a) - data.indexOf(b))
	}

	self.removeGrp = function(item) {
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
			select(this)
				.selectAll('*')
				.on('click', null)
			select(this)
				.on('click', null)
				.remove()
		}
	}

	self.addItem = function(item, i) {
		const filter = this.parentNode.__data__

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
			self.addJoinLabel(this, filter, item)
			return
		}

		// holder for blue pill
		const holder = select(this)
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('white-space', 'nowrap')
			.append('div')
			.attr('class', 'sja_pill_wrapper')
			.style('display', 'inline-block')
			.on('click', self.displayControlsMenu)

		self.addJoinLabel(this, filter, item)

		const pill = TVSInit({
			genome: self.genome,
			dslabel: self.dslabel,
			holder,
			debug: self.opts.debug,
			callback: tvs => {
				const rootCopy = JSON.parse(JSON.stringify(self.filter))
				const filterCopy = self.findItem(rootCopy, filter.$id)
				const i = filter.lst.indexOf(item)
				if (i == -1) return
				tvs.isnot = self.dom.isNotInput.property('checked')
				filterCopy.lst[i] = { $id: item.$id, type: 'tvs', tvs }
				self.refresh(rootCopy)
			}
		})
		self.pills[item.$id] = pill
		pill.main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
	}

	self.updateItem = function(item, i) {
		const filter = this.parentNode.__data__
		select(this)
			.select(':scope > .sja_filter_join_label')
			.style('display', filter.lst.indexOf(item) < filter.lst.length - 1 ? 'inline-block' : 'none')
			.html(filter.join == 'and' ? 'AND' : 'OR')

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
		} else {
			if (!self.pills[item.$id]) return
			self.pills[item.$id].main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
		}
	}

	self.removeItem = function(item) {
		delete self.pills[item.$id]
		select(this)
			.on('click', null)
			.remove()
	}

	self.addJoinLabel = function(elem, filter, item) {
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_join_label')
			.style('display', filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1 ? 'inline-block' : 'none')
			.style('width', '50px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.html(filter.lst.length < 2 ? '' : filter.join == 'and' ? 'AND' : 'OR')
			.on('click', self.displayControlsMenu)
	}

	self.updateJoinLabel = function(item) {
		const filter = this.parentNode.parentNode.parentNode.__data__
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(this).style(
			'display',
			filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1 ? 'inline-block' : 'none'
		)
	}
}

function setInteractivity(self) {
	self.displayControlsMenu = function() {
		if (!self.activeData) return
		const item = this.parentNode.__data__
		const filter = self.findParent(self.filter, item.$id)
		self.activeData = { item, filter, elem: this }
		self.removeBlankPill()
		self.resetGrpHighlights(this, filter)
		self.dom.controlsTip.showunder(this)
	}

	self.resetGrpHighlights = function(elem, filter) {
		const cls = elem.className
		const grpAction = cls.includes('join') || cls.includes('negate') || cls.includes('paren')
		const menuRows = self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		menuRows.filter(d => d.action == 'edit' || d.action == 'replace').style('display', grpAction ? 'none' : 'table-row')
		menuRows
			.filter(d => d.action == 'join')
			.style(
				'display',
				(filter.$id == self.filter.$id && filter.lst.length == 1) || cls.includes('negate') || cls.includes('paren')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(grpAction ? filter.join.toUpperCase() : filter.join == 'and' ? 'OR' : 'AND')

		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (grpAction) {
			if (cls.includes('join')) elem.parentNode.parentNode.style.backgroundColor = '#ee5'
			else elem.parentNode.style.backgroundColor = '#ee5'
		}
	}

	self.handleMenuOptionClick = function(d) {
		event.stopPropagation()
		if (d == self.activeData.menuOpt) return
		self.activeData.menuOpt = d
		if (self.activeData.elem.className.includes('join') && d.action !== 'join') {
			self.activeData.item = self.activeData.filter
			self.activeData.filter = self.findParent(self.filter, self.activeData.item)
		}
		self.resetBlankPill(d.action)
		self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		d.handler(this, d)
	}

	self.resetBlankPill = function(action) {
		// clear any currently highlighted blank pill/parenthesis
		self.removeBlankPill()
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (action != 'join') return
		const elem = self.activeData.elem.className.includes('join_label')
			? self.activeData.elem.parentNode.parentNode
			: self.activeData.item.type == 'tvs' || self.activeData.filter === self.filter
			? self.activeData.elem
			: self.activeData.elem.parentNode.parentNode
		const joiner = self.activeData.elem.className.includes('join_label')
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
				.style('display', 'inline-block')
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
				.style('display', 'inline-block')
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
				.style('display', 'inline-block')
		}
	}

	self.removeBlankPill = function() {
		self.dom.holder
			.selectAll(
				'.sja_filter_blank_pill, .sja_pill_wrapper > .sja_filter_paren_open, .sja_pill_wrapper > .sja_filter_paren_close'
			)
			.remove()

		// in case of potentially root filter subnesting, may have to
		// revert the visibility of root filter group parentheses
		// that subnest existing pill + blank pill
		//if (self.filter.lst.filter(f => f.type === 'tvslst').length < 1) {
		self.dom.filterContainer
			.selectAll(
				':scope > .sja_filter_grp > .sja_filter_paren_open, :scope > .sja_filter_grp > .sja_filter_paren_close'
			)
			.style('display', 'none')
		//}
	}

	self.displayTreeNew = function(d) {
		if (self.opts.newBtn && this.className !== 'sja_filter_add_transformer' && self.filter.lst.length) return
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		self.dom.isNotInput.property('checked', !self.filter.in)
		if (self.filter.lst.length > 1) {
			self.activeData = {
				item: self.filter,
				filter: self.filter,
				elem: self.dom.filterContainer.node(), //.select(':scope > .sja_filter_grp').node()
				btn: this
			}
			self.resetBlankPill('join')
		}
		self.dom.treeTip.clear().showunder(this)

		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				nav: {
					show_tabs: false,
					activeCohort: self.nav.activeCohort
				},
				termfilter: {
					show_top_ui: false,
					filter: self.rawFilter
				},
				disable_terms: [self.activeData.item.$id]
			},
			barchart: {
				bar_click_override: tvslst => {
					const rootCopy = JSON.parse(JSON.stringify(self.filter))

					if (!rootCopy.lst.length) {
						if (tvslst.length > 1) rootCopy.join = 'and'
						rootCopy.lst.push(...tvslst.map(self.wrapInputTvs))
						self.refresh(rootCopy)
					} else if (d != 'or' && d != 'and') {
						throw 'unhandled new term(s): invalid appender join value'
					} else {
						if (!rootCopy.join) rootCopy.join = d // 'and' || 'or'

						if (rootCopy.join == d) {
							if (tvslst.length < 2 || rootCopy.join == 'and') {
								rootCopy.lst.push(...tvslst.map(self.wrapInputTvs))
							} else {
								rootCopy.push({
									type: 'tvslst',
									in: true,
									join: 'and',
									lst: tvslst.map(self.wrapInputTvs)
								})
							}
							self.refresh(rootCopy)
						} else if (d == 'and' || tvslst.length < 2) {
							self.refresh({
								type: 'tvslst',
								in: true,
								join: d,
								lst: [rootCopy, ...tvslst.map(self.wrapInputTvs)]
							})
						} else {
							self.refresh({
								type: 'tvslst',
								in: true,
								join: 'or',
								lst: [
									rootCopy,
									{
										type: 'tvslst',
										in: true,
										join: 'and',
										lst: tvslst.map(self.wrapInputTvs)
									}
								]
							})
						}
					}
				}
			}
		})
	}

	// elem: the clicked menu row option
	// d: elem.__data__
	self.displayTreeMenu = function(elem, d) {
		select(elem).style('background-color', MENU_OPTION_HIGHLIGHT_COLOR)
		self.dom.treeTip.clear().showunderoffset(elem.lastChild)
		const filter = self.activeData.filter

		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				nav: {
					show_tabs: false,
					activeCohort: self.nav.activeCohort
				},
				termfilter: {
					show_top_ui: false,
					filter: self.rawFilter,
					disable_terms: [self.activeData.item.$id]
				}
			},
			barchart: {
				bar_click_override: d.bar_click_override
					? d.bar_click_override
					: !filter.join ||
					  !filter.lst.length ||
					  (self.activeData.elem && self.activeData.elem.className.includes('join'))
					? self.appendTerm
					: 1 //self.activeData.item.type == 'tvs'
					? self.subnestFilter
					: self.editFilter
			}
		})
	}

	self.editTerm = function(elem) {
		select(elem.parentNode)
			.selectAll('tr')
			.style('background-color', self.highlightEditRow)
		const holder = self.dom.treeBody
		const item = self.activeData.item
		self.dom.isNotInput.property('checked', item.tvs.isnot)
		self.dom.treeTip.clear()
		self.pills[item.$id].showMenu(holder)
		self.dom.treeTip.showunderoffset(elem.lastChild)
	}

	self.highlightEditRow = function(d) {
		return d.action == 'edit' ? MENU_OPTION_HIGHLIGHT_COLOR : ''
	}

	self.handleNotLabelClick = function(d) {
		self.activeData = {
			item: this.__data__
		}
		self.negateClause()
	}

	self.negateClause = function() {
		//const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const item = self.findItem(rootCopy, self.activeData.item.$id)
		if (item.type == 'tvslst') item.in = !item.in
		else item.tvs.isnot = !item.tvs.isnot
		self.refresh(rootCopy)
	}

	self.replaceTerm = tvslst => {
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.splice(i, 1, ...tvslst.map(self.wrapInputTvs))
		} else {
			filterCopy.lst[i] = {
				// transform from tvs to tvslst
				in: !self.dom.isNotInput.property('checked'),
				type: 'tvslst',
				join: 'and',
				lst: tvslst.map(self.wrapInputTvs)
			}
		}
		self.refresh(rootCopy)
	}

	self.appendTerm = tvslst => {
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.push(...tvslst.map(self.wrapInputTvs))
		} else {
			filterCopy.lst.push({
				// transform from tvs to tvslst
				in: !self.dom.isNotInput.property('checked'),
				type: 'tvslst',
				join: 'and',
				lst: tvslst.map(self.wrapInputTvs)
			})
		}
		self.refresh(rootCopy)
	}

	self.subnestFilter = tvslst => {
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		// transform from tvs to tvslst
		filterCopy.lst[i] = {
			in: !self.dom.isNotInput.property('checked'),
			type: 'tvslst',
			join: filter.join == 'or' ? 'and' : 'or',
			lst: [item, ...tvslst.map(self.wrapInputTvs)]
		}
		self.refresh(rootCopy)
	}

	self.editFilter = tvslst => {
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findParent(rootCopy, filter.$id)
		if (filterCopy == rootCopy) {
			self.refresh({
				type: 'tvslst',
				in: !self.dom.isNotInput.property('checked'),
				join: filter.join == 'or' ? 'and' : 'or',
				lst: [filterCopy, ...tvslst.map(self.wrapInputTvs)]
			})
		} else {
			filterCopy.lst.push(...tvslst.map(self.wrapInputTvs))
			self.refresh(rootCopy)
		}
	}

	self.removeTransform = function() {
		const t = event.target.__data__
		const item = t.action || typeof t !== 'object' ? self.activeData.item : self.findItem(self.filter, t.$id)
		const filter = self.findParent(self.filter, item.$id) //self.activeData.filter
		if (item == filter) {
			self.refresh(getWrappedTvslst([], '', item.$id))
			return
		}
		const i = filter.lst.findIndex(t => t.$id === item.$id)
		if (i == -1) return
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		filterCopy.lst.splice(i, 1)
		if (filterCopy.lst.length === 1) {
			const parent = self.findParent(rootCopy, filterCopy.$id)
			if (filterCopy.lst[0].type == 'tvslst') {
				if (parent == rootCopy) self.refresh(filterCopy.lst[0])
				else {
					const j = parent.lst.findIndex(t => t.$id == filterCopy.$id)
					if (filterCopy.lst[0].join == parent.join) {
						parent.lst.splice(j, 1, ...filterCopy.lst[0].lst)
						self.refresh(rootCopy)
					} else {
						parent.lst[j] = filterCopy.lst[0]
						self.refresh(rootCopy)
					}
				}
			} else {
				filterCopy.join = ''
				const j = parent.lst.findIndex(t => t.$id === filterCopy.$id)
				parent.lst[j] = filterCopy.lst[0]
				if (!filterCopy.in) {
					parent.lst[j].tvs.isnot = !parent.lst[j].tvs.isnot
					if (parent == rootCopy) parent.in = true
				}
				self.refresh(rootCopy)
			}
		} else {
			self.refresh(rootCopy)
		}
	}

	self.findItem = function(item, $id) {
		if (item.$id === $id) return item
		if (item.type !== 'tvslst') return
		for (const subitem of item.lst) {
			const matchingItem = self.findItem(subitem, $id)
			if (matchingItem) return matchingItem
		}
	}

	self.findParent = function(parent, $id) {
		if (parent.$id === $id) return parent
		if (!parent.lst) return
		for (const item of parent.lst) {
			if (item.$id === $id) return parent
			else if (item.type == 'tvslst') {
				const matchingParent = self.findParent(item, $id)
				if (matchingParent) return matchingParent
			}
		}
	}

	self.wrapInputTvs = function(tvs) {
		tvs.isnot = self.dom.isNotInput.property('checked')
		return { type: 'tvs', tvs }
	}
}

/***********************
 Utilities
*************************/

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
function getNormalRoot(rawFilter) {
	if (!rawFilter) return getWrappedTvslst([])
	const filter = JSON.parse(JSON.stringify(rawFilter))
	const processedFilter = normalizeFilter(filter)
	return processedFilter.type == 'tvslst' ? processedFilter : getWrappedTvslst([processedFilter])
}

exports.getNormalRoot = getNormalRoot

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
function normalizeProps(filter) {
	delete filter.$id
	if (filter.type == 'tvslst') {
		for (const item of filter.lst) {
			normalizeProps(item)
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
function filterJoin(lst) {
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

exports.filterJoin = filterJoin
