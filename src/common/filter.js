import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

/*
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
		this.dom = {
			holder: opts.holder,
			controlsTip: new Menu({ padding: '5px' }),
			treeTip: new Menu({
				padding: '5px',
				offsetX: 35,
				offsetY: -30,
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
			main: async rawFilter => {
				/*
				rawFilter{}
				  the raw filter data structure
				*/

				// to-do: should use deepEquals as part of rx.core
				const rawCopy = JSON.stringify(rawFilter)
				if (this.rawCopy == rawCopy) return
				this.rawCopy = rawCopy
				this.rawFilter = JSON.parse(this.rawCopy)
				this.validateFilter(this.rawFilter)

				this.filter = this.opts.getVisibleRoot ? this.opts.getVisibleRoot(this.rawFilter) : this.rawFilter
				this.resetActiveData(this.filter)

				this.dom.newBtn.style('display', this.filter.lst.length == 0 ? 'inline-block' : 'none')
				this.dom.holder.selectAll('.sja_filter_blank_pill').remove()
				this.updateUI(this.dom.filterContainer, this.filter)
				this.dom.holder
					.selectAll('.sja_filter_add_transformer')
					.style('display', d => (this.filter.lst.length > 0 && this.filter.join !== d ? 'inline-block' : 'none'))
				this.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
			},
			getNormalRoot: this.getNormalRoot
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
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
		if (rawParent.$id === this.filter.$id) {
			this.api.main(filter)
			this.opts.callback(this.filter)
		} else {
			const i = rawParent.lst.findIndex(f => f.$id == this.filter.$id)
			rawParent.lst[i] = filter
			this.api.main(rawParent)
			this.opts.callback(this.filter)
		}
	}
	getWrappedTvslst($id, lst = []) {
		return {
			$id,
			type: 'tvslst',
			in: true,
			join: '',
			lst
		}
	}
	getId(item) {
		return item.$id
	}
}

