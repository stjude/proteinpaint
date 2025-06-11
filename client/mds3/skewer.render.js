import { select as d3select } from 'd3-selection'
import { arc as d3arc } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { click_variant } from './clickVariant'
import { dtsnvindel, dtsv, dtfusionrna, mclass } from '#shared/common.js'
import { renderSkewerShapes, renderShapeKick, setNumBaseline } from './skewer.render.shapes.ts'
import { shapes } from '#dom/shapes'

/*
********************** EXPORTED
skewer_make
settle_glyph
unfold_glyph
fold_glyph
skewer_sety
mayHighlightDiskBySsmid
********************** INTERNAL
skewer_setstem
settle_glyph
unfold_update
horiplace
horiplace0
*/

const modefold = 0
const modeshow = 1
const middlealignshift = 0.3
const disclabelspacing = 1 // px spacing between disc and label
const textlensf = 0.6 // to replace n.getBBox().width for detecting filling font size which breaks in chrome

/*
sets tk.skewer.maxheight
*/
export function skewer_make(tk, block) {
	const ss = tk.skewer

	for (const d of ss.data) {
		d.x0 = d.x
		if (d.xoffset != undefined) {
			d.x = d.x0 + d.xoffset
		}
		// updates x
		// create stack bars
		for (const g of d.groups) {
			g.aa = d // disc reference group
		}
	}

	const dotwidth = Math.max(14, block.width / 110)
	// create skewers for all data (single or multiple) and compute width

	// get max m count for discs, for scaling disc radius
	let mdc = 0
	for (const d of ss.data) {
		for (const g of d.groups) {
			mdc = Math.max(mdc, g.occurrence)
		}
	}
	let mrd = 0 // max disc radius
	const w = Math.pow(dotwidth / 2, 2) * Math.PI // unit area
	if (mdc <= 10) mrd = w * mdc * 0.9
	else if (mdc <= 100) mrd = w * 10
	else if (mdc <= 1000) mrd = w * 14
	else mrd = w * 20
	// scale for disc radius
	const sf_discradius = scaleLinear()
		.domain([1, mdc * 0.5, mdc * 0.6, mdc * 0.7, mdc * 0.8, mdc])
		.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])

	let globalmaxradius = dotwidth / 2
	ss.maxheight = 0
	for (const d of ss.data) {
		// settings may have been carried over from previous rendering
		if (d.showmode == undefined) d.showmode = modefold
		if (d.slabelrotate == undefined) d.slabelrotate = false
		// determine dimension for this skewer, do not position or render yet
		// compute radius for each group
		d.maxradius = 0
		d.maxrimwidth = 0
		d.width = 0
		d.slabelwidth = 0
		for (const r of d.groups) {
			if (r.occurrence <= 1) {
				/*
				protect against occurrence=0 or even negative, which can break scale
				*/
				r.radius = dotwidth / 2
			} else {
				const digc = r.occurrence.toString().length
				r.radius = Math.max(Math.sqrt(sf_discradius(r.occurrence) / Math.PI), digc * 5)
			}
			d.maxradius = Math.max(d.maxradius, r.radius)
			globalmaxradius = Math.max(globalmaxradius, r.radius)

			r.rimwidth = r.rim1count + r.rim2count == 0 ? 0 : Math.max(2, r.radius / 6)
			d.maxrimwidth = Math.max(d.maxrimwidth, r.rimwidth)
		}
		let totalheight = 0
		for (const r of d.groups) {
			r.yoffset = totalheight + r.radius + r.rimwidth // immutable, y shift at expand mode
			totalheight += (r.radius + r.rimwidth) * 2
		}
		ss.maxheight = Math.max(ss.maxheight, totalheight)
	}

	if (!tk.shapes) {
		/** TODO: This assumes every skewer track has mutations
		 * In future change to accept other annotations
		 */
		if (!tk.shapeBy) {
			tk.shapes = {}
			Object.keys(mclass).forEach(v => (tk.shapes[v] = 'filledCircle'))
		}
	}

	ss.selection = ss.g
		.selectAll()
		.data(ss.data)
		.enter()
		.append('g')
		.attr('class', 'sja_skg')
		.each(function (d) {
			d.skewer = this
		})

	// disc containers
	const discg = ss.selection
		.selectAll()
		.data(d => d.groups)
		.enter()
		.append('g')
		.attr(
			'transform',
			d => 'translate(0,' + (d.aa.showmode == modefold ? 0 : d.yoffset * (tk.skewer.pointup ? -1 : 1)) + ')'
		)
		.attr('class', 'sja_aa_discg')
		.each(function (d) {
			d.g = this
			if (!d.shape) {
				//TODO: Add logic to determine when to apply shape or color
				// and which annotation to use if multiple (i.e. tk.shapeBy)
				d.shape = tk.shapes[d.mlst[0].class]
			}
			if (!d.shape.includes('Circle')) {
				//Use existing rendering code for circle shapes
				renderSkewerShapes(tk, ss, d3select(this))
			} else {
				// actual disc
				const discdot = d3select(this).append('circle')

				// full filled
				discdot
					.filter(d => d.dt == dtsnvindel || d.dt == dtsv || d.dt == dtfusionrna)
					.attr('fill', d => (!shapes[d.shape].isFilled ? 'white' : tk.color4disc(d.mlst[0])))
					.attr('stroke', d => (!shapes[d.shape].isFilled ? tk.color4disc(d.mlst[0]) : 'white'))
					.attr('r', d => d.radius - 0.5)
				// masking half
				d3select(this)
					.filter(d => d.dt == dtfusionrna || d.dt == dtsv)
					.append('path')
					.attr('fill', d => (!shapes[d.shape].isFilled ? tk.color4disc(d.mlst[0]) : 'white'))
					.attr('stroke', 'none')
					.attr('d', d =>
						d3arc()({
							innerRadius: 0,
							outerRadius: d.radius - 2,
							/**** Always show the colored area on the correct side ****
							 * Preserves showing the colored:white areas regardless if
							 * the shape is filled or not
							 */
							startAngle: d.useNterm == shapes[d.shape].isFilled ? 0 : Math.PI,
							endAngle: d.useNterm == shapes[d.shape].isFilled ? Math.PI : Math.PI * 2
						})
					)
			}
		})

	// number in disc
	const textslc = discg
		.filter(d => d.occurrence > 1)
		.append('text')
		.text(d => d.occurrence)
		.attr('class', 'sja_aa_discnum')
		.attr('fill-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('stroke-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('dominant-baseline', d => (tk.shapes ? setNumBaseline(d.shape, tk.skewer.pointup) : ''))
		.attr('text-anchor', 'middle')
		.each(d => {
			const s = d.radius * 1.5
			d.discnumfontsize = Math.min(s / (d.occurrence.toString().length * textlensf), s)
		})
		.attr('font-size', d => d.discnumfontsize)
		.attr('y', d => d.discnumfontsize * middlealignshift)
	textslc
		.filter(d => d.dt == dtsnvindel)
		.attr('fill', d => (tk.shapes && !shapes[d.shape].isFilled ? 'black' : 'white'))
	textslc
		.filter(d => d.dt == dtsv || d.dt == dtfusionrna)
		.attr('stroke', d => tk.color4disc(d.mlst[0]))
		.attr('stroke-width', 0.8)
		.attr('font-weight', 'bold')
		.attr('fill', 'white')
	// right-side label
	const textlab = discg
		.append('text')
		.text(d => d.mnameCompact || tk.mnamegetter(d.mlst[0]))
		.attr('font-size', d => {
			d._labfontsize = Math.max(12, d.radius * 1.2)
			return d._labfontsize
		})
		.each(function (d) {
			// after setting font size, set skewer width by label width
			const lw = this.getBBox().width
			d._label_width = lw
			if (d.aa.groups.length == 1) {
				d.aa.slabelrotate = true
				d.aa.slabelwidth = lw
				// skewer has single disc, label may rotate up, thus should be considerred in skewer maxheight
				ss.maxheight = Math.max(ss.maxheight, (d.radius + d.rimwidth) * 2 + 2 + lw)
			}
		})
		.attr('fill', d => tk.color4disc(d.mlst[0]))
		.attr('x', d => d.radius + d.rimwidth + 1)
		.attr('y', d => d._labfontsize * middlealignshift)
		.classed('sja_aa_disclabel', true)
		.attr('fill-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('transform', 'scale(1) rotate(0)')
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('click', (event, d) => {
			fold_glyph([d.aa], tk)
			unfold_update(tk, block)
		})
		.on('mouseover', (event, d) => {
			event.target.setAttribute('font-size', d._labfontsize * 1.1)
			showHoverTipOnDisk(event, d, tk)
		})
		.on('mouseout', (event, d) => {
			event.target.setAttribute('font-size', d._labfontsize)
			tk.hovertip.hide()
		})

	// red box for highlighting, under the kick cover
	ss.hlBoxG = discg.append('g')

	// pulsating label, not in use
	// textlab.filter(d => d.mlst.find(m => tk.hlssmid.has(m.ssm_id))).classed('sja_pulse', true)

	// skewer width
	for (const d of ss.data) {
		let leftw = 0,
			rightw = 0
		for (const g of d.groups) {
			leftw = Math.max(leftw, g.radius + g.rimwidth)
			rightw = Math.max(rightw, g.radius + g.rimwidth + disclabelspacing + g._label_width)
		}
		d.width = leftw + rightw
	}

	let kick
	// invisible kicking disc cover
	if (tk.shapes) {
		//Returns the kick in the same shape if skewer is not a circle
		kick = renderShapeKick(ss, discg)
	} else {
		kick = discg.append('circle').attr('r', d => d.radius - 0.5)
	}

	kick
		.attr('stroke', d => tk.color4disc(d.mlst[0]))
		.classed('sja_aa_disckick', true)
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('mouseover', (event, d) => {
			showHoverTipOnDisk(event, d, tk)
			if (tk.disc_mouseover) {
				tk.disc_mouseover(d, event.target)
			}
		})
		.on('mouseout', (event, d) => {
			tk.hovertip.hide()
			if (tk.disc_mouseout) {
				tk.disc_mouseout(d)
			}
		})
		.on('click', async (event, d) => {
			click_variant(d, tk, block, event.target.getBoundingClientRect(), event.target)
		})
	// disc rims
	const rimfunc = d3arc()
		.innerRadius(d => d.radius)
		.outerRadius(d => d.radius + d.rimwidth)
		.startAngle(0)
		.endAngle(d => {
			d.rim1_startangle = (Math.PI * 2 * d.rim1count) / d.occurrence
			return d.rim1_startangle
		})
	discg
		.filter(d => d.rim1count > 0)
		.append('path')
		.attr('d', rimfunc)
		.attr('fill', d => tk.color4disc(d.mlst[0]))
		.attr('class', 'sja_aa_discrim')
		.attr('fill-opacity', 0)

	const rimfunc2 = d3arc()
		.innerRadius(d => d.radius + 0.5)
		.outerRadius(d => d.radius + 0.5 + d.rimwidth)
		.startAngle(d => d.rim1_startangle)
		.endAngle(d => d.rim1_startangle + (Math.PI * 2 * d.rim2count) / d.occurrence)
	discg
		.filter(d => d.rim2count > 0)
		.append('path')
		.attr('d', rimfunc2)
		.attr('stroke', d => tk.color4disc(d.mlst[0]))
		.attr('fill', 'none')
		.attr('class', 'sja_aa_discrim')
		.attr('stroke-opacity', 0)
	// set stem lengths
	{
		// stem 1,2
		let lapcount = 0
		let lastx = 0
		for (const d of ss.data) {
			if (d.x - d.maxradius - d.maxrimwidth < lastx) {
				lapcount++
			}
			lastx = Math.max(lastx, d.x + d.width - d.maxradius - d.maxrimwidth)
		}
		// stem1
		ss.stem1 = lapcount == 0 ? 0 : dotwidth
		// stem2
		ss.stem2 = scaleLinear()
			.domain([0, 1, ss.data.length])
			.range([0, dotwidth, dotwidth * 3])(lapcount)
	}
	// stem3
	const hbaseline = dotwidth * 0.7
	// to set stem3, get max group size
	let maxm = 0
	for (const d of ss.data) {
		for (const g of d.groups) {
			maxm = Math.max(maxm, g.occurrence)
		}
	}
	ss.stem3 = Math.max(2, hbaseline + dotwidth * Math.min(5, maxm))

	let foldedKick
	// invisible kicking skewer cover when folded
	if (tk.shapes) {
		//Returns the kick in the same shape if skewer is not a circle
		foldedKick = renderShapeKick(ss, ss.selection)
		foldedKick.attr('transform', d => `translate(0, ${(tk.skewer.pointup ? -1 : 1) * d.maxradius})`)
	} else {
		foldedKick = ss.selection
			.append('circle')
			.attr('r', d => d.maxradius + 1)
			.attr('cy', d => (tk.skewer.pointup ? -1 : 1) * d.maxradius)
			.attr('transform', d => `scale(${d.showmode == modefold ? '1,1' : '0.01,0.01'})`) // "scale(0)" will not make the circle disappear on safari
	}

	foldedKick
		.attr('class', 'sja_aa_skkick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke', 'none')
		.on('mouseover', (event, d) => {
			let cumh = 0
			let boxw = 0
			const hpad = 5
			const tiph = tk.skewer.pointup ? 7 : 14
			for (const g of d.groups) {
				g.pica_fontsize = Math.max(11, g.radius)
				cumh += g.pica_fontsize + 1
				tk.pica.g
					.append('text')
					.text((g.mnameCompact || g.mlst[0].mname) + (g.occurrence > 1 ? ' x' + g.occurrence : ''))
					.attr('font-size', g.pica_fontsize)
					.each(function () {
						boxw = Math.max(boxw, this.getBBox().width)
					})
					.remove()
			}
			boxw += hpad * 2
			const boxh = cumh + 5
			tk.pica.g
				.append('rect')
				.attr('y', tk.skewer.pointup ? -boxh : 0)
				.attr('width', boxw)
				.attr('height', boxh)
				.attr('fill', 'white')
				.attr('fill-opacity', 0.8)
				.attr('stroke', '#ccc')
				.attr('shape-rendering', 'crispEdges')
			cumh = 0
			const _g = tk.pica.g
				.selectAll()
				.data(d.groups)
				.enter()
				.append('g')
				.attr('transform', (g, i) => {
					cumh += g.pica_fontsize + 1
					return 'translate(' + hpad + ',' + cumh * (tk.skewer.pointup ? -1 : 1) + ')'
				})
			_g.append('text')
				.text(g => g.mnameCompact || g.mlst[0].mname)
				.attr('font-size', g => g.pica_fontsize)
				.each(function (g) {
					g.pica_mlabelwidth = this.getBBox().width
				})
				.attr('fill', d => tk.color4disc(d.mlst[0]))
				.attr('dominant-baseline', tk.skewer.pointup ? 'hanging' : 'auto')
			const firstlabw = d.groups[0].pica_mlabelwidth
			tk.pica.x = d.x - hpad - firstlabw / 2
			tk.pica.y = d.y + (tk.skewer.pointup ? -1 : 1) * (d.maxradius * 2 + tiph + 2)
			tk.pica.g.attr('transform', 'translate(' + tk.pica.x + ',' + tk.pica.y + ')')
			_g.filter(g => g.occurrence > 1)
				.append('text')
				.text(g => 'x' + g.occurrence)
				.attr('x', g => g.pica_mlabelwidth + 5)
				.attr('font-size', g => g.pica_fontsize)
				.attr('dominant-baseline', tk.skewer.pointup ? 'hanging' : 'auto')
				.attr('fill', '#9e9e9e')
			const handle = tk.pica.g
				.append('g')
				.attr('transform', 'translate(' + (hpad + firstlabw / 2) + ',' + (tk.skewer.pointup ? 1 : -1) + ')')
			handle
				.append('line')
				.attr('y2', (tk.skewer.pointup ? 1 : -1) * tiph)
				.attr('stroke', '#858585')
				.attr('shape-rendering', 'crispEdges')
			handle
				.append('line')
				.attr('x1', -1)
				.attr('x2', -1)
				.attr('y2', (tk.skewer.pointup ? 1 : -1) * tiph)
				.attr('stroke', 'white')
				.attr('shape-rendering', 'crispEdges')
			handle
				.append('line')
				.attr('x1', 1)
				.attr('x2', 1)
				.attr('y2', (tk.skewer.pointup ? 1 : -1) * tiph)
				.attr('stroke', 'white')
				.attr('shape-rendering', 'crispEdges')
		})
		.on('mouseout', (event, d) => {
			tk.pica.g.selectAll('*').remove()
		})
		.on('click', (event, d) => {
			tk.pica.g.selectAll('*').remove()
			unfold_glyph([d], tk, block)
		})
	// set fold y offset
	// get max mcount for skewers
	let mm = 0
	for (const d of ss.data) {
		mm = Math.max(mm, d.occurrence)
	}
	const sf_foldyoff = scaleLinear()
		.domain([1, mm])
		.range([hbaseline, ss.stem3 - globalmaxradius])
	ss.selection.attr('transform', d => {
		d.foldyoffset = sf_foldyoff(d.occurrence)
		d.y = skewer_sety(d, tk)
		return 'translate(' + d.x + ',' + d.y + ')'
	})
	// no stackbars
	// stem
	ss.selection
		.append('path')
		.attr('class', 'sja_aa_stem')
		.attr('d', d => skewer_setstem(d, tk))
		.attr('stroke', d => tk.color4disc(d.groups[0].mlst[0]))
		.attr('fill', 'none')
	// ssk: only for skewers with >1 groups
	const mgsk = ss.selection.filter(d => d.groups.length > 1)
	mgsk
		.append('rect')
		.attr('class', 'sja_aa_ssk_bg')
		.attr('shape-rendering', 'crispEdges')
		.attr('fill-opacity', 0)
		.attr('height', ss.stem1)
		.attr('fill', d => tk.color4disc(d.groups[0].mlst[0]))
		.attr('width', d => {
			d.ssk_width = Math.max(d.occurrence.toString().length * 8 + 6, 2 * (d.maxradius + d.maxrimwidth))
			return d.ssk_width
		})
		.attr('x', d => -d.ssk_width / 2)
	mgsk
		.append('text')
		.attr('class', 'sja_aa_ssk_text')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('font-weight', 'bold')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.text(d => d.occurrence)
		.each(d => {
			d.ssk_fontsize = Math.min(ss.stem1, d.ssk_width / (d.occurrence.toString().length * textlensf))
		})
		.attr('font-size', d => d.ssk_fontsize)
	// ssk - kick
	mgsk
		.append('rect')
		.attr('class', 'sja_aa_ssk_kick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke', 'none')
		.attr('height', ss.stem1)
		.attr('x', d => -d.ssk_width / 2)
		.attr('width', d => d.ssk_width)
		.on('mouseover', (event, d) => {
			const p = d3select(event.target.parentNode)
			p.selectAll('.sja_aa_disckick').transition().attr('stroke-opacity', 1)
			p.select('.sja_aa_ssk_bg').transition().attr('fill-opacity', 1).attr('stroke-opacity', 1)
			p.select('.sja_aa_ssk_text').transition().attr('fill-opacity', 1)
		})
		.on('mouseout', function (event, d) {
			const p = d3select(event.target.parentNode)
			p.selectAll('.sja_aa_disckick').transition().attr('stroke-opacity', 0)
			p.select('.sja_aa_ssk_bg').transition().attr('fill-opacity', 0).attr('stroke-opacity', 0)
			p.select('.sja_aa_ssk_text').transition().attr('fill-opacity', 0)
		})
		.on('click', async (event, d) => {
			click_variant(d, tk, block, event.target.getBoundingClientRect(), null, event.target)
		})
}

export function skewer_sety(d, tk) {
	if (tk.skewer.pointup) {
		if (d.showmode == modefold) {
			return tk.skewer.maxheight + tk.skewer.stem1 + tk.skewer.stem2 + tk.skewer.stem3 - d.foldyoffset
		}
		return tk.skewer.maxheight
	}
	if (d.showmode == modefold) return d.foldyoffset
	return tk.skewer.stem1 + tk.skewer.stem2 + tk.skewer.stem3
}

function skewer_setstem(d, tk) {
	if (tk.skewer.pointup) {
		if (d.showmode == modefold) {
			return 'M0,0v0l0,0v' + d.foldyoffset
		}
		return 'M0,0v' + tk.skewer.stem1 + 'l' + (d.x0 - d.x) + ',' + tk.skewer.stem2 + 'v' + tk.skewer.stem3
	}
	if (d.showmode == modefold) {
		return 'M0,0v0l0,0v-' + d.foldyoffset
	}
	return 'M0,0v-' + tk.skewer.stem1 + 'l' + (d.x0 - d.x) + ',-' + tk.skewer.stem2 + 'v-' + tk.skewer.stem3
}

export function settle_glyph(tk, block) {
	if (tk.skewer.data.length == 0) return
	const x1 = 0
	const x2 = block.width
	// only settle those in view range
	// sum of skewer width, determines whether full or pack
	let sumwidth = 0
	const allinview = []
	const beyondviewitems = []
	for (const d of tk.skewer.data) {
		if (d.x0 < x1 || d.x0 > x2) {
			delete d.xoffset
			beyondviewitems.push(d)
		} else {
			// important: singleton label is rotated by default, must not include label width
			sumwidth += d.slabelrotate ? (d.groups[0].radius + d.groups[0].rimwidth) * 2 : d.width
			allinview.push(d)
		}
	}

	// reset those beyond view range
	fold_glyph(beyondviewitems, tk)
	// TODO may move d.x to +/-1000 out of sight

	let expandlst = []
	const foldlst = []

	if (sumwidth < x2 - x1) {
		// skewers can show in full
		expandlst = allinview
	} else {
		// rank skewers by ...
		allinview.sort((a, b) => {
			if (b.occurrence == a.occurrence) {
				if (b.groups.length == a.groups.length) {
					//return Math.abs(a.aapos*2-aarangestart-aarangestop)-Math.abs(b.aaposition*2-aarangestart-aarangestop);
					return Math.abs(a.x0 * 2 - x1 - x2) - Math.abs(b.x0 * 2 - x1 - x2)
				} else {
					return b.groups.length - a.groups.length
				}
			}
			return b.occurrence - a.occurrence
		})
		// collect top items to expand
		let width = 0
		let allowpx = (x2 - x1) * 0.8
		let stop = false
		for (const d of allinview) {
			if (stop) {
				delete d.xoffset
				foldlst.push(d)
				d.showmode = modefold
			} else {
				if (width + d.width < allowpx) {
					expandlst.push(d)
					width += d.width
				} else {
					stop = true
					delete d.xoffset
					foldlst.push(d)
					d.showmode = modefold
				}
			}
		}
	}
	fold_glyph(foldlst, tk)
	unfold_glyph(expandlst, tk, block)
}

export function unfold_glyph(newlst, tk, block) {
	const dur = 1000
	// set up new items
	const expanded = new Set() // d.x as key
	const folded = new Set()
	let hasfolded = false
	for (const d of newlst) {
		if (d.showmode == modeshow) {
			expanded.add(d.x0)
		} else {
			d.showmode = modeshow
			folded.add(d.x0)
			hasfolded = true
			d.y = skewer_sety(d, tk)
		}
	}
	if (hasfolded) {
		// vertical extending
		const set = tk.skewer.selection.filter(d => folded.has(d.x0))
		set
			.transition()
			.duration(dur)
			.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		set
			.selectAll('.sja_aa_discg')
			.transition()
			.duration(dur)
			.attr('transform', d => {
				d.y = d.yoffset * (tk.skewer.pointup ? -1 : 1)
				return 'translate(0,' + d.y + ')'
			})
		set
			.selectAll('.sja_aa_disckick')
			.transition()
			.duration(dur)
			.attr('transform', 'scale(1)')
			.on('end', () => {
				// on disckick fully expanded, make ssk_kick visible
				set
					.selectAll('.sja_aa_ssk_kick')
					.attr('transform', 'scale(1)')
					.attr('y', tk.skewer.pointup ? 0 : -tk.skewer.stem1)

				//For e2e testing
				set.selectAll('.sja_aa_disckick').classed('sjpp-active', true)
			})
		set.selectAll('.sja_aa_discnum').transition().duration(dur).attr('fill-opacity', 1).attr('stroke-opacity', 1)
		set
			.filter(d => d.groups.length > 1)
			.selectAll('.sja_aa_disclabel')
			.transition()
			.duration(dur)
			.attr('fill-opacity', 1)
			.attr('transform', 'scale(1)')
		set.selectAll('.sja_aa_discrim').transition().duration(dur).attr('fill-opacity', 1).attr('stroke-opacity', 1)

		/**** do not expand sja_aa_ssk_kick at this moment but wait till disckick is fully expanded:
		if ssk is expanded right now, cursor hover over it will halt disckick expanding transition and cause the discs to be unclickable
		*/

		set
			.selectAll('.sja_aa_ssk_bg')
			.attr('transform', 'scale(1)')
			.attr('y', tk.skewer.pointup ? 0 : -tk.skewer.stem1)
		set
			.selectAll('.sja_aa_ssk_text')
			.attr('transform', 'scale(1)')
			.attr('y', ((tk.skewer.pointup ? 1 : -1) * tk.skewer.stem1) / 2)
		set
			.selectAll('.sja_aa_skkick')
			.transition()
			.duration(0)
			.attr(
				'transform',
				d =>
					`${
						d.shape && !d.shape.includes('Circle') ? `translate(0, ${(tk.skewer.pointup ? -1 : 1) * d.maxradius})` : ''
					} scale(0.01, 0.01)` // safari fix
			)
			.on('end', () => {
				//For e2e testing
				set.selectAll('.sja_aa_skkick').classed('sjpp-active', false)
			})
		let counter = 0
		set
			.selectAll('.sja_aa_stem')
			.transition()
			.duration(dur)
			.attr('d', d => skewer_setstem(d, tk))
			.each(() => ++counter)
			.on('end', () => {
				if (!--counter) {
					unfold_update(tk, block)
				}
			})
	} else {
		unfold_update(tk, block)
	}
}

function unfold_update(tk, block) {
	const dur = 1000
	const alllst = [] // already expanded
	const hash = new Set() // d.x0 as key
	const x1 = 0
	const x2 = block.width
	for (const d of tk.skewer.data) {
		if (d.x0 < x1 || d.x0 > x2) continue
		if (d.showmode == modeshow) {
			d.x = d.x0
			alllst.push(d)
			hash.add(d.x0)
		}
	}
	if (alllst.length == 0) {
		return
	}
	horiplace(alllst, tk, block)
	for (const d of alllst) {
		d.xoffset = d.x - d.x0
	}
	for (let i = 0; i < alllst.length; i++) {
		const d = alllst[i]
		if (d.groups.length > 1) continue
		// single
		const disc = d.groups[0]
		if (tk.slabel_forcerotate) {
			d.slabelrotate = true
		} else {
			const next = alllst[i + 1]
			const rightx = next ? next.x - next.maxradius - next.maxrimwidth : x2
			d.slabelrotate = rightx - d.x - disc.radius - disc.rimwidth - 1 < d.slabelwidth
		}
		d.width = (disc.radius + disc.rimwidth) * 2 + (d.slabelrotate ? 0 : 2 + d.slabelwidth)
	}
	// horizontal shifting
	const set = tk.skewer.selection.filter(d => hash.has(d.x0))
	set
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
	set
		.selectAll('.sja_aa_stem')
		.transition()
		.duration(dur)
		.attr('d', d => skewer_setstem(d, tk))
	set
		.filter(d => d.groups.length == 1)
		.selectAll('.sja_aa_disclabel')
		.transition()
		.duration(dur)
		.attr('fill-opacity', 1)
		.attr(
			'transform',
			d => 'scale(1) rotate(' + (d.aa.slabelrotate ? (tk.skewer.pointup ? '-' : '') + '90' : '0') + ')'
		)
	tk.slabel_forcerotate = false
}

function horiplace(items, tk, block) {
	// only arrange those in aa view range
	const xoffset0 = 0
	const x2 = block.width
	let xoffset = xoffset0
	// those out of range are not touched
	// detect if any overlap
	let overlap = false
	for (const i of items) {
		if (i.x0 < xoffset0 || i.x0 > x2) continue
		if (i.groups.length == 1) {
			i.slabelrotate = true
			const disc = i.groups[0]
			i.width = (disc.radius + disc.rimwidth) * 2
		}
		const x = i.x - i.maxradius - i.maxrimwidth
		if (x < xoffset) {
			overlap = true
		}
		if (x + i.width > x2) {
			overlap = true
		}
		xoffset = Math.max(xoffset, x + i.width)
	}
	if (!overlap) {
		// nothing to do
		return false
	}
	// push and pack all to the left
	xoffset = xoffset0
	for (const i of items) {
		if (i.x0 < xoffset0 || i.x0 > x2) continue
		i.x = xoffset + i.maxradius + i.maxrimwidth
		xoffset += i.width
	}

	horiplace0(items, block.width)
}

function horiplace0(items, allwidth) {
	/*
	items[]
	.width
	.x0
	.x
		already set by pushing to left
	*/
	for (let i = 0; i < items.length; i++) {
		if (items[i].x0 < 0) continue
		if (items[i].x0 > allwidth) break

		while (1) {
			let currsum = 0,
				newsum = 0
			for (let j = i; j < items.length; j++) {
				const t = items[j]
				if (t.x0 > allwidth) {
					return
				}
				currsum += Math.abs(t.x - t.x0)
				t.x++
				newsum += Math.abs(t.x - t.x0)
			}
			if (items[i].x >= items[i].x0) {
				// wind back to make sure stem [i] stem is straight
				for (let j = i; j < items.length; j++) {
					items[j].x--
				}
				break
			}
			const z = items[items.length - 1]
			if (z.x + z.width / 2 >= allwidth) {
				return
			}
			if (newsum <= currsum) {
				// accept move
			} else {
				// reject move, procceed to next item
				for (let j = i; j < items.length; j++) {
					if (items[j].x0 > allwidth) {
						break
					}
					// wind back
					items[j].x--
				}
				break
			}
		}
	}
}

export function fold_glyph(lst, tk) {
	if (lst.length == 0) return
	const dur = 1000
	// total number of discs, determines if disc details are visible prior to folding
	const hash = new Set()
	for (const d of lst) {
		d.x = d.x0
		hash.add(d.x0)
		d.showmode = modefold
		d.y = skewer_sety(d, tk)
	}
	const set = tk.skewer.selection.filter(d => hash.has(d.x0))
	set
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
	set
		.selectAll('.sja_aa_stem')
		.transition()
		.duration(dur)
		.attr('d', d => skewer_setstem(d, tk))
	set
		.selectAll('.sja_aa_discg')
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(0,' + (tk.skewer.pointup ? '-' : '') + d.aa.maxradius + ')')
	set
		.selectAll('.sja_aa_disckick')
		.transition()
		.duration(0) // must add a transition so .on(end) below can be triggered
		.attr('transform', 'scale(0)')
		.on('end', () => {
			//For e2e testing
			set.selectAll('.sja_aa_disckick').classed('sjpp-active', false)
		})
	set.selectAll('.sja_aa_discnum').transition().duration(dur).attr('fill-opacity', 0).attr('stroke-opacity', 0)
	set.selectAll('.sja_aa_disclabel').transition().duration(dur).attr('fill-opacity', 0).attr('transform', 'scale(0)') // hide this label so it won't be tred
	set.selectAll('.sja_aa_discrim').transition().duration(dur).attr('fill-opacity', 0).attr('stroke-opacity', 0)
	set.selectAll('.sja_aa_ssk_kick').attr('transform', 'scale(0)')
	set.selectAll('.sja_aa_ssk_bg').attr('transform', 'scale(0)')
	set.selectAll('.sja_aa_ssk_text').attr('transform', 'scale(0)')
	set
		.selectAll('.sja_aa_skkick')
		.transition()
		.duration(dur) // to prevent showing pica over busy skewer
		.attr('transform', d => `${d.shape ? `translate(0, ${(tk.skewer.pointup ? -1 : 1) * d.maxradius})` : ''} scale(1)`)
		.on('end', () => {
			//For e2e testing
			set.selectAll('.sja_aa_skkick').classed('sjpp-active', true)
		})
}

/* works for both skewer and numeric mode
highlights disc dots by matching with tk.skewer.hlssmid, a set
hlBoxG is blank <g> in each discg
to highlight a disk, insert a <rect> with colored border
*/
export function mayHighlightDiskBySsmid(tk) {
	// clear existing highlights
	tk.skewer.hlBoxG.selectAll('*').remove()
	if (!tk.skewer.hlssmid) return
	tk.skewer.hlBoxG
		.filter(g => {
			if (g.mlst) {
				// in skewer mode
				return g.mlst.find(m => tk.skewer.hlssmid.has(m.ssm_id))
			}
			// numeric mode
			return tk.skewer.hlssmid.has(g.ssm_id)
		})
		.append('rect')
		.attr('x', g => -g.radius)
		.attr('y', g => -g.radius)
		.attr('width', g => g.radius * 2)
		.attr('height', g => g.radius * 2)
		.attr('stroke', tk.skewer.hlBoxColor)
		.attr('stroke-width', g => (g.radius > 10 ? 1.5 : 1))
		.attr('fill', 'none')
		.attr('class', 'sja_mds3_skewer_ssmhlbox') // for testing
}

export function showHoverTipOnDisk(event, d, tk) {
	tk.hovertip.clear().show(event.clientX, event.clientY)
	if (!d.mlst?.[0]) {
		// should not happen
		tk.hovertip.d.append('div').text('d.mlst[] missing or blank')
		return
	}
	// d.mlst[] is valid and has at least 1 item
	// when there are multiple items, assume they all have same dt and class
	const m = mclass[d.mlst[0]?.class] || { color: 'black', label: '_unknown' }
	tk.hovertip.d
		.append('div')
		.style('font-size', '.9em')
		.html(`<span style="background:${m.color}">&nbsp;&nbsp;</span> ${m.label}`)
	if (d.mlst[0].occurrence) {
		const c = d.mlst.reduce((t, i) => t + i.occurrence, 0)
		tk.hovertip.d.append('div').text(`${c} sample${c > 1 ? 's' : ''}`)
	}
	if (d.mlst.length > 1) {
		// this disc represents multiple item/variants
		// assuming all mlst has same dt; call as "variants/alteractions" depending on dt
		tk.hovertip.d.append('div').text(`${d.mlst.length} ${d.mlst[0].dt == dtsnvindel ? 'variants' : 'alterations'}`)
	}
}
