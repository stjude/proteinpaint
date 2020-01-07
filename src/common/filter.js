import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import { filterGlanceInit } from '../common/filterGlance'
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
		this.dom = { holder: opts.holder }
		this.durations = { exit: 500 }
		this.lastId = 0
		this.categoryData = {}
		this.pills = {}

		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		this.api = {
			main: async _filter => {
				this.dom.controlsTip.hide()
				const filter = JSON.parse(JSON.stringify(_filter))
				this.validateFilter(filter)
				this.filter = filter
				//console.log(40, this.filter)
				this.dom.newFilterBtn.datum(filter).style('display', !filter.lst || !filter.lst.length ? 'inline-block' : 'none')
				this.filterGlance.main(filter)
				this.updateUI(this.dom.controlsTip.d, filter)
			},
			clickNewBtn: () => {
				this.dom.newFilterBtn.node().click()
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if (!o.btnLabel) o.btnLabel = 'Filter' // throw '.btnLabel missing'
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
		// button to add new term
		/*self.dom.mainLabel = self.dom.holder
			.datum(self.filter)
			.append('div')
			.style('display', 'inline-block')
			.style('position','relative')
			.style('margin', '7px')
			.style('padding', '4px 6px 2px 6px')
			.style('border-radius', '6px')
			.style('text-align', 'center')
			.style('color', '#000')
			.style('cursor', 'pointer')
			.html('Filter')*/
			
		self.dom.newFilterBtn = self.dom.holder
			.datum(self.filter)
			.append('div')
			.attr('class', 'sja_new_filter_btn')
			.style('display', 'inline-block')
			.style('position','relative')
			.style('margin', '7px')
			.style('padding', '4px 6px 2px 6px')
			.style('border-radius', '6px')
			.style('text-align', 'center')
			.style('color', '#000')
			.style('cursor', 'pointer')
			.style('background', '#ececec')
			.html('+NEW')
			.on('click', self.displayTreeMenu)

		self.dom.glanceHolder = self.dom.holder.append('div').style('display', 'inline-block')

		self.filterGlance = filterGlanceInit({
			genome: self.opts.genome,
			dslabel: self.opts.dslabel,
			holder: self.dom.glanceHolder,
			debug: self.opts.debug
		})

		// mask
		self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_div_mask')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('width', '100%')
			.style('height', '100%')
			.on('click', self.displayTreeOrControls)

		self.dom.controlsTip = new Menu({ padding: '5px' })
		self.dom.treeTip = new Menu({ padding: '5px' }) 
	}

	self.updateUI = function(container, filter) {
		const pills = container
			.datum(filter)
			.style('display', !filter.lst || !filter.lst.length ? 'none' : 'block')
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

		const pills = select(this)
			.style('border', item.lst && filter !== self.filter ? '1px solid #ccc' : 'none')
			//.append('div')
			//.attr('class', 'sja_filter_grp_terms')
			.style('padding', '5px 5px 5px 0')
			.selectAll(':scope > .sja_filter_item')
			.data(item.type == 'tvslst' ? item.lst : [item], self.getId)

		pills
			.enter()
			.append('div')
			.attr('class', 'sja_filter_item')
			.each(self.addItem)

		select(this)
			.selectAll(':scope > .sja_filter_lst_appender')
			.data([{ label: '+AND', join: 'and', filter }, { label: '+OR', join: 'or', filter }])
			.enter()
			.append('div')
			.attr('class', 'sja_filter_lst_appender')
			.style('width', '50px')
			.style('margin', '5px 10px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.style('background-color', '#ececec')
			.on('click', self.displayTreeMenu)
			.each(self.updateLstAppender)
	}

	self.updateGrp = function(item, i) {
		const data = item.type == 'tvslst' ? item.lst : [item]
		const pills = select(this)
			.style('border', item.type == 'tvslst' && item.lst.length > 1 && item !== self.filter ? '1px solid #ccc' : 'none')
			.selectAll(':scope > .sja_filter_item')
			.data(data, self.getId)

		pills.exit().each(self.removeItem)
		pills.each(self.updateItem)
		pills
			.enter()
			.insert('div', ':scope > .sja_filter_lst_appender')
			.attr('class', 'sja_filter_item')
			.each(self.addItem)

		select(this)
			.selectAll(':scope > .sja_filter_item')
			.sort((a, b) => data.indexOf(a) - data.indexOf(b))

		select(this)
			.selectAll(':scope > .sja_filter_lst_appender')
			.each(self.updateLstAppender)

		const filter = item.type == 'tvslst' ? item : this.parentNode.__data__
		select(this)
			.selectAll(':scope > .sja_filter_item > .sja_filter_join_label')
			.each(self.updateJoinLabel)
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
		console.log(202, d.join, filter.join, filter.lst.length)
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
			.style('white-space', 'nowrap')
			.append('div')
			.attr('class', 'sja_pill_wrapper')
			.style('display', 'inline-block')

		// button to create a new subgroup with
		// this term plus and a newly selected tree term
		select(this)
			.append('div')
			.attr('class', 'sja_filter_add_transformer')
			.style('display', filter.lst.length > 1 ? 'inline-block' : 'none')
			//.style('width', '50px')
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.style('color', 'rgba(10,10,10,0.8)')
			.html(filter.join == 'and' ? '+OR' : '+AND')
			.on('click', self.displayTreeMenu)

		// to remove an item from a lst and transform a tvslst
		// into a tvs if there is only one entry in the resulting lst
		select(this)
			.append('div')
			.attr('class', 'sja_filter_remove_transformer')
			.html('REMOVE')
			.style('display', 'inline-block')
			.style('margin', '3px')
			.style('padding', '3px 3px')
			.style('color', 'rgba(255,100,100,0.8)')
			//.style('font-weight', 500)
			.style('cursor', 'pointer')
			.on('click', self.removeTransform)

		self.addJoinLabel(this, filter, item)

		const pill = TVSInit({
			genome: self.genome,
			dslabel: self.dslabel,
			holder,
			control_holder: self.dom.holder,
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
				.select(':scope > .sja_filter_add_transformer')
				.style('display', filter.lst.length > 1 ? 'inline-block' : 'none')
				.html(filter.join == 'and' ? '+OR' : '+AND')

			select(this)
				.select(':scope > .sja_filter_join_label')
				.style('display', filter.lst.indexOf(item) < filter.lst.length - 1 ? 'block' : 'none')
				.html(filter.join == 'and' ? 'AND' : 'OR')

			if (!self.pills[item.$id]) return
			self.pills[item.$id].main(item.tvs)
		}
	}

	self.removeItem = function(item) {
		delete self.pills[item.$id]
		select(this).remove()
	}

	self.updateLstAppender = function(d) {
		const filter = this.parentNode.__data__
		d.filter = filter
		select(this)
			.style('display', !filter.join || d.join === filter.join ? 'inline-block' : 'none')
			.html(d.label)
	}

	self.addJoinLabel = function(elem, filter, item) {
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_join_label')
			.style(
				'display',
				filter.lst.length > 1 && item && filter.lst.indexOf(item) < filter.lst.length - 1 ? 'block' : 'none'
			)
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
			filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1 ? 'block' : 'none'
		)
	}
}

function setInteractivity(self) {
	self.displayTreeOrControls = function() {
		if (self.filter.lst.length) {
			self.dom.controlsTip.showunder(self.dom.glanceHolder.node())
		} else {
			self.dom.newFilterBtn.node().click()
		}
	}

	self.displayTreeMenu = function(d) {
		//console.log(339, d, this.__data__)
		self.dom.treeTip.clear().showunder(this instanceof Node ? this : self.dom.newFilterBtn.node())
		const filter =
			'lst' in d
				? d
				: 'filter' in d
				? d.filter
				: this.className == 'sja_filter_lst_appender'
				? this.parentNode.__data_
				: this.__data__

		appInit(null, {
			holder: self.dom.treeTip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
				}
			},
			/*modifiers: {
				//modifier to replace filter by clicking term btn
				// NOT NEEDED ???
				tvs_select: tvs => {
					self.replaceFilter({ term: tvs })
				}
			},*/
			barchart: {
				bar_click_override:
					this.className == 'sja_filter_lst_appender'
						? tvslst => {
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								filterCopy.lst.push(...tvslst.map(self.wrapTvs))
								if (!filterCopy.join) {
									filterCopy.join = filter.join ? filter.join : d.join
								}
								self.opts.callback(rootCopy)
						  }
						: this.className == 'sja_filter_add_transformer'
						? tvslst => {
								self.dom.treeTip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const parent = self.findParent(rootCopy, filter.$id)
								const i = parent.lst.findIndex(f => f.$id === d.$id)
								// transform from tvs to tvslst
								parent.lst[i] = {
									type: 'tvslst',
									join: this.innerHTML === '+OR' ? 'or' : 'and',
									lst: [filter, ...tvslst.map(self.wrapTvs)]
								}
								self.opts.callback(rootCopy)
						  }
						: tvslst => {
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
		const filter = this.parentNode.parentNode.__data__
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
