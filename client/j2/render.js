import { scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale'
import { select as d3select } from 'd3-selection'
import { axisRight } from 'd3-axis'
import * as d3force from 'd3-force'
import { axisstyle, table2col } from '#dom'
import { bplen, IN_frame, JTypes, JT_exonskip, JT_exonaltuse, JT_a5ss, JT_a3ss } from '#shared/common.js'
import { getParameter } from './tk'
import { dofetch3 } from '#common/dofetch'

/*
 */

const minfontsize = 12
const lineopacity = 0.5
const discopacity = 0.5
const cohortLegendDotColor = '#858585' // '#EBBD5B' // also for sample percentage bar foreground color
const notAnnotatedLabel = 'Unannotated'
const junctionNoSpliceeventLabel = 'None'
const labyspace = 5

const hardcode_infoKey_type = 'type' // currently the only infoFilter key
const hardcode_infoValue_canonical = 'canonical'

/////////////  __render begins

export function renderTk(data, tk, block) {
	if (data) {
		// server returned fresh data
		if (data.junctions?.length == 0) {
			tk.data = []
			tk.leftlabels?.doms?.jug?.text('0 junctions')
			return
		}
		if (!Number.isFinite(data.maxReadCount)) throw new Error('data.maxReadCount is not number')
		rawdata2track(data.junctions, tk, block)
		// tk.data[] set
	} else {
		// this is called from config menu. server data is already parsed at tk.data[]
	}

	tk.leftlabels.doms.jug.text(`${tk.data.length} junction${tk.data.length > 1 ? 's' : ''}`)

	const viewpxwidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	setColor(tk)

	tk.sections.jug.g.selectAll('*').remove()

	// do not clear leftaxis, leave it to transition

	// all graphs go in here
	const mg = tk.sections.jug.g

	tk.data.sort((a, b) => {
		return a._x - b._x
	})

	/* disc radius, determined by sample count for each junction
	will show >1 sample count in disc
	TODO may show piechart for sample stratification
	so need to slightly increase disc radius to fit these
*/
	const maxsamplecount = tk.data.reduce((max, j) => Math.max(max, j.sampleCount), 0)
	{
		const radius = 5
		let mrd = 0 // max radius
		const w = Math.pow(radius, 2) * Math.PI // unit area
		if (maxsamplecount <= 10) {
			mrd = w * maxsamplecount * 0.9
		} else if (maxsamplecount <= 100) {
			mrd = w * 10
		} else if (maxsamplecount <= 1000) {
			mrd = w * 14
		} else {
			mrd = w * 20
		}
		const sf_discradius = scaleLinear()
			.domain([
				1,
				maxsamplecount * 0.5 + 0.1,
				maxsamplecount * 0.6 + 0.1,
				maxsamplecount * 0.7 + 0.1,
				maxsamplecount * 0.8 + 0.1,
				maxsamplecount
			])
			.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])
		let maxradius = 0
		for (const j of tk.data) {
			j.radius = Math.sqrt(sf_discradius(j.sampleCount) / Math.PI)
			if (j.sampleCount > 1) {
				// more than 1 sample, to show #sample in disc, so to adjust disc radius
				mg.append('text')
					.attr('font-family', 'Arial')
					.attr('font-size', Math.max(minfontsize, j.radius))
					.text(j.sampleCount)
					.each(function () {
						const b = this.getBBox()
						const newrad = Math.sqrt(Math.pow(b.width, 2) + Math.pow(b.height, 2)) / 2
						j.radius = Math.max(j.radius, newrad)
					})
					.remove()
			}
			j.rimwidth = j.rimcount ? Math.max(2, j.radius / 6) : 0
			j.radius2 = j.radius + j.rimwidth + (j.rimwidth > 0 ? 1 : 0)
			maxradius = Math.max(maxradius, j.radius2)
		}
		tk.maxradius = maxradius
	}

	// y position, by median read count for each junction
	const maxmedian = tk.data.reduce((c, j) => Math.max(c, j.medianReadCount), 0)

	tk.sections.jug.yscale = (tk.yscaleUseLog ? scaleLog() : scaleLinear())
		.domain([tk.readcountCutoff || 1, data.maxReadCount])
		.range([tk.sections.jug.axisheight, 0])

	// fill axis-y for those junction without previous axisy
	for (const j of tk.data) {
		if (j.axisy == undefined) {
			j.axisy = tk.sections.jug.axisheight - tk.sections.jug.yscale(j.medianReadCount)
		}
	}

	// set y position, also pad height for lower discs
	// all vertical heights set
	tk.sections.jug.height = tk.sections.jug.axisheight + tk.sections.jug.neckheight + tk.sections.jug.legheight

	// svg
	mg.attr('transform', `translate(0,${tk.sections.jug.height})`)

	{
		// top line
		const topy = -tk.sections.jug.legheight - tk.sections.jug.neckheight - tk.sections.jug.axisheight
		mg.append('line')
			.attr('x1', 0)
			.attr('y1', topy)
			.attr('y2', topy)
			.attr('x2', viewpxwidth)
			.attr('stroke', '#858585')
			.attr('stroke-opacity', 0.2)
			.attr('shape-rendering', 'crispEdges')
		// bottom line
		mg.append('line')
			.attr('x1', 0)
			.attr('y1', topy + tk.sections.jug.axisheight)
			.attr('y2', topy + tk.sections.jug.axisheight)
			.attr('x2', viewpxwidth)
			.attr('stroke', '#858585')
			.attr('stroke-opacity', 0.2)
			.attr('shape-rendering', 'crispEdges')
		let v = 10
		while (v <= data.maxReadCount) {
			// order of magnitude line
			mg.append('line')
				.attr('x1', 0)
				.attr('y1', topy + tk.sections.jug.yscale(v))
				.attr('y2', topy + tk.sections.jug.yscale(v))
				.attr('x2', viewpxwidth)
				.attr('stroke', '#858585')
				.attr('stroke-opacity', 0.2)
				.attr('stroke-dasharray', '4,4')
				.attr('shape-rendering', 'crispEdges')
			v *= 10
		}
	}

	const jug = mg
		.selectAll()
		.data(tk.data)
		.enter()
		.append('g')
		.attr('class', 'sja_jug')
		.attr('transform', d => set_jug(d))
		.each(function (j) {
			j.jugg = this
		})

	// leg 1
	// leg y1/y2 are constant
	jug
		.append('line')
		.attr('stroke', d => d.color)
		.attr('x1', d => set_leg_x1(d))
		.attr('y2', -tk.sections.jug.legheight)
		.attr('stroke-opacity', lineopacity)
		.attr('class', 'sja_jug_leg1')
		.each(function (d) {
			d.leg1 = this
		})

	// leg 2
	jug
		.append('line')
		.attr('stroke', d => d.color)
		.attr('x2', d => set_leg_x2(d))
		.attr('y1', -tk.sections.jug.legheight)
		.attr('stroke-opacity', lineopacity)
		.attr('class', 'sja_jug_leg2')
		.each(function (d) {
			d.leg2 = this
		})

	// jug2
	const jug2 = jug
		.append('g')
		.attr('class', 'sja_jug_jug2')
		.attr('transform', d => set_jug2(d, tk))

	// stem - jug2
	// stem may transit to reflect change in yscale / read count
	jug2
		.append('line')
		.attr('stroke', d => d.color)
		.attr('class', 'sja_jug_stem')
		.attr('stroke-dasharray', '2,2')
		.attr('shape-rendering', 'crispEdges')
		.attr('y1', d => d.radius)
		.attr('y2', d => {
			// use previous value
			return tk.sections.jug.neckheight + d.axisy
		})
		.attr('stroke-opacity', lineopacity)
		.each(function (d) {
			d.stem = this
		})

	// disc
	jug2
		.append('circle')
		.each(function (d) {
			d.disc = this
		})
		.attr('r', d => d.radius)
		.attr('fill', d => d.color)
		.attr('stroke', 'white')
		.attr('fill-opacity', discopacity)

	// text in disc
	jug2
		.filter(d => d.sampleCount > 1)
		.append('text')
		.text(d => d.sampleCount)
		.attr('font-size', d => Math.max(minfontsize, d.radius))
		.attr('class', 'sja_jug_discnum')
		.attr('fill', 'white')
		.attr('font-family', 'Arial')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')

	/*
	arcs, not in use

var arcfunc=d3.svg.arc()
	.innerRadius(function(d){return d.radius+1})
	.outerRadius(function(d){return d.radius+1+d.rimwidth})
	.startAngle(0)
	.endAngle(function(d){return Math.PI*2*d.rimcount/d.data.length})
jug2.filter(function(d){return d.rimwidth>0})
	.append('path')
	.attr('d',arcfunc)
	.attr('fill',function(d){return d.color})
	.attr('fill-opacity',function(d){return set_rim(d)})
	.attr('class','sja_jug_rim')
*/

	// kick
	jug2
		.append('circle')
		.attr('r', d => d.radius)
		.attr('stroke', d => d.color)
		//.attr('class','sja_aa_disckick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mouseover', (event, d) => {
			// stop default trigger for block.cursorhlbar
			event.stopPropagation()
			d3select(d.disc).attr('fill-opacity', 0.8)
			d3select(d.stem).attr('stroke-opacity', 1)
			d3select(d.leg1).attr('stroke-opacity', 1)
			d3select(d.leg2).attr('stroke-opacity', 1)

			mouseoverSpanBackground(d, tk, block, viewpxwidth)
			mouseoverBoxplot(d, tk)

			const p = event.target.getBoundingClientRect()
			tk.hovertip.clear().show(p.left + p.width, p.top - 50)
			showOneJunction(d, tk, tk.hovertip.d, block)
		})
		.on('mouseout', (event, d) => {
			tk.hovertip.hide()
			tk.pica.g.selectAll('*').remove()
			block.cursorhlbar.attr('fill', block.cursorhlbarFillColor) // restore
			d3select(d.disc).attr('fill-opacity', discopacity)
			d3select(d.stem).attr('stroke-opacity', lineopacity)
			d3select(d.leg1).attr('stroke-opacity', lineopacity)
			d3select(d.leg2).attr('stroke-opacity', lineopacity)
		})
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('mousemove', event => {
			event.stopPropagation()
		})
		.on('click', (event, d) => {
			tk.hovertip.hide()
			const p = event.target.getBoundingClientRect()
			tk.itemtip.clear().show(p.left + p.width, p.top - 50)
			showOneJunction(d, tk, tk.itemtip.d.append('div'), block, true)
		})

	doForceLayout(tk, block, viewpxwidth).then(() => {
		// done layout
		set_all(tk)
		axisstyle({
			axis: tk.sections.jug.axis.transition().call(
				axisRight()
					.scale(tk.sections.jug.yscale)
					.ticks(Math.floor(tk.sections.jug.axisheight / 20), '.0f')
			),
			color: 'black',
			showline: true
		})
	})
}

