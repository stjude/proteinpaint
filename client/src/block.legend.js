import * as common from '#shared/common.js'
import * as client from './client'
import { dstkrender } from './block.ds'
import * as coord from './coord'

/*

hardcoded legend for common.mclass, common.morigin
do not belong to specific tk but for all tk of ds type

functions:

	legend_newrow( holder, label )
	legend_mclass()
	legend_morigin()

*/

const tip = new client.Menu({ padding: '0px' })

export function legend_newrow(block, label) {
	const tr = block.legend.holder.append('tr')
	const td0 = tr
		.append('td')
		.text(label)
		.style('padding-right', '10px')
		.style('text-align', 'right')
		//.style('vertical-align','top')
		//.style('color',block.legend.legendcolor)
		//.style('font-weight','bold')
		.style('color', '#555')
		.style('border-right', 'solid 1px ' + block.legend.legendcolor)
	const td = tr.append('td')
	return [tr, td, td0]
}

export function legend_mclass(block) {
	if (!block.legend) {
		return
	}
	const hidden = new Set()
	for (const [c, obj] of block.legend.mclasses) {
		if (obj.hidden) {
			hidden.add(c)
		}
	}
	const map = new Map()
	for (const t of block.tklst) {
		if (t.hidden || t.type != client.tkt.ds) continue
		if (!t.mlst) {
			// maybe mlst not loaded yet
			continue
		}
		for (const m of t.mlst) {
			if (m.class) {
				if (!map.has(m.class)) {
					map.set(m.class, { count: 0 })
				}
				map.get(m.class).count++
			}
		}
	}
	const slst = []
	for (const [c, obj] of map) {
		if (hidden.has(c)) {
			map.get(c).hidden = true
		}
		slst.push({ key: c, count: obj.count })
	}
	block.legend.mclasses = map
	if (map.size == 0) {
		block.legend.tr_mclass.style('display', 'none')
		return
	}
	block.legend.tr_mclass.style('display', 'table-row')
	slst.sort((a, b) => b.count - a.count)
	block.legend.td_mclass.selectAll('*').remove()
	for (const e of slst) {
		const butt = block.legend.td_mclass
			.append('div')
			.style('display', 'inline-block')
			.style('white-space', 'nowrap')
			.style('padding', block.legend.vpad + ' 20px ' + block.legend.vpad + ' 0px')
			.classed('sja_clb', true)
			.on('click', () => {
				tip.clear()
				tip.showunder(butt.node())
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.html('<div style="display:inline-block;width:25px">&#10003;</div> show alone')
					.on('click', () => {
						tip.hide()
						block.pannedpx = undefined // make sure
						for (const obj of block.legend.mclasses.values()) {
							obj.hidden = true
						}
						block.legend.mclasses.get(e.key).hidden = false
						for (const t of block.tklst) {
							if (!t.hidden && t.type == client.tkt.ds) {
								dstkrender(t, block)
							}
						}
					})
				if (block.legend.mclasses.get(e.key).hidden) {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&#10003;</div> show')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							block.legend.mclasses.get(e.key).hidden = false
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				} else {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&times;</div> hide')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							block.legend.mclasses.get(e.key).hidden = true
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				}
				if (hidden.size > 1) {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&#10003;</div> show all')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							for (const obj of block.legend.mclasses.values()) {
								obj.hidden = false
							}
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				}

				const div2 = tip.d.append('div').style('margin', '20px')
				div2
					.append('div')
					.text(common.mclass[e.key].label.toUpperCase())
					.style('color', common.mclass[e.key].color)
					.style('font-size', '.8em')
				div2
					.append('div')
					.html(common.mclass[e.key].desc)
					.style('color', '#858585')
					.style('font-size', '.8em')
					.style('width', '210px')
				// end of click
			})
		butt
			.append('div')
			.style('display', 'inline-block')
			.style('background-color', common.mclass[e.key].color)
			.style('margin-right', '5px')
			.style('border-radius', '15px')
			.style('padding', '4px 8px')
			.style('color', 'white')
			.style('font-size', '.8em')
			.text(e.count)
		const lab = butt
			.append('div')
			.style('display', 'inline-block')
			.style('color', common.mclass[e.key].color)
			.text(common.mclass[e.key].label)
		if (hidden.has(e.key)) {
			lab.style('text-decoration', 'line-through')
		}
	}
}

