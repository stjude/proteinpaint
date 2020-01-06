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

class filterGlance {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }
		this.lastId = 0
		this.categoryData = {}
		this.pills = {}
		setRenderers(this)
		this.initUI()

		this.api = {
			main: async _filter => {
				const filter = JSON.parse(JSON.stringify(_filter))
				this.validateFilter(filter)
				this.filter = filter
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

exports.filterGlanceInit = rx.getInitFxn(filterGlance)

function setRenderers(self) {
	self.initUI = function() {
		//console.log(45,self.opts)
		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')
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
			.style('min-width', '250px')
			.each(self.addGrp)
	}

	self.addGrp = function(item, i) {
		const filter = this.parentNode.__data__

		select(this)
			//.style('padding', '5px 5px 5px 0')
			.style('display', 'inline-block')

		select(this)
			.append('span')
			.attr('class', 'sja_filter_paren')
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
			.attr('class', 'sja_filter_paren')
			.html(')')
			.style('display', filter === self.filter ? 'none' : 'inline')
			.style('font-weight', 500)
			.style('font-size', '20px')
	}

	self.updateGrp = function(item, i) {
		const filter = item.type == 'tvslst' ? item : this.parentNode.__data__
		select(this)
			.selectAll('.sja_filter_paren')
			.style('display', filter === self.filter ? 'none' : 'inline')

		const data = item.type == 'tvslst' ? item.lst : [item]
		const pills = select(this)
			.selectAll(':scope > .sja_filter_item')
			.data(data, self.getId)

		pills.exit().each(self.removeItem)
		pills.each(self.updateItem)
		pills
			.enter()
			.append('div') //, ':scope > .sja_filter_lst_appender')
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

	self.updateLstAppender = function(d) {
		const filter = this.parentNode.__data__
		d.filter = filter
		select(this)
			.style('display', !filter.join || d.join === filter.join ? 'inline-block' : 'none')
			.html(d.label)
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