function rawdata2track(raw, tk, block) {
	/*
	run only once, to parse new junctions to tk.data
	a junction could be following:
		splicing:
			on same chromosome, j.start - j.stop
		sv:
			break ends: j.chr - j.start, j.sv.mate.chr - j.sv.mate.start
	*/

	const viewpxwidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	const junctions = []
	for (const j of raw) {
		if (j.sv && j.chr == j.sv.mate.chr) {
			// same-chr sv, may need to swap start/stop
			if (j.start > j.sv.mate.start) {
				const p = j.start
				j.start = j.stop = j.sv.mate.start
				j.sv.mate.start = j.sv.mate.stop = p
				const q = j.strand
				j.strand = j.sv.mate.strand
				j.sv.mate.strand = q
			}
		}

		const e = j2block(j, block, viewpxwidth)
		if (e) {
			console.log(
				'junction not in view range: ' +
					j.chr +
					':' +
					j.start +
					'-' +
					(j.sv ? j.sv.mate.chr + ':' + j.sv.mate.start : j.stop)
			)
			continue
		}
		junctions.push(j)
	}
	if (tk.data) {
		/*
		there has been old junctions, reserve old settings for transitioning on both X and Y
		*/
		const map = new Map()
		tk.data.forEach(j => map.set(j.chr + '.' + j.start + '.' + j.stop + '.' + j.strand, j))

		const pannedpx = Number.isInteger(block.pannedpx) ? block.pannedpx : 0
		for (const i of junctions) {
			const j = map.get(i.chr + '.' + i.start + '.' + i.stop + '.' + i.strand)
			if (j) {
				i.x = j.x + pannedpx
				i.axisy = j.axisy
			}
		}
	}
	if (junctions.length == 0) {
		return 'no junctions in view range'
	}
	tk.data = junctions
}

