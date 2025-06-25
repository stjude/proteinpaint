import { select } from 'd3-selection'
import { ColorScale } from '#dom'

export default function svgLegend(opts) {
	let currlinex = 0
	let currliney = 0
	let currG

	const defaultSettings = {
		ontop: false,
		lineh: 25,
		padx: 5,
		padleft: 0, //150,
		padright: 20,
		padbtm: 30,
		fontsize: 12,
		iconh: 10,
		iconw: 10,
		hangleft: 1,
		linesep: false,
		mutationorder: [
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
		],
		itemOpacity: 1
	}

	const settings = Object.assign(defaultSettings, opts.settings || {})

	function render(data, overrides = {}) {
		Object.assign(settings, overrides.settings || {})
		currlinex = settings.padleft
		currliney = 0

		opts.holder.selectAll('g').remove()
		opts.holder.selectAll('text').remove()
		const d = settings.dimensions
		if (!opts.holder.attr('transform')) {
			// d.yOffset should be used instead of settings.svgh ???
			opts.holder.attr('transform', settings.ontop ? null : `translate(${d.xOffset},${settings.svgh})`)
		}
		if (opts.note) {
			opts.holder
				.append('text')
				.style('font-size', '0.8em')
				.text(opts.note)
				.attr('transform', `translate(-135, 15)`)
				.attr('font-style', 'italic')
		}
		const l = opts.holder.selectAll('g').data(data)

		l.exit().remove()
		l.enter().append('g').each(addGroup)

		return currliney + settings.lineh + settings.padbtm
	}

	function addGroup(d, i) {
		if (!d.items || !d.items.length) return
		currlinex = 0
		currliney += settings.lineh

		let g = select(this).style('opacity', d.crossedOut ? '0.6' : 1)
		const leftdist = settings.hangleft ? settings.padleft + settings.hangleft - settings.padx : settings.padleft

		const grplabel = g
			.append('text')
			.attr('transform', 'translate(' + leftdist + ',' + (currliney + settings.iconh / 2) + ')')
			.attr('text-anchor', settings.hangleft ? 'end' : 'start')
			.attr('font-weight', 700)
			.attr('font-size', settings.fontsize)
			.attr('dominant-baseline', 'central')
			.text(d.name)
			.style('text-decoration', d.crossedOut ? 'line-through' : '')

		if (settings.linesep) {
			currlinex = settings.padleft
			currliney += settings.lineh
		} /* else if (d.hasScale) {
			currlinex = leftdist - 2 * settings.padx + 2
		} */ else if (d.hasScale || settings.hangleft) {
			currlinex = leftdist + 2 * settings.padx
		} else {
			currlinex += settings.padleft + grplabel.node().getBBox().width + 2 * settings.padx
		}

		if (d.sorter) d.items.sort(d.sorter)

		g.selectAll('g')
			.data(d.items)
			.enter()
			.append('g')
			//.attr('transform', 'translate(0,'+i*20+')')
			.each(addItem)

		const bbox = grplabel.node().getBBox()
		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			grplabel.attr('y', bbox.height / 4)
		}
	}

	function addItem(d, i) {
		const g = select(this)
			.attr('transform', 'translate(' + currlinex + ',' + currliney + ')')
			.style('opacity', settings.itemOpacity)
			.style('opacity', d.greyedOut ? '0.6' : 1)

		const itemlabel = g
			.append('text')
			.attr('transform', 'translate(' + (settings.iconw + settings.padx / 2) + ',' + settings.iconh / 2 + ')')
			.attr('font-size', settings.fontsize)
			.attr('dominant-baseline', 'central')
			.style('cursor', 'default')
			.style(
				'text-decoration',
				(settings.exclude && settings.exclude.classes && settings.exclude.classes.includes(d.class)) || d.crossedOut
					? 'line-through'
					: ''
			)

		itemlabel.each(function (d) {
			const t = select(this)
			if (settings.isExcludedAttr && d[settings.isExcludedAttr]) {
				t.style('text-decoration', 'line-through').style('opacity', 0.5)
			}
			if (typeof d.text == 'string') {
				t.text(d.text)
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

			if (d.onClickCallback) {
				t.on('click', () => d.onClickCallback(d, t))
				t.style('cursor', 'pointer')
			}
		})

		const bbox = itemlabel.node().getBBox()
		const width = d.width || settings.iconw
		currlinex += bbox.width + width
		if (settings.linesep || currlinex > settings.svgw - settings.padright) {
			currliney += settings.lineh
			const leftdist = !settings.hangleft ? settings.padleft : settings.padleft + settings.hangleft + settings.padx

			g.attr('transform', 'translate(' + leftdist + ',' + currliney + ')')
			currlinex = bbox.width + width + settings.padleft
			if (settings.hangleft) currlinex = settings.iconw + bbox.width + leftdist
			else currlinex = width + bbox.width + settings.padleft
		}

		const y = settings.fontsize - bbox.height + (bbox.height - settings.iconh) / 2
		let colorGradientId
		if (d.domain) {
			colorGradientId = `sjpp-linear-gradient-${getId()}`
			const domain = d.domain || [d.minLabel, d.maxLabel]
			const yPos = y + 3
			const min = d.domain[0]
			const max = d.domain[d.domain.length - 1]
			const domainRange = Math.abs(max - min)

			const opts = {
				barwidth: width,
				barheight: settings.iconh,
				colors: d.colors || d.scale.range() || ['white', 'grey'],
				domain,
				fontSize: 0.82 * settings.fontsize,
				holder: g,
				id: colorGradientId,
				position: `${bbox.width + 25},${yPos}`,
				showNumsAsIs: d.showNumsAsIs || false,
				tickSize: 2,
				topTicks: true
			}
			if (!d.showNumsAsIs) {
				//console.warn fires if both .showNumsAsIs and .ticks are set
				opts.ticks = 3
			}
			if (d.labels) {
				opts.labels = d.labels
				if (d.text) opts.position = `${bbox.width + bbox.x + 45 + settings.padx},${yPos}`
			}
			// Ticks must be spaced appropriately for loss and gain
			// scales. Lowering the range for smaller ranges
			// appropriates spaces the scale ticks
			if ((min == 0 || max == 0) && domainRange > 1) {
				opts.ticks = domainRange > 5 ? 2 : 1
			}
			if (d.numericInputs) opts.numericInputs = d.numericInputs

			new ColorScale(opts)

			if (opts.labels) currlinex += bbox.width + 25 + 15 * settings.padx
			else currlinex += 10 * settings.padx
		} else {
			g.append('rect')
				.attr('height', settings.iconh)
				.attr('width', width)
				//.attr('x', bbox.width)
				.attr('y', y)
				.attr('fill', colorGradientId ? `url(#${colorGradientId})` : opts.rectFillFxn)
				.attr('stroke', opts.iconStroke)
				.attr('shape-rendering', 'crispEdges')

			currlinex += 2.5 * settings.padx
		}

		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			itemlabel.attr('y', bbox.height / 4)
		}
	}

	return render
}

let i = 0
function getId() {
	return `${i++}-${Date.now().toString().slice(-6)}-${Math.random().toString().slice(-6)}`
}
