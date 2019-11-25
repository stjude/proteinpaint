import * as rx from '../common/rx.core'
import * as client from '../client'
import { appInit } from '../termdb/app'

/*

************** opts{} of constructor
.holder
.genome
.dslabel
.placeholder
.callback( data )
	.term{} // optional
	.q{}


************** this.api, exposed!!
.main( data )
	.term{} // optional
	.q{}
	.disable_terms
.showTree()


************** instance private properties
.opts{}
.term{}
.q{}
.disable_terms[]


************** introducing the atypical API
-- this.api{} is self-made, not generated by getComponentApi
-- api not registered in caller.components{}, not in the notify-cycle
-- no bus
-- upon init, termsetting constructor does not accept initial value of term/q
   term/q/disable_terms will only be set/updated through api.main()
-- termsetting opts.callback() will send caller updated term/q via user fiddling


************** explain behavior here:

*/

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.placeholder = opts.placeholder || 'Select term&nbsp;'

		this.dom = {
			holder: opts.holder,
			tip: new client.Menu({ padding: '0px' })
		}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		// this api will be frozen and returned by termsettingInit()
		this.api = {
			main: async (data = {}) => {
				console.log(data)
				this.validateMainData(data)
				// term is read-only if it comes from state, let it remain read-only
				this.term = data.term
				this.q = rx.fromJson(rx.toJson(data.q)) // q{} will be altered here and must not be read-only
				this.disable_terms = data.disable_terms
				this.updateUI()
			},
			showTree: this.showTree
		}
	}

	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
	validateMainData(d) {
		if (d.term) {
			// term is optional
			if (!d.term.id) throw 'data.term.id missing'
			if (!d.term.name) throw 'data.term.name missing'
		}
		if (!d.q) d.q = {}
		if (typeof d.q != 'object') throw 'data.q{} is not object'
		if (d.disable_terms) {
			if (!Array.isArray(d.disable_terms)) throw 'data.disable_terms[] is not array'
		}
	}
}