function j2block(j, block, viewpxwidth) {
	let starthit
	let stophit
	{
		const l = block.seekcoord(j.chr, j.start)
		for (const hit of l) {
			if (hit.ridx != undefined && block.subpanels) {
				// hit in rglst and also has subpanels:
				if (hit.x < 0 || hit.x > block.width) {
					// hit position is actually out of block range, do not use it
					continue
				}
			}
			starthit = hit
		}
	}

	{
		const l = block.seekcoord(j.sv ? j.sv.mate.chr : j.chr, j.sv ? j.sv.mate.start : j.stop)
		for (const hit of l) {
			if (hit.ridx != undefined && block.subpanels) {
				if (hit.x < 0 || hit.x > block.width) {
					continue
				}
			}
			stophit = hit
		}
	}

	if (starthit) {
		if (!stophit) {
			stophit = starthit // stop not mapped, use start
		}
	} else {
		if (stophit) {
			starthit = stophit
		} else {
			return true
		}
	}

	let startout = starthit.x < 0 || starthit.x > viewpxwidth
	let stopout = stophit.x < 0 || stophit.x > viewpxwidth
	if (startout && stopout) {
		// both start/stop are out of view range, drop
		return true
	}

	j.x0 = starthit.x
	j.x1 = stophit.x
	j.x = (j.x0 + j.x1) / 2 // adjusted by force layout
	j._x = j.x // constant
	return false
}

