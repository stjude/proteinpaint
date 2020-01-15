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
			main: async _filter => {
				const filter = JSON.parse(JSON.stringify(_filter))
				this.validateFilter(filter)
				this.filter = filter
				this.resetActiveData(filter)
				this.dom.newBtn.style('display', filter.lst.length == 0 ? 'inline-block' : 'none')
				this.updateUI(this.dom.filterContainer, filter)
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		//if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
	validateFilter(item, ancestry = []) {
		item.ancestry = ancestry
		// for reliably binding data to DOM elements
		// and associating updated data copy to
		// the currently bound data
		if (!('$id' in item)) item.$id = this.lastId++
		else if (this.lastId < item.$id) this.lastId = item.$id + 1

		if (!('type' in item)) throw 'missing filter.type'
		if (item.type != 'tvs' && item.type != 'tvslst') throw 'invalid filter.type'
		if (item.type != 'tvslst') return
		if (!Array.isArray(item.lst)) throw 'invalid or missing filter.lst[]'
		if (!item.lst.length) item.in = true
		for (const [i, subitem] of item.lst.entries()) {
			this.validateFilter(subitem, [{ $id: item.$id, in: item.in }, ...ancestry])
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
			this.dom.controlsTip.d
				.selectAll('tr')
				.filter(d => d.action == 'negate')
				.selectAll('td:nth-child(2)')
				.each(this.setNegateToggles)
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
			.style('background-color', '#ececec')
			.style('cursor', 'pointer')
			.on('click', self.displayTreeNew)

		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')

		self.dom.table = self.dom.controlsTip
			.clear()
			.d.append('table')
			.style('border-collapse', 'collapse')

		self.dom.table
			.selectAll('tr')
			.data([
				{ action: 'edit', html: ['', 'Edit', '&#9658;'], handler: self.editTerm },
				{ action: 'replace', html: ['', 'Replace', '&#9658;'], bar_click_override: self.replaceTerm },
				{ action: 'join-and', html: ['&#10010;', '', '&#9658;'] },
				{ action: 'join-or', html: ['&#10010;', '', '&#9658;'] },
				{ action: 'negate', html: ['', '', ''], handler: self.negateClause },
				{ action: 'remove', html: ['&#10006;', '', ''], handler: self.removeTransform }
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
	}

	self.setNegateToggles = function(d) {
		if (!self.activeData) return
		const item = self.activeData.item
		const data = [{ $id: item.$id, in: 'in' in item ? item.in : item.tvs.isnot }]
		if (self.filter.lst.length > 1) data.push(...item.ancestry)
		const spans = select(this)
			.selectAll('span')
			.data(data)
		spans.exit().remove()
		spans
			.enter()
			.append('span')
			.style('margin', '3px 3px 1px 0')
			.style('padding', '1px 3px')
			.style('border', '1px solid #ccc')

		select(this)
			.selectAll('span')
			.style('color', d => {
				if (d.$id === item.$id) return item.tvs.isnot ? '#fff' : '#000'
				else return !d.in ? '#fff' : '#000'
			})
			.style('background', d => {
				if (d.$id === item.$id) return item.tvs.isnot ? 'rgb(104,0,0)' : 'transparent'
				else return !d.in ? 'rgb(104,0,0)' : 'transparent'
			})
			.style('font-weight', d => (d.$id == item.$id ? '400' : '600'))
			.html(d => (d.$id == item.$id ? 'Negate' : ')'))
	}

	self.setRemoveBtns = function(d) {
		if (!self.activeData) return
		const item = self.activeData.item
		const data = [{ $id: item.$id }]
		if (self.filter.lst.length > 1) data.push(...item.ancestry)
		const spans = select(this)
			.selectAll('span')
			.data(data)
		spans.exit().remove()
		spans
			.enter()
			.append('span')
			.style('margin', '1px 3px 1px 0')
			.style('padding', '1px 3px')
			.style('border', '1px solid #ccc')

		select(this)
			.selectAll('span')
			.style('font-weight', d => (d.$id == item.$id ? '400' : '600'))
			.html(d => (d.$id == item.$id ? 'Remove' : ')'))
	}

	self.setJoinBtns = function(d) {
		if (!self.activeData) return
		const join = this.parentNode.__data__.action.split('-')[1]
		const joiner = join.toUpperCase()
		const filter = self.activeData.filter
		const data = [joiner]
		if (filter.join !== join && self.filter.lst.length > 1) data.push(')', joiner)
		const spans = select(this)
			.selectAll('span')
			.data(data)
		spans
			.exit()
			.on('click', null)
			.remove()
		spans
			.enter()
			.append('span')
			.style('margin', '1px 3px 1px 0')
			.style('padding', '1px 3px')

		select(this)
			.selectAll('span')
			.html(d => d)
			.style('border', (d, i) => (d == joiner ? '1px solid #ccc' : 'none'))
			.style('font-weight', d => (d === ')' ? '600' : '400'))
			.style('background-color', 'transparent')
			.style('color', '#000')
			.on('click', self.setActiveJoinSpan)
	}

	self.setActiveJoinSpan = function(d, i) {
		self.activeData.spanD = d
		self.activeData.spanI = i < 2 ? 0 : 2
		select(this.parentNode)
			.selectAll('span')
			.style('background-color', (s, j) => (i == j && i !== 1 ? 'rgb(57, 108, 152)' : 'transparent'))
			.style('color', (s, j) => (i == j && i !== 1 ? '#fff' : '#000'))
	}

	self.updateUI = function(container, filter) {
		const pills = container
			.datum(filter)
			.style('display', !filter.lst || !filter.lst.length ? 'none' : 'inline-block')
			.selectAll(':scope > .sja_filter_grp')
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
			.append('span')
			.attr('class', 'sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline')
			.style('color', 'rgb(102,0,0)')
			.style('font-weight', 500)
			.html('NOT')

		select(this)
			.append('span')
			.attr('class', 'sja_filter_paren_open')
			.html('(')
			.style('display', filter === self.filter && filter.in ? 'none' : 'inline')
			.style('font-weight', 500)
			.style('font-size', '20px')

		const pills = select(this)
			.selectAll(':scope > .sja_filter_item')
			.data(item.type == 'tvslst' ? item.lst : [item], self.getId)

		pills
			.enter()
			.append('div')
			.attr('class', 'sja_filter_item')
			.each(self.addItem)

		select(this)
			.append('span')
			.attr('class', 'sja_filter_paren_close')
			.html(')')
			.style('display', filter === self.filter && filter.in ? 'none' : 'inline')
			.style('font-weight', 500)
			.style('font-size', '20px')
	}

	self.updateGrp = function(item, i) {
		const filter = this.parentNode.__data__

		select(this)
			.select(':scope > .sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline')

		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style('display', filter !== self.filter || !filter.in ? 'inline' : 'none')

		const data = item.type == 'tvslst' ? item.lst : [item]
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
				self.opts.callback(rootCopy)
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
			.html(filter.lst.length < 2 ? '' : filter.join == 'and' ? 'AND' : 'OR')
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
		self.activeData = { item, filter }

		const rows = self.dom.controlsTip.d.selectAll('tr').style('background-color', 'transparent')
		rows
			.filter(d => d.action == 'negate')
			.selectAll('td:nth-child(2)')
			.each(self.setNegateToggles)
		rows
			.filter(d => d.action == 'remove')
			.selectAll('td:nth-child(2)')
			.each(self.setRemoveBtns)
		self.restyleMenuBtns(rows)
		self.dom.controlsTip.showunder(this)
	}

	self.handleMenuOptionClick = function(d) {
		if (d == self.activeData.menuOpt) return
		self.activeData.menuOpt = d

		const rows = self.dom.controlsTip.d.selectAll('tr').style('background-color', 'transparent')
		if (event.target.tagName.toUpperCase() == 'TD') {
			this.firstChild.nextSibling.firstChild.click()
		} else if (!d.action.startsWith('join-')) {
			delete self.activeData.spanD
			delete self.activeData.spanI
			self.restyleMenuBtns(rows)
		}

		if (d.bar_click_override || !d.handler) {
			self.displayTreeMenu.call(this, d)
		} else {
			d.handler(this)
		}
	}

	self.restyleMenuBtns = function(rows) {
		rows
			.filter(d => d.action == 'join-and')
			.selectAll('td:nth-child(2)')
			.each(self.setJoinBtns)
		rows
			.filter(d => d.action == 'join-or')
			.selectAll('td:nth-child(2)')
			.each(self.setJoinBtns)
	}

	self.displayTreeNew = function(d) {
		self.dom.isNotInput.property('checked', self.activeData.item.tvs && self.activeData.item.tvs.isnot)
		self.dom.treeTip.clear().showunder(this)
		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
				}
			},
			barchart: {
				bar_click_override: tvslst => {
					self.dom.controlsTip.hide()
					self.dom.treeTip.hide()
					const rootCopy = JSON.parse(JSON.stringify(self.filter))
					rootCopy.lst.push(...tvslst.map(self.wrapTvs))
					self.opts.callback(rootCopy)
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
			.filter(d => d.action.startsWith('join-'))
			.selectAll('td > span')
			.style('background-color', function(spanD) {
				return spanD === self.activeData.spanD ? this.style.backgroundColor : 'transparent'
			})
			.style('color', function(spanD) {
				return spanD === self.activeData.spanD ? this.style.color : '#000'
			})

		self.dom.treeTip.clear().showunderoffset(this.lastChild)
		self.activeData.joiner = d.action.split('-')[1]
		const filter = self.activeData.filter

		appInit(null, {
			holder: self.dom.treeBody,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
				}
			},
			barchart: {
				bar_click_override: d.bar_click_override
					? d.bar_click_override
					: self.activeData.joiner == filter.join || !filter.join || !filter.lst.length
					? self.appendTerm
					: self.activeData.spanI === 0
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

	self.negateClause = function(d) {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const t =
			event.target.tagName.toUpperCase() == 'SPAN'
				? event.target.__data__
				: event.target.parentNode.firstChild.nextSibling.firstChild.__data__
		//const item = self.activeData.item
		//const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const item = self.findItem(rootCopy, t.$id)
		if (t.$id == item.$id) {
			if (item.type == 'tvslst') item.in = !item.in
			else item.tvs.isnot = !item.tvs.isnot
		} else {
			item.in = !item.in
		}
		self.opts.callback(rootCopy)
	}

	self.replaceTerm = tvslst => {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		filterCopy.lst[i] =
			tvslst.length < 2
				? self.wrapTvs(tvslst[0])
				: {
						// transform from tvs to tvslst
						in: true,
						type: 'tvslst',
						join: joiner,
						lst: [item, ...tvslst.map(self.wrapTvs)]
				  }
		self.opts.callback(rootCopy)
	}

	self.appendTerm = tvslst => {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		filterCopy.lst.push(...tvslst.map(self.wrapTvs))
		if (!filterCopy.join) {
			filterCopy.join = self.activeData.joiner
		}
		self.opts.callback(rootCopy)
	}

	self.subnestFilter = tvslst => {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		// transform from tvs to tvslst
		filterCopy.lst[i] = {
			in: true,
			type: 'tvslst',
			join: self.activeData.joiner,
			lst: [item, ...tvslst.map(self.wrapTvs)]
		}
		self.opts.callback(rootCopy)
	}

	self.editFilter = tvslst => {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const item = self.activeData.item
		const filter = self.activeData.filter
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findParent(rootCopy, filter.$id)
		if (filterCopy == rootCopy && filterCopy.join != self.activeData.spanD.toLowerCase()) {
			self.opts.callback({
				type: 'tvslst',
				in: true,
				join: filter.join == 'or' ? 'and' : 'or',
				lst: [filterCopy, ...tvslst.map(self.wrapTvs)]
			})
		} else {
			filterCopy.lst.push(...tvslst.map(self.wrapTvs))
			self.opts.callback(rootCopy)
		}
	}

	self.removeTransform = function() {
		self.dom.controlsTip.hide()
		self.dom.treeTip.hide()
		const t = event.target.__data__
		const item = t.action || typeof t !== 'object' ? self.activeData.item : self.findItem(self.filter, t.$id)
		const filter = self.findParent(self.filter, item.$id) //self.activeData.filter
		if (item == filter) {
			self.opts.callback({
				type: 'tvslst',
				in: true,
				join: '',
				lst: []
			})
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
				if (parent == rootCopy) self.opts.callback(filterCopy.lst[0])
				else {
					const j = parent.lst.findIndex(t => t.$id == filterCopy.$id)
					if (filterCopy.lst[0].join == parent.join) {
						parent.lst.splice(j, 1, ...filterCopy.lst[0].lst)
						self.opts.callback(rootCopy)
					} else {
						parent.lst[j] = filterCopy.lst[0]
						self.opts.callback(rootCopy)
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
				self.opts.callback(rootCopy)
			}
		} else {
			self.opts.callback(rootCopy)
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
}
