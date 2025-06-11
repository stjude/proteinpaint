import { select as d3select } from 'd3-selection'
import { format as d3format } from 'd3-format'
import { axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { axisstyle, makeNumericAxisConfig, shapes } from '#dom'
import { make_datagroup } from './datagroup'
import { click_variant } from './clickVariant'
import { positionLeftlabelg } from './leftlabel'
import { may_render_skewer } from './skewer'
import { mayHighlightDiskBySsmid } from './skewer.render'
import { renderShapeKick, renderSkewerShapes } from './skewer.render.shapes'

/*
********************** EXPORTED
renderNumericMode
********************** INTERNAL
numeric_make
render_axis
setup_axis_scale
adjustview
verticallabplace
setStem
m_mouseover
m_mouseout


based on zoom level, toggle between two views:
1. cozy view, showing stem, x-shift, labels showing for all discs and point up
   at this mode, default is to draw a single circle for each variant
   alternatively, allow to show graphs e.g. boxplot
   such kind of values should all be server-computed
2. crowded view, no stem, no x-shift, only show label for top/bottom items

when clicking variant:
dots in numeric mode are individual variants
compared to skewer, each dot is a mlst[]

*/

const font = 'Arial'
const disclabelspacing = 1 // px spacing between disc and label
const middlealignshift = 0.3
const labyspace = 5
const clustercrowdlimit = 7 // at least 8 px per disc, otherwise won't show mname label
// when using an info field, if the variant is not annotated and no missing_value is available from the info field, use this
const maxclusterwidth = 100
const hardcode_missing_value = 0
const stemColor = '#ededed'
const defaultLabel = 'Numeric value'

/*
nm{}
	the object marked as "in use" in skewer.viewModes[]
	rendering parameters are attached to it
data: {skewer}
	tricky!
	data.skewer can be missing when pan/zoom in protein mode, where skewer data is not returned
	as same data has been kept at tk.skewer.rawmlst
*/
export function renderNumericMode(nm, data, tk, block) {
	const datagroup = make_datagroup(tk, data.skewer || tk.skewer.rawmlst, block).filter(
		g => g.x >= 0 && g.x <= block.width
	)

	// for variant leftlabel to access later
	nm.data = datagroup

	// initialize numeric mode
	if (!nm.axisg) nm.axisg = tk.gleft.append('g')
	if (!nm.axisheight) nm.axisheight = 150

	clearTk(tk)

	numeric_make(nm, tk, block)

	mayHighlightByLDoverlay(tk)

	return (
		nm.toplabelheight +
		nm.maxradius +
		nm.axisheight +
		nm.maxradius +
		nm.stem1 +
		nm.stem2 +
		nm.stem3 +
		nm.bottomlabelheight
	)
}

function clearTk(tk) {
	// skewer.g <g> is always there. will create nm plot into it
	// new d3 group selection is registered at skewer.nmg
	tk.skewer.g.selectAll('*').remove()
	if (tk.skewer.nmg) tk.skewer.nmg.selectAll('*').remove()
}

function numeric_make(nm, tk, block) {
	/*
	 */

	if (!nm.axisSetting) {
		// should be fine to create default setting when missing
		nm.axisSetting = { auto: 1 }
	}

	const data = nm.data

	for (const d of data) {
		d.x0 = d.x
		if (d.xoffset != undefined) {
			d.x = d.x0 + d.xoffset
		}
	}

	// diameter, also m label font size
	const dotwidth = Math.max(14, block.width / 110)

	nm.dotwidth = dotwidth
	nm.maxradius = 0

	for (const d of data) {
		for (const m of d.mlst) {
			// radius may be variable
			m.radius = dotwidth / 2
			nm.maxradius = Math.max(m.radius, nm.maxradius)

			// determine if has rim
			m.rimwidth = 0

			m.aa = d // m references data point
		}
	}

	const showstem = adjustview(data, nm, tk, block)

	setup_axis_scale(data, nm, tk)

	const numscale = scaleLinear().domain([nm.minvalue, nm.maxvalue]).range([0, nm.axisheight])

	// set m._y
	for (const d of data) {
		for (const m of d.mlst) {
			if (m.__value_missing) {
				// missing numeric value, assign 0 to place the dot at the bottom of axis
				m._y = 0
			} else {
				// has valid value, map to axis
				if (m.__value_use < nm.minvalue) {
					m._y = 0
				} else if (m.__value_use > nm.maxvalue) {
					m._y = nm.axisheight
				} else {
					m._y = numscale(m.__value_use)
				}
			}
		}
	}

	/*
	set:
	.data[].width
	.data[].stemw
	.data[].xoffset
	.data[].x
	.data[].mlst[].xoff
	.data[].mlst[].rotate
	*/

	if (showstem) {
		nm.stem1 = 5
		nm.stem2 = 20
		nm.stem3 = 10 // should be determined by stackbars
	} else {
		nm.stem1 = 0
		nm.stem2 = 0
		nm.stem3 = 0
	}

	// get mname label width
	for (const d of data) {
		for (const m of d.mlst) {
			tk.glider
				.append('text')
				.text(tk.mnamegetter(m))
				.attr('font-size', m.radius * 2 - 2)
				.each(function () {
					m.labwidth = this.getBBox().width
				})
				.remove()
		}
	}

	// rotated labels, size protruding beyond y axis
	for (const d of data) {
		// reset all
		for (const m of d.mlst) {
			delete m.labattop
			delete m.labatbottom
		}
	}

	if (!tk.skewer.hideDotLabels) {
		// can show m label
		if (showstem) {
			// show label for each disc, all rotated up
			for (const d of data) {
				if (d.mlst.length == 1) {
					const m = d.mlst[0]
					m.labattop = true
				} else {
					// cluster
					if ((d.width - d.fixedgew) / (d.mlst.length - 1) < clustercrowdlimit) {
						// too crowded, no label
					} else {
						// show label for all m
						for (const m of d.mlst) {
							m.labattop = true
						}
					}
				}
			}
		} else {
			// no stem
			// sort items by v
			verticallabplace(data)
		}
	}

	nm.toplabelheight = 0
	nm.bottomlabelheight = 0

	if (nm.showsamplebar || nm.showgenotypebyvalue) {
		for (const d of data) {
			for (const m of d.mlst) {
				nm.toplabelheight = Math.max(nm.toplabelheight, m.labwidth)
			}
		}
	} else {
		for (const d of data) {
			for (const m of d.mlst) {
				if (m.labattop) {
					nm.toplabelheight = Math.max(nm.toplabelheight, m._y + m.labwidth - nm.axisheight)
				} else if (m.labatbottom) {
					nm.bottomlabelheight = Math.max(nm.bottomlabelheight, m.labwidth - m._y)
				}
				//Backwards compatibility with .variantShapeName{} arg
				//May allow other shapes
				if (m.shapeCircle) {
					m.shape = 'emptyCircle'
					delete m.shapeCircle
				} else if (m.shapeTriangle) {
					m.shape = 'filledTriangle'
					delete m.shapeTriangle
				} else if (!m.shape) m.shape = 'filledCircle'
			}
		}
	}

	// adjust toplabelheight by tk labels
	{
		let h = block.labelfontsize + labyspace + block.labelfontsize // tk label and label_mcount
		if (tk.label_stratify) {
			h += tk.label_stratify.length * (labyspace + block.labelfontsize)
		}
		nm.toplabelheight = Math.max(nm.toplabelheight, h)
	}

	render_axis(tk, nm, block)

	tk.skewer.g
		.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius)
		.attr('y2', nm.toplabelheight + nm.maxradius)
		.attr('x2', block.width)
		.attr('stroke', stemColor)
		.attr('shape-rendering', 'crispEdges')
	tk.skewer.g
		.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('y2', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('x2', block.width)
		.attr('stroke', stemColor)
		.attr('shape-rendering', 'crispEdges')

	tk.skewer.nmg = tk.skewer.g
		.selectAll()
		.data(data)
		.enter()
		.append('g')
		.attr('class', 'sja_skg2')
		.each(function (d) {
			// compute radius for each group
			d.g = this
		})

	tk.skewer.nmg.attr(
		'transform',
		d =>
			'translate(' +
			d.x +
			',' +
			(nm.toplabelheight + disclabelspacing + nm.maxradius + nm.axisheight + nm.maxradius) +
			')'
	)

	// 2: stem
	if (showstem) {
		tk.skewer.nmg
			.append('path')
			.attr('class', 'sja_aa_stem')
			.attr('d', d => setStem(d, nm))
			.attr('stroke', d => tk.color4disc(d.mlst[0]))
			.attr('fill', d => (d.mlst.length == 1 ? 'none' : stemColor))
	}

	// 3: discs

	const discg = tk.skewer.nmg
		.selectAll()
		.data(d => d.mlst)
		.enter()
		.append('g')
		.attr('class', 'sja_aa_discg')
		.each(function (m) {
			m.g = this

			// actual disc
			if (!m.shape.includes('Circle')) {
				renderSkewerShapes(tk, nm, d3select(this))
			} else {
				d3select(this)
					.append('circle')
					.attr('fill', m => (shapes[m.shape].isFilled ? tk.color4disc(m) : 'none'))
					.attr('stroke', m => (shapes[m.shape].isFilled ? 'white' : tk.color4disc(m)))
					.attr('r', m => m.radius - 0.5)
					.attr('class', 'sja_aa_disk_fill')
			}
		})

	discg.attr('transform', m => {
		return 'translate(' + m.xoff + ',' + (m._y + nm.maxradius) * -1 + ')'
	})

	// no text in disc

	// used by mayHighlightDiskBySsmid
	tk.skewer.hlBoxG = discg.append('g')

	// disc kick
	const kick = renderShapeKick(nm, discg)

	kick
		.attr('stroke', m => tk.color4disc(m))
		.attr('fill', 'white')
		.attr('class', 'sja_aa_disckick')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mousedown', event => {
			event.preventDefault()
		})
		.on('mouseover', (event, m) => {
			m_mouseover(m, nm, tk)
		})
		.on('mouseout', (event, m) => {
			m_mouseout(m, tk)
		})
		.on('click', (event, m) => {
			click_variant({ mlst: [m] }, tk, block, event.target.getBoundingClientRect(), event.target)
		})

	// m label
	// only make for those to appear on top or bottom
	const textlabels = discg
		.filter(m => m.labattop || m.labatbottom)
		.append('text')
		.each(function (m) {
			m.__svg_textlabel = this
		})
		.text(m => tk.mnamegetter(m))
		.attr('font-size', m => {
			m._labfontsize = Math.max(12, m.radius * 1.2)
			return m._labfontsize
		})
		.attr('fill', m => tk.color4disc(m))
		.attr('x', m =>
			nm.showsamplebar || nm.showgenotypebyvalue
				? nm.axisheight + nm.maxradius + 4
				: m.radius + m.rimwidth + disclabelspacing
		)
		.attr('y', m => m._labfontsize * middlealignshift)
		.attr('class', 'sja_aa_disclabel')
		.attr('transform', m => 'rotate(' + (m.labattop ? '-' : '') + '90)')
		.on('mousedown', event => {
			event.preventDefault()
		})
		.on('mouseover', (event, m) => m_mouseover(m, nm, tk))
		.on('mouseout', (event, m) => m_mouseout(m, tk))
		.on('click', (event, m) => {
			click_variant({ mlst: [m] }, tk, block, event.target.getBoundingClientRect(), event.target.previousSibling)
		})
}