function setColor(tk) {
	for (const j of tk.data) {
		// remove prior color, as color may be reassigned by switching infoFilter and then calling renderTk()
		delete j.color
		j.color = JTypes[j.types[0]]?.color
		if (j.color == undefined) throw new Error('unknown j.type')
	}
}

function set_jug(d) {
	return 'translate(' + d.x + ',0)'
}
function set_leg_x1(d) {
	return d.x0 - d.x
}
function set_leg_x2(d) {
	return d.x1 - d.x
}
function set_stem_y2(d, tk) {
	return tk.sections.jug.neckheight + tk.sections.jug.axisheight - tk.sections.jug.yscale(d.medianReadCount)
}
function set_jug2(d, tk) {
	return 'translate(0,-' + (tk.sections.jug.legheight + tk.sections.jug.neckheight + d.axisy) + ')'
}

function set_all(tk) {
	// must update axisy to current value
	const mg = tk.sections.jug
	tk.data.forEach(j => (j.axisy = mg.axisheight - mg.yscale(j.medianReadCount)))

	const dur = 500
	mg.g
		.selectAll('.sja_jug_leg1')
		.transition()
		.duration(dur)
		.attr('y2', -mg.legheight)
		.attr('x1', d => set_leg_x1(d))
	mg.g
		.selectAll('.sja_jug_leg2')
		.transition()
		.duration(dur)
		.attr('y1', -mg.legheight)
		.attr('x2', d => set_leg_x2(d))
	mg.g
		.selectAll('.sja_jug_jug2')
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug2(d, tk))
	/*
	mg.g.selectAll('.sja_jug_rim')
		.transition().duration(dur)
		.attr('fill-opacity',(d)=> set_rim(d))
		*/
	mg.g
		.selectAll('.sja_jug')
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug(d))
	mg.g
		.selectAll('.sja_jug_stem')
		.transition()
		.duration(dur)
		.attr('y2', d => mg.neckheight + d.axisy)
}

