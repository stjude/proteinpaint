import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

class TvsLstUi {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }
		this.lastId = 0

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}
		this.initUI()
		this.pills = {}

		this.api = {
			main: async filter => {
				this.setId(filter)
				this.filter = filter
				console.log(28, this.filter)
				this.dom.grpAdderDiv.datum(filter).style('display', !filter.$lst || !filter.$lst.length ? 'block' : 'none')
				this.updateUI(this.dom.filterContainer, filter)
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
	setId(item) {
		if (!('$id' in item)) item.$id = this.lastId++
		else if (this.lastId < item.$id) this.lastId = item.$id + 1
		if (!item.$lst) return
		for (const [i, subitem] of item.$lst.entries()) {
			this.setId(subitem)
		}
	}
	getId(item) {
		return item.$id
	}
}

exports.TvsLstInit = rx.getInitFxn(TvsLstUi)

function setRenderers(self) {
	self.initUI = function() {
		//console.log(45,self.opts)
		self.dom.filterContainer = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_container')
			//.style('border', '1px solid #ccc')
			.style('margin', '5px')
			.style('padding', '5px')

		// button to add new term
		self.dom.grpAdderDiv = self.dom.holder
			.append('div')
			.attr('class', 'sja_new_filter_btn')
			.style('padding', '4px 6px 2px 6px')
			.style('display', 'block')
			.style('margin', '7px')
			.style('border-radius', '6px')
			.style('text-align', 'center')
			.style('color', '#000')
			.style('background-color', '#EEEEEE')
			.style('cursor', 'pointer')
			.html('+NEW')
			.on('click', self.displayTreeMenu)
	}

	self.updateUI = function(container, filter) {
		const pills = container
			.datum(filter)
			.style('display', !filter.$lst || !filter.$lst.length ? 'none' : 'block')
			.selectAll(':scope > .tvs_pill_grp')
			.data([filter], self.getId)

		pills.exit().each(self.removePillGrp)
		pills.each(self.updatePillGrp)
		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_grp')
			.style('margin', '5px')
			.style('min-width', '250px')
			.each(self.addPillGrp)
	}

	self.addPillGrp = function(item, i) {
		const filter = this.parentNode.__data__
		console.log(123, item, filter)

		const pills = select(this)
			.style('border', item.$lst && filter !== self.filter ? '1px solid #ccc' : 'none')
			//.append('div')
			//.attr('class', 'sja_filter_grp_terms')
			.style('padding', '5px 5px 5px 0')
			.selectAll(':scope > .tvs_pill_wrapper')
			.data(item.$lst ? item.$lst : [item], self.getId)

		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_wrapper')
			.each(self.addPillTerm)

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
			.style('background-color', self.grpJoinLabelBgColor)
			.on('click', self.displayTreeMenu)
			.each(self.updateFilterLstAppender)
	}

	self.updatePillGrp = function(item, i) {
		const data = item.$lst ? item.$lst : [item]
		const pills = select(this)
			.style('border', item.$lst && item.$lst.length > 1 && item !== self.filter ? '1px solid #ccc' : 'none')
			.selectAll(':scope > .tvs_pill_wrapper')
			.data(data, self.getId)

		pills.exit().each(self.removePillTerm)
		pills.each(self.updatePillTerm)
		pills
			.enter()
			.insert('div', ':scope > .sja_filter_lst_appender')
			.attr('class', 'tvs_pill_wrapper')
			.each(self.addPillTerm)

		select(this)
			.selectAll(':scope > .tvs_pill_wrapper')
			.sort((a, b) => data.indexOf(a) - data.indexOf(b))

		select(this)
			.selectAll(':scope > .sja_filter_lst_appender')
			.each(self.updateFilterLstAppender)

		const filter = item.$lst ? item : this.parentNode.__data__
		select(this)
			.selectAll(':scope > .tvs_pill_wrapper > .sja_filter_term_join_label')
			.each(self.updateFilterJoinLabel)
	}

	self.removePillGrp = function(item) {
		if (item.$lst) {
			for (const subitem of item.$lst) {
				if (subitem.$lst) self.removePillGrp(subitem)
				else {
					delete self.pills[subitem.$id]
				}
			}
		} else {
			delete self.pills[item.$id]
		}
		if (this instanceof Node) select(this).remove()
	}

	self.updateFilterLstAppender = function(d) {
		const filter = this.parentNode.__data__
		d.filter = filter

		select(this)
			.style('display', !filter.$join || d.join === filter.$join ? 'inline-block' : 'none')
			.html(d.label)
	}

	self.addPillTerm = function(item, i) {
		const filter = this.parentNode.__data__

		if (item.$lst) {
			console.log(168, item)
			self.updateUI(select(this), item)
			self.addFilterJoinLabel(this, filter, item)
			return
		}

		// holder for blue pill
		const holder = select(this)
			.style('white-space', 'nowrap')
			.append('div')
			.attr('class', 'tvs_pill_term_div')
			.style('display', 'inline-block')

		// to add a new tvs in a subgroup
		select(this)
			.append('div')
			.attr('class', 'tvs_pill_term_adder')
			.style('display', filter.$lst.length > 1 ? 'inline-block' : 'none')
			//.style('width', '50px')
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.html(filter.$join == 'and' ? '+OR' : '+AND')
			//.style('background-color', self.grpJoinLabelBgColor)
			.on('click', self.displayTreeMenu)

		// to remove
		select(this)
			.append('div')
			.attr('class', 'tvs_pill_term_remover')
			.html('REMOVE')
			.style('display', 'inline-block')
			.style('margin', '3px')
			.style('padding', '3px 3px')
			.style('color', 'rgba(255,100,100,0.8)')
			//.style('font-weight', 500)
			.style('cursor', 'pointer')
			.on('click', self.removeTerm)

		self.addFilterJoinLabel(this, filter, item)

		const pill = TVSInit({
			genome: self.genome,
			dslabel: self.dslabel,
			holder,
			debug: self.opts.debug,
			callback: new_term => {
				// const filter = self.copyTvsLst(filter)
				// the pill term is replaced with a copy in each dispatch cycle,
				// so cannot use the closured addPillTerm(argument) as term
				// const term = pill.getTerm()
				const i = filter.$lst.findIndex(grp => grp.indexOf(item) != -1)
				if (i == -1) return
				const grp = lst[i]
				const j = filter.$lst[i].indexOf(item)
				if (!new_term) {
					// remove term
					grp.splice(j, 1)
					if (!grp.length) lst.splice(lst.indexOf(grp), 1)
				} else {
					// replace term
					grp[j] = new_term
				}
				console.log(213, lst)
				self.opts.callback(lst)
			}
		})
		self.pills[item.$id] = pill
		pill.main(item)
	}

	self.updatePillTerm = function(item, i) {
		if (item.$lst) {
			console.log(256, item)
			self.updateUI(select(this), item)
		} else {
			const tvs = self.pills[item.$id].getTerm()
			const filter = this.parentNode.__data__

			select(this)
				.select('.tvs_pill_term_adder')
				.style('display', filter.$lst.length > 1 ? 'inline-block' : 'none')
				.html(filter.$join == 'and' ? '+OR' : '+AND')

			select(this)
				.select('.sja_filter_term_join_label')
				.style('display', filter.$lst.indexOf(item) < filter.$lst.length - 1 ? 'block' : 'none')
				.html(filter.$join == 'and' ? 'AND' : 'OR')

			if (!self.pills[item.$id]) return
			self.pills[item.$id].main(tvs)
		}
	}

	self.removePillTerm = function(term) {
		console.log(283, '$id==', term.$id)
		const terms = this.parentNode.parentNode.__data__
		delete self.pills[term.$id]
		select(this).remove()
	}

	self.removeTerm = function(tvs) {
		const filter = this.parentNode.parentNode.__data__
		const i = filter.$lst.findIndex(t => t.$id === tvs.$id)
		if (i == -1) return
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		filterCopy.$lst.splice(i, 1)
		if (filterCopy.$lst.length == 1) {
			if (filterCopy.$lst[0].$lst) {
				self.opts.callback(filterCopy.$lst[0])
			} else {
				filterCopy.$join = ''
				const parent = rootCopy === filterCopy ? rootCopy : self.findParent(rootCopy, filterCopy.$id)
				//if (!parent) return
				const j = parent.$lst.findIndex(t => t.$id === tvs.$id)
				parent.$lst[j] = filterCopy.$lst[0]
				self.opts.callback(rootCopy)
			}
		} else {
			self.opts.callback(rootCopy)
		}
	}

	self.addFilterJoinLabel = function(elem, filter, item) {
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_term_join_label')
			.style(
				'display',
				filter.$lst.length > 1 && item && filter.$lst.indexOf(item) < filter.$lst.length - 1 ? 'block' : 'none'
			)
			.style('width', '50px')
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('cursor', 'pointer')
			.html(filter.$lst.length < 2 ? '' : filter.$join == 'and' ? 'AND' : 'OR')
	}

	self.updateFilterJoinLabel = function(item) {
		const filter = this.parentNode.parentNode.parentNode.__data__
		const i = filter.$lst.findIndex(d => d.$id === item.$id)
		select(this).style(
			'display',
			filter.$lst.length > 1 && item && i != -1 && i < filter.$lst.length - 1 ? 'block' : 'none'
		)
	}

	self.grpJoinLabelBgColor = function() {
		return this.innerHTML == 'AND' ? 'transparent' : '#ececec'
	}

	self.findItem = function(item, $id) {
		if (item.$id === $id) return item
		if (!item.$lst) return
		for (const subitem of item.$lst) {
			const matchingItem = self.findItem(subitem, $id)
			if (matchingItem) return matchingItem
		}
	}

	self.findParent = function(parent, $id) {
		if (!parent.$lst) return
		for (const item of parent.$lst) {
			if (item.$id === $id) return parent
			else if (item.$lst) {
				const matchingParent = self.findParent(item, $id)
				if (matchingParent) return matchingParent
			}
		}
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = function(d) {
		self.dom.tip.clear().showunder(this instanceof Node ? this : self.dom.grpAdderDiv.node())
		const filter =
			'$lst' in d
				? d
				: 'filter' in d
				? d.filter
				: this.className == 'sja_filter_lst_appender'
				? this.parentNode.__data_
				: this.__data__
		console.log(352, d, this.className, filter)

		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
				}
			},
			modifiers: {
				//modifier to replace filter by clicking term btn
				tvs_select: tvs => {
					self.replaceFilter({ term: tvs })
				}
			},
			barchart: {
				bar_click_override:
					this.className == 'sja_filter_lst_appender'
						? tvslst => {
								console.log(406)
								self.dom.tip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								console.log(410, filterCopy, rootCopy)
								filterCopy.$lst.push(...tvslst)
								if (!filterCopy.$join) {
									filterCopy.$join = filter.$join ? filter.$join : d.join
									console.log(414, filterCopy.$join)
								}
								console.log(416, filterCopy, rootCopy)
								self.opts.callback(rootCopy)
						  }
						: this.className == 'tvs_pill_term_adder'
						? tvslst => {
								self.dom.tip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const parent = self.findParent(rootCopy, filter.$id)
								const i = parent.$lst.findIndex(f => f.$id === d.$id)
								parent.$lst[i] = {
									$join: this.innerHTML === '+OR' ? 'or' : 'and',
									$lst: [filter, ...tvslst]
								}
								console.log(429, i, filter, d, parent, rootCopy)
								self.opts.callback(rootCopy)
						  }
						: tvslst => {
								console.log(433)
								self.dom.tip.hide()
								const rootCopy = JSON.parse(JSON.stringify(self.filter))
								const filterCopy = self.findItem(rootCopy, filter.$id)
								filterCopy.$lst.push(...tvslst)
								if (!filterCopy.$join) {
									filterCopy.$join = filter.$join ? filter.$join : d.join
									console.log(439, filterCopy.$join)
								}
								console.log(441, filterCopy, rootCopy)
								self.opts.callback(rootCopy)
						  }
			}
		})
	}
}
