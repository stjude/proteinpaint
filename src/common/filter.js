import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

/*
recursive filter:
{
  type: 'tvslst'
  $in: BOOL
  $join: "and"/"or"
  $lst: []
}

where $lst can contain anothe filter thus recursive


*/

const type_tvslst = 'tvslst'
const type_tvs = 'tvs'

class filterUI {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.dom = {
			holder: opts.holder,
			tip: new Menu({ padding: '5px' })
		}
		this.durations = { exit: 500 }
		this.lastId = 0

		setRenderers(this)
		setInteractivity(this)

		this.initUI()
		this.pills = {}

		this.api = {
			main: async filter => {
				this.filter = JSON.parse(JSON.stringify(filter))
				this.updateUI()
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		this.genome = o.genome
		this.dslabel = o.dslabel
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
	/*
	copyTvsLst() {
		const lst = JSON.parse(JSON.stringify(this.tvslst))
		this.tvslst.forEach((grp, i) => {
			lst[i].id = grp.id
		})
		return lst
	}
	*/
}

exports.filterInit = rx.getInitFxn(filterUI)

function setRenderers(self) {
	self.initUI = function() {
		// always visible border to wrap the moving parts
		self.dom.borderWrap = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_pill_grp')
			.style('border', 'solid 1px #ccc')
			.style('border-radius', '6px')
			.style('margin', '5px')

		// only visible when filter is empty
		self.dom.toggle_emptyAdd = self.dom.borderWrap
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('margin', '5px')
			.style('padding', '4px 20px')
			.style('border-radius', '6px')
			.text('+ NEW')
			.on('click', self.displayTreeMenu) // TODO
		// only visible when filter is not empty
		self.dom.toggle_glanceDiv = self.dom.borderWrap.append('div').on('click', self.displayMenu)
	}

	self.updateUI = function() {
		if (self.filter.lst.length == 0) {
			// empty filter
			self.dom.toggle_emptyAdd.style('display', 'block')
			self.dom.toggle_glanceDiv.style('display', 'none')
			return
		}
		self.dom.toggle_emptyAdd.style('display', 'none')
		self.dom.toggle_glanceDiv.style('display', 'block')

		self.dom.toggle_glanceDiv.text('something here')
		// recurse on self.filter.lst[] to render ui
	}

	self.recurse_menu = opts => {
		/*
		recursive function,
		recurse on filter.lst to make menu components

		.filter: a node of self.filter
		.idxlst: list of array indice tracking .filter within self.filter
		.holder
		*/
		const { filter, holder, idxlst, parentNode } = opts
		if (filter.lst.length > 1) {
			holder.style('border', 'dashed 1px #ccc').style('padding', '10px')
		}

		for (const [i, item] of filter.lst.entries()) {
			const row = holder.append('div')
			const thisidxlst = JSON.parse(JSON.stringify(idxlst))
			thisidxlst.push(i)

			if (item.type == type_tvslst) {
				self.recurse_menu({
					filter: item,
					holder: row,
					idxlst: thisidxlst,
					parentNode: filter
				})
				continue
			}
			if (item.type == type_tvs) {
				self.tvs_printrow({
					i,
					filter,
					row,
					idxlst: thisidxlst,
					parentNode
				})
				continue
			}
			throw 'unknown type ' + item.type
		}
	}
	self.tvs_printrow = opts => {
		/* for a tvs, print a row with pill and buttons

		i: index of filter.lst[] of this tvs
		filter: from which to get the tvs
		row: <div>
		idxlst: for tvs; the last element is i
		*/

		const { i, filter, row, idxlst, parentNode } = opts
		row.style('position', 'relative').style('padding-right', '150px')

		const pill = TVSInit({
			genome: self.genome,
			dslabel: self.dslabel,
			holder: row,
			debug: self.opts.debug,
			// TODO disable delete in tvs menu
			callback: tvs2 => {
				// simply replace
				filter.lst[i].tvs = tvs2[0]
			}
		})
		pill.main(filter.lst[i].tvs)

		const btndiv = row
			.append('div')
			.style('position', 'absolute')
			.style('right', '0px')
			.style('top', '5px')
		btndiv
			.append('span')
			.text('+' + (filter.join == 'and' ? 'OR' : 'AND'))
			.attr('class', 'sja_clbtext')
			.style('font-size', '.8em')
			.on('click', () => {
				self.filter_extend_leaf(filter, i)
			})
		btndiv
			.append('span')
			.text('REMOVE')
			.attr('class', 'sja_clbtext')
			.style('font-size', '.8em')
			.style('color', '#AB7A81')
			.style('margin-left', '10px')
			.on('click', () => {
				self.filter_remove_leaf(filter, i, idxlst)
			})
	}
}

function setInteractivity(self) {
	self.displayMenu = function() {
		self.dom.tip.clear().showunder(self.dom.toggle_glanceDiv.node())
		if (self.filter.lst.length == 0) {
			// empty, show tree
			// TODO label as adding to self.filter.lst[]
			self.displayTreeMenu()
			return
		}

		const d = self.dom.tip.d.append('div').style('margin', '10px')

		self.recurse_menu({
			holder: d.append('div'),
			filter: self.filter,
			idxlst: [],
			parentNode: null
		})

		const row = d.append('div').style('margin-top', '20px')
		// both "+AND +OR"
		const btn_and = row
			.append('div')
			.attr('class', 'sja_menuoption clickbtn_bottom_and')
			.style('display', 'inline-block')
			.style('padding', '5px 20px')
			.style('border-radius', '15px')
			.text('+ AND')
			.on('click', self.clickbtn_bottom_and)
		const btn_or = row
			.append('div')
			.attr('class', 'sja_menuoption clickbtn_bottom_or')
			.style('display', 'inline-block')
			.style('margin-left', '10px')
			.style('padding', '5px 20px')
			.style('border-radius', '15px')
			.text('+ OR')
			.on('click', self.clickbtn_bottom_or)
	}
	self.displayTreeMenu = function(holder) {
		// TODO old
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
	self.clickbtn_bottom_and = function() {}
	self.clickbtn_bottom_or = function() {}
	self.filter_extend_leaf = (filter, i) => {
		/*
		launch tree, select a tvs2
		and extend a leaf tvs at filter.lst[i] into a list
		
		filter: a level/node of self.filter
		i: array index of filter.lst[]
		*/
		self.dom.tip.clear()
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel
			},
			barchart: {
				bar_click_override: tvslst => {
					self.dom.tip.hide()
					const tvs = filter.lst[i]
					filter.lst[i] = {
						type: type_tvslst,
						in: true,
						join: filter.join == 'and' ? 'or' : 'and',
						lst: [tvs, { type: type_tvs, tvs: tvslst[0] }]
					}
					self.opts.callback(self.filter)
				}
			}
		})
	}
	self.filter_remove_leaf = (filter, i, idxlst) => {
		/*
		to remove the leaf tvs at filter.lst[i]

		filter: a node of self.filter
		i: array index of filter.lst[] for the to-be-deleted tvs
		idxlst: tracking tvs from self.filter
		*/
		filter.lst.splice(i, 1)
		if (filter.lst.length > 1) {
			// still 2 or more items left
			return
		}
		if (filter.lst.length == 0) {
			throw 'should not happen'
			// to deal with it
		}
		// only one item left in filter.lst
	}
}