function doForceLayout(tk, block, viewpxwidth) {
	// may return promise
	const nodes = [] // nodes in simulation
	let sumdiscwidth = 0 // sum of disc width, for comparing with view range width
	tk.data.map(j => {
		let tox // ideal x
		if (j.x0 < 0) {
			// left foot out of range
			tox = j.x1 - j.radius2 * 2
		} else if (j.x1 > viewpxwidth) {
			// right foot out
			tox = j.x0 + j.radius2 * 2
		} else {
			tox = j._x
		}
		nodes.push({
			junction: j,
			tox: tox,
			x: tox,
			y: tk.sections.jug.axisheight - tk.sections.jug.yscale(j.medianReadCount)
		})
		sumdiscwidth += j.radius2 * 2
	})

	// must sort nodes, must apply index by ascending order!!
	nodes.sort((i, j) => i.tox - j.tox)
	nodes.forEach((n, i) => (n.index = i))

	const collidestrength = sumdiscwidth <= viewpxwidth ? 1 : viewpxwidth / sumdiscwidth

	return new Promise((resolve, reject) => {
		d3force
			.forceSimulation(nodes)
			.force(
				'y',
				d3force
					.forceY(d => {
						return tk.sections.jug.axisheight - tk.sections.jug.yscale(d.junction.medianReadCount)
					})
					.strength(1)
			)
			.force('x', d3force.forceX(d => d.tox).strength(0.1))
			.force(
				'collide',
				d3force
					.forceCollide(d => {
						return d.junction.radius2 + 2
					})
					.strength(collidestrength)
			)
			.alphaMin(0.5)
			.on('end', () => {
				nodes.forEach(n => {
					n.junction.x = n.x
				})
				resolve()
			})
	})
}

function mouseoverSpanBackground(j, tk, block, viewpxwidth) {
	/*
	in genome mode, j.x0 is on left, j.x1 is on right
	in gm mode of reverse strand gene, j.x1 is on left, j.x0 is on right
	*/

	let xleft = Math.min(j.x0, j.x1)
	let xright = Math.max(j.x0, j.x1)

	if (block.usegm && block.usegm.strand == '-') {
		xleft = j.x1
		xright = j.x0
	}

	if (xleft >= 0 && xright <= viewpxwidth) {
		// two feet within view range
		block.cursorhlbar
			.attr('x', block.leftheadw + block.lpad + xleft)
			.attr('y', 0)
			.attr('width', xright - xleft)
			.attr('height', block.totalheight())
			.attr('fill', 'url(#' + tk.gradient4spanBackground.mid.id + ')')
		return
	}

	// one foot is out of view range

	const boxwidth = 50

	if (xleft >= 0) {
		block.cursorhlbar
			.attr('x', block.leftheadw + block.lpad + xleft)
			.attr('fill', 'url(#' + tk.gradient4spanBackground.left.id + ')')
	} else {
		block.cursorhlbar
			.attr('x', block.leftheadw + block.lpad + xright - boxwidth)
			.attr('fill', 'url(#' + tk.gradient4spanBackground.right.id + ')')
	}
	block.cursorhlbar.attr('y', 0).attr('width', boxwidth).attr('height', block.totalheight())
}

