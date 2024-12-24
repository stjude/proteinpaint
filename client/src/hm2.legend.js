import { select } from 'd3-selection'

export default function hm2legend(hm, rectFillFxn, textFxn, iconStroke, itemOpacity) {
	let currlinex = 0
	let currliney = 0
	let defaults
	let currG

	init()

	function main(g) {
		currG = g
		currlinex = hm.legendpadleft
		currliney = 0

		g.selectAll('g').remove()
		g.attr('transform', hm.legendontop ? null : 'translate(0,' + hm.svgh + ')').on(
			'mouseover.tphm2',
			hm.handlers.legend.mouseover
		)

		const l = g.selectAll('g').data(hm.h.legend)

		l.exit().remove()
		l.enter().append('g').each(addGroup)

		return currliney + hm.legendlineh + hm.legendpadbtm
	}

	function init() {
		defaults = {
			legendontop: true,
			legendh: 0,
			legendlineh: 25,
			legendpadx: 5,
			legendpadleft: 150,
			legendpadright: 20,
			legendpadbtm: 30,
			legendfontsize: 12,
			legendiconh: 10,
			legendiconw: 10,
			samplecount4legend: true,
			legendhangleft: 1,
			legendlinesep: false,
			legendmutationorder: [
				'M',
				'E',
				'F',
				'N',
				'S',
				'D',
				'I',
				'P',
				'L',
				'Intron',
				'ITD',
				'DEL',
				'NLOSS',
				'CLOSS',
				'Utr3',
				'Utr5',
				'X',
				'noncoding',
				'Fuserna',
				'SV',
				'CNV_amplification',
				'CNV_homozygous_deletion',
				'CNV_amp',
				'CNV_loss',
				'CNV_loh',
				'snv',
				'mnv'
			]
		}

		for (let key in defaults) {
			if (!(key in hm)) hm[key] = defaults[key]
		}
	}

	function addGroup(d, i) {
		if (!d.items || !d.items.length) return
		currlinex = 0
		currliney += hm.legendlineh

		let g = select(this)
		const leftdist = hm.legendhangleft ? hm.legendpadleft + hm.legendhangleft - hm.legendpadx : hm.legendpadleft

		const grplabel = g
			.append('text')
			.attr('transform', 'translate(' + leftdist + ',' + (currliney + hm.legendiconh / 2) + ')')
			.attr('text-anchor', hm.legendhangleft ? 'end' : 'start')
			.attr('font-weight', 700)
			.attr('font-size', hm.legendfontsize)
			.attr('dominant-baseline', 'central')
			.text(d.text + (hm.samplecount4legend ? ' (sample count)' : ''))

		if (hm.linesep) {
			currlinex = hm.legendpadleft
			currliney += hm.legendlineh
		} else if (hm.legendhangleft) {
			currlinex = leftdist + 2 * hm.legendpadx
		} else {
			currlinex += hm.legendpadleft + grplabel.node().getBBox().width + 2 * hm.legendpadx
		}

		if (d.sorter) d.items.sort(d.sorter)

		g.selectAll('g')
			.data(d.items)
			.enter()
			.append('g')
			//.attr('transform', 'translate(0,'+i*20+')')
			.each(addItem)
	}

	function addItem(d, i) {
		let g = select(this)
			.attr('transform', 'translate(' + currlinex + ',' + currliney + ')')
			.style('opacity', itemOpacity)

		const itemlabel = g
			.append('text')
			.attr('transform', 'translate(' + (hm.legendiconw + hm.legendpadx / 2) + ',' + hm.legendiconh / 2 + ')')
			.attr('font-size', hm.legendfontsize)
			.attr('dominant-baseline', 'central')
			.each(function (d) {
				const t = select(this)
				if (typeof d.text == 'string') {
					t.text(textFxn(d))
				} else if (Array.isArray(d.text)) {
					t.selectAll('tspan')
						.data(d.text)
						.enter()
						.append('tspan')
						.text(d => d)
						.attr('dominant-baseline', 'central')
						.attr('x', function (dd, i) {
							if (i == 0) {
								select(this).attr('font-weight', 700)
								d.lastx = select(this).node().getComputedTextLength() + 10
								return 0
							} else if (d.lastx) {
								return d.lastx
							}
						})
				}
			})

		const bbox = itemlabel.node().getBBox()
		currlinex += hm.legendiconw + bbox.width + 2.5 * hm.legendpadx
		if (hm.legendlinesep || currlinex > hm.svgw - hm.legendpadright) {
			currliney += hm.legendlineh
			const leftdist = !hm.legendhangleft ? hm.legendpadleft : hm.legendpadleft + hm.legendhangleft + hm.legendpadx

			g.attr('transform', 'translate(' + leftdist + ',' + currliney + ')')
			currlinex = hm.legendiconw + bbox.width + 2.5 * hm.legendpadx + hm.legendpadleft
			if (hm.legendhangleft) currlinex = hm.legendiconw + bbox.width + 2.5 * hm.legendpadx + leftdist
			else currlinex = hm.legendiconw + bbox.width + 2.5 * hm.legendpadx + hm.legendpadleft
		}

		g.append('rect')
			.attr('height', hm.legendiconh)
			.attr('width', hm.legendiconw)
			.attr('y', hm.legendfontsize - bbox.height + (bbox.height - hm.legendiconh) / 2)
			.attr('fill', rectFillFxn)
			.attr('stroke', iconStroke)
			.attr('shape-rendering', 'crispEdges')
	}

	main.defaults = defaults

	main.finalizePos = function (h) {
		currG
			.transition()
			.duration(hm.duration)
			.attr('transform', hm.legendontop ? null : 'translate(0,' + (hm.svgh + h) + ')')
	}

	return main
}
