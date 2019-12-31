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
				this.dom.grpAdderDiv.style('display', !filter.$lst || !filter.$lst.length ? 'block' : 'none')
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
			.html('+NEW')
			.on('click', self.displayTreeMenu)
	}

	self.updateUI = function(container, filter) {
		const pills = container
			.datum(filter)
			.style('display', !filter.$lst || !filter.$lst.length ? 'none' : 'block')
			.selectAll('.tvs_pill_grp')
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
			.append('div')
			.attr('class', 'sja_filter_grp_terms')
			.style('padding', '5px 5px 5px 0')
			.selectAll('.tvs_pill_wrapper')
			.data(item.$lst ? item.$lst : [item], self.getId)

		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_wrapper')
			.each(self.addPillTerm)

		select(this)
			.append('div')
			.selectAll('.sja_filter_lst_appender')
			.data([{ label: '+AND', join: 'and' }, { label: '+OR', join: 'or' }])
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
		const pills = select(this)
			.style('border', item.$lst && item.$lst.length > 1 ? '1px solid #ccc' : 'none')
			.selectAll('.tvs_pill_wrapper')
			.data(item.$lst ? item.$lst : [item], self.getId)

		pills.exit().each(self.removePillTerm)
		pills.each(self.updatePillTerm)
		pills.enter().each(self.addPillTerm)
	}

	self.removePillGrp = function(item) {
		console.log(97, item)
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

		select(this)
			.style('display', !filter.$join || d.join === filter.$join ? 'inline-block' : 'none')
			.html(d.label)
	}

	self.addPillTerm = function(item, i) {
		if (item.$lst) {
			console.log(168, item)
			self.updateUI(select(this), item)
			return
		}

		const filter = this.parentNode.__data__
		// holder for blue pill
		const holder = select(this)
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
		//
		select(this)
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
			//.style('background-color', self.grpJoinLabelBgColor)
			.on('click', self.displayTreeMenu)

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
			const joiner = filter.$join == 'and' ? 'OR' : 'AND'
			select(this)
				.select('.tvs_pill_term_adder')
				.html('+' + joiner)
			//.style('background-color', self.grpJoinLabelBgColor)

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
		console.log(280, 'removeTerm', tvs.$id, filter)
		const i = filter.$lst.findIndex(t => t.$id === tvs.$id)
		if (i == -1) return
		console.log(282, i)
		const rootCopy = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = self.findItem(rootCopy, filter.$id)
		filterCopy.$lst.splice(i, 1)
		console.log(287, JSON.parse(JSON.stringify(filterCopy.$lst)))
		if (filterCopy.$lst.length == 1) {
			const parent = rootCopy === filterCopy ? rootCopy : self.findParent(rootCopy, filterCopy.$id)
			//if (!parent) return
			const j = parent.$lst.findIndex(t => t.$id === tvs.$id)
			parent.$lst[j] = filterCopy.$lst[0]
			console.log(290, console.log(parent))
		}
		self.opts.callback(rootCopy)
	}

	self.getPillId = function(termsId, termId) {
		return termsId + '-' + termId
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
	self.displayTreeMenu = function(holder) {
		console.log(264, this.innerHTML)
		const filterHolder = holder instanceof Node ? holder || self.dom.holder.node() : this
		self.dom.tip.clear().showunder(filterHolder)
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
				bar_click_override: tvslst => {
					//console.log(187, tvslst, filterHolder.__data__)
					self.dom.tip.hide()
					console.log(self.filter)
					const copy = self.copyTvsLst(self.filter)
					console.log(copy)
					if (filterHolder.className.includes('sja_filter_term_join_label')) {
						const id = filterHolder.parentNode.parentNode.__data__.id
						const grp = copy.$lst.find(grp => grp.id == id)
						grp.push(tvslst[0])
					} else {
						copy.$lst.push(tvslst)
					}
					console.log(293, copy)
					self.opts.callback(copy.$lst)
				}
			}
		})
	}
}
