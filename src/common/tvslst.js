import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

class TvsLst {
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
			main: async grps => {
				this.grps = grps
				this.updateUI()
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'object') throw '.callback{} is not an object'
		if (typeof o.callback.addGrp != 'function') throw '.callback.addGrp() is not a function'
		if (typeof o.callback.addTerm != 'function') throw '.callback.addTerm() is not a function'
		return o
	}
}

exports.TvsLstInit = rx.getInitFxn(TvsLst)

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
		//console.log(60, self.grps)
		//self.dom.grpAdderDiv.style('display', !self.grps.length ? 'block' : 'none')
		self.dom.pillGrpDiv.style('display', !self.grps.length ? 'none' : 'block')

		const pills = self.dom.pillGrpDiv.selectAll('.tvs_pill_grp').data(self.grps, terms => terms.id)

		pills.exit().each(self.removePillGrp)
		pills.each(self.updatePillGrp)
		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_grp')
			.style('margin', '5px')
			.style('width', '250px')
			.each(self.addPillGrp)
	}

	self.removePillGrp = function(terms) {
		//console.log(72, terms.id)
		select(this).remove()
		for (const term of terms) {
			const id = terms.id + '-' + term.id
			delete self.pills[id]
		}
	}

	self.updatePillGrp = function(terms) {
		//console.log(80, terms, this)
		const pills = select(this)
			.select('.sja_filter_grp_terms')
			.selectAll('.tvs_pill_wrapper')
			.data(terms, term => terms.id + '-' + term.id)

		pills.exit().each(function(term) {
			const id = terms.id + '-' + term.id
			delete self.pills[id]
			select(this).remove()
		})

		pills.each(function(term, i) {
			//console.log(104, terms.indexOf(term), terms.length-1, term.term.id)
			select(this)
				.select('.sja_filter_term_join_label')
				.html(terms.indexOf(term) < terms.length - 1 ? 'AND' : '+ AND')
				.style('background-color', self.grpJoinLabelBgColor)

			const id = terms.id + '-' + term.id
			if (!self.pills[id]) return
			self.pills[id].main(term)
		})

		pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill_wrapper')
			.each(function(term, i) {
				const holder = select(this.parentNode)
					.append('div')
					.attr('class', 'tvs_pill_term_div')

				select(this.parentNode)
					.append('div')
					.attr('class', '.sja_filter_term_join_label')
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
					callback: self.opts.callback
				})
				pill.main(term)
				const id = terms.id + '-' + term.id
				self.pills[id] = pill
			})
	}

	self.addPillGrp = function(terms, i) {
		//console.log(91, terms.id)
		const grpJoinDiv = select(this)
			.append('div')
			.attr('class', 'sja_filter_grp_join_label')
			.html(self.grps.length > 1 && i > 0 ? 'OR' : '')

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
			.each(function(term, i) {
				//console.log(97, this, term)
				const holder = select(this)
					.append('div')
					.attr('class', 'tvs_pill_term_div')
				select(this)
					.append('div')
					.attr('class', 'sja_filter_term_join_label')
					.style('margin-left', '10px')
					.style('border', 'none')
					.style('border-radius', '5px')
					.html(i < terms.length - 1 ? 'AND' : '+ AND')
					.style('background-color', self.grpJoinLabelBgColor)
					.on('click', self.displayTreeMenu)

				const pill = TVSInit({
					genome: self.genome,
					dslabel: self.dslabel,
					holder,
					debug: self.opts.debug,
					callback: self.opts.callback
				})
				pill.main(term)
				const id = terms.id + '-' + term.id
				self.pills[id] = pill
			})
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

					if (filterHolder.className.includes('sja_filter_term_join_label')) {
						const id = filterHolder.parentNode.parentNode.__data__.id
						self.opts.callback.addTerm({
							id,
							term: tvslst[0]
						})
					} else {
						self.opts.callback.addGrp({
							term: tvslst[0]
						})
					}
				}
			}
		})
	}
}