function adjustview(data, nm, tk, block) {
	/*
	self adjusting
	for .data[], add:
		.x0
		.width
	for .data[0].mlst[], add:
		.xoff
	*/

	let sumwidth = 0

	// set initial width

	for (const d of data) {
		let w = 0
		for (const m of d.mlst) {
			w += 2 * (m.radius + m.rimwidth)
		}

		if (d.mlst.length == 1) {
			d.width = w
		} else {
			// cluster, apply maximum allowed span
			d.width = Math.min(maxclusterwidth, w)

			const m0 = d.mlst[0]
			const m1 = d.mlst[d.mlst.length - 1]
			d.fixedgew = m0.radius + m0.rimwidth + m1.radius + m1.rimwidth
		}

		sumwidth += d.width
	}

	if (sumwidth <= block.width) {
		// fits all
		// move all to left
		let cum = 0
		for (const d of data) {
			d.x = cum + d.mlst[0].radius + d.mlst[0].rimwidth
			cum += d.width

			// stemw required for placing
			if (d.mlst.length == 1) {
				d.stemw = 0
			} else {
				d.stemw = d.width - d.fixedgew
			}
		}

		horiplace1(data, block.width)

		for (const d of data) {
			d.xoffset = d.x - d.x0

			if (d.mlst.length == 1) {
				d.mlst[0].xoff = 0
				d.stemw = 0
			} else {
				d.stemw = d.width - d.fixedgew

				const span = d.stemw / (d.mlst.length - 1)
				for (let i = 0; i < d.mlst.length; i++) {
					d.mlst[i].xoff = span * i
				}
			}
		}

		return true
	}

	// do not shrink and horiplace
	for (const d of data) {
		d.x = d.x0
		d.xoffset = 0
		for (const m of d.mlst) {
			m.xoff = 0
		}
	}

	// do not show stem
	return false
}

