import { scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { select as d3select } from 'd3-selection'
import { axisRight } from 'd3-axis'
import * as client from './client'
import * as common from '#shared/common.js'
import { legend_newrow } from './block.legend'
import { modefold, moderaise, modesample } from './block.tk.junction'
import { spliceeventanalyze, displayspliceevents } from './block.tk.junction.spliceevent'
import { beeswarm } from 'd3-beeswarm'
import getdefault_exonskipalt from './spliceevent.exonskip.getdefault'

/*
exported functions:
	- rendertk()
	- automode()
	- horiplace()
*/

const colorfunc = scaleOrdinal(schemeCategory10)

const minfontsize = 12

export function rendertk(junctions, tk, block) {
	/*
data from multiple samples
allow metadata
allow mode toggling
allow highlight certain junctions
*/

	if (tk.data) {
		/*
	there has been old junctions
	reserve old settings (x, mode)
	*/
		const map = new Map()
		for (const j of tk.data) {
			map.set(j.chr + '.' + j.start + '.' + j.stop, j)
		}
		const pannedpx = Number.isInteger(block.pannedpx) ? block.pannedpx : 0
		for (const i of junctions) {
			const j = map.get(i.chr + '.' + i.start + '.' + i.stop)
			if (j) {
				i.x = j.x + pannedpx
				i.mode = j.mode
				i.modefix = j.modefix
				/*
			lazy fix: if previous mode is modesample, change to moderaise
			*/
				if (i.mode == modesample) {
					i.mode = moderaise
				}
			}
		}
	}
	tk.data = junctions
	tk.glider.selectAll('*').remove()
	tk.leftaxis.selectAll('*').remove()

	/*
if(tk.bins) {
	// not in use
	tk.data=null
	var barheight=tk.axisheight
	var binw=block.width/bincount
	tk.height=tk.toppad+barheight+tk.bottompad
	var maxvalue=Math.max.apply(null,bins)
	var yscale=d3.scale.log().domain([1,maxvalue]).range([barheight,0])
	sja.f.axis_applystyle({
		axis:tk.leftaxis.call(
			d3.svg.axis().scale(yscale).orient('left').ticks(6,'.0f')
		),
		color:'black',
		showline:true
	})
	tk.glider.selectAll().data(bins).enter().append('rect')
		.attr('x',function(d,i){ return binw*i })
		.attr('y',function(d){ return tk.toppad+(d==0 ? 0 : yscale(d))})
		.attr('height',function(d){return barheight-(d==0 ? barheight : yscale(d))})
		.attr({
			width:binw,
			fill:'black'
			})
	block.block_setheight()
	if(tk.onrender) {
		tk.onrender(tk)
	}
	return
}
	*/

	if (tk.readcountcutoff) {
		const newj = []
		for (const j of tk.data) {
			if (j.data) {
				// multi sample, filter on samples
				const newsamples = []
				for (const s of j.data) {
					if (s.v >= tk.readcountcutoff) {
						newsamples.push(s)
					}
				}
				if (newsamples.length == 0) {
					continue
				}
				j.data = newsamples
				newj.push(j)
			} else {
				// single sample
				if (j.v >= tk.readcountcutoff) {
					newj.push(j)
				}
			}
		}
		tk.data = newj
	}

	if (tk.data.length == 0) {
		tk.height_main = 50
		block.tkcloakoff(tk, { error: tk.name + ': No junction in view range' })
		// controller off
		tk.label_mcount.text('')
		if (tk.label_samplecount) {
			// only has this label when of multi-samples
			tk.label_samplecount.text('')
		}
		get_leftLabelMaxwidth(tk)
		block.setllabel()
		block.block_setheight()
		/*
	if(tk.onrender) {
		tk.onrender(tk)
	}
	*/
		return
	}

	// tell # of unique junctions
	tk.label_mcount.text(tk.data.length + ' junction' + (tk.data.length > 1 ? 's' : ''))

	/*
if(tk.totalsamplecount>1) {
	tk.label_samplecount.text(tk.totalsamplecount+' samples')
}
*/

	get_leftLabelMaxwidth(tk)
	block.setllabel()

	junctiontype2color(tk, block)

	// all graphs go in here
	const mg = tk.glider.append('g')

	tk.data.sort((a, b) => {
		return a._x - b._x
	})

	/*
when multi-sample, use max # of samples for a junction in view range
if single sample, use max junction read count
*/
	let maxsamplecount = 0

	// disc radius
	if (tk.totalsamplecount > 1) {
		/*
	multi-sample
	will show >1 sample count in disc
	and may show piechart for sample stratification
	so need to slightly increase disc radius to fit these
	*/
		maxsamplecount = tk.data.reduce((max, j) => Math.max(max, j.data.length), 0)

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
			j.radius = Math.sqrt(sf_discradius(j.data.length) / Math.PI)
			if (j.data.length > 1) {
				// more than 1 sample, to show #sample in disc, so to adjust disc radius
				mg.append('text')
					.attr('font-family', client.font)
					.attr('font-size', Math.max(minfontsize, j.radius))
					.text(j.data.length)
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
	} else {
		/*
	single sample
	disc size by read count
	no text in disc
	*/
		maxsamplecount = tk.data.reduce((max, j) => Math.max(max, j.data[0].v), 0)

		const radius = 5
		let mrd = 0 // max radius
		const w = Math.pow(radius, 2) * Math.PI // unit area
		if (maxsamplecount <= 10) {
			mrd = w * maxsamplecount * 0.9
		} else if (maxsamplecount <= 100) {
			mrd = w * 5
		} else if (maxsamplecount <= 1000) {
			mrd = w * 7
		} else {
			mrd = w * 10
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
			j.radius = Math.sqrt(sf_discradius(j.data[0].v) / Math.PI)
			j.rimwidth = j.rimcount ? Math.max(2, j.radius / 6) : 0
			j.radius2 = j.radius + j.rimwidth + (j.rimwidth > 0 ? 1 : 0)
			maxradius = Math.max(maxradius, j.radius2)
		}
		tk.maxradius = maxradius
	}

	// y position
	let maxread = 0,
		maxmedian = 0,
		maxmedianradius = 0

	for (const j of tk.data) {
		for (const s of j.data) {
			maxread = Math.max(s.v, maxread)
		}
		if (j.data.length == 1) {
			// even for single sample, still set j.median
			j.median = j.data[0].v
		} else {
			const readlst = j.data.map(s => s.v)
			readlst.sort((a, b) => a - b)
			j.median = readlst[Math.floor(j.data.length / 2)]
		}
		if (j.median > maxmedian) {
			maxmedian = j.median
			maxmedianradius = j.radius
		}
	}

	tk.yscale = scaleLog()
		.domain([tk.readcountcutoff || 1, maxread])
		.range([tk.axisheight, 0])

	client.axisstyle({
		axis: tk.leftaxis.call(axisRight().scale(tk.yscale).ticks(6, '.0f')),
		color: 'black',
		showline: true
	})

	// set y position, also pad height for lower discs
	// all vertical heights set
	tk.height_main = tk.toppad + tk.axisheight + tk.maxradius * 4 + tk.padheight + tk.lowpad + tk.legheight + tk.bottompad

	// as soon as height is determined, create <g> for splice events, since glider has been emptied
	tk.eventsg = tk.glider.append('g').attr('transform', 'translate(0,' + (tk.height_main - tk.toppad) + ')')

	automode(tk, null, block.width)

	// svg
	mg.attr('transform', 'translate(0,' + (tk.height_main - tk.toppad - tk.bottompad) + ')')

	{
		// top line
		const topy = -tk.legheight - tk.lowpad - tk.maxradius * 4 - tk.padheight - tk.axisheight
		mg.append('line')
			.attr('x1', 0)
			.attr('y1', topy)
			.attr('y2', topy)
			.attr('x2', block.width)
			.attr('stroke', '#858585')
			.attr('stroke-opacity', 0.2)
			.attr('shape-rendering', 'crispEdges')
		// bottom line
		mg.append('line')
			.attr('x1', 0)
			.attr('y1', topy + tk.axisheight)
			.attr('y2', topy + tk.axisheight)
			.attr('x2', block.width)
			.attr('stroke', '#858585')
			.attr('stroke-opacity', 0.2)
			.attr('shape-rendering', 'crispEdges')
		let v = 10
		while (v <= maxread) {
			// order of magnitude line
			mg.append('line')
				.attr('x1', 0)
				.attr('y1', topy + tk.yscale(v))
				.attr('y2', topy + tk.yscale(v))
				.attr('x2', block.width)
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
		.attr('transform', d => set_jug(d))
		.each(function (j) {
			j.jugg = this
		})

	tk.jug = jug

	// highlight junctions?
	if (tk.hljunctions) {
		jug.attr('class', d => {
			for (const j of tk.hljunctions) {
				if (d.chr == j.chr && d.start == j.start && d.stop == j.stop) {
					return 'sja_pulse'
				}
			}
			return null
		})
	}

	jug
		.append('line')
		.attr('stroke', d => d.color)
		.attr('x1', d => set_leg_x1(d))
		.attr('y2', d => set_leg_y(d, tk))
		.attr('stroke-opacity', d => set_lineopacity(d))
		.each(function (d) {
			d.leg1 = this
		})
		.classed('sja_jug_leg1', true)
	jug
		.append('line')
		.attr('stroke', d => d.color)
		.attr('x2', d => set_leg_x2(d))
		.attr('y1', d => set_leg_y(d, tk))
		.attr('stroke-opacity', d => set_lineopacity(d))
		.classed('sja_jug_leg2', true)
		.each(function (d) {
			d.leg2 = this
		})
	const jug2 = jug
		.append('g')
		.attr('class', 'sja_jug_jug2')
		.attr('transform', d => set_jug2(d, tk))

	jug2
		.append('line')
		.attr('stroke', d => d.color)
		.classed('sja_jug_stem', true)
		.attr('stroke-dasharray', '2,2')
		.attr('shape-rendering', 'crispEdges')
		.attr('y1', d => set_stem_y1(d))
		.attr('y2', d => set_stem_y2(d, tk))
		.attr('stroke-opacity', d => set_lineopacity(d))
		.each(function (d) {
			d.stem = this
		})
	jug2
		.append('circle')
		.attr('r', d => d.radius)
		.attr('fill', d => d.color)
		.attr('stroke', 'white')
		.attr('fill-opacity', 0.5)

	// text in disc
	jug2
		.filter(d => d.data.length > 1)
		.append('text')
		.text(d => d.data.length)
		.attr('font-size', d => Math.max(minfontsize, d.radius))
		.attr('fill-opacity', d => set_discnum(d))
		.classed('sja_jug_discnum', true)
		.attr('fill', 'white')
		.attr('font-family', client.font)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')

	/*
	arcs
	not in use
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
		.classed('sja_aa_disckick', true)
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mouseover', (event, d) => {
			jug.selectAll('.sja_jug_leg1').attr('stroke-opacity', 0.2)
			jug.selectAll('.sja_jug_leg2').attr('stroke-opacity', 0.2)
			jug.selectAll('.sja_jug_stem').attr('stroke-opacity', 0.2)
			d3select(d.leg1).attr('stroke-opacity', 1)
			d3select(d.leg2).attr('stroke-opacity', 1)
			d3select(d.stem).attr('stroke-opacity', 1)
			if (d.mode == modefold) {
				foldedjunctioninfo(d, tk)
				return
			}
			const circle = event.target.getBoundingClientRect()
			expandedjunctioninfo(d, tk, circle)
		})
		.on('mouseout', () => {
			tk.pica.g.selectAll('*').remove()
			tk.tktip.hide()
			jug.selectAll('.sja_jug_leg1').attr('stroke-opacity', d => set_lineopacity(d))
			jug.selectAll('.sja_jug_leg2').attr('stroke-opacity', d => set_lineopacity(d))
			jug.selectAll('.sja_jug_stem').attr('stroke-opacity', d => set_lineopacity(d))
		})
		.on('mousedown', event => {
			/*
		allow shift jug manually
		*/
			event.stopPropagation()
		})
		.on('click', (event, d) => {
			if (d.mode == modefold) {
				d.mode = moderaise
			} else if (d.mode == moderaise) {
				if (d.data.length == 1) {
					// single sample, or just 1 sample in a multi sample track
					d.mode = modefold
				} else {
					// show dots for sample
					d.mode = modesample
					junctionsamplespread(d, tk, block)
				}
			} else {
				d.mode = modefold
			}
			d.modefix = true
			horiplace(tk.data, block.width, tk)
		})
	horiplace(tk.data, block.width, tk)

	function set_lineopacity(d) {
		// do not take this function out!
		return 0.5
		//return .3+.7 * (d.data ? d.data.length : d.v) / maxsamplecount
	}

	block.onloadalltk.push(() => {
		spliceeventanalyze(tk, block)
	})

	// done
	block.tkcloakoff(tk, {})
	block.block_setheight()
}

export function horiplace(lst, width, tk) {
	/*
	j._x: theoretical x pos of jug, wild if one foot is way out of view range
	j.x0: actual x of left foot
	j.x1: actual x of right foot
	*/

	const todo = []
	for (const i of lst) {
		// target x
		if (i.x0 < 0) {
			// left foot out of range
			i.tox = i.x1 - i.radius2 * 2
		} else if (i.x1 > width) {
			// right foot out
			i.tox = i.x0 + i.radius2 * 2
		} else {
			// both in
			i.tox = i._x
		}
		if (i.mode == modefold) {
			//i.x=Math.min(Math.max(i.radius2,i._x), width-i.radius2)
			i.x = i.tox
		} else {
			todo.push(i)
		}
	}

	/*
	no longer does shifting
	*/
	for (const i of lst) {
		i.x = i.tox
	}
	set_all(tk)
	return
	// !!! why return before this code block !!!
	// todo.sort((a, b) => {
	// 	return a.tox - b.tox
	// })

	// // push all to left
	// // set initial x for all for shifting
	// let cumx = todo.length == 0 ? 0 : todo[0].radius2
	// for (const i of todo) {
	// 	i.x = cumx + i.radius2
	// 	cumx += i.radius2 * 2
	// 	/*
	// 	i.x=cumx+i.radius2
	// 	if(i.x0<0) {
	// 		// left out
	// 		i.x=Math.max(i.x, i.x1-i.radius2*2)
	// 	} else if(i.x1>width) {
	// 		i.x=Math.max(i.x, i.x0+i.radius2*2)
	// 	}
	// 	cumx=i.x+i.radius2
	// 	*/
	// }

	// for (let i = 0; i < todo.length; i++) {
	// 	while (1) {
	// 		let currsum = 0,
	// 			newsum = 0
	// 		for (let j = i; j < todo.length; j++) {
	// 			const k = todo[j]
	// 			// detect conditions to stop
	// 			if (j > 0) {
	// 				const prev = todo[j - 1]
	// 				if (prev.x + prev.radius2 <= k.x - k.radius2) {
	// 					// not overlapping with previous
	// 					if (k.x >= k.tox) {
	// 						// so it can stop
	// 						break
	// 					}
	// 				}
	// 			} else {
	// 				if (k.x >= k.tox) {
	// 					// the first one, it can stop too
	// 					break
	// 				}
	// 			}
	// 			const z = todo[todo.length - 1]
	// 			if (z.x + z.radius2 >= width) {
	// 				// last one out of range
	// 				break
	// 			}
	// 			currsum += Math.abs(k.x - k.tox)
	// 			k.x++
	// 			newsum += Math.abs(k.x - k.tox)
	// 		}
	// 		if (newsum < currsum) {
	// 		} else {
	// 			// reject
	// 			for (let j = i; j < todo.length; j++) {
	// 				todo[j].x--
	// 			}
	// 			break
	// 		}
	// 	}
	// }
	// set_all(tk)
}

export function automode(tk, usemode, blockwidth) {
	/*
no longer fold junctions
*/
	for (const i of tk.data) {
		if (!i.mode) i.mode = moderaise
	}
	return

	const samplecountlst = []
	for (let i = 0; i < tk.data.length; i++) {
		samplecountlst.push({
			idx: i,
			count: tk.data[i].data ? tk.data[i].data.length : tk.data[i].v
		})
	}
	samplecountlst.sort((a, b) => b.count - a.count)
	let cumx = 0
	for (const cc of samplecountlst) {
		const d = tk.data[cc.idx]
		if (!d.mode) {
			// no mode, only happens in first-time loading data and no usemode imposed
			cumx += d.radius2 * 2
			d.mode = cumx >= blockwidth ? modefold : moderaise
		} else {
			if (d.modefix) {
				// won't alter mode
				if (d.mode != modefold) {
					cumx += d.radius2 * 2
				}
			} else {
				if (usemode) {
					d.mode = usemode
					if (d.mode != modefold) {
						cumx += d.radius2 * 2
					}
				} else {
					cumx += d.radius2 * 2
					d.mode = cumx >= blockwidth ? modefold : moderaise
				}
			}
		}
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
function set_discnum(d) {
	return d.mode == modefold ? 0 : 1
}
function set_pillar(d) {
	if (d.mode == modesample) return d.radius * 2
	return 0
}
function set_stem_y1(d) {
	if (d.mode == modefold) return d.radius
	return d.radius2
}
function set_rim(d) {
	return d.mode == modefold ? 0 : 0.7
}
function set_qmg(d, tk) {
	if (d.mode == modesample)
		return 'translate(0,-' + (tk.legheight + tk.maxradius * 4 + tk.lowpad + tk.padheight) + ') scale(1)'
	return 'translate(0,0) scale(0)'
}
function set_leg_y(d, tk) {
	if (d.mode == modefold) return -tk.legheight
	return -tk.legheight - tk.lowpad - tk.maxradius * 2
}
function set_jug2(d, tk) {
	if (d.mode == modefold) return 'translate(0,-' + (tk.legheight + tk.lowpad + d.radius) + ')'
	if (d.mode == moderaise)
		return (
			'translate(0,-' +
			(tk.legheight + tk.lowpad + tk.maxradius * 4 + tk.padheight + tk.axisheight - tk.yscale(d.median)) +
			')'
		)
	return 'translate(0,-' + (tk.legheight + tk.lowpad + tk.maxradius * 3 + tk.padheight) + ')'
}
function set_stem_y2(d, tk) {
	if (d.mode == modefold) return d.radius + tk.lowpad
	if (d.mode == moderaise) return tk.padheight + tk.maxradius * 2 + tk.axisheight - tk.yscale(d.median)
	return tk.maxradius + tk.padheight
}
function set_all(tk) {
	const dur = 500
	if (tk.totalsamplecount > 1) {
		tk.jug
			.selectAll('.sja_jug_qmg')
			.transition()
			.duration(dur)
			.attr('transform', d => set_qmg(d, tk))
		tk.jug
			.selectAll('.sja_jug_discnum')
			.transition()
			.duration(dur)
			.attr('fill-opacity', d => set_discnum(d))
		/*
		tk.jug.selectAll('.sja_jug_pillar')
			.attr('width',(d)=> set_pillar(d))
			*/
	}
	tk.jug
		.selectAll('.sja_jug_leg1')
		.transition()
		.duration(dur)
		.attr('y2', d => set_leg_y(d, tk))
		.attr('x1', d => set_leg_x1(d))
	tk.jug
		.selectAll('.sja_jug_leg2')
		.transition()
		.duration(dur)
		.attr('y1', d => set_leg_y(d, tk))
		.attr('x2', d => set_leg_x2(d))
	tk.jug
		.selectAll('.sja_jug_jug2')
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug2(d, tk))
	tk.jug
		.selectAll('.sja_jug_stem')
		.transition()
		.duration(dur)
		.attr('y2', d => set_stem_y2(d, tk))
		.attr('y1', d => set_stem_y1(d))
	/*
	tk.jug.selectAll('.sja_jug_rim')
		.transition().duration(dur)
		.attr('fill-opacity',(d)=> set_rim(d))
		*/
	tk.jug
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug(d))
}

function junctiontype2color(tk, block) {
	// figure out color for junctions
	for (const j of tk.data) {
		j.color = common.defaultcolor
	}
	if (tk.nocatepreconfig) {
		/* no preconfig info
		detect types from data
		refresh legend everytime
		*/
		let categories = {}
		if (tk.categories) {
			// has category from previous data load
			categories = tk.categories
		}
		let hasnewtype = false
		for (const j of tk.data) {
			if (j.type) {
				if (!categories[j.type]) {
					hasnewtype = true
					categories[j.type] = {
						label: j.type
					}
					// known/novel hardcoded types
					if (j.type.toLowerCase() == 'known') {
						categories[j.type].color = '#0C72A8' // '#659AC7'
					} else if (j.type.toLowerCase() == 'novel') {
						categories[j.type].color = '#A80C33' // '#C86569'
					} else {
						categories[j.type].color = colorfunc(j.type)
					}
				}
			}
		}
		if (hasnewtype) {
			tk.categories = categories
			if (!tk.tr_legend) {
				const [tr, td] = legend_newrow(block, tk.name)
				tk.tr_legend = tr
				tk.td_legend = td
				tr.style('display', 'none')
				client.appear(tr, 'table-row')
			}
			client.category2legend(tk.categories, tk.td_legend)
		}
	}
	if (tk.categories) {
		// now apply color, no matter preconfigured or runtime
		for (const j of tk.data) {
			if (j.type && tk.categories[j.type]) {
				j.color = tk.categories[j.type].color
			}
		}
	}
}

function foldedjunctioninfo(d, tk) {
	// d is junction
	const fontsize = 15
	let pad = 5,
		y = pad,
		width = 0
	const bg = tk.pica.g
		.append('rect')
		.attr('stroke', d.color)
		.attr('shape-rendering', 'crispEdges')
		.attr('fill', 'white')
		.attr('fill-opacity', 0.8)
	if (d.type) {
		tk.pica.g
			.append('text')
			.text(d.type)
			.attr('fill', d.color)
			.attr('font-size', fontsize - 2)
			.attr('font-family', client.font)
			.attr('x', pad)
			.attr('y', y + fontsize / 2)
			.attr('dominant-baseline', 'central')
			.each(function () {
				width = this.getBBox().width
			})
		y += fontsize
	}
	if (d.data) {
		// multi-sample
		tk.pica.g
			.append('text')
			.text(d.data.length + ' sample' + (d.data.length > 1 ? 's' : ''))
			.attr('fill', '#858585')
			.attr('font-size', fontsize - 2)
			.attr('font-family', client.font)
			.attr('x', pad)
			.attr('y', y + fontsize / 2)
			.attr('dominant-baseline', 'central')
			.each(function () {
				width = Math.max(width, this.getBBox().width)
			})
		y += fontsize
		tk.pica.g
			.append('text')
			.text(d.median + ' median')
			.attr('fill', '#858585')
			.attr('font-size', fontsize - 2)
			.attr('font-family', client.font)
			.attr('x', pad)
			.attr('y', y + fontsize / 2)
			.attr('dominant-baseline', 'central')
			.each(function () {
				width = Math.max(width, this.getBBox().width)
			})
		y += fontsize
	} else {
		// single sample
		tk.pica.g
			.append('text')
			.text(d.v + ' reads')
			.attr('fill', '#858585')
			.attr('font-size', fontsize - 2)
			.attr('font-family', client.font)
			.attr('x', pad)
			.attr('y', y + fontsize / 2)
			.attr('dominant-baseline', 'central')
			.each(function () {
				width = Math.max(width, this.getBBox().width)
			})
		y += fontsize
	}
	y += pad
	bg.attr('width', pad * 2 + width).attr('height', y)
	tk.pica.g
		.append('line')
		.attr('stroke', d.color)
		.attr('shape-rendering', 'crispEdges')
		.attr('x1', 30)
		.attr('x2', 30)
		.attr('y1', y)
		.attr('y2', y + 15)
	y += 15
	tk.pica.g.attr(
		'transform',
		'translate(' +
			(d.x - 30) +
			',' +
			(tk.toppad + tk.axisheight + tk.maxradius * 4 + tk.padheight - d.radius * 2 - y) +
			')'
	)
}

function expandedjunctioninfo(d, tk, circle) {
	tk.tktip.clear()
	const holder = tk.tktip.d
	if (d.type) {
		holder
			.append('div')
			.style('display', 'inline-block')
			.text(d.type)
			.classed('sja_mcdot', true)
			.style('background-color', d.color)
			.style('padding', '1px 8px')
			.style('margin-bottom', '3px')
	}
	holder
		.append('div')
		.html(
			common.bplen(d.stop - d.start) +
				' <span style="font-size:.8em;">' +
				d.chr +
				':' +
				(d.start + 1) +
				'-' +
				(d.stop + 1) +
				'</span>'
		)
	if (d.data) {
		// multi-sample
		if (d.data.length > 1) {
			holder.append('div').html(d.data.length + ' <span style="font-size:.8em;color:#858585">samples</span>')
			if (d.rimcount) {
				holder
					.append('div')
					.html(d.rimcount + ' <span style="font-size:.8em;color:#858585">show ' + tk.rimwhat + '</span>')
			}
			holder.append('div').html(d.median + ' <span style="font-size:.8em;color:#858585">median read count</span>')
		} else if (d.data.length == 1) {
			// only one sample
			samplejunctiontooltip(d, d.data[0], tk, holder)
		}
	} else {
		// single sample
		holder.append('div').html(d.v + ' <span style="font-size:.8em;color:#858585">read count</span>')
	}

	if (d.spliceevents && d.spliceevents.length > 0) {
		const renderdiv = holder.append('div').style('margin', '10px 0px')
		displayspliceevents(d.spliceevents, renderdiv)
	}
	tk.tktip.show(circle.left + circle.width, circle.top - 50)
}

function junctionsamplespread(j, tk, block) {
	/*
	called by clicking a junction disc
	beeswarm of samples
	*/

	if (j.qmg) {
		j.qmg.remove()
	}

	/*
	for(const d of j.data) {
		not in use
		get data from study
		if(tk.metadata) {
			let v=tk.metadata.anno[d.patient]
			if(!v) {
				v=tk.metadata.anno[d.sample]
			}
			if(v) {
				d.metadata=v
			} else {
				d.metadata=null
			}
		} else {
			d.metadata=null
		}
	}
		*/

	if (tk.cohortsetting && tk.cohortsetting.uselevelidx != undefined) {
		/*
		apply chosen level of cohort to categorize samples
		use level, get the text key for each sample, and get color for key
		*/

		for (const d of j.data) {
			if (!d[tk.cohortsetting.cohort.levels[0].k]) {
				/*
				this sample has no value for the 1st level
				unannotated sample
				*/
				d.color = 'gray'
				continue
			}
			// for each applied level, get key
			const levelkeys = []
			for (let lidx = 0; lidx <= tk.cohortsetting.uselevelidx; lidx++) {
				const levelvalue = d[tk.cohortsetting.cohort.levels[lidx].k]
				if (levelvalue) {
					levelkeys.push(levelvalue)
				}
			}
			const str = levelkeys.join(tk.cohortsetting.levelseparator)
			d.color = tk.cohortsetting.colorfunc(str)
		}
	}

	j.swarm = beeswarm()
		.data(j.data)
		.distributeOn(d => tk.axisheight - tk.yscale(d.v))
		.radius(tk.qmradius)
		.orientation('vertical')
		.side('symetric')
		.arrange()

	const jugg = d3select(j.jugg)

	/*
	pillar
	doesn't work well

	jugg.append('rect')
		.classed('sja_jug_pillar sja_bgbox',true)
		.attr('fill','yellow')
		.attr('fill-opacity',0)
		.attr('stroke','none')
		.attr('y',-(tk.legheight+tk.maxradius*4+tk.lowpad+tk.padheight+tk.axisheight))
		.attr('height',tk.axisheight)
		.attr('x',-j.radius)
		.attr('width', set_pillar(j))
		.attr('shape-rendering','crispEdges')
		.on('mousedown',()=>{
			event.stopPropagation()
		})
		.on('click',()=>{
			j.pillarrect=event.target // for modifying pillar rect when removing junction from matrix table
			const added=matrixjunctionchange(j,tk,block)
			j.pillarrect.style.stroke = added ? d.color : 'none'
		})
		*/

	j.qmg = jugg.append('g').attr('class', 'sja_jug_qmg').attr('transform', set_qmg(j, tk))

	const opacity = 0.8

	j.qmg
		.selectAll()
		.data(j.swarm)
		.enter()
		.append('circle')
		.attr('cx', 0)
		.attr('cy', bee => -bee.y)
		.attr('r', tk.qmradius)
		.attr('fill', bee => {
			return bee.datum.color || 'green'
			/*
			study metadata, not in use
			if(!tk.metadata) return 'green'
			// md applied
			if(!bee.datum.metadata) return '#858585'
			return bee.datum.metadata.color
			*/
		})
		.attr('fill-opacity', opacity)
		.on('mousedown', event => event.stopPropagation())
		.on('mousemove', event => event.stopPropagation())
		.on('mouseover', (event, bee) => {
			// mouse over a single sample, tiny dot
			d3select(event.target).attr('fill-opacity', 1)
			const p = event.target.getBoundingClientRect()
			tk.tktip.clear()
			tk.tktip.show(p.left + 20, p.top - 40)
			samplejunctiontooltip(j, bee.datum, tk, tk.tktip.d)
		})
		.on('mouseout', event => d3select(event.target).attr('fill-opacity', opacity))
		.on('click', (event, bee) => {
			if (tk.tracks) {
				// FIXME need cohort
				/*
				let thissampletk=null
				for(const t of tk.tracks) {
					if(t.tkid==bee.datum.tkid) {
						thissampletk=t
						break
					}
				}
				if(!thissampletk) {
					console.log('member junction track not found for '+bee.datum.tkid)
					return
				}
				tkhandleclick(block,thissampletk)
				*/
				return
			}
		})
		.transition()
		.attr('cx', bee => bee.x)
}

function samplejunctiontooltip(j, sample, tk, holder) {
	/*
	for tk.tracks[] case, tooltip for a single sample
	j: junction
	sample: j.data[?], datum for a sample
	*/
	if (sample.sample) {
		holder.append('div').html(sample.sample)
	} else if (sample.name) {
		holder.append('div').html(sample.name)
	} else if (sample.patient || sample.sampletype) {
		if (sample.patient) {
			holder.append('div').html(sample.patient + ' <span style="font-size:.7em;color:#858585">patient</span>')
		}
		if (sample.sampletype) {
			holder.append('div').html(sample.sampletype + ' <span style="font-size:.7em;color:#858585">sample type</span>')
		}
	} else if (sample.tkid) {
		// neither label available, show member tk name
		for (const t of tk.tracks) {
			if (t.tkid == sample.tkid) {
				holder.append('div').text(t.name || 'unnamed member')
				break
			}
		}
	}

	if (tk.cohortsetting && tk.cohortsetting.cohort && tk.cohortsetting.cohort.levels) {
		// a block track from ds, with ds.cohort supplied
		for (const lev of tk.cohortsetting.cohort.levels) {
			if (sample[lev.k]) {
				holder
					.append('div')
					.html(sample[lev.k] + ' <span style="font-size:.7em;color:#858585">' + lev.label + '</span>')
			}
		}
	}

	holder.append('div').html(sample.v + ' <span style="font-size:.7em;color:#858585">read count</span>')

	if (sample.metadata) {
		// FIXME
		holder
			.append('div')
			.html(
				'<span style="background-color:' +
					sample.metadata.color +
					'" class=sja_mcdot>&nbsp;</span> ' +
					sample.metadata.value +
					' <span style="font-size:.7em;color:#858585">' +
					tk.metadata.m.label +
					'</span>'
			)
	}

	if (sample.hasrim) {
		holder.append('div').text(tk.rimwhat)
	}

	if (j.spliceevents) {
		/*
		compute splice event percentage for this sample
		TODO exonskip only!
		*/
		const evtidx = getdefault_exonskipalt(j.spliceevents)
		const evt = j.spliceevents[evtidx]
		const skipwhichexon =
			'exon ' + evt.skippedexon.map(i => i + 1).join(',') + ' ' + (evt.isskipexon ? 'skip' : 'alt. use')
		// find out percentage
		// junction B count of this sample
		let jbcount = 0
		if (evt.junctionB && evt.junctionB.data) {
			for (const d of evt.junctionB.data) {
				if (d.tkid == sample.tkid) {
					jbcount = d.v
					break
				}
			}
		}
		let acountsum = 0
		if (evt.junctionAlst) {
			for (const ja of evt.junctionAlst) {
				if (ja && ja.data) {
					for (const d of ja.data) {
						if (d.tkid == sample.tkid) {
							acountsum += d.v
							break
						}
					}
				}
			}
		}
		let percent
		if (jbcount == 0) {
			percent = 0
		} else {
			percent = Math.ceil((100 * jbcount) / (jbcount + acountsum / evt.junctionAlst.length))
		}
		holder.append('div').html(percent + '% <span style="font-size:.7em;color:#858585;">' + skipwhichexon + '</span>')
	}
}

function get_leftLabelMaxwidth(tk) {
	const collectlabw = []
	tk.tklabel.each(function () {
		collectlabw.push(this.getBBox().width)
	})
	if (tk.label_mcount) {
		tk.label_mcount.each(function () {
			collectlabw.push(this.getBBox().width)
		})
	}
	/*
	if(tk.label_samplecount) {
		tk.label_samplecount.each(function(){
			collectlabw.push(this.getBBox().width)
		})
	}
	*/
	tk.leftLabelMaxwidth = Math.max(...collectlabw)
}
