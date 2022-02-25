import { select, selectAll } from 'd3-selection'

export function labelAdjuster(opts) {
	let currLabels, currStep, raisedLabels
	let currFontSize, currLineH
	let foundOversized = false

	function main(labels) {
		currLabels = labels
		raisedLabels = []

		opts.steps.map((s, i) => {
			if (!(s.type in main.adjusters)) return
			currStep = s
			const labels = s.type == 'spread' ? raisedLabels : currLabels
			labels.map(trackdimensions)
			labels.map(main.adjusters[s.type])
		})
	}

	function trackdimensions(d, i) {
		if (i == 0) foundOversized = false
		if ('oversized' in d && !d.oversized) return
		if (!d.words) d.words = [d.label]

		const bbox = d.text.node().getBBox()
		d.w = bbox.width
		d.h = bbox.height
		d.oversized = d.w + opts.margin > d.maxw
		if (d.oversized) foundOversized = true

		d.start = d.center - d.w / 2 - opts.margin / 2
		d.end = d.center + d.w / 2 + opts.margin / 2

		if (!d.wlevels) d.wlevels = { 0: { start: d.start, end: d.end } }
		else if (!d.tspan) d.wlevels[0] = { start: d.start, end: d.end }
		else
			d.tspan.each((t, i) => {
				const w = d.w * (t.length / d.maxwordlen)
				const j = opts.stackSign == -1 ? d.words.length - 1 - i : i
				d.wlevels[j] = {
					start: d.center - w / 2 - opts.margin / 2,
					end: d.center + w / 2 + opts.margin / 2
				}
			})
	}

	main.opts = (_opts = {}) => {
		for (var key in _opts) opts[key] = _opts[key]
	}

	main.adjusters = {
		abbr: d => {
			if (!d.oversized || !d.label || !(d.label in currStep.shortnames)) return
			d.label = currStep.shortnames[d.label]
			d.text.text(d.label)
		},

		wrap: d => {
			d.words = d.label && currStep.delim ? d.label.split(currStep.delim) : [d.label]
			if (!d.oversized) return
			if (!currStep.delim || d.label.indexOf(currStep.delim) == -1) return
			d.maxwordlen = 0
			d.words.map(w => {
				if (w.length > d.maxwordlen) d.maxwordlen = w.length
			})
			d.text.text('')
			d.text.selectAll('tspan').remove()

			d.tspan = d.text
				.selectAll('tspan')
				.data(d.words)
				.enter()
				.append('tspan')
				.attr(
					'y',
					opts.stackSign == -1 ? (t, i) => (i - d.words.length + 1) * currStep.lineh : (t, i) => i * currStep.lineh
				)
				.attr('x', 0)
				.text(t => t)
		},

		resize: d => {
			if (!(d.oversized || (currStep.consistent && foundOversized))) return
			d.text.attr('font-size', currStep.fontsize)
			if (d.tspan)
				d.tspan.attr(
					'y',
					opts.stackSign == -1 ? (t, i) => (i + 1 - d.words.length) * currStep.lineh : (t, i) => i * currStep.lineh
				)
		},

		raise: (d, i) => {
			if (!d.oversized) return
			const prev = currLabels[i - 1]
			const next = currLabels[i + 1]
			if ((!prev || d.start > prev.end) && (!next || d.end < next.start)) return

			let okstart = true,
				okend = true
			const pw = prev ? prev.wlevels : null,
				nw = next ? next.wlevels : null,
				dw = d.wlevels

			// current label should not run into the middle of the prev or next label
			if (prev && prev.center + opts.margin > dw[0].start) okstart = false
			if (next && dw[0].end + opts.margin > next.start) okend = false

			if (okstart && okend) {
				// current level of tspan should not into the same level of prev or next
				for (let i in [0, 1, 2, 3, 4]) {
					if (!dw[i]) continue
					if (pw && pw[i] && pw[i].end > dw[i].start) okstart = false
					if (nw && nw[i] && dw[i].end > nw[i].start) okend = false
					if (!okstart || !okend) break
				}
				if (okstart && okend) return
			}

			const hurdle = !prev || (next && next.words.length > prev.words.length) ? next : prev
			//console.log(d.label + ' to be raised', okstart, okend, hurdle.words.length)
			if (!('raisedby' in hurdle)) hurdle.raisedby = 0
			d.raisedby = hurdle.words.length + hurdle.raisedby
			const h = opts.stackSign * d.raisedby * currStep.lineh
			const c = opts.tick.centeron
			const e = opts.tick.extendon

			d.raisedh = h /*- opts.margin*/ + (opts.stackSign == -1 ? 0 : currStep.lineh)

			d.line = d.g
				.append('line')
				.attr(c + '1', 0)
				.attr(c + '2', 0)
				.attr(e + '1', opts.stackSign == -1 ? 0 : opts.tick.direction * h + opts.margin - currStep.lineh)
				.attr(e + '2', opts.stackSign == -1 ? -opts.tick.direction * h : -currStep.lineh) //+opts.margin)
				.attr('stroke', '#555')
				.attr('shape-rendering', 'crispEdges')

			if (!d.tspan) d.text.attr('x', 0).attr('y', d.raisedh)
			else
				d.tspan
					.attr('x', 0)
					.attr(
						'y',
						opts.stackSign == -1
							? (t, i) => (i - d.words.length + 1) * currStep.lineh + d.raisedh
							: (t, i) => i * currStep.lineh + d.raisedh
					)

			const newlevels = {}
			for (var i in d.wlevels) {
				newlevels[i + hurdle.words.length] = d.wlevels[i]
			}
			d.wlevels = newlevels
			raisedLabels.push(d)
			//console.log(prev?prev.wlevels[0]:0, d.wlevels[0], next?next.wlevels[0]:0)
		},

		spread: (d, i) => {
			if (!d.oversized) return
			const prev = raisedLabels[i - 1]
			const next = raisedLabels[i + 1]
			if ((!prev || d.start > prev.end) && (!next || d.end < next.start)) return

			if (d.tspan) {
				d.tspan.remove()
				delete d.tspan //console.log('spreading '+ d.label)
			}

			d.text.text(d.label).attr('font-size', currStep.fontsize)
			d.w = d.text.node().getBBox().width
			if (opts.stackSign == 1) d.raisedh += -1 * (d.words.length - 1) * currStep.lineh + opts.margin

			d.words = [d.label]
			d.text.attr('x', -d.w / 2 + opts.margin).attr('y', d.raisedh)
		},

		rotate: (d, i) => {
			if (!d.oversized) return

			const t = d.text.attr('transform')
			const currdegree = t && t.indexOf('rotate(90)') != -1 ? 90 : t && t.indexOf('rotate(-90)') != -1 ? -90 : 0

			// to-do: allow tspan when degree!=0
			if (d.tspan && currdegree == 0) {
				d.tspan.remove()
				delete d.tspan
				d.words = [d.label]
			}

			if (d.line) {
				// no need for connector line
				d.line.remove()
				delete d.line
			}

			d.text.attr('font-size', currStep.fontsize)
			if (!d.tspan) d.text.text(d.label)

			const bbox = d.text.node().getBBox()
			d.w = bbox.width
			d.h = bbox.height

			const degree = currdegree == 0 && opts.tick.centeron == 'x' ? opts.stackSign * 90 : 0
			const x =
				currdegree == -90 && opts.tick.centeron == 'y'
					? -d.w / 2
					: currdegree == 90 && opts.tick.centeron == 'y'
					? d.w / 2
					: degree == -90
					? d.w / 2
					: degree == 90
					? d.w / 2 - currStep.lineh
					: 0
			const y =
				opts.tick.centeron == 'x' && degree == 90 ? d.h / 3 : opts.tick.centeron == 'x' && degree == -90 ? d.h / 3 : 0
			const rotate = 'rotate(' + degree + ')'

			const translate = !d.tspan || degree != 0 ? '' : 'translate(0,' + d.h / 3 + ')' //wrapped
			const textanchor = !d.tspan || degree != 0 ? 'middle' : x < 0 ? 'end' : 'start'

			d.text
				.attr('font-size', currStep.fontsize)
				.attr('x', x)
				.attr('y', y)
				.attr('transform', translate + rotate)
				.attr('text-anchor', textanchor)
		}
	}

	return main
}