function horiplace1(items, allwidth) {
	/*
	only for numeric
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
				currsum += Math.abs(t.x - t.x0 - t.stemw / 2)
				t.x++
				newsum += Math.abs(t.x - t.x0 - t.stemw / 2)
			}
			if (items[i].x > items[i].x0 - items[i].stemw / 2) {
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

function verticallabplace(data) {
	const mlst = []
	for (const d of data) {
		for (const m of d.mlst) {
			mlst.push({
				m: m,
				w: 2 * (m.radius + m.rimwidth),
				x: d.x0,
				y: m._y
			})
		}
	}

	mlst.sort((i, j) => j.y - i.y) // descending

	// 1. labels pointing up, none has label yet

	for (let i = 0; i < mlst.length; i++) {
		const big = mlst[i]
		let overlapwithdisc = false
		for (let j = 0; j < i; j++) {
			const small = mlst[j]
			if (Math.abs(big.x - small.x) < (big.w + small.w) / 2 - 2) {
				overlapwithdisc = true
				break
			}
		}
		if (!overlapwithdisc) {
			big.m.labattop = true
		}
	}

	// 2. labels pointing down

	for (let i = mlst.length - 1; i >= 0; i--) {
		const big = mlst[i]
		if (big.m.labattop) continue
		let overlapwithlabeleddisc = false
		for (let j = mlst.length - 1; j > i; j--) {
			const small = mlst[j]
			if (small.m.labatbottom && Math.abs(small.x - big.x) < (small.w + big.w) / 2 - 2) {
				overlapwithlabeleddisc = true
				break
			}
		}
		if (!overlapwithlabeleddisc) {
			big.m.labatbottom = true
		}
	}
}

function setStem(d, nm) {
	if (d.mlst.length == 1) {
		return 'M0,0v' + nm.stem1 + 'l' + -d.xoffset + ',' + nm.stem2 + 'v' + nm.stem3
	}
	// funnel
	return (
		'M0,0' +
		'v' +
		nm.stem1 + // vertical down
		'l' +
		-d.xoffset +
		',' +
		nm.stem2 + // slope 1
		'v' +
		nm.stem3 + // vertical down
		//+'h1' // to right 1
		'v-' +
		nm.stem3 + // veritical up
		'l' +
		(d.stemw + d.xoffset - 1) +
		',-' +
		nm.stem2 + // slope 2
		'v-' +
		nm.stem1
	)
	//+'Z'
}

function m_mouseover(m, nm, tk) {
	if (m.__svg_textlabel) {
		d3select(m.__svg_textlabel).attr('font-size', m._labfontsize * 1.1)
	}

	// pica moves to center of m disc
	tk.pica.g.attr(
		'transform',
		'translate(' + (m.aa.x + m.xoff) + ',' + (nm.toplabelheight + nm.maxradius + nm.axisheight - m._y) + ')'
	)

	const linelen = 10
	const boxpad = 4
	const fontsize = m._labfontsize || 13 // _labfontsize is undefined if this m has no lab
	const color = tk.color4disc(m)

	const words = []

	if (nm.tooltipPrintValue) {
		const out = nm.tooltipPrintValue(m)
		if (Array.isArray(out)) {
			words.push(...out.map(i => `${i.k} = ${i.v}`))
		}
	} else {
		words.push(nm.label + ' = ' + (m.__value_missing ? 'NA' : m.__value_use))
	}

	if (tk.mds.queries?.ld?.mOverlay?.data) {
		// doing ld overlay now
		if (m.ssm_id == tk.mds.queries.ld.mOverlay.m.ssm_id) {
			// the same variant, do not indicate r2 value
		} else {
			// indicate r2 value
			let r2 = '?'
			for (const v of tk.mds.queries.ld.mOverlay.data) {
				if (v.pos == m.pos && v.alleles == m.ref + '.' + m.alt) {
					r2 = v.r2
					break
				}
			}
			words.push('r2 = ' + r2)
		}
	}

	if (!m.labattop && !m.labatbottom) {
		words.push(tk.mnamegetter(m))
	}

	let textw = 0
	//showlab=false
	for (const w of words) {
		tk.pica.g
			.append('text')
			.attr('font-size', fontsize)
			.text(w)
			.each(function () {
				textw = Math.max(textw, this.getBBox().width)
			})
			.remove()
	}

	const boxw = boxpad * 2 + textw
	let boxx,
		linex1,
		onleft = true
	if (boxw + linelen > m.aa.x + m.xoff) {
		// pica on right
		onleft = false
		linex1 = m.radius + m.rimwidth
		boxx = linex1 + linelen
	} else {
		// on left
		linex1 = -m.radius - m.rimwidth - linelen
		boxx = linex1 - boxw
	}

	const boxh = fontsize * words.length

	// bg box for white rim
	tk.pica.g
		.append('rect')
		.attr('x', boxx - 2)
		.attr('y', -2 - boxpad - boxh / 2)
		.attr('width', 4 + boxw)
		.attr('height', 4 + boxpad * 2 + boxh)
		.attr('fill', 'white')
	tk.pica.g
		.append('line')
		.attr('x1', linex1)
		.attr('x2', linex1 + linelen)
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('shape-rendering', 'crispEdges')
	tk.pica.g
		.append('line')
		.attr('x1', linex1)
		.attr('x2', linex1 + linelen)
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	tk.pica.g
		.append('rect')
		.attr('x', boxx)
		.attr('y', -boxpad - boxh / 2)
		.attr('width', boxw)
		.attr('height', boxpad * 2 + boxh)
		.attr('fill', 'none')
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')

	let y = (fontsize - boxh) / 2
	for (const w of words) {
		tk.pica.g
			.append('text')
			.text(w)
			.attr('text-anchor', onleft ? 'end' : 'start')
			.attr('font-size', fontsize)
			.attr('x', onleft ? linex1 - boxpad : boxx + boxpad)
			.attr('y', y)
			.attr('fill', color)
			.attr('dominant-baseline', 'central')
		y += fontsize
	}
}

function m_mouseout(m, tk) {
	if (m.__svg_textlabel) {
		d3select(m.__svg_textlabel).attr('font-size', m._labfontsize)
	}
	tk.pica.g.selectAll('*').remove()
}

/*
based on numeric datatype selector, determine numeric value for each m

if axisSetting.auto=1, determine min/max range
*/
function setup_axis_scale(data, nm, tk) {
	for (const g of data) {
		for (const m of g.mlst) {
			delete m.__value_use
			delete m.__value_missing
		}
	}

	if (nm.byAttribute) {
		for (const g of data) {
			for (const m of g.mlst) {
				const v = m[nm.byAttribute]
				if (Number.isFinite(v)) {
					m.__value_use = v
				} else {
					m.__value_missing = true
				}
			}
		}
	} else if (nm.byInfo) {
		for (const g of data) {
			for (const m of g.mlst) {
				const v = m?.info?.[nm.byInfo]
				if (Number.isFinite(v)) {
					m.__value_use = v
				} else {
					m.__value_missing = true
				}
			}
		}
	} else {
		throw 'unknown method of getting value'
	}

	if (nm.axisSetting.auto) {
		nm.minvalue = null
		nm.maxvalue = null

		for (const g of data) {
			for (const m of g.mlst) {
				if ('__value_use' in m) {
					if (nm.minvalue == null) {
						nm.minvalue = m.__value_use
						nm.maxvalue = m.__value_use
					} else {
						nm.minvalue = Math.min(nm.minvalue, m.__value_use)
						nm.maxvalue = Math.max(nm.maxvalue, m.__value_use)
					}
				}
			}
		}
	} else if (nm.axisSetting.fixed) {
		nm.minvalue = nm.axisSetting.fixed.min
		nm.maxvalue = nm.axisSetting.fixed.max
	} else {
		throw 'unknown axisSetting'
	}
}

function render_axis(tk, nm, block) {
	// axis always opens to left so as not to overlap with data points
	// to share space with left labels and not overlapping, records nm.toplabelheight and nm.axisWidth
	nm.axisg
		.attr('transform', 'translate(0,' + (nm.toplabelheight + nm.maxradius) + ')')
		.selectAll('*')
		.remove()

	// axis is inverse of numscale
	const thisscale = scaleLinear().domain([nm.minvalue, nm.maxvalue]).range([nm.axisheight, 0])

	const thisaxis = axisLeft().scale(thisscale).ticks(4)
	if (nm.isinteger) {
		thisaxis.tickFormat(d3format('d'))
		if (nm.maxvalue - nm.minvalue < 3) {
			/*
			must do this to avoid axis showing redundant labels that doesn't make sense
			e.g. -1 -2 -2
			*/
			thisaxis.ticks(nm.maxvalue - nm.minvalue)
		}
	}
	axisstyle({
		axis: nm.axisg.call(thisaxis),
		showline: true,
		fontsize: nm.dotwidth
	})

	// axis label, text must wrap
	// read the max tick label width at nm.axisWidth, so axis label won't overlap with them
	nm.axisWidth = 0
	nm.axisg.selectAll('text').each(function () {
		nm.axisWidth = Math.max(nm.axisWidth, this.getBBox().width)
	})
	nm.axisWidth += 15

	// axis label

	/* split string by space and render one word in each line
	const lst = (nm.label || defaultLabel).split(' ')
	const y = (nm.axisheight - lst.length * (nm.dotwidth + 1)) / 2
	let maxlabelw = 0
	lst.forEach((text, i) => {
		nm.axisg
			.append('text')
			.attr('fill', 'black')
			.attr('font-size', nm.dotwidth)
			.attr('dominant-baseline', 'central')
			.attr('text-anchor', 'end')
			.attr('y', y + (nm.dotwidth + 1) * i)
			.attr('x', -nm.axisWidth)
			.text(text)
			.each(function() {
				maxlabelw = Math.max(maxlabelw, this.getBBox().width + 15 + nm.axisWidth)
			})
	})
	*/

	// render one single text label so can apply click
	let w
	nm.axisg
		.append('text')
		.attr('fill', 'black')
		.attr('font-size', nm.dotwidth)
		.attr('dominant-baseline', 'central')
		.attr('text-anchor', 'end')
		.attr('class', 'sjpp-mds3-nm-axislabel sja_clbtext2') // for testing
		.attr('y', nm.axisheight / 2)
		.attr('x', -nm.axisWidth)
		.text(nm.label || defaultLabel) // if too long can use ellipsis, hover to show full
		.each(function () {
			w = this.getBBox().width
		})
		.on('click', event => {
			tk.menutip
				.clear()
				.showunder(event.target)
				.d.append('div')
				.text('Cancel')
				.attr('class', 'sja_menuoption')
				.style('border-radius', '0px')
				.on('click', () => {
					tk.menutip.hide()
					nm.inuse = false
					tk.skewer.viewModes.find(i => i.type == 'skewer').inuse = true
					may_render_skewer({ skewer: tk.skewer.rawmlst }, tk, block)
					positionLeftlabelg(tk, block)
					tk._finish()
				})

			makeNumericAxisConfig({
				holder: tk.menutip.d.append('div').style('margin', '10px'),
				noPercentile: true,
				callback: s => {
					nm.axisSetting = s
					clearTk(tk)
					numeric_make(nm, tk, block)
				},
				setting: nm.axisSetting
			})
		})

	tk.skewer.maxwidth = nm.axisWidth + w
}

function mayHighlightByLDoverlay(tk) {
	// quick fix:
	// after rendering numeric tk, allow to highlight the "index" variant from ld overlay
	const m = tk.mds.queries?.ld?.mOverlay?.m
	if (!m) return
	tk.skewer.hlssmid = new Set([m.ssm_id])
	mayHighlightDiskBySsmid(tk)
}
