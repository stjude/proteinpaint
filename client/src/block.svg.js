import * as client from './client'
import * as common from '#shared/common.js'

const ypad = 20
const xpad = 2

// legend items
const rowh = 20
const rowpad = 3
const fontsize = 16

export default function (block) {
	for (const tk of block.tklst) {
		if (tk.config_handle) tk.config_handle.text('')
		if (tk.label_close) tk.label_close.text('')
	}

	const oldheight = block.totalheight()

	let newheight

	const [h1, g1] = proteindomain(block, oldheight + ypad)

	const [h2, g2] = mclassorigin(block, oldheight + ypad)

	newheight = oldheight + ypad + Math.max(h1, h2) + ypad

	// TODO add legend from any other tracks

	block.svg.attr('height', newheight)

	const lst = []
	if (block.usegm && block.usegm.name) lst.push(block.usegm.name)
	if (block.usegm && block.usegm.isoform) lst.push(block.usegm.isoform)
	client.to_svg(block.svg.node(), lst.length ? lst.join('_') : 'screenshot')

	// recover

	for (const tk of block.tklst) {
		if (tk.config_handle) tk.config_handle.text('CONFIG')
		if (tk.label_close) tk.label_close.text('Close')
	}

	if (g1) g1.remove()
	if (g2) g2.remove()

	block.svg.attr('height', oldheight)
}

function proteindomain(block, height) {
	const gm = block.usegm
	if (!gm) {
		return [0, null]
	}
	const domains = client.getdomaintypes(gm)
	if (domains.length == 0) {
		return [0, null]
	}
	const showlst = []
	for (const domain of domains) {
		if (!gm.domain_hidden[domain.name + domain.description]) {
			showlst.push(domain)
		}
	}
	if (showlst.length == 0) return [0, null]

	const g = block.svg.append('g').attr('transform', 'translate(' + (xpad + block.leftheadw) + ',' + height + ')')
	let h = 0
	for (const item of showlst) {
		const row = g.append('g').attr('transform', 'translate(0,' + h + ')')
		row
			.append('rect')
			.attr('width', 15)
			.attr('height', rowh)
			.attr('stroke', item.stroke)
			.attr('fill', item.fill)
			.attr('shape-rendering', 'crispEdges')
		let w
		row
			.append('text')
			.attr('x', 20)
			.attr('y', rowh / 2)
			.attr('dominant-baseline', 'central')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('fill', 'black')
			.text(item.name)
			.each(function () {
				w = this.getBBox().width
			})
		if (item.description) {
			row
				.append('text')
				.attr('x', 30 + w)
				.attr('y', rowh / 2)
				.attr('dominant-baseline', 'central')
				.attr('font-size', 12)
				.attr('font-family', client.font)
				.attr('fill', '#858585')
				.text(item.description.length > 80 ? item.description.substr(0, 70) + ' ...' : item.description)
		}
		h += rowh + rowpad
	}
	return [h, g]
}

function mclassorigin(block, height) {
	if (!block.legend) {
		return [0, null]
	}
	let totalitem = 0

	const mclass2show = getMclasses(block)
	// [ [classkey=str, count=int], ... ]

	totalitem += mclass2show.length

	if (block.legend.morigins && block.legend.morigins.size > 0) {
		for (const [cls, obj] of block.legend.morigins) {
			if (!obj.hidden) {
				totalitem++
			}
		}
	}

	if (totalitem == 0) return [0, null]

	let h = 0
	const g = block.svg
		.append('g')
		.attr('transform', 'translate(' + (xpad + block.leftheadw + block.lpad + block.width - 200) + ',' + height + ')')

	for (const [cls, count] of mclass2show) {
		const { color, label } = common.mds3tkMclass(cls)
		const row = g.append('g').attr('transform', 'translate(0,' + h + ')')
		row
			.append('circle')
			.attr('cx', rowh / 2)
			.attr('cy', rowh / 2)
			.attr('r', rowh / 2)
			.attr('fill', color)
		row
			.append('text')
			.text(`${label}, n=${count}`)
			.attr('x', rowh + 10)
			.attr('y', rowh / 2)
			.attr('dominant-baseline', 'central')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('fill', color)
		h += rowh + rowpad
	}
	if (block.legend.morigins && block.legend.morigins.size > 0) {
		for (const [org, o] of block.legend.morigins) {
			if (o.hidden) {
				continue
			}
			const row = g.append('g').attr('transform', 'translate(0,' + h + ')')
			const circleg = row.append('g').attr('transform', 'translate(5,0)')
			circleg.html(common.morigin[org].legend)
			row
				.append('text')
				.text(common.morigin[org].label + ', n=' + o.count)
				.attr('x', rowh + 10)
				.attr('y', rowh / 2)
				.attr('dominant-baseline', 'central')
				.attr('font-size', fontsize)
				.attr('font-family', client.font)
				.attr('fill', 'black')
			h += rowh + rowpad
		}
	}
	return [h, g]
}

function getMclasses(block) {
	/* two sources of mclass
	 */

	const mclass2show = [] // element: [class, count]

	// 1: legacy ds track
	if (block.legend.mclasses && block.legend.mclasses.size > 0) {
		for (const [cls, o] of block.legend.mclasses) {
			if (!o.hidden) mclass2show.push([cls, o.count])
		}
	}

	// 2: mds3 tk
	const tk = block.tklst.find(i => i.type == 'mds3')
	if (tk && tk.legend?.mclass?.currentData) {
		for (const m of tk.legend.mclass.currentData) {
			// m = [class, count]
			if (!tk.legend.mclass.hiddenvalues.has(m[0])) {
				mclass2show.push(m)
			}
		}
	}
	return mclass2show
}