function mouseoverBoxplot(j, tk) {
	// mouse over disc show boxplot for read count
	if (!j.readcountBoxplot) return
	const color = 'black'
	const p5 = tk.sections.jug.yscale(j.readcountBoxplot[0])
	const p25 = tk.sections.jug.yscale(j.readcountBoxplot[1])
	const p50 = tk.sections.jug.yscale(j.readcountBoxplot[2])
	const p75 = tk.sections.jug.yscale(j.readcountBoxplot[3])
	const p95 = tk.sections.jug.yscale(j.readcountBoxplot[4])
	const w = 10
	tk.pica.g.selectAll('*').remove()
	tk.pica.g.attr('transform', 'translate(' + j.x + ',' + p50 + ')')
	const g = tk.pica.g.append('g').attr('transform', 'translate(' + (-5 - w - j.radius2) + ',0)')
	// v line
	g.append('line')
		.attr('x1', w / 2)
		.attr('x2', w / 2)
		.attr('y1', p95 - p50)
		.attr('y2', p5 - p50)
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	g.append('line')
		.attr('x1', 0)
		.attr('x2', w)
		.attr('y1', p5 - p50)
		.attr('y2', p5 - p50)
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	g.append('line')
		.attr('x1', 0)
		.attr('x2', w)
		.attr('y1', p95 - p50)
		.attr('y2', p95 - p50)
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	g.append('rect')
		.attr('y', p75 - p50)
		.attr('width', w)
		.attr('height', p25 - p75)
		.attr('stroke', color)
		.attr('fill', 'white')
		.attr('shape-rendering', 'crispEdges')
	// median
	if (p25 - p75 > 3) {
		g.append('line').attr('x2', w).attr('stroke', color).attr('shape-rendering', 'crispEdges')
	}
}

/////////////  __render ENDS

/************* __eventdiagram

exon skip or a5ss events, junctionB has a number of samples passing current filter from which median read count is generated on previous view-range request
to illustrate canonical junctionAlst, the same set of samples from junctionB should be used to find out median read count for each of them
thus the query
*/

function showOneJunction(j, tk, holder, block, ifeventdetails) {
	const table = table2col({ holder, margin: '0px' })
	{
		const [t1, t2] = table.addRow()
		t1.text('Junction')
		const div = t2.append('div')
		if (!j.sv || j.chr == j.sv.mate.chr) {
			// same chr
			div.html(
				bplen(Math.abs(j.start - (j.sv ? j.sv.mate.start : j.stop))) +
					' <span style="font-size:.8em;">' +
					j.chr +
					':' +
					(j.start + 1) +
					'-' +
					((j.sv ? j.sv.mate.start : j.stop) + 1) +
					'</span>'
			)
		} else {
			// inter-chr sv
			div.html(
				'<span style="font-size:.8em;">' +
					j.chr +
					':' +
					(j.start + 1) +
					'-' +
					j.sv.mate.chr +
					':' +
					(j.sv.mate.start + 1) +
					'</span>'
			)
		}
		// print all types in 2nd row
		const d2 = t2.append('div')
		d2.append('span') // strand
			.attr('class', 'sja_mcdot')
			.style('padding', '1px 5px')
			.style('background-color', '#555')
			.style('margin-right', '5px')
			.text(j.strand)
		for (const t of j.types) {
			d2.append('span')
				.attr('class', 'sja_mcdot')
				.style('padding', '1px 5px')
				.style('background-color', JTypes[t]?.color || 'black')
				.style('margin-right', '5px')
				.text(JTypes[t]?.name || '?')
		}
	}
	const [t1, t2] = table.addRow()
	if (j.sampleCount == 1) {
		t1.text('Sample')
		const sndiv = t2.append('div')
		sndiv.html('1 <span style="font-size:.7em">single sample</span>')
		if (ifeventdetails) {
			// query to get sample name and print
		}
		t2.append('div').html(j.medianReadCount + ' <span style="font-size:.7em">read count</span>')
	} else {
		t1.text('Samples')
		t2.append('div').html(`${j.sampleCount} <span style="font-size:.7em">samples</span>
			<br>${j.medianReadCount} <span style="font-size:.7em">median read count</span>`)
		if (ifeventdetails) {
			// if app is available, show btn to generate junction term
		}
	}

	const type2elst = new Map() // k: event.type, v: list of events of that type
	for (const e of j.info?.events || []) {
		if (!type2elst.has(e.type)) type2elst.set(e.type, [])
		type2elst.get(e.type).push(e)
	}

	for (const [type, elst] of type2elst) {
		listAllEvents(elst, table, j, tk, block)
	}

	if (type2elst.size == 0) {
		// no events. it's either canonical or not annotated, show free diagram
		const [t1, t2] = table.addRow()
		t1.text('Diagram')
		showJunctionDiagram(j, tk, t2)
	}
}