export function legend_morigin(block) {
	if (!block.legend) {
		return
	}
	const hidden = new Set()
	for (const [c, obj] of block.legend.morigins) {
		if (obj.hidden) {
			hidden.add(c)
		}
	}
	const map = new Map()
	for (const t of block.tklst) {
		if (t.hidden || t.type != client.tkt.ds) continue
		if (!t.mlst) {
			continue
		}
		for (const m of t.mlst) {
			if (!m.origin) continue
			if (!map.has(m.origin)) {
				// adding new entry to the origin legend
				/*
				tricky alert
				by default, common.morigin has some item hidden
				so whatever is set hidden there, effect will be applicable here
				and when user clicks "Show only" or "Show" option in the morigin menu
				it will forever abolish the .hidden of that item in common.morigin
				*/
				let hidebydefault = false
				if (common.morigin[m.origin] && common.morigin[m.origin].hidden) {
					// this type is hidden by default
					hidebydefault = true
					hidden.add(m.origin)
				}
				map.set(m.origin, { count: 0, hidden: hidebydefault })
			}
			map.get(m.origin).count++
		}
	}
	const slst = []
	for (const [c, obj] of map) {
		if (hidden.has(c)) {
			map.get(c).hidden = true
		}
		slst.push({ key: c, count: obj.count })
	}
	block.legend.morigins = map
	if (map.size == 0) {
		block.legend.tr_morigin.style('display', 'none')
		return
	}
	block.legend.tr_morigin.style('display', 'table-row')
	slst.sort((a, b) => b.count - a.count)
	block.legend.td_morigin.selectAll('*').remove()
	for (const e of slst) {
		const butt = block.legend.td_morigin
			.append('div')
			.style('display', 'inline-block')
			.style('white-space', 'nowrap')
			.style('padding', block.legend.vpad + ' 20px ' + block.legend.vpad + ' 0px')
			.classed('sja_clb', true)
			.on('click', () => {
				tip.clear()
				tip.showunder(butt.node())
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.html('<div style="display:inline-block;width:25px">&#10003;</div> show alone')
					.on('click', () => {
						tip.hide()
						block.pannedpx = undefined // make sure
						for (const obj of block.legend.morigins.values()) {
							obj.hidden = true
						}
						block.legend.morigins.get(e.key).hidden = false
						/*
						tricky alert
						abolish .hidden from common.morigin
						in case when .hidden is set by default, the variants of this origin can show
						*/
						common.morigin[e.key].hidden = false
						for (const t of block.tklst) {
							if (!t.hidden && t.type == client.tkt.ds) {
								dstkrender(t, block)
							}
						}
					})
				if (block.legend.morigins.get(e.key).hidden) {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&#10003;</div> show')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							block.legend.morigins.get(e.key).hidden = false
							/*
							tricky alert
							see above
							*/
							common.morigin[e.key].hidden = false
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				} else {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&times;</div> hide')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							block.legend.morigins.get(e.key).hidden = true
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				}
				if (hidden.size > 1) {
					tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.html('<div style="display:inline-block;width:25px">&#10003;</div> show all')
						.on('click', () => {
							tip.hide()
							block.pannedpx = undefined // make sure
							for (const obj of block.legend.morigins.values()) {
								obj.hidden = false
							}
							for (const t of block.tklst) {
								if (!t.hidden && t.type == client.tkt.ds) {
									dstkrender(t, block)
								}
							}
						})
				}

				const div2 = tip.d.append('div').style('margin', '20px')
				div2
					.append('div')
					.text(common.morigin[e.key].label.toUpperCase())
					.style('color', common.morigin[e.key].color)
					.style('font-size', '.8em')
				div2
					.append('div')
					.html(common.morigin[e.key].desc)
					.style('color', '#858585')
					.style('font-size', '.8em')
					.style('width', '210px')
				// end of click
			})
		butt
			.append('svg')
			.style('margin-right', '5px')
			.attr('width', 19) // hardcoded legend w/h
			.attr('height', 19)
			.html(common.morigin[e.key].legend)
		const lab = butt
			.append('div')
			.style('display', 'inline-block')
			.style('color', '#858585')
			.text(common.morigin[e.key].label + ', ' + e.count)
		if (hidden.has(e.key)) {
			lab.style('text-decoration', 'line-through')
		}
	}
}
