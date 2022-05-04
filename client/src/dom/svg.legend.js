import { select } from 'd3-selection'

export default function svgLegend(opts) {
	let currlinex = 0
	let currliney = 0
	let currG

	const defaults = {
		legendontop: false,
		legendh: 0,
		legendlineh: 25,
		legendpadx: 5,
		legendpadleft: 0, //150,
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
			'CNV_amp',
			'CNV_loss',
			'snv',
			'mnv'
		],
		itemOpacity: 1
	}

	const settings = Object.assign(defaults, opts.settings || {})

	function render(data, overrides = {}) {
		/*const legendGroups = holder.selectAll(':scope>g').data(data)
		legendGroups.exit().remove()
		legendGroups.each(updateLegendGroup)
		legendGroups.enter().append('g').each(addLegendGroup)*/
		Object.assign(settings, overrides.settings || {})
		currlinex = settings.legendpadleft
		currliney = 0

		opts.holder.selectAll('g').remove()
		opts.holder.attr('transform', settings.legendontop ? null : 'translate(0,' + settings.svgh + ')')
		//.on('mouseover.tphm2', settings.handlers.legend.mouseover)
		//.on('click.tphm2', settings.handlers.legend.click)

		const l = opts.holder.selectAll('g').data(data)

		l.exit().remove()
		l.enter()
			.append('g')
			.each(addGroup)

		return currliney + settings.legendlineh + settings.legendpadbtm
	}

	function addGroup(d, i) {
		if (!d.items || !d.items.length) return
		currlinex = 0
		currliney += settings.legendlineh

		let g = select(this)
		const leftdist = settings.legendhangleft
			? settings.legendpadleft + settings.legendhangleft - settings.legendpadx
			: settings.legendpadleft

		const grplabel = g
			.append('text')
			.attr('transform', 'translate(' + leftdist + ',' + (currliney + settings.legendiconh / 2) + ')')
			.attr('text-anchor', settings.legendhangleft ? 'end' : 'start')
			.attr('font-weight', 700)
			.attr('font-size', settings.legendfontsize)
			.attr('dominant-baseline', 'central')
			.text(d.name) // + (settings.samplecount4legend ? ' (sample count)' : ''))

		if (settings.linesep) {
			currlinex = settings.legendpadleft
			currliney += settings.legendlineh
		} else if (settings.legendhangleft) {
			currlinex = leftdist + 2 * settings.legendpadx
		} else {
			currlinex += settings.legendpadleft + grplabel.node().getBBox().width + 2 * settings.legendpadx
		}

		if (d.sorter) d.items.sort(d.sorter)

		if (d.d && d.d.renderAs == 'colorScale') {
			setColorBarLegend(g, d, i)
		} else {
			g.selectAll('g')
				.data(d.items)
				.enter()
				.append('g')
				//.attr('transform', 'translate(0,'+i*20+')')
				.each(addItem)
		}

		const bbox = grplabel.node().getBBox()
		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			grplabel.attr('y', bbox.height / 4)
		}
	}

	function addItem(d, i) {
		let g = select(this)
			.attr('transform', 'translate(' + currlinex + ',' + currliney + ')')
			.style('opacity', settings.itemOpacity)

		const itemlabel = g
			.append('text')
			.attr(
				'transform',
				'translate(' + (settings.legendiconw + settings.legendpadx / 2) + ',' + settings.legendiconh / 2 + ')'
			)
			.attr('font-size', settings.legendfontsize)
			.attr('dominant-baseline', 'central')
			.style('cursor', 'default')
			.style(
				'text-decoration',
				settings.exclude && settings.exclude.classes && settings.exclude.classes.includes(d.class) ? 'line-through' : ''
			)

		itemlabel.each(function(d) {
			const t = select(this)
			if (typeof d.text == 'string') {
				t.text(d.text)
			} else if (Array.isArray(d.text)) {
				t.selectAll('tspan')
					.data(d.text)
					.enter()
					.append('tspan')
					.text(d => d)
					.attr('dominant-baseline', 'central')
					.attr('x', function(dd, i) {
						if (i == 0) {
							select(this).attr('font-weight', 700)
							d.lastx =
								select(this)
									.node()
									.getComputedTextLength() + 10
							return 0
						} else if (d.lastx) {
							return d.lastx
						}
					})
			}
		})

		const bbox = itemlabel.node().getBBox()
		currlinex += settings.legendiconw + bbox.width + 2.5 * settings.legendpadx
		if (settings.legendlinesep || currlinex > settings.svgw - settings.legendpadright) {
			currliney += settings.legendlineh
			const leftdist = !settings.legendhangleft
				? settings.legendpadleft
				: settings.legendpadleft + settings.legendhangleft + settings.legendpadx

			g.attr('transform', 'translate(' + leftdist + ',' + currliney + ')')
			currlinex = settings.legendiconw + bbox.width + 2.5 * settings.legendpadx + settings.legendpadleft
			if (settings.legendhangleft) currlinex = settings.legendiconw + bbox.width + 2.5 * settings.legendpadx + leftdist
			else currlinex = settings.legendiconw + bbox.width + 2.5 * settings.legendpadx + settings.legendpadleft
		}

		const rect = g
			.append('rect')
			.attr('height', settings.legendiconh)
			.attr('width', settings.legendiconw)
			.attr('y', settings.legendfontsize - bbox.height + (bbox.height - settings.legendiconh) / 2)
			.attr('fill', opts.rectFillFxn)
			.attr('stroke', opts.iconStroke)
			.attr('shape-rendering', 'crispEdges')

		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			itemlabel.attr('y', bbox.height / 4)
		}
	}

	return render
}
