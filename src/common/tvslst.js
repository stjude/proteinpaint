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
			main: async tvslst => {
				this.tvslst = tvslst
				this.updateUI()
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
	copyTvsLst() {
		const lst = JSON.parse(JSON.stringify(this.tvslst))
		this.tvslst.forEach((grp, i) => {
			lst[i].id = grp.id
		})
		return lst
	}
}

exports.TvsLstInit = rx.getInitFxn(TvsLstUi)

function setRenderers(self) {
	self.initUI = function() {
		//console.log(45,self.opts)
		self.dom.pillGrpDiv = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_pill_grp')
			//.style('border', '1px solid #aaa')
			.style('margin', '5px')
			.style('padding', '5px')

		// button to add new term
		self.dom.grpAdderDiv = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_grp_btn')
			.style('padding', '4px 6px 2px 6px')
			.style('display', 'block')
			.style('margin', '7px')
			.style('border-radius', '6px')
			.style('color', '#000')
			.style('background-color', '#EEEEEE')
			.html(self.opts.adderLabel || '+ OR')
			.on('click', self.displayTreeMenu)
	}

	self.updateUI = function() {
		//console.log(60, self.tvslst)
		//self.dom.grpAdderDiv.style('display', !self.tvslst.length ? 'block' : 'none')
		self.dom.pillGrpDiv.style('display', !self.tvslst.length ? 'none' : 'block')

		const pills = self.dom.pillGrpDiv.selectAll('.tvs_pill_grp').data(self.tvslst, grp => grp.id)

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

	self.removePillGrp = function(terms) {
		//console.log(72, terms.id, this)
		select(this).remove()
		for (const term of terms) {
			delete self.pills[self.getPillId(terms.id, term.term.id)]
		}
	}

	self.updatePillGrp = function(terms) {
		//console.log(97, terms.id, terms, this)
		const pills = select(this)
			.select('.sja_filter_grp_terms')
			.selectAll('.tvs_pill_wrapper')
			.data(terms, term => term.term.id)

		pills.exit().each(self.removePill)

		pills.each(self.updatePillTerm)

		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_wrapper')
			.each(self.addPillTerm)
	}

	self.addPillGrp = function(terms, i) {
		const grpJoinDiv = select(this)
			.append('div')
			.attr('class', 'sja_filter_grp_join_label')
			.html(self.tvslst.length > 1 && i > 0 ? 'OR' : '')

		const pills = select(this)
			.append('div')
			.attr('class', 'sja_filter_grp_terms')
			.style('padding', '5px 5px 5px 0')
			.style('border', '1px solid #aaa')
			.selectAll('.tvs_pill_wrapper')
			.data(terms)

		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_wrapper')
			.each(self.addPillTerm)
	}

	self.addPillTerm = function(term, i) {
		const terms = this.parentNode.parentNode.__data__
		const holder = select(this)
			.style('position', 'relative')
			.append('div')
			.attr('class', 'tvs_pill_term_div')

		holder
			.append('div')
			.attr('class', 'tvs_pill_term_remover')
			.html('X')
			.style('float', 'right')
			.style('padding', '3px 3px')
			.style('background-color', 'rgba(255,100,100,0.5)')
			.style('font-weight', 500)
			.style('cursor', 'pointer')
			.on('click', self.removeTerm)

		select(this)
			.append('div')
			.attr('class', 'sja_filter_term_join_label')
			.style('margin-left', '10px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.html(terms.indexOf(term) < terms.length - 1 ? 'AND' : '+ AND')
			.style('background-color', self.grpJoinLabelBgColor)
			.on('click', self.displayTreeMenu)

		const pill = TVSInit({
			genome: self.genome,
			dslabel: self.dslabel,
			holder,
			debug: self.opts.debug,
			callback: new_term => {
				const lst = self.copyTvsLst()
				// the pill term is replaced in each dispatch cycle.
				// so cannot use the closured addPillTerm(argument) as term
				const term = pill.getTerm()
				const i = self.tvslst.findIndex(grp => grp.indexOf(term) != -1)
				if (i == -1) return
				const grp = lst[i]
				const j = self.tvslst[i].indexOf(term)
				if (!new_term) {
					// remove term
					grp.splice(j, 1)
					if (!grp.length) lst.splice(lst.indexOf(grp), 1)
				} else {
					// replace term
					grp[j] = new_term
				}
				self.opts.callback(lst)
			}
		})
		const id = self.getPillId(terms.id, term.term.id)
		self.pills[id] = pill
		pill.main(term)
	}

	self.updatePillTerm = function(term, i) {
		const terms = this.parentNode.parentNode.__data__
		select(this)
			.select('.sja_filter_term_join_label')
			.html(terms.indexOf(term) < terms.length - 1 ? 'AND' : '+ AND')
			.style('background-color', self.grpJoinLabelBgColor)

		const id = self.getPillId(terms.id, term.term.id)
		if (!self.pills[id]) return
		self.pills[id].main(term)
	}

	self.removePill = function(term) {
		const terms = this.parentNode.parentNode.__data__
		const id = self.getPillId(terms.id, term.term.id)
		delete self.pills[id]
		select(this).remove()
	}

	self.removeTerm = function(term) {
		const terms = this.parentNode.parentNode.parentNode.__data__
		const grpId = terms.id
		const i = terms.findIndex(t => t.term.id === term.term.id)
		if (i == -1) return
		const lst = self.copyTvsLst()
		const grp = lst.find(grp => grp.id == grpId)
		grp.splice(i, 1)
		if (!grp.length) lst.splice(lst.indexOf(grp), 1)
		self.opts.callback(lst)
	}

	self.getPillId = function(termsId, termId) {
		return termsId + '-' + termId
	}

	self.grpJoinLabelBgColor = function() {
		return this.innerHTML == 'AND' ? 'transparent' : '#ececec'
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = function(holder) {
		//console.log(holder, this)
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
					const lst = self.copyTvsLst()
					if (filterHolder.className.includes('sja_filter_term_join_label')) {
						const id = filterHolder.parentNode.parentNode.__data__.id
						const grp = lst.find(grp => grp.id == id)
						grp.push(tvslst[0])
					} else {
						lst.push(tvslst)
					}
					self.opts.callback(lst)
				}
			}
		})
	}
}