exports.termsettingInit = rx.getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		// toggle the display of pilldiv and nopilldiv with availability of this.term
		self.dom.nopilldiv = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', self.showTree)
		self.dom.pilldiv = self.dom.holder
			.append('div')
			.attr('class', 'ts_pill')
			.style('cursor', 'pointer')
			.on('click', self.showMenu)

		// nopilldiv - placeholder label
		self.dom.nopilldiv
			.append('div')
			.html(self.placeholder)
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')

		// nopilldiv - plus button
		self.dom.nopilldiv
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.text('+')

		// blue pill, TODO add the multiple segments of a pill
		self.dom.pill_termname = self.dom.pilldiv
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_filter_tag_btn ts_name_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.style('background', '#4888BF')
			.style('color', 'white')
		self.dom.pill_settingSummary = self.dom.pilldiv // this may be hidden
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_filter_tag_btn ts_summary_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('background', '#674EA7')
			.style('color', 'white')
	}

	self.updateUI = () => {
		if (!self.term) {
			// no term
			self.dom.nopilldiv.style('display', 'block')
			self.dom.pilldiv.style('display', 'none')
			return
		}
		// has term
		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const grp_summary_text =
			self.term.groupsetting &&
			self.term.groupsetting.lst &&
			self.q.groupsetting &&
			self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx].name
				: self.q.groupsetting && self.q.groupsetting.customset
				? 'Divided into ' + self.q.groupsetting.customset.groups.length + ' groups'
				: self.q.bar_by_grade
				? 'By Grade'
				: self.q.bar_by_children
				? 'By Subcondition'
				: ''

		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', 'block')
		self.dom.pill_termname
			.style('border-radius', grpsetting_flag || self.term.iscondition ? '6px 0 0 6px' : '6px')
			.html(self.term.name) // TODO trim long string
		self.dom.pill_settingSummary.style('display', grpsetting_flag || self.term.iscondition ? 'inline-block' : 'none')
		self.dom.pill_settingSummary.html(grp_summary_text)
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback(null)
	}

	self.showTree = holder => {
		self.dom.tip.clear().showunder(holder || self.dom.holder.node())
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel
			},
			tree: {
				click_term: term => {
					self.dom.tip.hide()
					const data = { id: term.id, term, q: {} }
					termsetting_fill_q(data.q, term)
					self.opts.callback(data)
				},
				disable_terms: self.disable_terms
			}
		})
	}

	self.showMenu = () => {
		self.dom.tip.clear().showunder(self.dom.holder.node())

		const term_option_div = self.dom.tip.d.append('div')
		const term_edit_div = self.dom.tip.d.append('div').style('text-align', 'center')

		const optsFxn = self.term.iscategorical
			? self.showGrpOpts
			: self.term.isfloat || self.term.isinteger
			? self.showNumOpts
			: self.term.iscondition
			? self.showConditionOpts
			: null

		term_option_div
			.append('div')
			.style('margin', '5px 2px')
			.style('text-align', 'center')

		optsFxn(term_option_div)

		term_edit_div
			.append('div')
			.attr('class', 'replace_btn sja_filter_tag_btn')
			.style('display', self.opts.disable_ReplaceRemove ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('background-color', '#74b9ff')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Replace')
			.on('click', () => {
				self.dom.tip.clear()
				self.showTree()
			})
		term_edit_div
			.append('div')
			.attr('class', 'remove_btn sja_filter_tag_btn')
			.style('display', self.opts.disable_ReplaceRemove ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('background-color', '#ff7675')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}

	self.showGrpOpts = async function(div) {
		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const predefined_group_name =
			self.term.groupsetting &&
			self.term.groupsetting.lst &&
			self.q.groupsetting &&
			self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx].name
				: ''
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values

		const active_group_info_div = div.append('div').style('margin', '10px')

		// if using predfined groupset, display name
		active_group_info_div
			.append('div')
			.style('display', grpsetting_flag && predefined_group_name ? 'block' : 'none')
			.style('font-size', '.9em')
			.style('font-weight', 'bold')
			.style('text-align', 'center')
			.style('padding-bottom', '5px')
			.html('Using ' + predefined_group_name)

		//display groups and categories assigned to that group
		if (grpsetting_flag) {
			const groupset =
				self.q.groupsetting.predefined_groupset_idx != undefined
					? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
					: self.q.groupsetting.customset || undefined

			const group_table = active_group_info_div.append('table').style('font-size', '.8em')

			for (const [i, g] of groupset.groups.entries()) {
				const group_tr = group_table.append('tr')

				//group name
				group_tr
					.append('td')
					.style('font-weight', 'bold')
					.style('vertical-align', 'top')
					.html(g.name || 'Group ' + (i + 1) + ':')

				const values_td = group_tr.append('td')

				for (const v of g.values) {
					values_td.append('div').html(values[v.key].label)
				}
			}

			//redevide groups btn
			div
				.append('div')
				.attr('class', 'group_btn sja_filter_tag_btn')
				.style('display', 'block')
				.style('padding', '7px 6px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('border-radius', '12px')
				.style('background-color', '#eee')
				.style('color', '#000')
				.html('Redivide groups')
				.on('click', () => {
					const valGrp = self.grpSet2valGrp(groupset)
					self.regroupMenu(groupset.groups.length, valGrp)
				})
		}

		const default_btn_txt =
			(!grpsetting_flag ? 'Using' : 'Use') +
			' default categories ' +
			(values ? '(n=' + Object.keys(values).length + ')' : '')

		// default overlay btn - devide to n groups (n=total)
		div
			.append('div')
			.attr('class', 'group_btn sja_filter_tag_btn')
			.style('display', 'block')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.style('background-color', !grpsetting_flag ? '#fff' : '#eee')
			.style('color', !grpsetting_flag ? '#888' : '#000')
			.style('pointer-events', !grpsetting_flag ? 'none' : 'auto')
			.text(default_btn_txt)
			.on('click', () => {
				self.q.groupsetting.inuse = false
				delete self.q.groupsetting.predefined_groupset_idx
				self.dom.tip.hide()
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
			})

		//show button/s for default groups
		if (self.term.groupsetting && self.term.groupsetting.lst) {
			for (const [i, group] of self.term.groupsetting.lst.entries()) {
				if (self.q.groupsetting.predefined_groupset_idx != i)
					div
						.append('div')
						.attr('class', 'group_btn sja_filter_tag_btn')
						.style(
							'display',
							(group.is_grade && !self.q.bar_by_grade) || (group.is_subcondition && !self.q.bar_by_children)
								? 'none'
								: 'block'
						)
						.style('padding', '7px 6px')
						.style('margin', '5px')
						.style('text-align', 'center')
						.style('font-size', '.8em')
						.style('border-radius', '13px')
						.style('background-color', '#eee')
						.style('color', '#000')
						.html('Use <b>' + group.name + '</b>')
						.on('click', () => {
							self.q.groupsetting.inuse = true
							self.q.groupsetting.predefined_groupset_idx = i
							self.dom.tip.hide()
							self.opts.callback({
								id: self.term.id,
								term: self.term,
								q: self.q
							})
						})
			}
		}

		// devide to grpups btn
		div
			.append('div')
			.attr('class', 'group_btn sja_filter_tag_btn')
			.style(
				'display',
				(self.term.groupsetting && self.term.groupsetting.disabled) || grpsetting_flag ? 'none' : 'block'
			)
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.style('background-color', '#eee')
			.style('color', '#000')
			.html('Divide <b>' + self.term.name + '</b> to groups')
			.on('click', () => {
				self.regroupMenu()
			})
	}

	self.regroupMenu = function(grp_count, temp_cat_grps) {
		//start with default 2 groups, extra groups can be added by user
		const default_grp_count = grp_count || 2
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const cat_grps = temp_cat_grps || JSON.parse(JSON.stringify(values))

		//initiate empty customset
		const customset = { groups: [] }
		Array(default_grp_count)
			.fill()
			.map(() => customset.groups.push({ values: [] }))

		self.dom.tip.clear().showunder(self.dom.holder.node())

		const regroup_div = self.dom.tip.d.append('div').style('margin', '10px')

		const group_select_div = regroup_div.append('div').style('margin', '5px')

		const group_table = group_select_div.append('table').style('border-collapse', 'collapse')
		const title_tr = group_table.append('tr')

		// top title bar for the table
		title_tr
			.append('th')
			.attr('colspan', default_grp_count + 2)
			.style('padding', '2px 5px')
			.html('Groups')

		title_tr
			.append('th')
			.style('padding', '2px 5px')
			.html('Categories')

		//this row have '+'/'-' button to add new group
		const grp_btn_tr = group_table.append('tr')

		//first group cannot be deleted
		grp_btn_tr.append('th')
		grp_btn_tr.append('th')

		for (let i = 1; i < default_grp_count; i++)
			grp_btn_tr
				.append('th')
				.append('div')
				.attr('class', 'grp_rm_btn')
				.style('padding', '2px 5px')
				.style('margin', '2px')
				.style('background-color', '#eee')
				.style('border-radius', '6px')
				.style('cursor', 'pointer')
				.html('-')
				.on('click', () => {
					for (const [key, val] of Object.entries(cat_grps)) {
						if (cat_grps[key].group == i + 1) cat_grps[key].group = 1
					}
					self.regroupMenu(default_grp_count - 1, cat_grps)
				})

		grp_btn_tr
			.append('th')
			.append('div')
			.attr('class', 'grp_add_btn')
			.style('padding', '2px 5px')
			.style('margin', '2px')
			.style('background-color', '#eee')
			.style('border-radius', '6px')
			.style('cursor', 'pointer')
			.html('+')
			.on('click', () => {
				self.regroupMenu(default_grp_count + 1, cat_grps)
			})

		// this row will have group names/number
		const group_name_tr = group_table.append('tr')

		group_name_tr
			.append('th')
			.style('padding', '2px 5px')
			.html('Exclude')

		for (let i = 0; i < default_grp_count; i++)
			group_name_tr
				.append('th')
				.style('padding', '2px 5px')
				.html(i + 1)

		// for each cateogry add new row with radio button for each group and category name
		for (const [key, val] of Object.entries(values)) {
			const cat_tr = group_table
				.append('tr')
				.on('mouseover', () => {
					cat_tr.style('background-color', '#eee')
				})
				.on('mouseout', () => {
					cat_tr.style('background-color', '#fff')
				})

			//checkbox for exclude group
			cat_tr
				.append('td')
				.attr('align', 'center')
				.style('padding', '2px 5px')
				.append('input')
				.attr('type', 'radio')
				.attr('name', key)
				.attr('value', 0)
				.property('checked', () => {
					if (cat_grps[key].group === 0) {
						// cat_grps[key].group = 0
						return true
					}
				})
				.on('click', () => {
					cat_grps[key].group = 0
				})

			// checkbox for each group
			for (let i = 0; i < default_grp_count; i++) {
				cat_tr
					.append('td')
					.attr('align', 'center')
					.style('padding', '2px 5px')
					.append('input')
					.attr('type', 'radio')
					.attr('name', key)
					.attr('value', i)
					.property('checked', () => {
						if (!cat_grps[key].group && cat_grps[key].group !== 0) {
							cat_grps[key].group = 1
							return true
						} else {
							return cat_grps[key].group == i + 1 ? true : false
						}
					})
					.on('click', () => {
						cat_grps[key].group = i + 1
					})
			}

			// extra empty column for '+' button
			cat_tr.append('td')

			// categories
			cat_tr
				.append('td')
				.style('display', 'inline-block')
				.style('margin', '2px')
				.style('cursor', 'default')
				.html(val.label)
		}

		const button_div = regroup_div
			.append('div')
			.style('text-align', 'center')
			.style('margin', '5px')

		// 'Apply' button
		button_div
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('background-color', '#74b9ff')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update customset and add to self.q
				for (const [key, val] of Object.entries(cat_grps)) {
					for (let i = 0; i < default_grp_count; i++) {
						if (cat_grps[key].group == i + 1) customset.groups[i].values.push({ key: key })
					}
				}
				self.q.groupsetting = {
					inuse: true,
					customset: customset
				}
				self.dom.tip.hide()
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
			})
	}

	self.showNumOpts = async function(div) {
		let custom_bins_q, default_bins_q

		if (self.q) {
			//if bincoinfig initiated by user/by default
			custom_bins_q = JSON.parse(JSON.stringify(self.q))
		} else if (self.term.bins) {
			//if binconfig not defined yet or deleted by user, set it as numeric_bin.bins
			const bins =
				self.term.bins.less && !self.opts.disable_ReplaceRemove ? self.term.bins.less : self.term.bins.default

			if (!bins.last_bin) bins.last_bin = {}

			custom_bins_q = JSON.parse(JSON.stringify(bins))
			self.q = JSON.parse(JSON.stringify(bins))
		}

		// (termporary) set default_bins_q as self.bins.default
		// default_bins_q =
		// 	self.term.bins.less && !self.opts.disable_ReplaceRemove ? self.term.bins.less : self.term.bins.default
		default_bins_q = self.term.bins.default

		const config_table = div
			.append('table')
			.style('border-spacing', '7px')
			.style('border-collapse', 'separate')

		//Bin Size edit row
		const bin_size_tr = config_table.append('tr')

		bin_size_tr
			.append('td')
			.style('margin', '5px')
			.html('Bin Size')

		const bin_size_td = bin_size_tr.append('td')

		//First Bin edit row
		const first_bin_tr = config_table.append('tr')

		first_bin_tr
			.append('td')
			.style('margin', '5px')
			.html('First Bin')

		const first_bin_td = first_bin_tr.append('td')

		//Last bin edit row
		const last_bin_tr = config_table.append('tr')

		last_bin_tr
			.append('td')
			.style('margin', '5px')
			.html('Last Bin')

		const last_bin_td = last_bin_tr.append('td')

		const last_bin_select_div = last_bin_td.append('div')
		// .style('display','none')

		// if last bin is not defined, it will be auto, can be edited from dropdown
		const last_bin_select = last_bin_select_div
			.append('select')
			.style('margin-left', '15px')
			.style('margin-bottom', '7px')
			.on('change', () => {
				self.apply_last_bin_change(last_bin_edit_div, last_bin_select, custom_bins_q, default_bins_q)
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
			})

		last_bin_select
			.append('option')
			.attr('value', 'auto')
			.html('Auto')

		last_bin_select
			.append('option')
			.attr('value', 'custom')
			.html('Custom Bin')

		if (
			!custom_bins_q.last_bin ||
			(Object.keys(custom_bins_q.last_bin).length === 0 && custom_bins_q.last_bin.constructor === Object)
		) {
			last_bin_select.node().selectedIndex = 0
		} else if (JSON.stringify(custom_bins_q.last_bin) != JSON.stringify(default_bins_q.last_bin)) {
			last_bin_select.node().selectedIndex = 1
		}

		const last_bin_edit_div = last_bin_td.append('div')

		self.apply_last_bin_change(last_bin_edit_div, last_bin_select, custom_bins_q, default_bins_q)

		// if(!default_bins_q.last_bin || (Object.keys(default_bins_q.last_bin).length === 0 && default_bins_q.last_bin.constructor === Object)){
		// 	last_bin_select_div.style('display','block')
		// }else{
		// 	last_bin_edit_div.style('display','block')
		// }

		// note for users to press enter to make changes to bins
		const note_tr = config_table.append('tr')

		note_tr.append('td')

		note_tr
			.append('td')
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '10px')
			.style('color', '#858585')
			.text(
				'Note: Press ENTER to update.' +
					(!self.opts.disable_ReplaceRemove ? ' To Replace/Update use following buttons.' : '')
			)

		// reset row with 'reset to default' button if any changes detected
		const reset_bins_tr = config_table.append('tr').style('display', 'none')

		self.bin_size_edit(bin_size_td, custom_bins_q, default_bins_q, reset_bins_tr)
		self.end_bin_edit(first_bin_td, 'first', custom_bins_q, default_bins_q, reset_bins_tr)
		self.end_bin_edit(last_bin_edit_div, 'last', custom_bins_q, default_bins_q, reset_bins_tr)

		const button_div = reset_bins_tr.append('div').style('display', 'inline-block')

		// reset button
		button_div
			.append('div')
			.style('font-size', '.8em')
			.style('margin-left', '10px')
			.style('display', 'inline-block')
			.style('border-radius', '5px')
			.attr('class', 'sja_menuoption')
			.text('RESET')
			.on('click', () => {
				self.q = JSON.parse(JSON.stringify(default_bins_q))
				custom_bins_q = JSON.parse(JSON.stringify(default_bins_q))
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
				self.bin_size_edit(bin_size_td, custom_bins_q, default_bins_q, reset_bins_tr)
				self.end_bin_edit(first_bin_td, 'first', custom_bins_q, default_bins_q, reset_bins_tr)
				last_bin_select.node().value = 'auto'
				self.apply_last_bin_change(last_bin_edit_div, last_bin_select, custom_bins_q, default_bins_q)
				reset_bins_tr.style('display', 'none')
				self.end_bin_edit(last_bin_edit_div, 'last', custom_bins_q, default_bins_q, reset_bins_tr)
			})

		if (self.bins_customized(default_bins_q)) reset_bins_tr.style('display', 'table-row')
	}

	// function to edit bin_size options
	self.bin_size_edit = function(bin_size_td, custom_bins_q, default_bins_q, reset_bins_tr) {
		bin_size_td.selectAll('*').remove()

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		const bin_size_input = bin_size_td
			.append('input')
			.attr('type', 'number')
			.attr('value', custom_bins_q.bin_size)
			.style('margin-left', '15px')
			.style('width', '60px')
			.on('keyup', () => {
				if (!client.keyupEnter()) return
				bin_size_input.property('disabled', true)
				apply()
				bin_size_input
					.property('disabled', false)
					.node()
					.focus()
			})

		// select between start/stop inclusive
		const include_select = bin_size_td
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				apply()
			})

		include_select
			.append('option')
			.attr('value', 'stopinclusive')
			.html('start &lt; ' + x + ' &le; end')
		include_select
			.append('option')
			.attr('value', 'startinclusive')
			.html('start &le; ' + x + ' &lt; end')

		include_select.node().selectedIndex = custom_bins_q.startinclusive ? 1 : 0

		function apply() {
			if (bin_size_input.node().value) self.q.bin_size = parseFloat(bin_size_input.node().value)
			self.q.stopinclusive = include_select.node().value == 'stopinclusive'
			if (!self.q.stopinclusive) self.q.startinclusive = include_select.node().value == 'startinclusive'

			if (self.bins_customized(default_bins_q)) reset_bins_tr.style('display', 'table-row')
			self.opts.callback({
				id: self.term.id,
				term: self.term,
				q: self.q
			})
		}
	}

	// function to edit first and last bin
	self.end_bin_edit = function(bin_edit_td, bin_flag, custom_bins_q, default_bins_q, reset_bins_tr) {
		bin_edit_td.selectAll('*').remove()

		let bin
		if (bin_flag == 'first') {
			bin = custom_bins_q.first_bin
		} else if (bin_flag == 'last') {
			if (custom_bins_q.last_bin) {
				bin = custom_bins_q.last_bin
			} else {
				bin = {
					start: '',
					stop: ''
				}
			}
		}

		const start_input = bin_edit_td
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.style('margin-left', '15px')
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				start_input.property('disabled', true)
				await apply()
				start_input.property('disabled', false)
			})

		if (isFinite(bin.start_percentile)) {
			start_input.attr('value', parseFloat(bin.start_percentile))
		} else if (isFinite(bin.start)) {
			start_input.attr('value', parseFloat(bin.start))
		}

		// select realation between lowerbound and first bin/last bin
		let startselect
		if (bin_flag == 'first') {
			startselect = bin_edit_td
				.append('select')
				.style('margin-left', '10px')
				.on('change', () => {
					apply()
				})

			startselect.append('option').html('&le;')
			startselect.append('option').html('&lt;')

			startselect.node().selectedIndex = bin.startinclusive ? 0 : 1
		} else {
			bin_edit_td
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '3px 10px')
				.style('margin-left', '10px')
				.style('width', '15px')
				.html(custom_bins_q.startinclusive ? ' &le;' : ' &lt;')
		}

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		bin_edit_td
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '3px 10px')
			.html(x)

		// relation between first bin and upper value
		let stopselect
		if (bin_flag == 'first') {
			bin_edit_td
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '3px 10px')
				.style('margin-left', '10px')
				.style('width', '15px')
				.html(custom_bins_q.stopinclusive ? ' &le;' : ' &lt;')
		} else {
			stopselect = bin_edit_td
				.append('select')
				.style('margin-left', '10px')
				.on('change', () => {
					apply()
				})

			stopselect.append('option').html('&le;')
			stopselect.append('option').html('&lt;')

			stopselect.node().selectedIndex = bin.stopinclusive ? 0 : 1
		}

		const stop_input = bin_edit_td
			.append('input')
			.style('margin-left', '10px')
			.attr('type', 'number')
			.style('width', '60px')
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				stop_input.property('disabled', true)
				await apply()
				stop_input.property('disabled', false)
			})

		if (isFinite(bin.stop_percentile)) {
			stop_input.attr('value', parseFloat(bin.stop_percentile))
		} else if (isFinite(bin.stop)) {
			stop_input.attr('value', parseFloat(bin.stop))
		}

		// percentile checkbox
		const id = Math.random()
		const percentile_checkbox = bin_edit_td
			.append('input')
			.attr('type', 'checkbox')
			.style('margin', '0px 5px 0px 10px')
			.attr('id', id)
			.on('change', async () => {
				try {
					if (percentile_checkbox.node().checked) {
						if (
							parseFloat(start_input.node().value) > 100 ||
							parseFloat(start_input.node().value) < 0 ||
							parseFloat(stop_input.node().value) > 100 ||
							parseFloat(stop_input.node().value) < 0
						)
							throw 'Percentile value must be within 0 to 100'
					}
				} catch (e) {
					window.alert(e)
				}
			})

		bin_edit_td
			.append('label')
			.attr('for', id)
			.text('Percentile')
			.style('font-size', '.8em')
			.attr('class', 'sja_clbtext')

		if (bin.start_percentile || bin.stop_percentile) percentile_checkbox.property('checked', true)

		function apply() {
			try {
				if (!self.q.last_bin) {
					self.q.last_bin = {}
				}

				if (start_input.node().value && stop_input.node().value && start_input.node().value > stop_input.node().value)
					throw 'start value must be smaller than stop value'

				if (percentile_checkbox.node().checked) {
					if (
						parseFloat(start_input.node().value) > 100 ||
						parseFloat(start_input.node().value) < 0 ||
						parseFloat(stop_input.node().value) > 100 ||
						parseFloat(stop_input.node().value) < 0
					)
						throw 'Percentile value must be within 0 to 100'
				}

				//first_bin parameter setup from input
				if (bin_flag == 'first') {
					if (start_input.node().value) {
						delete self.q.first_bin.startunbounded
						if (percentile_checkbox.node().checked)
							self.q.first_bin.start_percentile = parseFloat(start_input.node().value)
						else self.q.first_bin.start = parseFloat(start_input.node().value)
					} else {
						delete self.q.first_bin.start
						delete self.q.first_bin.start_percentile
						self.q.first_bin.startunbounded = true
					}
					if (stop_input.node().value) {
						if (percentile_checkbox.node().checked)
							self.q.first_bin.stop_percentile = parseFloat(stop_input.node().value)
						else self.q.first_bin.stop = parseFloat(stop_input.node().value)
					} else if (!start_input.node().value) throw 'If start is empty, stop is required for first bin.'

					if (startselect.node().selectedIndex == 0) self.q.first_bin.startinclusive = true
					else if (self.q.first_bin.startinclusive) delete self.q.first_bin.startinclusive

					// if percentile checkbox is unchecked, delete start/stop_percentile
					if (!percentile_checkbox.node().checked) {
						delete self.q.first_bin.start_percentile
						delete self.q.first_bin.stop_percentile
					}
				}

				//last_bin parameter setup from input
				else if (bin_flag == 'last') {
					if (start_input.node().value) {
						if (percentile_checkbox.node().checked)
							self.q.last_bin.start_percentile = parseFloat(start_input.node().value)
						else self.q.last_bin.start = parseFloat(start_input.node().value)
					} else if (!stop_input.node().value) throw 'If stop is empty, start is required for last bin.'

					if (stop_input.node().value) {
						delete self.q.last_bin.stopunbounded
						if (percentile_checkbox.node().checked)
							self.q.last_bin.stop_percentile = parseFloat(stop_input.node().value)
						else self.q.last_bin.stop = parseFloat(stop_input.node().value)
					} else {
						delete self.q.last_bin.stop
						delete self.q.last_bin.stop_percentile
						self.q.last_bin.stopunbounded = true
					}

					if (stopselect.node().selectedIndex == 0) self.q.last_bin.stopinclusive = true
					else if (self.q.last_bin.stopinclusive) delete self.q.last_bin.stopinclusive

					// if percentile checkbox is unchecked, delete start/stop_percentile
					if (!percentile_checkbox.node().checked) {
						delete self.q.last_bin.start_percentile
						delete self.q.last_bin.stop_percentile
					}
				}
				if (self.bins_customized(default_bins_q)) reset_bins_tr.style('display', 'table-row')
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
			} catch (e) {
				window.alert(e)
			}
		}
	}

	self.apply_last_bin_change = function(last_bin_edit_div, last_bin_select, custom_bins_q, default_bins_q) {
		if (last_bin_select.node().value == 'custom') {
			last_bin_edit_div.style('display', 'block')
		} else if (last_bin_select.node().value == 'auto') {
			const last_bin = default_bins_q.last_bin ? default_bins_q.last_bin : {}
			self.q.last_bin = JSON.parse(JSON.stringify(last_bin))
			custom_bins_q.last_bin = JSON.parse(JSON.stringify(last_bin))
			last_bin_edit_div.style('display', 'none')
			// last_bin_select.style('display','block')
		}
	}

	self.bins_customized = function(default_bins_q) {
		const custom_bins_q = self.q
		if (custom_bins_q && default_bins_q) {
			if (
				custom_bins_q.bin_size == default_bins_q.bin_size &&
				custom_bins_q.stopinclusive == default_bins_q.stopinclusive &&
				JSON.stringify(custom_bins_q.first_bin) == JSON.stringify(default_bins_q.first_bin)
			) {
				if (
					default_bins_q.last_bin &&
					JSON.stringify(custom_bins_q.last_bin) == JSON.stringify(default_bins_q.last_bin)
				) {
					return false
				} else if (Object.keys(custom_bins_q.last_bin).length === 0 && custom_bins_q.last_bin.constructor === Object) {
					return false
				} else return true
			} else {
				return true
			}
		}
	}

	self.showConditionOpts = async function(div) {
		// grade/subcondtion value type
		const value_type_select = div
			.append('select')
			.style('margin', '5px 10px')
			.on('change', () => {
				self.q.bar_by_grade = value_type_select.node().value == 'sub' ? false : true
				self.q.bar_by_children = value_type_select.node().value == 'sub' ? true : false
				self.q.value_by_max_grade = value_type_select.node().value == 'max' || 'sub' ? true : false
				self.q.value_by_most_recent = value_type_select.node().value == 'recent' ? true : false
				self.q.value_by_computable_grade = value_type_select.node().value == 'computable' ? true : false
				self.dom.tip.hide()
				self.opts.callback({
					id: self.term.id,
					term: self.term,
					q: self.q
				})
			})

		value_type_select
			.append('option')
			.attr('value', 'max')
			.text('Max grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'recent')
			.text('Most recent grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'computable')
			.text('Any grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'sub')
			.text('Sub-conditions')

		value_type_select.node().selectedIndex = self.q.bar_by_children
			? 3
			: self.q.value_by_computable_grade
			? 2
			: self.q.value_by_most_recent
			? 1
			: 0

		//options for grouping grades/subconditions
		self.showGrpOpts(div)
	}

	self.grpSet2valGrp = function(groupset) {
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const vals_with_grp = JSON.parse(JSON.stringify(values))
		for (const [i, g] of groupset.groups.entries()) {
			for (const v of g.values) {
				vals_with_grp[v.key].group = i + 1
			}
		}

		for (const [key, val] of Object.entries(vals_with_grp)) {
			if (vals_with_grp[key].group == undefined) vals_with_grp[key].group = 0
		}

		return vals_with_grp
	}
}

function termsetting_fill_q(q, term) {
	if (term.isinteger || term.isfloat) {
		/*
		if q is already initiated, do not overwrite
		to be tested if can work with partially declared state
		always copies from .bins.default
		no longer deals with the case where .bins.less is to be used as term2/0
		*/
		if (Number.isFinite(q.bin_size) && q.first_bin) {
			if (q.first_bin.startunbounded) {
				if (Number.isInteger(q.first_bin.stop_percentile) || Number.isFinite(q.first_bin.stop)) {
					// valid, do not override
					return
				}
			} else {
				if (Number.isInteger(q.first_bin.start_percentile) || Number.isFinite(q.first_bin.start)) {
					// valid, do not override
					return
				}
			}
		}
		// override
		termsetting_fill_q_numeric(q, term.bins.default)
		return
	}
	if (term.iscategorical || term.iscondition) {
		if (!q.groupsetting) q.groupsetting = {}
		if (term.groupsetting.disabled) {
			q.groupsetting.disabled = true
			return
		}
		delete q.groupsetting.disabled
		if (!('inuse' in q.groupsetting)) q.groupsetting.inuse = false // do not apply by default

		if (term.iscondition) {
			/*
			for condition term, must set up bar/value flags before quiting for inuse:false
			*/
			if (q.value_by_max_grade || q.value_by_most_recent || q.value_by_computable_grade) {
				// need any of the three to be set
			} else {
				// set a default one
				q.value_by_max_grade = true
			}
			if (q.bar_by_grade || q.bar_by_children) {
			} else {
				q.bar_by_grade = true
			}
		}

		if (!q.groupsetting.inuse) {
			// inuse:false is either from automatic setup or predefined in state
			// then no need for additional setup
			return
		}
		// if to apply the groupsetting
		if (term.groupsetting.lst && term.groupsetting.useIndex >= 0 && term.groupsetting.lst[term.groupsetting.useIndex]) {
			q.groupsetting.predefined_groupset_idx = term.groupsetting.useIndex
		}
		return
	}
	throw 'unknown term type'
}
exports.termsetting_fill_q = termsetting_fill_q
function termsetting_fill_q_numeric(q, binconfig) {
	rx.copyMerge(q, binconfig)
}
exports.termsetting_fill_q_numeric = termsetting_fill_q_numeric
