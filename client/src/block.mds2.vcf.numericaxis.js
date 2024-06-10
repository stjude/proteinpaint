import { select as d3select } from 'd3-selection'
import { format as d3format } from 'd3-format'
import { axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { vcf_m_color, divide_data_to_group } from './block.mds2.vcf'
import { vcf_clickvariant } from './block.mds2.vcf.clickvariant'

/*
adapted from legacy code

********************** EXPORTED
render
may_setup_numerical_axis
get_axis_label
get_axis_label_AFtest
may_get_param
may_get_param_AFtest_termfilter
********************** INTERNAL
numeric_make
render_axis
setup_axis_scale
adjustview
verticallabplace
m_mouseover
m_mouseout
may_printinfo_axistype



based on zoom level, toggle between two views:
1. cozy view, showing stem, x-shift, labels showing for all discs and point up
   at this mode, default is to draw a single circle for each variant
   alternatively, allow to show graphs e.g. boxplot
   such kind of values should all be server-computed
2. crowded view, no stem, no x-shift, only show label for top/bottom items

*/

const disclabelspacing = 1 // px spacing between disc and label
const middlealignshift = 0.3
const labyspace = 5
const clustercrowdlimit = 7 // at least 8 px per disc, otherwise won't show mname label
// when using an info field, if the variant is not annotated and no missing_value is available from the info field, use this
const hardcode_missing_value = 0

export function render(data, r, _g, tk, block) {
	/*
numerical axis
info field as sources of values

value may be singular number, or boxplot

*/

	const datagroup = divide_data_to_group(r, block)

	const nm = tk.vcf.numerical_axis

	numeric_make(nm, r, _g, datagroup, tk, block)

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

function numeric_make(nm, r, _g, data, tk, block) {
	/*
	 */

	for (const d of data) {
		d.x0 = d.x
		if (d.xoffset != undefined) {
			d.x = d.x0 + d.xoffset
		}
	}

	// diameter, also m label font size
	const dotwidth = Math.max(14, block.width / 110)

	if (tk.ld && tk.ld.overlay && tk.ld.overlay.vcfcircle) {
		// resize overlay circle
		tk.ld.overlay.vcfcircle
			.attr('r', dotwidth / 2)
			// and also hide it upon rendering variants
			.attr('stroke-opacity', 0)
	}

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

	/*
	nm.showsamplebar = showstem && tk.ds && tk.ds.samplebynumericvalue

	if(!nm.showsamplebar) {
		// do not show both at same time
		nm.showgenotypebyvalue = showstem && tk.ds && tk.ds.genotypebynumericvalue
	}
	tk.genotype2color.legend.style('display', nm.showsamplebar || nm.showgenotypebyvalue ? 'block':'none')
	*/

	setup_axis_scale(r, nm, tk)

	const numscale = scaleLinear().domain([nm.minvalue, nm.maxvalue]).range([0, nm.axisheight])

	// set m._y
	for (const d of data) {
		for (const m of d.mlst) {
			m._y = numscale(m._v)
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
				.text(mnamegetter(m.mname))
				.attr('font-family', client.font)
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

	render_axis(_g, tk, nm, block)
	/*
	if( nm.inuse_termdb2groupAF ) {
		// show horizontal line at 0
		_g
			.append('line')
			//.attr('y1', nm.toplabelheight+nm.maxradius+ numscale(0) )
			.attr('y1',  numscale(0) )
			.attr('y2', nm.toplabelheight+nm.maxradius+ numscale(0) )
			.attr('x2', r.width )
			.attr('stroke','black')
			.attr('shape-rendering','crispEdges')
	}
	*/

	_g.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius)
		.attr('y2', nm.toplabelheight + nm.maxradius)
		.attr('x2', r.width)
		.attr('stroke', '#ededed')
		.attr('shape-rendering', 'crispEdges')
	_g.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('y2', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('x2', r.width)
		.attr('stroke', '#ededed')
		.attr('shape-rendering', 'crispEdges')

	tk.skewer2 = _g
		.selectAll()
		.data(data)
		.enter()
		.append('g')
		.attr('class', 'sja_skg2')
		.each(function (d) {
			// compute radius for each group
			d.g = this
		})

	tk.skewer2.attr(
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
		tk.skewer2
			.append('path')
			.attr('class', 'sja_aa_stem')
			.attr('d', d => skewer2_setstem(d, nm))
			.attr('stroke', d => vcf_m_color(d.mlst[0], tk))
			.attr('fill', d => (d.mlst.length == 1 ? 'none' : '#ededed'))
	}

	// 3: discs

	const discg = tk.skewer2
		.selectAll()
		.data(d => d.mlst)
		.enter()
		.append('g')
		.attr('class', 'sja_aa_discg')
		.each(function (m) {
			m.g = this
		})

	discg.attr('transform', m => {
		return 'translate(' + m.xoff + ',' + (m._y + nm.maxradius) * -1 + ')'
	})

	// actual disc
	const discdot = discg.append('circle')
	// full filled
	discdot
		//.filter(m=> m.dt==common.dtsnvindel || m.dt==common.dtsv || m.dt==common.dtfusionrna)
		.attr('fill', m => vcf_m_color(m, tk))
		.attr('stroke', 'white')
		.attr('r', m => m.radius - 0.5)
		.attr('class', 'sja_aa_disk_fill')

	// no text in disc

	// disc kick
	discg
		.append('circle')
		.attr('r', m => m.radius - 0.5)
		.attr('stroke', m => vcf_m_color(m, tk))
		.attr('class', 'sja_aa_disckick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mousedown', event => {
			event.preventDefault()
			//event.stopPropagation()
		})
		.on('mouseover', (event, m) => {
			m_mouseover(m, nm, tk)
		})
		.on('mouseout', (event, m) => {
			m_mouseout(m, tk)
		})
		.on('click', (event, m) => {
			// FIXME prevent triggering click after panning
			const p = event.target.getBoundingClientRect()
			vcf_clickvariant(m, p, tk, block)
		})

	// m label
	// only make for those whose to appear on top or bottom
	const textlabels = discg
		.filter(m => m.labattop || m.labatbottom)
		.append('text')
		.each(function (m) {
			m.textlabel = this
		})
		.text(m => mnamegetter(m.mname))
		.attr('font-family', client.font)
		.attr('font-size', m => {
			m._labfontsize = Math.max(12, m.radius * 1.2)
			return m._labfontsize
		})
		.attr('fill', m => vcf_m_color(m, tk))
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
			//event.stopPropagation()
		})
		.on('mouseover', (event, m) => m_mouseover(m, nm, tk))
		.on('mouseout', (event, m) => m_mouseout(m, tk))
		.on('click', (event, m) => {
			vcf_clickvariant(m, { left: m.clientX, top: m.clientY }, tk, block)
			if (block.debugmode) {
				console.log(m)
			}
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

	const maxclusterwidth = 100

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

	let showstem = true

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

const mnamegetter = s => {
	if (!s) return ''
	// trim too long names
	if (s.length > 25) {
		return s.substr(0, 20) + '...'
	}
	return s
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

function skewer2_setstem(d, nm) {
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
	if (m.textlabel) {
		d3select(m.textlabel).attr('font-size', m._labfontsize * 1.1)
	}

	// pica moves to center of m disc
	tk.pica.g.attr(
		'transform',
		'translate(' + (m.aa.x + m.xoff) + ',' + (nm.toplabelheight + nm.maxradius + nm.axisheight - m._y) + ')'
	)

	const linelen = 10
	const boxpad = 4
	const fontsize = m._labfontsize || 13 // _labfontsize is undefined if this m has no lab
	const color = vcf_m_color(m, tk)

	const words = []

	if (nm.inuse_AFtest) {
		if (m.AFtest_group_values) {
			for (const v of m.AFtest_group_values) words.push(v)
		} else if (m.AFtest_pvalue != undefined) {
			words.push(m.AFtest_pvalue)
		}
	} else if (nm.inuse_infokey) {
		words.push(m._v)
	} else {
		throw 'unknown axis type'
	}

	if (!m.labattop && !m.labatbottom) {
		words.push(m.mname)
	}

	let textw = 0
	//showlab=false
	for (const w of words) {
		tk.pica.g
			.append('text')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
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
			.attr('font-family', client.font)
			.attr('x', onleft ? linex1 - boxpad : boxx + boxpad)
			.attr('y', y)
			.attr('fill', color)
			.attr('dominant-baseline', 'central')
		y += fontsize
	}
}

function m_mouseout(m, tk) {
	if (m.textlabel) {
		d3select(m.textlabel).attr('font-size', m._labfontsize)
	}
	tk.pica.g.selectAll('*').remove()
}

function setup_axis_scale(r, nm, tk) {
	/*
based on the source of axis scaling,
decide following things about the y axis:
- scale range, by different types of scales
- name label
*/

	nm.minvalue = 0
	nm.maxvalue = 0

	// these are only for inuse_infokey
	let info_key, use_altinfo, missing_value

	if (nm.inuse_infokey) {
		info_key = nm.info_keys.find(i => i.in_use).key // setup_numerical_axis guarantee this is valid
		// if the INFO is A, apply to m.altinfo, else, to m.info
		use_altinfo = tk.vcf.info[info_key].Number == 'A'
		if (tk.info_fields) {
			const i = tk.info_fields.find(i => i.key == info_key)
			if (i) {
				missing_value = i.missing_value
			}
		}
	}

	for (const m of r.variants) {
		let v = null

		if (nm.inuse_AFtest) {
			v = m.nm_axis_value
		} else if (nm.inuse_infokey) {
			if (use_altinfo) {
				if (m.altinfo) {
					v = m.altinfo[info_key]
				}
			} else {
				if (m.info) {
					v = m.info[info_key]
				}
			}
			if (!Number.isFinite(v)) {
				// should only happen for info field, when this variant is not annotated by it
				// may use the predefined missing value
				v = Number.isFinite(missing_value) ? missing_value : hardcode_missing_value
			}
		} else {
			throw 'unknown axis type'
		}

		m._v = v // for later use

		nm.minvalue = Math.min(nm.minvalue, v)
		nm.maxvalue = Math.max(nm.maxvalue, v)
	}

	if (nm.inuse_AFtest && nm.AFtest.testby_AFdiff) {
		// for two group comparison, use the same range for two sides
		const v = Math.max(Math.abs(nm.minvalue), Math.abs(nm.maxvalue))
		nm.minvalue = -v
		nm.maxvalue = v
	}
}

export function may_setup_numerical_axis(tk) {
	/*
to validate the numerical axis settings
and set the .isinteger and .label of nm
by default the numerical axis may not specify what to use as test

call this in makeTk()
and switching numeric axis category
*/

	if (!tk.vcf) return

	const nm = tk.vcf.numerical_axis
	if (!nm.in_use) {
		// not in use, do not set up
		return
	}

	delete nm.isinteger

	if (!nm.info_keys && !nm.AFtest) throw 'no options for numerical axis'

	// decide which option to use
	if (nm.inuse_infokey) {
		if (!nm.info_keys) throw '.info_keys[] missing when inuse_infokey is true'
	} else if (nm.inuse_AFtest) {
		if (!nm.AFtest) throw '.AFtest{} missing when inuse_AFtest is true'
	} else {
		// no option in use, use one by default
		if (nm.AFtest) {
			nm.inuse_AFtest = true
		} else {
			nm.inuse_infokey = true
		}
	}

	if (nm.info_keys) {
		// info keys
		if (!Array.isArray(nm.info_keys)) throw 'numerical_axis.info_keys[] is not an array'
		if (nm.info_keys.length == 0) throw 'numerical_axis.info_keys[] array is empty'

		let info_element = nm.info_keys.find(i => i.in_use) // which element from tk.vcf.numerical_axis.info_keys is in use
		if (!info_element) {
			info_element = nm.info_keys[0]
			info_element.in_use = true
		}

		if (!tk.vcf.info) throw 'VCF file has no INFO fields'

		if (nm.inuse_infokey) {
			// to decide if it's integer or floating point
			let notset = true
			if (tk.info_fields) {
				const a = tk.info_fields.find(i => i.key == info_element.key)
				if (a) {
					notset = false
					if (a.isinteger) nm.isinteger = true
				}
			}
			if (notset) {
				// this info field is not found in tk.info_fields[], find it in vcf.info{}
				const f = tk.vcf.info[info_element.key]
				if (!f) throw 'unknown INFO field for numerical axis: ' + info_element.key
				if (f.Type == 'Integer') nm.isinteger = true
			}
		}
	}

	if (nm.AFtest) {
		if (!nm.AFtest.allowed_infofields) throw 'AFtest.allowed_infofields[] is required'
		if (!Array.isArray(nm.AFtest.allowed_infofields)) throw 'AFtest.allowed_infofields[] is not array'
		if (!nm.AFtest.groups) throw 'AFtest.groups[] missing'
		if (!Array.isArray(nm.AFtest.groups)) throw 'AFtest.groups[] is not array'
		if (nm.AFtest.groups.length < 2) throw 'AFtest.groups[] must have at least two elements'
		for (const g of nm.AFtest.groups) {
			if (g.is_termdb) {
				if (!g.filter) throw '.filter{} missing from a is_termdb group'
				// TODO validate filter
			} else if (g.is_infofield) {
				if (!g.key) throw 'key missing from a is_infofield group'
				if (!nm.AFtest.allowed_infofields.find(i => i.key == g.key))
					throw 'info key not found in allowed_infofields: ' + g.key
			} else if (g.is_population) {
				if (!g.key) throw 'key missing from a is_population group'
				if (!tk.populations) throw 'tk.populations{} missing when using a population group'
				if (!tk.populations.find(i => i.key == g.key)) throw 'unknown population by key: ' + g.key
			} else {
				throw 'unknown type of group from AFtest.groups[]'
			}
		}
		if (nm.AFtest.testby_AFdiff) {
			// validate AFdiff setting here
		} else if (nm.AFtest.testby_fisher) {
			// require at least one termdb group
			if (nm.AFtest.groups.find(i => i.is_infofield)) throw 'fisher test will not work for an info field'
		} else {
			throw 'AFtest: do not know how to do test'
		}
	}

	// axis label
	if (nm.inuse_AFtest) {
		if (nm.AFtest.testby_AFdiff) nm.label = 'Allele frequency difference'
		else if (nm.AFtest.testby_fisher) nm.label = '-log10 P-value'
	} else {
		nm.label = get_axis_label(tk)
	}
}

function render_axis(_g, tk, nm, block) {
	/*
render axis
*/
	tk.leftaxis_vcfrow
		.attr('transform', 'translate(-' + nm.dotwidth / 2 + ',' + (nm.toplabelheight + nm.maxradius) + ')')
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
	client.axisstyle({
		axis: tk.leftaxis_vcfrow.call(thisaxis),
		showline: true,
		fontsize: nm.dotwidth
	})

	if (nm.minvalue == nm.maxvalue) {
		tk.leftaxis_vcfrow
			.append('text')
			.attr('text-anchor', 'end')
			.attr('font-size', nm.dotwidth)
			.attr('dominant-baseline', 'central')
			.attr('x', block.tkleftlabel_xshift)
			.attr('y', nm.axisheight)
			.text(nm.minvalue)
			.attr('fill', 'black')
	}

	// axis label, text must wrap
	// read the max tick label width first
	let maxw = 0
	tk.leftaxis_vcfrow.selectAll('text').each(function () {
		maxw = Math.max(maxw, this.getBBox().width)
	})
	tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, maxw + 15)

	if (nm.label) {
		const lst = nm.label.split(' ')
		const y = (nm.axisheight - lst.length * (nm.dotwidth + 1)) / 2
		let maxlabelw = 0
		lst.forEach((text, i) => {
			tk.leftaxis_vcfrow
				.append('text')
				.attr('fill', 'black')
				.attr('font-size', nm.dotwidth)
				.attr('dominant-baseline', 'central')
				.attr('text-anchor', 'end')
				.attr('y', y + (nm.dotwidth + 1) * i)
				.attr('x', -(maxw + 15))
				.text(text)
				.each(function () {
					maxlabelw = Math.max(maxlabelw, this.getBBox().width + 15 + maxw)
				})
		})
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, maxlabelw)
	}
}

/////////////////////// exported helper functions

export function get_axis_label(tk) {
	if (!tk.vcf) return
	const nm = tk.vcf.numerical_axis
	if (!nm) return
	if (!nm.in_use) return 'Disabled'
	if (nm.inuse_infokey) {
		const key = nm.info_keys.find(i => i.in_use)
		if (!key) return 'Error: no key in_use'
		if (tk.info_fields) {
			const a = tk.info_fields.find(i => i.key == key.key)
			if (a && a.label) return a.label
		}
		return key.key
	}
	if (nm.inuse_AFtest) return get_axis_label_AFtest()
	return 'Error: unknown type of axis'
}

export function get_axis_label_AFtest() {
	return 'Compare two groups'
}

export function may_get_param(tk, par) {
	/*
append numeric axis parameter to object for loadTk
*/
	if (!tk.vcf) return
	const nm = tk.vcf.numerical_axis
	if (!nm) return
	if (!nm.in_use) return
	if (nm.inuse_infokey) {
		// no parameter
		return
	}
	if (nm.inuse_AFtest && nm.AFtest) {
		par.AFtest = {
			groups: [],
			testby_AFdiff: nm.AFtest.testby_AFdiff,
			testby_fisher: nm.AFtest.testby_fisher
		}
		for (const g of nm.AFtest.groups) {
			if (g.is_termdb) {
				par.AFtest.groups.push({
					is_termdb: true,
					filter: g.filterApi.getNormalRoot()
				})
				continue
			}
			if (g.is_infofield) {
				const g2 = {
					is_infofield: true,
					key: g.key
				}
				if (tk.info_fields) {
					// attempt to get missing value
					const i = tk.info_fields.find(j => j.key == g.key)
					if (i && i.missing_value != undefined) {
						g2.missing_value = i.missing_value
					}
				}
				par.AFtest.groups.push(g2)
				continue
			}
			if (g.is_population) {
				const g2 = {
					is_population: true,
					key: g.key
				}
				if (g.adjust_race) {
					// only adjust race if there is a termdb group besides this population
					if (nm.AFtest.groups.find(i => i.is_termdb)) {
						g2.adjust_race = true
					}
				}
				par.AFtest.groups.push(g2)
				continue
			}
			throw 'unknown group type at xhr parameter'
		}
		const v = may_get_param_AFtest_termfilter(tk)
		if (v) {
			par.AFtest.termfilter = [v]
		}
		return
	}
	throw 'unknown type of numeric axis'
}

export function may_get_param_AFtest_termfilter(tk) {
	if (!tk.vcf || !tk.vcf.numerical_axis) return
	const af = tk.vcf.numerical_axis.AFtest
	if (!af || !af.termfilter || !af.termfilter.inuse) return
	if (af.termfilter.type != 'categorical') throw 'AFtest.termfilter.type is not categorical (hardcoded)'
	if (!af.termfilter.values) throw 'termfilter.values missing'
	// in nm, termfilter is not tvs
	// in parameter, termfilter is tvs
	const v = af.termfilter.values[af.termfilter.value_index]
	if (!v) throw 'unknown value selection by value_index in AFtest.termfilter'
	return {
		term: {
			id: af.termfilter.id,
			name: af.termfilter.name,
			type: 'categorical' // hardcoded
		},
		values: [{ key: v.key, label: v.label || v.key }]
	}
}

function may_printinfo_axistype(data, nm) {
	// data{} is returned by server
	if (nm.inuse_termdb2groupAF) {
		nm.termdb2groupAF.group1.div_numbersamples.text('n=' + data.group1numbersamples)
		nm.termdb2groupAF.group2.div_numbersamples.text('n=' + data.group2numbersamples)
		return
	}
	if (nm.inuse_ebgatest) {
		nm.ebgatest.div_numbersamples.text('n=' + data.numbersamples)
		nm.ebgatest.div_populationaverage.selectAll('*').remove()
		data.populationaverage.forEach(i => {
			nm.ebgatest.div_populationaverage
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '0px 10px')
				.text(i.key + ': ' + i.v.toFixed(3))
		})
		return
	}
}