exports.filterInit = rx.getInitFxn(Filter)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.newBtn = self.dom.holder
			.append('div')
			.attr('class', 'sja_new_filter_btn')
			.html('+NEW')
			.style('display', 'inline-block')
			.style('margin', '2px 10px 2px 2px')
			.style('padding', '5px')
			.style('border-radius', '5px')
			//.style('background-color', '#ececec')
			.style('cursor', 'pointer')
			.on('click', self.displayTreeNew)

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
				{ action: 'edit', html: ['', 'Edit', '&#9658;'], handler: self.editTerm },
				{ action: 'replace', html: ['', 'Replace', '&#9658;'], bar_click_override: self.replaceTerm },
				{ action: 'join', html: ['&#10010;', '', '&#9658;'] },
				{ action: 'negate', html: ['', 'Negate', ''], handler: self.negateClause },
				{ action: 'remove', html: ['&#10006;', 'Remove', ''], handler: self.removeTransform }
			])
			.enter()
			.append('tr')
			.on('click', self.handleMenuOptionClick)
			.selectAll('td')
			.data(d => d.html)
			.enter()
			.append('td')
			.style('padding', function(d, i) {
				return i === 0 ? '1px' : !d ? '3px 5px' : '1px 5px'
			})
			.style('color', (d, i) => (d == '&#10006;' ? '#a00' : i === 0 ? '#0a0' : '#111'))
			.style('opacity', (d, i) => (i === 0 ? 0.8 : 1))
			.style('cursor', 'pointer')
			.html(d => d)

		self.dom.treeHead = self.dom.treeTip.d
			.append('div')
			.attr('class', 'sja_tree_tip_head')
			.style('padding', '3px')
		//.style('background-color', '#eee')
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

		select('body').on('mousedown.sja_filter', () => {
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
			self.dom.holder.selectAll('.sja_filter_blank_pill').remove()
		})
	}

	self.updateUI = function(container, filter) {
		container.datum(filter).style('display', !filter.lst || !filter.lst.length ? 'none' : 'inline-block')

		const pills = container.selectAll(':scope > .sja_filter_grp').data([filter], self.getId)

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
		pill.main(item.tvs)
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
			self.pills[item.$id].main(item.tvs)
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

		const grpAction =
			this.className.includes('join') || this.className.includes('negate') || this.className.includes('paren')
		const rows = self.dom.controlsTip.d.selectAll('tr').style('background-color', 'transparent')

		rows.filter(d => d.action == 'edit' || d.action == 'replace').style('display', grpAction ? 'none' : 'table-row')

		const joiner = grpAction ? filter.join.toUpperCase() : filter.join == 'and' ? 'OR' : 'AND'
		rows
			.filter(d => d.action == 'join')
			.style(
				'display',
				(filter.$id == self.filter.$id && filter.lst.length == 1) ||
					this.className.includes('negate') ||
					this.className.includes('paren')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(joiner)

		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (grpAction) {
			if (this.className.includes('join')) this.parentNode.parentNode.style.backgroundColor = '#ee5'
			else this.parentNode.style.backgroundColor = '#ee5'
		}
		self.dom.controlsTip.showunder(this)
	}

	self.displayBlankPill = function(parentDiv, joiner) {
		self.dom.holder.selectAll('.sja_filter_blank_pill').remove()
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')

		const blank = select(parentDiv)
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
	}

	self.handleMenuOptionClick = function(d) {
		event.stopPropagation()
		if (d == self.activeData.menuOpt) return
		self.activeData.menuOpt = d
		if (self.activeData.elem.className.includes('join') && d.action !== 'join') {
			self.activeData.item = self.activeData.filter
			self.activeData.filter = self.findParent(self.filter, self.activeData.item)
		}
		if (d.action === 'join') {
			const elem =
				self.activeData.item.type == 'tvs'
					? self.activeData.elem.parentNode.parentNode
					: self.activeData.elem.parentNode.parentNode
			self.displayBlankPill(elem, self.activeData.filter.join.toUpperCase())
		} else {
			self.dom.holder.selectAll('.sja_filter_blank_pill').remove()
		}

		const rows = self.dom.controlsTip.d.selectAll('tr').style('background-color', 'transparent')
		if (d.bar_click_override || !d.handler) {
			self.displayTreeMenu.call(this, d)
		} else {
			d.handler(this)
		}
	}

	self.displayTreeNew = function(d) {
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		self.dom.isNotInput.property('checked', self.activeData.item.tvs && self.activeData.item.tvs.isnot)
		self.dom.treeTip.clear().showunder(this)
		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false,
					filter: self.getNormalRoot(self.rawFilter)
				},
				disable_terms: [self.activeData.item.$id]
			},
			barchart: {
				bar_click_override: tvslst => {
					const rootCopy = JSON.parse(JSON.stringify(self.filter))

					if (!rootCopy.lst.length) {
						if (tvslst.length > 1) rootCopy.join = 'and'
						rootCopy.lst.push(...tvslst.map(self.wrapTvs))
						self.refresh(rootCopy)
					} else if (d != 'or' && d != 'and') {
						throw 'unhandled new term(s): invalid appender join value'
					} else {
						if (!rootCopy.join) rootCopy.join = d // 'and' || 'or'

						if (rootCopy.join == d) {
							if (tvslst.length < 2 || rootCopy.join == 'and') {
								rootCopy.lst.push(...tvslst.map(self.wrapTvs))
							} else {
								rootCopy.push({
									type: 'tvslst',
									in: true,
									join: 'and',
									lst: tvslst.map(self.wrapTvs)
								})
							}
							self.refresh(rootCopy)
						} else if (d == 'and' || tvslst.length < 2) {
							self.refresh({
								type: 'tvslst',
								in: true,
								join: d,
								lst: [rootCopy, ...tvslst.map(self.wrapTvs)]
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
										lst: tvslst.map(self.wrapTvs)
									}
								]
							})
						}
					}
				}
			}
		})
	}

	self.displayTreeMenu = function(d) {
		//console.log(553, d, self.activeData, this)
		const thisRow = this
		select(this.parentNode)
			.selectAll('tr')
			.style('background-color', function() {
				return this == thisRow ? '#eeee55' : 'transparent'
			})

		self.dom.treeTip.clear().showunderoffset(this.lastChild)
		const filter = self.activeData.filter

		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false,
					filter: self.getNormalRoot(self.rawFilter),
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
		self.pills[item.$id].showMenu(item.tvs, holder)
		self.dom.treeTip.showunderoffset(elem.lastChild)
	}

	self.highlightEditRow = function(d) {
		return d.action == 'edit' ? '#eeee55' : 'transparent'
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
			filterCopy.lst.splice(i, 1, ...tvslst.map(self.wrapTvs))
		} else {
			filterCopy.lst[i] = {
				// transform from tvs to tvslst
				in: !self.dom.isNotInput.property('checked'),
				type: 'tvslst',
				join: 'and',
				lst: tvslst.map(self.wrapTvs)
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
			filterCopy.lst.push(...tvslst.map(self.wrapTvs))
		} else {
			filterCopy.lst.push({
				// transform from tvs to tvslst
				in: !self.dom.isNotInput.property('checked'),
				type: 'tvslst',
				join: 'and',
				lst: tvslst.map(self.wrapTvs)
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
			lst: [item, ...tvslst.map(self.wrapTvs)]
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
				lst: [filterCopy, ...tvslst.map(self.wrapTvs)]
			})
		} else {
			filterCopy.lst.push(...tvslst.map(self.wrapTvs))
			self.refresh(rootCopy)
		}
	}

	self.removeTransform = function() {
		const t = event.target.__data__
		const item = t.action || typeof t !== 'object' ? self.activeData.item : self.findItem(self.filter, t.$id)
		const filter = self.findParent(self.filter, item.$id) //self.activeData.filter
		if (item == filter) {
			self.refresh(self.getWrappedTvslst(item.$id, []))
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

	self.wrapTvs = function(tvs) {
		tvs.isnot = self.dom.isNotInput.property('checked')
		return { type: 'tvs', tvs }
	}

	/*
		get valid filter data to be used for server requests
		will use normalizeFilter recursively as needed

		.filter{} the raw filter root
	*/
	self.getNormalRoot = _filter => {
		const filter = JSON.parse(JSON.stringify(_filter ? _filter : self.rawFilter))
		return self.normalizeFilter(filter)
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
	self.normalizeFilter = function(filter) {
		delete filter.$id
		const lst = filter.lst
			// keep non-tvslst entries or tvslst with non-empty lst.length
			.filter(f => f.type !== 'tvslst' || f.lst.length > 0)
			// do not reformat an entry unless it is a tvslst with only one entry,
			// in which case just return that filter's first lst entry instead
			// of the filter itself
			.map(f => (f.type !== 'tvslst' || f.lst.length > 1 ? f : f.lst[0]))

		lst.forEach(self.normalizeProps)

		if (!lst.length) {
			// return a default empty filter = {type: 'tvslst', lst:[], ...}
			return self.getWrappedTvslst(filter.$id, [])
		} else if (lst.length == 1) {
			// return the only lst entry after normalizing
			if (lst[0].type === 'tvslst') {
				return self.normalizeFilter(lst[0])
			} else {
				return self.normalizeProps(lst[0])
			}
		} else {
			// reset and fill-in filter.lst with normalized entries
			filter.lst = []
			for (const item of lst) {
				if (item.type === 'tvslst') {
					const normalItem = self.normalizeFilter(item)
					if (normalItem.type !== 'tvslst' || normalItem.lst.length) {
						filter.lst.push(normalItem)
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
	self.normalizeProps = filter => {
		delete filter.$id
		if (filter.type == 'tvslst') {
			for (const item of filter.lst) {
				self.normalizeProps(item)
			}
		}
	}
}

/* join a list of filters into the first filter with "and", return joined filter
to be used by caller app to join hidden filters into a visible filter

lst:[]
  a list of filters
  the function returns a (modified) copy of the first filter, and will not modify it
  rest of the array will be joined to the first one under "and"
overrides:{}
	optional filter key-values to apply to the root-level of all of the items in the lst[] argument
	example: {visibility: 'hidden'}
*/
function filterJoin(lst, overrides = {}) {
	if (!lst || lst.length == 0) return
	let f1 = JSON.parse(JSON.stringify(lst[0]))
	if (lst.length == 1) return f1
	// more than 1 item, will join
	if (f1.join == 'or') {
		// f1 is "or", wrap it with another root layer of "and"
		f1 = {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [f1]
		}
	} else if (f1.join == '') {
		// f1 is single-tvs
		f1 = {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [f1.lst[0]]
		}
	}
	// now, f1.join should be "and"
	for (let i = 1; i < lst.length; i++) {
		const f = lst[i]
		// need to handle potentially frozen f object
		const ff = Object.assign({}, f, overrides)
		if (ff.join == 'and') {
			f1.lst.push(...ff.lst.map(d => Object.assign(d, overrides)))
		} else if (f.join == 'or') {
			f1.lst.push(ff)
		} else {
			const item = Object.assign(ff.lst[0], overrides)
			f1.lst.push(item)
		}
	}
	return f1
}

exports.filterJoin = filterJoin
