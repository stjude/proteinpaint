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
				offsetY: -25
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
				console.log(filter)
				this.filter = filter
				// clear menu click
				this.activeData = { item: {}, filter: {} }
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
	validateFilter(item) {
		// for reliably binding data to DOM elements
		// and associating updated data copy to
		// the currently bound data
		if (!('$id' in item)) item.$id = this.lastId++
		else if (this.lastId < item.$id) this.lastId = item.$id + 1

		if (!('type' in item)) throw 'missing filter.type'
		if (item.type != 'tvs' && item.type != 'tvslst') throw 'invalid filter.type'
		if (item.type != 'tvslst') return
		for (const [i, subitem] of item.lst.entries()) {
			this.validateFilter(subitem)
		}
	}
	getId(item) {
		return item.$id
	}
}

exports.filterInit = rx.getInitFxn(Filter)

function setRenderers(self) {
	self.initUI = function() {
		//console.log(45,self.opts)
		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')

		self.dom.table = self.dom.controlsTip
			.clear()
			.d.append('table')
			.style('border-collapse', 'collapse')
		self.dom.table
			.selectAll('tr')
			.data([
				{ action: 'edit', html: ['Edit', '&#9658;'] },
				{ action: 'replace', html: ['Replace', '&#9658;'] },
				{ action: 'join-and', html: ['+AND', '&#9658;'] },
				{ action: 'join-or', html: ['+OR', '&#9658;'] },
				{ action: 'remove', html: ['Remove', '&#10006'] }
			])
			.enter()
			.append('tr')
			.on('click', self.displayTreeMenu)
			.selectAll('td')
			.data(d => d.html)
			.enter()
			.append('td')
			.style('padding', '1px 5px')
			.style('color', d => (d == '&#10006' ? '#a00' : '#111'))
			.style('cursor', 'pointer')
			.html(d => d)
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
			.attr('class', 'sja_filter_paren_open')
			.html('(')
			.style('display', filter === self.filter ? 'none' : 'inline')
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
			.style('display', filter === self.filter ? 'none' : 'inline')
			.style('font-weight', 500)
			.style('font-size', '20px')
	}

	self.updateGrp = function(item, i) {
		const filter = item.type == 'tvslst' ? item : this.parentNode.__data__
		select(this)
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.style('display', filter === self.filter ? 'none' : 'inline')

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
		if (this instanceof Node) select(this).remove()
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
				filterCopy.lst[i] = { $id: item.$id, type: 'tvs', tvs }
				self.opts.callback(rootCopy)
			}
		})
		self.pills[item.$id] = pill
		pill.main(item.tvs)

		if (self.opts.mode == 'active') {
			// mask
			holder
				.append('div')
				.attr('class', 'sja_filter_div_mask')
				.style('position', 'absolute')
				.style('top', 0)
				.style('left', 0)
				.style('width', holder.style('width'))
				.style('height', '100%')
				.on('click', self.displayControlsMenu)
		}
	}

	self.updateItem = function(item, i) {
		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
		} else {
			//const tvs = self.pills[item.$id].getTerm()
			const filter = this.parentNode.__data__

			select(this)
				.select(':scope > .sja_filter_join_label')
				.style('display', filter.lst.indexOf(item) < filter.lst.length - 1 ? 'inline-block' : 'none')
				.html(filter.join == 'and' ? 'AND' : 'OR')

			if (!self.pills[item.$id]) return
			self.pills[item.$id].main(item.tvs)
		}
	}

	self.removeItem = function(item) {
		delete self.pills[item.$id]
		select(this).remove()
	}

	self.addJoinLabel = function(elem, filter, item) {
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_join_label')
			.style('display', filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1 ? 'inline-block' : 'none')
			.style('width', '50px')
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('cursor', 'pointer')
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
		const item = this.parentNode.__data__
		const filter = self.findParent(self.filter, item.$id)
		console.log(263, item, filter)
		self.activeData = { item, filter }
		self.dom.controlsTip.d.selectAll('tr').style('background-color', 'transparent')
		self.dom.controlsTip.showunder(this)
	}

	self.displayTreeMenu = function(d) {
		console.log(339, d, self.activeData, this)
		const thisRow = this
		select(this.parentNode)
			.selectAll('tr')
			.style('background-color', function() {
				return this == thisRow ? '#eeee55' : 'transparent'
			})

		if (d.action == 'remove') {
			self.removeTransform(self.activeData.item)
			self.dom.controlsTip.hide()
			return
		}
		if (d.action == 'edit') {
			self.dom.treeTip
				.clear()
				.d.append('div')
				.html('**** TODO ****')
			self.dom.treeTip.showunderoffset(this.lastChild)
			return
		}

		self.dom.treeTip.clear().showunderoffset(this.lastChild)
		const item = self.activeData.item
		const filter = self.activeData.filter
		const joiner = d.action.split('-')[1]
		console.log(322, joiner, filter.join, self.activeData)

		appInit(null, {
			holder: self.dom.treeTip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
				}
			},
			barchart: {
				bar_click_override:
					d.action == 'replace'
						? tvslst => {
								self.dom.controlsTip.hide()
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
								console.log(354, i, item, filterCopy)
								// transform from tvs to tvslst
								filterCopy.lst[i] =
									tvslst.length < 2
										? self.wrapTvs(tvslst[0])
										: {
												type: 'tvslst',
												join: joiner,
												lst: [item, ...tvslst.map(self.wrapTvs)]
										  }
								self.opts.callback(rootCopy)
						  }
						: joiner && (!filter.join || filter.join == joiner)
						? tvslst => {
								console.log(366)
								self.dom.controlsTip.hide()
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								filterCopy.lst.push(...tvslst.map(self.wrapTvs))
								if (!filterCopy.join) {
									filterCopy.join = joiner
								}
								self.opts.callback(rootCopy)
						  }
						: joiner
						? tvslst => {
								console.log(347)
								self.dom.controlsTip.hide()
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
								console.log(354, i, item, filterCopy)
								// transform from tvs to tvslst
								filterCopy.lst[i] = {
									type: 'tvslst',
									join: joiner,
									lst: [item, ...tvslst.map(self.wrapTvs)]
								}
								self.opts.callback(rootCopy)
						  }
						: tvslst => {
								console.log(360)
								self.dom.controlsTip.hide()
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								filterCopy.lst.push(...tvslst.map(self.wrapTvs))
								if (!filterCopy.join) {
									filterCopy.join = filter.join ? filter.join : d.join
								}
								self.opts.callback(rootCopy)
						  }
			}
		})
	}

	self.removeTransform = function(item) {
		const filter = self.activeData.filter
		const i = filter.lst.findIndex(t => t.$id === item.$id)
		if (i == -1) return
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		filterCopy.lst.splice(i, 1)
		if (filterCopy.lst.length === 1) {
			if (filterCopy.lst[0].lst) {
				self.opts.callback(filterCopy.lst[0])
			} else {
				filterCopy.join = ''
				const parent = rootCopy === filterCopy ? rootCopy : self.findParent(rootCopy, filterCopy.$id)
				//if (!parent) return
				const j = parent.lst.findIndex(t => t.$id === filterCopy.$id)
				parent.lst[j] = filterCopy.lst[0]
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
		return { type: 'tvs', tvs }
	}
}
