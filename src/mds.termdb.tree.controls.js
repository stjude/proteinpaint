import { Menu, newpane, tkt, get_event_bus } from './client'
import { event } from 'd3-selection'
import * as termvaluesettingui from './mds.termdb.termvaluesetting.ui'
import { validate_termvaluesetting } from './mds.termdb.termvaluesetting'

export function getFilterUi(obj) {
	if (!obj.termfilter || !obj.termfilter.show_top_ui) {
		// do not display ui, and do not collect callbacks
		return
	}

	if (!obj.termfilter.terms) {
		obj.termfilter.terms = []
	} else {
		if (!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
		validate_termvaluesetting(obj.termfilter.terms)
	}

	obj.dom.termfilterdiv.selectAll('*').remove()

	const div = obj.dom.termfilterdiv
		.style('display', 'inline-block')
		.append('div')
		.style('display', 'inline-block')
		.style('border', 'solid 1px #ddd')
		.style('padding', '7px')
		.style('margin-bottom', '10px')

	div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '0px 5px')
		.text('FILTER')
		.style('opacity', '.5')
		.style('font-size', '.8em')

	const tvsuiObj = {
		group_div: div,
		group: obj.termfilter,
		mds: obj.mds,
		genome: obj.genome,
		tvslst_filter: false,
		callback: obj.main,
		fetchOpts: obj.fetchOpts,
		isCoordinated: true,
		store: obj.store,
		isReactive: true
	}

	termvaluesettingui.init(tvsuiObj)
	obj.tvstip = tvsuiObj.tvstip

	let currTermsStr = JSON.stringify(obj.termfilter.terms)

	const filter = {
		main(action, state = null) {
			if (!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
			const termStr = JSON.stringify(obj.termfilter.terms)
			if (termStr == currTermsStr) return // do not rerender since data is the same
			currTermsStr = termStr
			validate_termvaluesetting(obj.termfilter.terms)
			tvsuiObj.main()
		},
		supportsStore: true
	}

	if (obj.callbacks.filter) {
		tvsuiObj.postRenderCallback = () => filter.bus.emit('postRender')
		filter.bus = get_event_bus(['postRender'], obj.callbacks.filter, obj)
	}

	return filter
}

export function getCartUi(obj) {
	const cart = {
		main() {
			if (!obj.selected_groups) {
				obj.dom.cartdiv.style('display', 'none')
				cart.bus.emit('postRenderBtn', obj)
				return
			}

			if (obj.selected_groups.length > 0) {
				// selected group button
				obj.dom.cartdiv
					.style('display', 'inline-block')
					.attr('class', 'sja_filter_tag_btn')
					.style('padding', '6px')
					.style('margin', '0px 10px')
					.style('border-radius', obj.button_radius)
					.style('background-color', '#00AB66')
					.style('color', '#fff')
					.text('Selected ' + obj.selected_groups.length + ' Group' + (obj.selected_groups.length > 1 ? 's' : ''))
					.on('click', () => make_selected_group_tip(obj, cart))
			} else {
				obj.dom.cartdiv.style('display', 'none')
			}

			cart.bus.emit('postRenderBtn', obj)
		},
		bus: get_event_bus(['postRenderBtn', 'postRenderTip'], obj.callbacks.cart)
	}

	return cart
}

function make_selected_group_tip(obj, cart) {
	const tip = obj.tip
	tip.clear()
	tip.showunder(obj.dom.cartdiv.node())

	const table = tip.d
		.append('table')
		.style('border-spacing', '5px')
		.style('border-collapse', 'separate')

	// one row for each group
	for (const [i, group] of obj.selected_groups.entries()) {
		const tr = table.append('tr')
		const td1 = tr.append('td')

		td1
			.append('div')
			.attr('class', 'sja_filter_tag_btn')
			.text('Group ' + (i + 1))
			.style('white-space', 'nowrap')
			.style('color', '#000')
			.style('padding', '6px')
			.style('margin', '3px 5px')
			.style('font-size', '.7em')
			.style('text-transform', 'uppercase')

		group.dom = {
			td2: tr.append('td'),
			td3: tr
				.append('td')
				.style('opacity', 0.5)
				.style('font-size', '.8em'),
			td4: tr.append('td')
		}

		const tvsuiObj = {
			group_div: group.dom.td2,
			group: group,
			mds: obj.mds,
			genome: obj.genome,
			tvslst_filter: false,
			callback: () => {
				tvsuiObj.main()
				cart.bus.emit('postRenderTip', obj)
			},
			fetchOpts: obj.fetchOpts
		}

		termvaluesettingui.init(tvsuiObj)
		obj.tvstip = tvsuiObj.tvstip

		// TODO : update 'n=' by group selection
		// group.dom.td3.append('div')
		//  .text('n=?, view stats')

		// 'X' button to remove gorup
		group.dom.td4
			.append('div')
			.attr('class', 'sja_filter_tag_btn remove_group_btn')
			.style('padding', '2px 6px 2px 6px')
			.style('display', 'inline-block')
			.style('margin-left', '7px')
			.style('border-radius', '6px')
			.style('background-color', '#fa5e5b')
			.html('&#215;')
			.on('click', () => {
				// remove group and update tip and button
				obj.selected_groups.splice(i, 1)

				if (obj.selected_groups.length == 0) {
					obj.dom.cartdiv.style('display', 'none')
					tip.hide()
					cart.bus.emit('postRenderBtn', obj)
					cart.bus.emit('postRenderTip', obj)
				} else {
					// this coordination suggests using a
					// reactive component flow from cart to group tip
					// for example,
					// clicking the cartdiv should set cart.tipIsVisible = true,
					// then call cart.main(),
					// which calls cart.components.grouptip.main(),
					// then triggers make_selected_group_tip()
					// to maintain a unidirectional data/update flow
					cart.main()
					make_selected_group_tip(obj, cart)
				}
			})
	}

	if (obj.selected_groups.length > 1) {
		const tr_gp = table.append('tr')
		const td_gp = tr_gp
			.append('td')
			.attr('colspan', 4)
			.attr('align', 'center')
			.style('padding', '0')

		td_gp
			.append('div')
			.attr('class', 'sja_filter_tag_btn launch_gp_btn')
			.style('display', 'inline-block')
			.style('height', '100%')
			.style('width', '96%')
			.style('padding', '4px 10px')
			.style('margin-top', '10px')
			.style('border-radius', '3px')
			.style('background-color', '#eee')
			.style('color', '#000')
			.text('Perform Association Test in GenomePaint')
			.style('font-size', '.8em')
			.on('click', () => {
				tip.hide()
				const pane = newpane({ x: 100, y: 100 })
				import('./block').then(_ => {
					new _.Block({
						hostURL: localStorage.getItem('hostURL'),
						holder: pane.body,
						genome: obj.genome,
						nobox: true,
						chr: obj.genome.defaultcoord.chr,
						start: obj.genome.defaultcoord.start,
						stop: obj.genome.defaultcoord.stop,
						nativetracks: [obj.genome.tracks.find(i => i.__isgene).name.toLowerCase()],
						tklst: [
							{
								type: tkt.mds2,
								dslabel: obj.dslabel,
								vcf: { numerical_axis: { AFtest: { groups: obj.selected_groups } } }
							}
						]
					})
				})
			})
	}

	cart.bus.emit('postRenderTip', obj)
}

export function setObjBarClickCallback(obj) {
	// below is used for setting up barchart event bus
	obj.callbacks.bar = {
		postClick:
			obj.modifier_barchart_selectbar && obj.modifier_barchart_selectbar.callback
				? arg => obj.modifier_barchart_selectbar.callback({ terms: arg.termValues })
				: obj.bar_click_menu
				? arg => show_bar_click_menu(obj, arg)
				: () => {}
	}
}

function show_bar_click_menu(obj, arg) {
	/*
  obj           the term tree obj
  termValue     array of term-value entries
*/
	const options = arg.options ? arg.options : []
	if (obj.bar_click_menu.add_filter) {
		options.push({
			label: 'Add as filter',
			callback: menuoption_add_filter
		})
	}
	if (obj.bar_click_menu.select_to_gp) {
		options.push({
			label: 'Select to GenomePaint',
			callback: menuoption_select_to_gp
		})
	}
	if (obj.bar_click_menu.select_group_add_to_cart) {
		options.push({
			label: 'Add group to cart',
			callback: menuoption_select_group_add_to_cart
		})
	}

	if (options.length) {
		obj.tip.clear()
		if (arg.header) {
			obj.tip.d.append('div').html(arg.header)
		}
		obj.tip.d
			.append('div')
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.html(d => d.label)
			.on('click', d => {
				obj.tip.hide()
				d.callback(obj, arg.termValues)
			})

		obj.tip.show(arg.x, arg.y)
	}
}

function menuoption_add_filter(obj, tvslst) {
	/*
  obj: the tree object
  tvslst: an array of 1 or 2 term-value setting objects
       this is to be added to the obj.termfilter.terms[]
     if barchart is single-term, tvslst will have only one element
     if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
  */
	if (!tvslst) return

	if (!obj.termfilter || !obj.termfilter.show_top_ui) {
		// do not display ui, and do not collect callbacks
		return
	}

	for (const [i, term] of tvslst.entries()) {
		obj.termfilter.terms.push(term)
	}

	obj.main()
}

function menuoption_select_to_gp(obj, tvslst) {
	const lst = []
	for (const t of tvslst) lst.push(t)
	if (obj.termfilter && obj.termfilter.terms) {
		for (const t of obj.termfilter.terms) {
			lst.push(JSON.parse(JSON.stringify(t)))
		}
	}

	const pane = newpane({ x: 100, y: 100 })
	import('./block').then(_ => {
		new _.Block({
			hostURL: localStorage.getItem('hostURL'),
			holder: pane.body,
			genome: obj.genome,
			nobox: true,
			chr: obj.genome.defaultcoord.chr,
			start: obj.genome.defaultcoord.start,
			stop: obj.genome.defaultcoord.stop,
			nativetracks: [obj.genome.tracks.find(i => i.__isgene).name.toLowerCase()],
			tklst: [
				{
					type: tkt.mds2,
					dslabel: obj.dslabel,
					vcf: {
						numerical_axis: {
							AFtest: {
								groups: [{ is_termdb: true, terms: lst }, obj.bar_click_menu.select_to_gp.group_compare_against]
							}
						}
					}
				}
			]
		})
	})
}

function menuoption_select_group_add_to_cart(obj, tvslst) {
	if (!tvslst || !tvslst.length) return

	const new_group = {}
	new_group.is_termdb = true
	new_group.terms = []

	for (const [i, term] of tvslst.entries()) {
		new_group.terms.push(term)
	}

	if (!obj.selected_groups) {
		obj.selected_groups = []
	}

	obj.selected_groups.push(new_group)
	obj.components.cart.main()
}