function showJunctionDiagram(j, tk, holder) {
	/* a junction with no known event, show diagram with respect to either end mapping to gene
	here just use first isoform
	TODO allow choosing an isoform/event
	if start/stop are on same gene, render using one function
	if no different genes, show with another  function
	*/
	if (typeof j.info != 'object' || Object.keys(j.info).length == 0) {
		// either missing j.info, or is empty object
		return
	}

	const leftgenes = new Map()
	if (j.info.exonleft) j.info.exonleft.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.info.exonleftin) j.info.exonleftin.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.info.intronleft) j.info.intronleft.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))

	const rightgenes = new Map()
	if (j.info.exonright) j.info.exonright.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.info.exonrightin) j.info.exonrightin.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.info.intronright) j.info.intronright.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))

	let isoform // the one with both start/stop in it
	let strand

	if (leftgenes.size) {
		if (rightgenes.size) {
			// start/stop both in genes
			for (const [n, a] of leftgenes) {
				if (rightgenes.has(n)) {
					isoform = n
					strand = a.strand
					break
				}
			}
		} else {
			// stop not in a gene, use start
			const a = [...leftgenes][0]
			isoform = a[0]
			strand = a[1].strand
		}
	} else if (rightgenes.size) {
		// start not in a gene, use stop
		const a = [...rightgenes][0]
		isoform = a[0]
		strand = a[1].strand
	}

	if (isoform) {
		if (strand != '+' && strand != '-') {
			holder.text('unknown strand for ' + isoform)
			return
		}
		import('../src/spliceevent.noeventdiagram').then(p => {
			p.samegene({
				isoform: isoform,
				reverse: strand == '-',
				ongene: j.info,
				holder: holder
			})
		})
		return
	}

	// here start/stop are on different genes
	import('../src/spliceevent.noeventdiagram').then(p => {
		p.differentgenes({
			ongene: j.info,
			holder: holder
		})
	})
}

function showEventdiagram_a53ss(j, e, tk, holder, block, donotloadcount) {
	// a5ss, a3ss
	const e2 = {
		junctionB: {
			start: j.start,
			stop: j.stop,
			strand: j.strand,
			v: j.medianReadCount
		},
		a5ss: e.type == JT_a5ss,
		a3ss: e.type == JT_a3ss,
		altinintron: e.altinintron,
		altinexon: e.altinexon,
		frame: e.frame,
		exon5idx: e.exon5idx,
		strand: e.strand,
		sitedist: e.sitedist
	}
	if (e.junctionA) {
		e2.junctionA = { start: e.junctionA.start, stop: e.junctionA.stop, strand: e.junctionA.strand, v: '...' }
	}
	import('../src/spliceevent.a53ss.diagram').then(p => {
		const text = p.default({
			event: e2,
			holder: holder
		})
		if (!text) return
		if (donotloadcount) return
		setTimeout(() => {
			if (text.node().getBoundingClientRect().top == 0) return
			const strandA = e.junctionA.strand
			fetchReadcount4junctionAbyjunctionBsamples(
				tk,
				block,
				j,
				new Map([[e.junctionA.start + '.' + e.junctionA.stop + '.' + strandA, text]]),
				[[e.junctionA.start, e.junctionA.stop, strandA]]
			)
		}, 1000)
	})
}

function showEventdiagram_skipalt_fetchreadcount(j, e, tk, holder, block, donotloadcount = false) {
	/*
	j is the junctionB of this event
	event is as from j.info.spliceEvent, either skip or alt
	*/
	const e2 = {
		gm: {
			// confirm if can delete
			name: e.gene,
			isoform: e.isoform
		},
		junctionB: {
			data: [{ v: j.medianReadCount }]
		},
		skippedexon: e.skippedexon,
		isskipexon: e.type == JT_exonskip,
		isaltexon: e.type == JT_exonaltuse,
		frame: e.frame,
		junctionAlst: [],
		color: '#99004d'
	}
	if (e.junctionAlst) {
		for (const jA of e.junctionAlst) {
			if (jA) {
				//jA.strand = '+' // TODO FIXME remove when strand is added
				jA.data = [{ v: '...' }]
				e2.junctionAlst.push(jA)
				continue
			}
			e2.junctionAlst.push(null)
		}
	}
	if (e.up1junction) {
		e.up1junction.data = [{ v: '...' }]
		e2.up1junction = e.up1junction
	}
	if (e.down1junction) {
		e.down1junction.data = [{ v: '...' }]
		e2.down1junction = e.down1junction
	}

	import('../src/spliceevent.exonskip.diagram').then(p => {
		const [junction2readcounttext, junctionlst] = p.default({
			event: e2,
			holder: holder,
			nophrase: true
		})
		if (donotloadcount) return
		setTimeout(() => {
			// if the diagram already disappears, don't make query
			for (const [k, text] of junction2readcounttext) {
				if (text.node().getBoundingClientRect().top == 0) {
					return
				}
			}
			fetchReadcount4junctionAbyjunctionBsamples(tk, block, j, junction2readcounttext, junctionlst)
		}, 1000)
	})
}

function listAllEvents(lst, table, j, tk, block) {
	if (lst.length == 1) {
		const [t1, t2] = table.addRow()
		const e = lst[0]
		t1.text(e.gene + ' ' + e.isoform)
		if (e.type == JT_exonskip || e.type == JT_exonaltuse) {
			showEventdiagram_skipalt_fetchreadcount(j, e, tk, t2, block)
		} else if (e.type == JT_a5ss || e.type == JT_a3ss) {
			showEventdiagram_a53ss(j, e, tk, t2, block)
		}
		return
	}

	// multiple events
	// for events on different isoform that may be showing identical events, group them
	const map = new Map() // k: stringified event less isoform, v: isoform
	for (const e of lst) {
		const f = structuredClone(e)
		const v = e.isoform
		delete f.isoform
		const key = JSON.stringify(f)
		if (map.has(key)) map.get(key).push(e.isoform)
		else map.set(key, [e.isoform])
	}
	for (const [key, isolst] of map) {
		const eo = JSON.parse(key)
		const [t1, t2] = table.addRow()
		t1.text(eo.gene + ' ' + isolst.join(' '))
		if (eo.type == JT_exonskip || eo.type == JT_exonaltuse) {
			showEventdiagram_skipalt_fetchreadcount(j, eo, tk, t2, block)
		} else if (eo.type == JT_a5ss || eo.type == JT_a3ss) {
			showEventdiagram_a53ss(j, eo, tk, t2, block)
		}
	}
}

/*
query server to get median read count for display for these junctions
over the same group of sample

jB: junction B
jAlst: [ [start,stop] ]
junction2readcounttext: svg text for printing median read count for each A junction
*/
async function fetchReadcount4junctionAbyjunctionBsamples(tk, block, jB, junction2readcounttext, jAlst) {
	const [body, headers] = getParameter(tk, block)
	delete body.rglst
	delete body.hiddenTypes
	body.junctionB = { chr: jB.chr, start: jB.start, stop: jB.stop, strand: jB.strand }
	body.junctionAposlst = jAlst
	try {
		const data = await dofetch3('termdb/junctions/AbyB', { body, headers })
		if (data.error) throw new Error(data.error)
		if (!Array.isArray(data.lst)) throw new Error('.lst[] missing')
		for (const j of data.lst) {
			/*
			.start
			.stop
			.v
			*/
			const key = j.start + '.' + j.stop + '.' + j.strand
			if (junction2readcounttext.has(key)) {
				junction2readcounttext.get(key).text(j.v)
			}
		}
	} catch (e) {
		console.error(e.message || e)
	}
}

/////////////// __eventdiagram ENDS

async function queryOneJunction(j, tk, block, holder) {}

function get_list_cells(table) {
	return [
		table
			.append('div')
			.style('width', '100%')
			.style('padding', '5px 20px 5px 0px')
			.style('border-bottom', 'solid 1px #ededed'),
		table
			.append('div')
			.style('width', '100%')
			.style('border-bottom', 'solid 1px #ededed')
			.style('padding', '5px 20px 5px 0px')
	]
}
