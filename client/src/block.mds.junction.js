import * as client from './client'
import * as common from '#shared/common.js'
import { scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale'
import { select as d3select } from 'd3-selection'
import { axisRight } from 'd3-axis'
import * as d3force from 'd3-force'
import { legend_newrow } from './block.legend'
import exonskipalt_getdefault from './spliceevent.exonskip.getdefault.js'
import * as blockmds from './block.mds'

/*
mds-junction
	- make tk parts
	- load
	- render

filter always reloads
changing infoFilter Type to re-color only re-render, won't reload

JUMP ___cohortfilter __infofilter __maketk __eventdiagram __onedetail



*** infoFilter

just one type of info for now, categories:
	canonical
	splice events (skip/a5ss/a3ss)
	unannotated

pre-calculated events, and type of canonical

client keeps catalog of all classes from a Type
server applies any infoFilter to drop junctions/samples, then reports .info{} for each junction, but does not make summary
.info{} characterizes each junctions, client summarize it from tk.data[] on client





*** cohortFilter

server makes summary for all samples in use, client generates legend accordingly, client doesn't keep catalog
	ds.cohort.attributes
		TODO .isNumeric
	ds.cohort.hierarchies




legend is made in loadTk(), after renderTk()



********************** EXPORTED
loadTk()


********************** INTERNAL

makeTk
configPanel
addLoadParameter
rawdata2track
j2block
doForceLayout
renderTk

makeLegend_cohort
showMenu_cohortFilter

makeLegend_infoFilter
showMenu_infoFilter

showOneJunction
queryOneJunction
mouseoverSpanBackground



TODO: integrate genomics information on samples to perform filtering, e.g.
- expression level of certain gene
- mutation status of certain gene or region

*/

const minfontsize = 12
const lineopacity = 0.5
const discopacity = 0.5
const invalidCategoryColor = '#8EA399' // when a junction has no valid value for a infoFilter
const cohortLegendDotColor = '#858585' // '#EBBD5B' // also for sample percentage bar foreground color
const notAnnotatedLabel = 'Unannotated'
const junctionNoSpliceeventLabel = 'None'
const labyspace = 5

const hardcode_infoKey_type = 'type' // currently the only infoFilter key
const hardcode_infoValue_canonical = 'canonical'

export async function loadTk(tk, block, noViewRangeChange) {
	/*
	also works for subtrack
	*/

	if (noViewRangeChange) {
		// reloading track but with no view range change, when filters has been changed/applied
		delete block.pannedpx
		if (tk.subTracks) {
			// this is parent track loading at such case, sub tracks share infoFilter with parent, so update them too
			for (const t of tk.subTracks) {
				loadTk(t, block, true)
			}
		}
	}

	block.tkcloakon(tk)
	block.block_setheight()

	if (tk.uninitialized) {
		makeTk(tk, block)
	}

	if (tk.mds.mdsIsUninitiated) {
		const d = await client.dofetch3(`getDataset?genome=${block.genome.name}&dsname=${tk.mds.label}`)
		if (d.error) throw d.error
		if (!d.ds) throw 'ds missing'
		Object.assign(tk.mds, d.ds)
		delete tk.mds.mdsIsUninitiated
	}

	const par = {
		genome: block.genome.name,
		rglst: block.tkarg_maygm(tk),
		dslabel: tk.mds.label,
		querykey: tk.querykey
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const r of block.subpanels) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop
			})
		}
	}

	addLoadParameter(par, tk)

	if (tk.uninitialized) {
		// only delete the flag here after adding load parameter
		// for custom track, it tells this is first time querying it, thus will modify parameter to retrieve list of samples from track header
		delete tk.uninitialized
	}

	let data // produced inside try{} and accessed after catch()

	try {
		data = await client.dofetch2('mdsjunction', {
			method: 'POST',
			body: JSON.stringify(par)
		})
		if (data.error) throw data.error
		if (!data.lst) '.lst[] missing'
		if (data.sample2client) tk.samples = data.sample2client
		if (data.lst.length == 0) throw 'no data' // actually not error, so need to provide numbers for showing on labels
		if (!data.maxreadcount) throw 'got junctions but no maxreadcount'
		const err = rawdata2track(data.lst, tk, block)
		if (err) throw err

		tk.maxReadCount = data.maxreadcount
		renderTk(tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		// error somewhere, no rendering
		tk.data = []
		tk.leftaxis.selectAll('*').remove()
		tk.glider.selectAll('*').remove()
		block.tkcloakoff(tk, { error: tk.name + ': ' + (e.message || e) })
		if (e.stack) console.log(e.stack)
	}
	// after catch()
	if (data.junctiontotalnumber) {
		tk.junctionCountLabel.text(
			(tk.data.length == data.junctiontotalnumber
				? tk.data.length
				: tk.data.length + ' of ' + data.junctiontotalnumber) +
				' junction' +
				(data.junctiontotalnumber > 1 ? 's' : '')
		)
	} else {
		tk.junctionCountLabel.text('')
	}
	if (data.samplecount) {
		tk.sampleCountLabel.text(data.samplecount + ' sample' + (data.samplecount > 1 ? 's' : ''))
	} else {
		tk.sampleCountLabel.text('')
	}

	// legend
	if (tk.parentTk) {
		// is subtrack, no legend
	} else {
		makeLegend_cohort(data, tk, block)
		for (const info of tk.infoFilter.lst) {
			makeLegend_infoFilter(info, tk, block)
		}
	}

	block.block_setheight()
	updateLabel(tk, block)
}

function addLoadParameter(par, tk) {
	if (tk.iscustom) {
		if (tk.uninitialized) {
			// first time the track is loaded, request samples from the header line of the track file
			par.getsamples = 1
		}
		par.iscustom = 1
		par.file = tk.file
		par.file2 = tk.file2
		par.url = tk.url
	}
	if (tk.readcountCutoff) {
		par.readcountCutoff = tk.readcountCutoff
	}

	if (tk.permanentHierarchy) {
		// is subtrack, fixed to show a subset of sample for one level in the hierarchy, won't apply cohortFilter
		par.permanentHierarchy = tk.permanentHierarchy
	} else if (tk.cohortFilter && tk.cohortFilter.hiddenAttr) {
		// not a subtrack
		const a = {}
		let hasfilter = false
		for (const key in tk.cohortFilter.hiddenAttr) {
			let count = 0
			const b = {}
			for (const value in tk.cohortFilter.hiddenAttr[key]) {
				count++
				b[value] = 1
			}
			if (count) {
				hasfilter = true
				a[key] = b
			}
		}
		if (hasfilter) {
			par.cohortHiddenAttr = a
		}
	}

	// info filter, junction annotation type, event percentage
	// for subtrack, will apply parent track setting
	{
		let infoFilter = (tk.parentTk || tk).infoFilter
		const a = {}
		let hasfilter = false
		for (const info of infoFilter.lst) {
			let count = 0
			const b = {}
			for (const k in info.hiddenCategories) {
				count++
				b[k] = 1
			}
			if (count) {
				hasfilter = true
				a[info.key] = b
			}
		}
		if (hasfilter) {
			par.infoFilter = a
		}

		// splice event percentage cutoff
		const b = {}
		hasfilter = false
		for (const info of infoFilter.lst) {
			for (const eventcode in info.categories) {
				const obj = info.categories[eventcode]
				if (obj.valuePerSample && obj.valuePerSample.cutoffValueUseIdx != undefined) {
					const cutoff = obj.valuePerSample.cutoffValueLst[obj.valuePerSample.cutoffValueUseIdx]
					if (cutoff) {
						hasfilter = true
						b[eventcode] = cutoff
					}
				}
			}
		}
		if (hasfilter) {
			par.spliceEventPercentage = b
		}
	}
}

function updateLabel(tk, block) {
	const lst = []
	tk.tklabel.each(function () {
		lst.push(this.getBBox().width)
	})
	if (tk.subhierarchylabel) {
		tk.subhierarchylabel.each(function () {
			lst.push(this.getBBox().width)
		})
	}
	tk.junctionCountLabel.each(function () {
		lst.push(this.getBBox().width)
	})
	tk.sampleCountLabel.each(function () {
		lst.push(this.getBBox().width)
	})
	tk.leftLabelMaxwidth = Math.max(...lst)
	block.setllabel()
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
		tk.data.forEach(j => map.set(j.chr + '.' + j.start + '.' + j.stop, j))

		const pannedpx = Number.isInteger(block.pannedpx) ? block.pannedpx : 0
		for (const i of junctions) {
			const j = map.get(i.chr + '.' + i.start + '.' + i.stop)
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

function infoFilter_inuse(tk) {
	// which one of the infoFilter[] is being used, for subtrack, will use parent's
	const a = (tk.parentTk || tk).infoFilter
	if (a.useFilterIndex == undefined) {
		a.useFilterIndex = 0
	}
	return a.lst[a.useFilterIndex]
}

function renderTk(tk, block) {
	/*
tk.data has been made, all junctions in view range, over all samples, passing any filters (applied in server)

decide color for junctions
*/

	const viewpxwidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	setColor(tk)

	tk.glider.selectAll('*').remove()

	// do not clear leftaxis, leave it to transition

	// all graphs go in here
	const mg = tk.glider.append('g')

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
					.attr('font-family', client.font)
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

	tk.yscale = (tk.yscaleUseLog ? scaleLog() : scaleLinear())
		.domain([tk.readcountCutoff || 1, tk.maxReadCount])
		.range([tk.axisheight, 0])

	// fill axis-y for those junction without previous axisy
	for (const j of tk.data) {
		if (j.axisy == undefined) {
			j.axisy = tk.axisheight - tk.yscale(j.medianReadCount)
		}
	}

	// set y position, also pad height for lower discs
	// all vertical heights set
	tk.height_main = tk.toppad + tk.axisheight + tk.neckheight + tk.legheight + tk.bottompad

	// as soon as height is determined, create <g> for splice events, since glider has been emptied
	tk.eventsg = tk.glider.append('g').attr('transform', 'translate(0,' + (tk.height_main - tk.toppad) + ')')

	// svg
	mg.attr('transform', 'translate(0,' + (tk.height_main - tk.toppad - tk.bottompad) + ')')

	{
		// top line
		const topy = -tk.legheight - tk.neckheight - tk.axisheight
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
			.attr('y1', topy + tk.axisheight)
			.attr('y2', topy + tk.axisheight)
			.attr('x2', viewpxwidth)
			.attr('stroke', '#858585')
			.attr('stroke-opacity', 0.2)
			.attr('shape-rendering', 'crispEdges')
		let v = 10
		while (v <= tk.maxReadCount) {
			// order of magnitude line
			mg.append('line')
				.attr('x1', 0)
				.attr('y1', topy + tk.yscale(v))
				.attr('y2', topy + tk.yscale(v))
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
		.attr('transform', d => set_jug(d))
		.each(function (j) {
			j.jugg = this
		})

	tk.jug = jug

	// highlight junctions?
	if (tk.hljunctions) {
		// TODO
		jug.attr('class', d => {
			for (const j of tk.hljunctions) {
				if (d.chr == j.chr && d.start == j.start && d.stop == j.stop) {
					return 'sja_pulse'
				}
			}
			return null
		})
	}

	// leg 1
	// leg y1/y2 are constant
	jug
		.append('line')
		.attr('stroke', d => d.color)
		.attr('x1', d => set_leg_x1(d))
		.attr('y2', -tk.legheight)
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
		.attr('y1', -tk.legheight)
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
			return tk.neckheight + d.axisy
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
		.attr('font-family', client.font)
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
			tk.tktip.clear().show(p.left + p.width, p.top - 50)
			showOneJunction(d, tk, tk.tktip.d, block)
		})
		.on('mouseout', (event, d) => {
			tk.tktip.hide()
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
		.on('click', (event, j) => {
			tk.tktip.hide()
			const pane = client.newpane({ x: event.clientX, y: event.clientY })
			if (!tk.iscustom) {
				pane.header
					.append('span')
					.style('color', '#858585')
					.style('font-size', '.8em')
					.text(tk.mds.queries[tk.querykey].name)
			}
			pane.header.append('text').text(j.chr + ':' + j.start + '-' + j.stop)
			const div1 = pane.body.append('div').style('margin-top', '15px')
			showOneJunction(j, tk, div1, block, true)

			const div2 = pane.body.append('div')
			queryOneJunction(j, tk, block, div2)
		})

	doForceLayout(tk, block, viewpxwidth).then(() => {
		// done layout
		set_all(tk)
		client.axisstyle({
			axis: tk.leftaxis.transition().call(
				axisRight()
					.scale(tk.yscale)
					.ticks(Math.floor(tk.axisheight / 20), '.0f')
			),
			color: 'black',
			showline: true
		})
	})
}

function setColor(tk) {
	/*
	color junctions by chosen category, it must be done here because
	user can change info category, and call this render track again using new color
	*/
	const info = infoFilter_inuse(tk)

	let datastructureerror = 0
	let invalidinfovalue = 0

	for (const j of tk.data) {
		// remove prior color, as color may be reassigned by switching infoFilter and then calling renderTk()
		delete j.color

		if (!j.info) {
			datastructureerror++
			continue
		}
		const infovalue = j.info[info.key]
		if (!infovalue) {
			continue
		}
		if (!infovalue.lst) {
			datastructureerror++
			continue
		}
		// one junction allows multiple values for an info, so gather uniq set of values
		const value2count = new Map()
		for (const i of infovalue.lst) {
			const v = i.attrValue
			if (v == undefined) {
				datastructureerror++
				continue
			}
			if (!info.categories[v]) {
				invalidinfovalue++
				continue
			}
			if (!value2count.has(v)) {
				value2count.set(v, 0)
			}
			value2count.set(v, value2count.get(v))
		}
		if (value2count.size) {
			// 1 or more values, use the most abundant one
			const k = [...value2count].sort((a, b) => b[1] - a[1])[0][0]
			j.color = info.categories[k].color
		}
	}

	// fix missing colors
	for (const j of tk.data) {
		if (!j.color) {
			j.color = invalidCategoryColor
		}
	}

	const err = []
	if (datastructureerror) err.push('data structure error in ' + datastructureerror + ' junctions')
	if (invalidinfovalue) err.push('invalid annotation value used in ' + invalidinfovalue + ' junctions')
	if (err.length) {
		console.log(err.join('\n'))
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
	return tk.neckheight + tk.axisheight - tk.yscale(d.medianReadCount)
}
function set_jug2(d, tk) {
	return 'translate(0,-' + (tk.legheight + tk.neckheight + d.axisy) + ')'
}

function set_all(tk) {
	// must update axisy to current value
	tk.data.forEach(j => (j.axisy = tk.axisheight - tk.yscale(j.medianReadCount)))

	const dur = 500
	tk.jug
		.selectAll('.sja_jug_leg1')
		.transition()
		.duration(dur)
		.attr('y2', -tk.legheight)
		.attr('x1', d => set_leg_x1(d))
	tk.jug
		.selectAll('.sja_jug_leg2')
		.transition()
		.duration(dur)
		.attr('y1', -tk.legheight)
		.attr('x2', d => set_leg_x2(d))
	tk.jug
		.selectAll('.sja_jug_jug2')
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug2(d, tk))
	/*
	tk.jug.selectAll('.sja_jug_rim')
		.transition().duration(dur)
		.attr('fill-opacity',(d)=> set_rim(d))
		*/
	tk.jug
		.transition()
		.duration(dur)
		.attr('transform', d => set_jug(d))
	tk.jug
		.selectAll('.sja_jug_stem')
		.transition()
		.duration(dur)
		.attr('y2', d => tk.neckheight + d.axisy)
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
			y: tk.axisheight - tk.yscale(j.medianReadCount)
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
						return tk.axisheight - tk.yscale(d.junction.medianReadCount)
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
	const p5 = tk.yscale(j.readcountBoxplot.percentile[0])
	const p25 = tk.yscale(j.readcountBoxplot.percentile[1])
	const p50 = tk.yscale(j.readcountBoxplot.percentile[2])
	const p75 = tk.yscale(j.readcountBoxplot.percentile[3])
	const p95 = tk.yscale(j.readcountBoxplot.percentile[4])
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

////////////////  ___cohortfilter

function makeLegend_cohort(result, tk, block) {
	/*
	result{} is generated by server,
		.attributeSummary
			for ds.cohort.attributes
		.hierarchySummary
			for ds.cohort.hierarchies

	only for parent track, not for subtrack

	*/

	tk.cohortFilter.holderTable.selectAll('*').remove()
	if (result.attributeSummary) {
		makeLegend_cohort_attribute(result.attributeSummary, tk, block)
	}

	if (result.hierarchySummary) {
		// server provides hierarchy summaries, now initiate receiving end on client

		if (!tk.cohortFilter.hierarchies) {
			tk.cohortFilter.hierarchies = {
				keys: {}
				// to enable other attributes about hierarchies
			}

			for (const k in result.hierarchySummary) {
				tk.cohortFilter.hierarchies.keys[k] = {
					// allnodes[] will be added here, for collecting all nodes from view range, so existance of subtracks can be shown by different node style in parent tk
					// refresh each time parent track loads

					// in parent tk, nodes that are currently unfolded
					opennodeids: new Set()
				}
			}
		}

		blockmds.makeLegend_cohort_hierarchy({
			hash: result.hierarchySummary,
			tk: tk,
			block: block,
			makenodelabel: (node, row) => {
				row
					.append('span')
					.style('margin-right', '5px')
					.attr('class', 'sja_mcdot')
					.style('background', '#858585')
					.style('padding', '1px 6px')
					.text(node.count)
				const color = node.isleaf ? '#858585' : 'inherit'
				row
					.append('span')
					.style('margin-right', '5px')
					.style('color', color)
					.text(node.label || node.name)
				if (node.totalCount) {
					row
						.append('span')
						.style('font-size', '.7em')
						.style('color', color)
						.text(Math.ceil((100 * node.count) / node.totalCount) + '%')
				}
			},
			clicknode: (node, hierarchyname) => {
				blockmds.showHideSubtrack_byHierarchyLevel(tk, block, {
					hierarchyname: hierarchyname,
					levelidx: node.depth - 1,
					valuekey: node.name,
					valuelabel: node.label,
					nodeid: node.id
				})
			}
		})
	}
}

function makeLegend_cohort_attribute(lst, tk, block) {
	/*
	for ds.cohort.attributes

	already hidden categories will not appear in lst: they have been dropped by server

	lst [ attr ]
		.label
		.key
		.values[{}]
			.name
			.label
			.count
	*/
	for (const attr of lst) {
		const tr = tk.cohortFilter.holderTable
			.append('tr')
			.style('border-spacing', '5px')
			.style('border-collapse', 'separate')
		// header, not clickable
		tr.append('td').text(attr.label).style('color', '#858585')
		// values holder
		const td = tr.append('td')

		/* TODO
		if(attr.isNumeric) {
			continue
		}
		*/

		// following is categorical-only, must have .values[]
		for (const item of attr.values) {
			/*
			.name
			.count
			.totalCount
			.label
			.color
			*/
			const div = td
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '10px')
				.attr('class', 'sja_clb')
				.on('click', () => {
					showMenu_cohortFilter(tk, block, attr, item, div)
				})
			if (item.label) {
				div.property('title', item.label)
			}
			div
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '0px 5px')
				.style('margin-right', '5px')
				.attr('class', 'sja_mcdot')
				.style('background', cohortLegendDotColor)
				.html(item.count > 1 ? item.count : '&nbsp;')
			div.append('div').style('display', 'inline-block').text(item.name)
			if (item.totalCount) {
				// knows the total number of samples for this subgroup
				div
					.append('div')
					.style('display', 'inline-block')
					.style('font-size', '.7em')
					.style('color', '#858585')
					.html('&nbsp;' + Math.ceil((100 * item.count) / item.totalCount) + '%')
				/*
				 the total number of samples available for this attribute value is known, show percentage bar
				client.fillbar(
					div,
					{f:item.count/item.totalCount, v1:item.count, v2:item.totalCount},
					{width:50, height:3, fillbg:'#ddd', fill:cohortLegendDotColor}
				)
				.style('display','block')
				*/
			}
		}
		// any hidden ones from this attr
		if (tk.cohortFilter.hiddenAttr[attr.key]) {
			for (const value in tk.cohortFilter.hiddenAttr[attr.key]) {
				const div = td
					.append('div')
					.style('display', 'inline-block')
					.style('padding', '8px')
					.style('color', '#858585')
					.attr('class', 'sja_clb')
					.style('text-decoration', 'line-through')
					.text(value)
					.on('click', () => {
						showMenu_cohortFilter(tk, block, attr, { name: value }, div)
					})
			}
		}
	}
	// shown all attributes that are visible in view range

	// now show any attributes that is solely hidden maybe because that user hide all its values, yet still show so to provide a way

	for (const key in tk.cohortFilter.hiddenAttr) {
		if (lst.findIndex(i => i.key == key) != -1) {
			// attribute by this key is already shown in legend
			continue
		}
		const tr = tk.cohortFilter.holderTable
			.append('tr')
			.style('border-spacing', '5px')
			.style('border-collapse', 'separate')
		tr.append('td')
			.text(key) // only key is known now, not label
			.style('color', '#858585')
		// values holder
		const td = tr.append('td')
		for (const value in tk.cohortFilter.hiddenAttr[key]) {
			const div = td
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '8px')
				.style('color', '#858585')
				.attr('class', 'sja_clb')
				.style('text-decoration', 'line-through')
				.text(value)
				.on('click', () => {
					showMenu_cohortFilter(tk, block, { key: key }, { name: value }, div)
				})
		}
	}
}

function showMenu_cohortFilter(tk, block, attr, item, div) {
	/*
	show menu on clicking on an item from a cohort attribute

	attr: one of ds.cohort.attributes[]
		.label
		.key    for checking against cohortFilter.hiddenAttr{}
		.values[] for stuff from view range
	item: the current item of attr.values[] 
		.name   for checking against cohortFilter.hiddenAttr[attr.key]
		.label
		.count
		.color
	div: button for this item
	*/
	const tip = tk.legendMenu
	tip.clear().showunder(div.node())

	if (item.count) {
		tip.d
			.append('div')
			.html(
				item.totalCount
					? '<span style="font-size:1.5em">' +
							item.count +
							'</span> / ' +
							item.totalCount +
							' sample' +
							(item.count > 1 ? 's' : '')
					: item.count + ' sample' + (item.count > 1 ? 's' : '')
			)
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('color', '#858585')
	}
	if (item.label) {
		tip.d.append('div').text(item.label).style('margin', '10px').style('font-size', '.8em').style('color', '#858585')
	}

	if (tk.cohortFilter.hiddenAttr[attr.key] && tk.cohortFilter.hiddenAttr[attr.key][item.name]) {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Show')
			.on('click', () => {
				tip.hide()
				div.text('Loading ...')
				delete tk.cohortFilter.hiddenAttr[attr.key][item.name]
				loadTk(tk, block, true)
			})
	} else {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Hide')
			.on('click', () => {
				tip.hide()
				div.text('Loading ...')
				if (!tk.cohortFilter.hiddenAttr[attr.key]) {
					tk.cohortFilter.hiddenAttr[attr.key] = {}
				}
				tk.cohortFilter.hiddenAttr[attr.key][item.name] = 1
				loadTk(tk, block, true)
			})
	}

	tip.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Show only')
		.on('click', () => {
			tip.hide()
			div.text('Loading ...')

			// must not clear keys, but preserve what user had already selected to be hidden

			if (!tk.cohortFilter.hiddenAttr[attr.key]) {
				tk.cohortFilter.hiddenAttr[attr.key] = {}
			}
			for (const v of attr.values) {
				tk.cohortFilter.hiddenAttr[attr.key][v.name] = 1
			}
			delete tk.cohortFilter.hiddenAttr[attr.key][item.name]
			loadTk(tk, block, true)
		})

	if (tk.cohortFilter.hiddenAttr[attr.key]) {
		// if any is hidden
		let count = 0
		for (const k in tk.cohortFilter.hiddenAttr[attr.key]) {
			count++
		}
		if (count) {
			tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text('Show all')
				.on('click', () => {
					tip.hide()
					div.text('Loading ...')
					delete tk.cohortFilter.hiddenAttr[attr.key]
					loadTk(tk, block, true)
				})
		}
	}
}

////////////////  ___cohortfilter ENDS

/////////  __infofilter

function makeLegend_infoFilter(info, tk, block) {
	/*
	info: an item of infoFilter.lst[]
	summarize the info from tk.data[]

	splice event should have extra options

	*/

	info.holder.selectAll('*').remove()

	info.value2junctioncount = new Map()
	/*
	any value from junctions in view range, cached for showing in item tooltip
	k: value of this info
	v: # of junctions
	*/
	info.value2junctioncount.set(notAnnotatedLabel, 0) // number of junctions without annotation

	let err_missinginfo = 0 // error: # missing .info

	for (const j of tk.data) {
		if (!j.info) {
			err_missinginfo++
			continue
		}
		const infovalue = j.info[info.key]
		if (!infovalue || !infovalue.lst) {
			info.value2junctioncount.set(notAnnotatedLabel, info.value2junctioncount.get(notAnnotatedLabel) + 1)
			continue
		}
		// one junction allows multiple values for an info, so gather uniq set of values
		const valueset = new Set()
		for (const i of infovalue.lst) {
			const v = i.attrValue
			if (v == undefined) {
				continue
			}
			if (!info.categories[v]) {
				continue
			}
			valueset.add(v)
		}
		if (valueset.size == 0) {
			// no valid value for this junction
			info.value2junctioncount.set(notAnnotatedLabel, info.value2junctioncount.get(notAnnotatedLabel) + 1)
		} else {
			// 1 or more values, count all
			for (const v of valueset) {
				if (!info.value2junctioncount.has(v)) {
					info.value2junctioncount.set(v, 0)
				}
				info.value2junctioncount.set(v, info.value2junctioncount.get(v) + 1)
			}
		}
	}
	if (err_missinginfo) {
		console.error('.info missing in ' + err_missinginfo + ' junctions')
	}

	if (info.value2junctioncount.get(notAnnotatedLabel) == 0) {
		info.value2junctioncount.delete(notAnnotatedLabel)
	}

	// show values
	const lst = [...info.value2junctioncount]

	lst.sort((i, j) => j[1] - i[1])

	for (const [value, count] of lst) {
		// for valid value, get its registry object to access numeric cutoff attributes
		const category = value == notAnnotatedLabel ? { label: value, color: invalidCategoryColor } : info.categories[value]

		const cell = info.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.attr('class', 'sja_clb')
			.on('click', () => {
				tk.legendMenu.showunder(cell.node())
				showMenu_infoFilter(info, value, tk, block)
			})
		// dot
		cell
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_mcdot')
			.style('padding', '1px 5px')
			.style('background-color', category.color)
			.style('color', 'white')
			.html(count > 1 ? count : '&nbsp;')
			.style('margin-right', '5px')

		// label, may show numerical cutoff value
		const lab = cell.append('span').style('color', category.color)
		if (category.valuePerSample && category.valuePerSample.cutoffValueUseIdx != undefined) {
			// numeric cutoff value applied
			const cutoff = category.valuePerSample.cutoffValueLst[category.valuePerSample.cutoffValueUseIdx]
			if (cutoff) {
				lab.text(category.label + ', ' + cutoff.label)
			} else {
				lab.text(category.label + ' (invalid cutoff index)')
			}
		} else {
			// no cutoff
			lab.text(category.label)
		}
	}
	// any hidden values
	for (const value in info.hiddenCategories) {
		// value is key of info.categories
		const div = info.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '8px')
			.style('color', '#858585')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.text(info.categories[value].label)
			.on('click', () => {
				tk.legendMenu.showunder(div.node())
				showMenu_infoFilter(info, value, tk, block)
			})
	}
	/*
	other values such for the case when user select >40% for exon skipping, and eliminates all samples with exon skipping
	this makes "exon skipping" not present in junction view-range
	still, must show "exon skipping" since it's not in hiddenCategories
	*/
	for (const value in info.categories) {
		if (info.value2junctioncount.has(value) || info.hiddenCategories[value]) {
			continue
		}
		const category = info.categories[value]
		const div = info.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '8px')
			.style('color', category.color)
			.attr('class', 'sja_clb')
			.on('click', () => {
				tk.legendMenu.showunder(div.node())
				showMenu_infoFilter(info, value, tk, block)
			})
		if (category.valuePerSample && category.valuePerSample.cutoffValueUseIdx != undefined) {
			// numeric cutoff value applied
			const cutoff = category.valuePerSample.cutoffValueLst[category.valuePerSample.cutoffValueUseIdx]
			if (cutoff) {
				div.text(category.label + ', ' + cutoff.label)
			} else {
				div.text(category.label + ' (invalid cutoff index)')
			}
		} else {
			// no cutoff
			div.text(category.label)
		}
	}
}

function showMenu_infoFilter(info, value, tk, block) {
	/*
	show menu for a value of an info

	info: an item in infoFilter.lst[]
		.key
		.label
		.hiddenCategories{}
		.categories{k:{}}
			.label
			.color
			.valuePerSample
				.key
				.label
				.cutoffValueLst[]
				.cutoffValueUseIdx

	value: string, a key in info.categories, or notAnnotatedLabel

	*/
	const tip = tk.legendMenu
	tip.clear()

	const jcount4thisvalue = info.value2junctioncount.get(value)
	tip.d
		.append('div')
		.text(jcount4thisvalue ? jcount4thisvalue + ' junction' + (jcount4thisvalue > 1 ? 's' : '') : 'no junction')
		.style('font-size', '.8em')
		.style('color', '#858585')
		.style('margin', '10px')

	const thisvalueishidden = info.hiddenCategories[value]

	const category = info.categories[value] // category for an actual value, not for unannotated

	if (category) {
		// this is valid value
		if (category.description) {
			tip.d.append('div').style('padding', '10px').html(info.categories[value].description)
		}
		if (!thisvalueishidden && category.valuePerSample) {
			/*
			will show numerical cutoff when the category is not hidden, no matter if there are junctions or not
			this is must because user can select a big cutoff that removes all junctions from this sample,
			and the numerical cutoff buttons must still be shown so that user can click it again to undo
			*/
			const row = tip.d.append('div').style('margin', '2px 10px 2px 10px')

			// show button for each cutoff
			for (const [i, cutoff] of category.valuePerSample.cutoffValueLst.entries()) {
				const button = row.append('div').style('display', 'inline-block').style('padding', '10px').text(cutoff.label)
				if (i == category.valuePerSample.cutoffValueUseIdx) {
					button.attr('class', 'sja_clb_selected')
				} else {
					button.attr('class', 'sja_clb')
				}
				button.on('click', () => {
					tip.hide()
					if (i == category.valuePerSample.cutoffValueUseIdx) {
						// already using this cutoff, cancel
						delete category.valuePerSample.cutoffValueUseIdx
					} else {
						category.valuePerSample.cutoffValueUseIdx = i
					}
					loadTk(tk, block, true)
				})
			}
			tip.d
				.append('div')
				.text('Drop junctions with event percetage lower than selected cutoff.')
				.style('margin', '2px 10px 10px 10px')
				.style('font-size', '.7em')
				.style('color', '#858585')
		}
	}

	if (thisvalueishidden) {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('Show')
			.on('click', () => {
				tip.hide()
				delete info.hiddenCategories[value]
				loadTk(tk, block, true)
			})
	} else {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('Hide')
			.on('click', () => {
				tip.hide()
				info.hiddenCategories[value] = 1
				loadTk(tk, block, true)
			})
	}
	tip.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.html('Show only')
		.on('click', () => {
			tip.hide()
			info.hiddenCategories = {}
			for (const k in info.categories) {
				if (k != value) {
					info.hiddenCategories[k] = 1
				}
			}
			if (value != notAnnotatedLabel) {
				info.hiddenCategories[notAnnotatedLabel] = 1
			}
			loadTk(tk, block, true)
		})

	let hidenum = 0
	for (const k in info.hiddenCategories) {
		hidenum++
	}
	if (hidenum) {
		// one class is hidden, make "show all"
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('Show all')
			.on('click', () => {
				tip.hide()
				info.hiddenCategories = {}
				loadTk(tk, block, true)
			})
	}
}

/////////  __infofilter  ENDS

/////////////  __maketk

function makeTk(tk, block) {
	/* for a native track added from clicking dshandle>menu option, it already has the mds{}
	for a native track added from runpp({tracks:[]}), it will only have dslabel
	*/
	if (tk.dslabel) {
		if (block.genome.datasets[tk.dslabel]) {
			tk.mds = block.genome.datasets[tk.dslabel]
			delete tk.iscustom
		}
	}
	// make color gradients
	{
		const pale = '#FFFEAB'
		const dark = '#F7F69E'
		const id1 = Math.random().toString()
		const id2 = Math.random().toString()
		const id3 = Math.random().toString()
		const defs = tk.gleft.append('defs')
		const left = defs.append('linearGradient').attr('id', id1)
		left.append('stop').attr('offset', 0).attr('stop-color', dark)
		left.append('stop').attr('offset', 1).attr('stop-color', 'white')
		const mid = defs.append('linearGradient').attr('id', id2)
		mid.append('stop').attr('offset', 0).attr('stop-color', pale)
		mid.append('stop').attr('offset', 0.5).attr('stop-color', 'white')
		mid.append('stop').attr('offset', 1).attr('stop-color', pale)
		const right = defs.append('linearGradient').attr('id', id3)
		right.append('stop').attr('offset', 0).attr('stop-color', 'white')
		right.append('stop').attr('offset', 1).attr('stop-color', dark)

		tk.gradient4spanBackground = {
			left: { id: id1, gradient: left },
			mid: { id: id2, gradient: mid },
			right: { id: id3, gradient: right }
		}
	}

	let laby = labyspace + block.labelfontsize

	if (tk.permanentHierarchy) {
		// is subtrack, show which hierarchy it represents
		// dummy name
		tk.subhierarchylabel = block
			.maketklefthandle(tk, laby)
			.text(tk.permanentHierarchy.hierarchyname + ': ' + tk.permanentHierarchy.valuelabel)
			.attr('class', null)
			.attr('fill', '#858585')
		laby += labyspace + block.labelfontsize
	}

	// controller - # junctions
	// the callback may have something to do with server query! so may move this part to mdsjunction.render too!!
	{
		const tip = new client.Menu({ padding: 'none' })
		tk.junctionCountLabel = block.maketklefthandle(tk, laby).on('click', () => {
			// TODO
		})
	}

	laby += labyspace + block.labelfontsize

	// controller - # samples
	{
		const tip = new client.Menu({ padding: 'none' })
		tk.sampleCountLabel = block.maketklefthandle(tk, laby).on('click', () => {
			// TODO
		})
	}

	laby += labyspace + block.labelfontsize

	if (tk.permanentHierarchy) {
		blockmds.subtrackclosehandle(tk, block, laby)
	}

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	// legend
	if (tk.parentTk) {
		// is subtrack, doesn't show legend
	} else {
		// not subtrack

		tk.legendMenu = new client.Menu({ padding: '0px' })

		const [tr, td] = legend_newrow(block, tk.name)
		tk.tr_legend = tr
		tk.td_legend = td

		tk.infoFilter.holderTable = tk.td_legend.append('table')
		tk.infoFilter.useFilterIndex = 0
		for (const [i, info] of tk.infoFilter.lst.entries()) {
			const tr = tk.infoFilter.holderTable.append('tr')

			// label button to allow toggle between different info for coloring junctions
			info.labelButton = tr
				.append('td')
				.text(info.label)
				.attr('class', i == tk.infoFilter.useFilterIndex ? 'sja_clb_selected' : 'sja_clb')
				.on('click', () => {
					if (tk.infoFilter.useFilterIndex == i) {
						// already using this one, do not cancel (unlike vcf)
						return
					}
					// set to use this info
					tk.infoFilter.useFilterIndex = i
					tk.infoFilter.lst.forEach(j => j.labelButton.attr('class', 'sja_clb'))
					info.labelButton.attr('class', 'sja_clb_selected')
					renderTk(tk, block)
				})
			info.holder = tr.append('td')
		}

		// cohort annotation should be optional
		tk.cohortFilter = {
			holderTable: tk.td_legend.append('table'),
			hiddenAttr: {}
		}
		if (tk.mds.cohortHiddenAttr) {
			// dataset has hidden attributes by default for sample annotation, copy to hiddenAttr
			for (const k in tk.mds.cohortHiddenAttr) {
				tk.cohortFilter.hiddenAttr[k] = {}
				for (const v in tk.mds.cohortHiddenAttr[k]) {
					tk.cohortFilter.hiddenAttr[k][v] = 1
				}
			}
		}
	}
}

function downloadjunctions(tk) {
	// not working
	const txt = []
	if (tk.file || tk.url) {
		// single track
		if (tk.data) {
			txt.push('chromosome\tstart\tstop\tread_count' + (tk.categories ? '\ttype' : ''))
			for (const j of tk.data) {
				txt.push(j.chr + '\t' + j.start + '\t' + j.stop + '\t' + j.v + (tk.categories ? '\t' + j.type : ''))
			}
		}
	} else if (tk.tracks) {
		if (tk.data) {
			const header = ['chromosome\tstart\tstop' + (tk.categories ? '\ttype' : '')]
			for (const t of tk.tracks) {
				const lst = []
				if (t.patient) lst.push(t.patient)
				if (t.sampletype) lst.push(t.sampletype)
				if (lst.length == 0) {
					lst.push(t.name)
				}
				header.push(lst.join(', '))
			}
			txt.push(header.join('\t'))
			for (const j of tk.data) {
				const lst = [j.chr + '\t' + j.start + '\t' + j.stop + (tk.categories ? '\t' + j.type : '')]
				const hash = new Map()
				for (const jsample of j.data) {
					hash.set(jsample.tkid, jsample.v)
				}
				for (const t of tk.tracks) {
					lst.push(hash.has(t.tkid) ? hash.get(t.tkid) : '')
				}
				txt.push(lst.join('\t'))
			}
		}
	}

	client.export_data(tk.name, [{ label: 'Splice junction', text: txt.join('\n') }])
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const holder = tk.tkconfigtip.d

	// read count cutoff
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('Read count cutoff&nbsp;')
		row
			.append('input')
			.property('value', tk.readcountCutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = event.target.value
				if (!v || v < 0) {
					// set to zero to cancel
					v = 0
				}
				if (v == 0) {
					if (tk.readcountCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.readcountCutoff = 0
						loadTk(tk, block, true)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (tk.readcountCutoff) {
					// cutoff has been set
					if (tk.readcountCutoff == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.readcountCutoff = v
						loadTk(tk, block, true)
					}
				} else {
					// cutoff has not been set
					tk.readcountCutoff = v
					loadTk(tk, block, true)
				}
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.text('For a junction, samples with read count lower than cutoff will not be shown.')
	}

	// height
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').text('Track height')
		row
			.append('button')
			.html('&nbsp;&nbsp;+&nbsp;&nbsp;')
			.style('margin-left', '10px')
			.on('click', () => {
				tk.axisheight += 30
				tk.legheight = tk.axisheight / 4
				renderTk(tk, block)
				block.block_setheight()
			})
		row
			.append('button')
			.html('&nbsp;&nbsp;-&nbsp;&nbsp;')
			.style('margin-left', '5px')
			.on('click', () => {
				if (tk.axisheight <= 90) return
				tk.axisheight -= 30
				tk.legheight = tk.axisheight / 4
				renderTk(tk, block)
				block.block_setheight()
			})
	}

	// log scale
	{
		const row = holder.append('div').style('margin-bottom', '1px')
		const id = Math.random()
		const input = row
			.append('input')
			.attr('type', 'checkbox')
			.style('margin-right', '10px')
			.attr('id', id)
			.on('change', () => {
				tk.yscaleUseLog = !tk.yscaleUseLog
				renderTk(tk, block)
			})
		if (tk.yscaleUseLog) {
			input.property('checked', 1)
		}
		row.append('label').text('Use log10 for Y scale read count').attr('for', id)
	}
}

/////////////  __maketk ENDS

/************* __eventdiagram

exon skip or a5ss events, junctionB has a number of samples passing current filter from which median read count is generated on previous view-range request
to illustrate canonical junctionAlst, the same set of samples from junctionB should be used to find out median read count for each of them
thus the query
*/

function showOneJunction(j, tk, holder, block, ifeventdetails) {
	// head
	const row1 = holder.append('div').style('margin-bottom', '5px').style('white-space', 'nowrap')
	{
		const info = infoFilter_inuse(tk)
		const valueobj = j.info[info.key]
		if (valueobj) {
			// uniq set of values
			const values = new Set()
			valueobj.lst.forEach(i => values.add(i.attrValue))
			for (const value of values) {
				const anno = info.categories[value]
				row1
					.append('span')
					.attr('class', 'sja_mcdot')
					.style('padding', '1px 5px')
					.style('background-color', anno ? anno.color : invalidCategoryColor)
					.style('margin-right', '5px')
					.text(anno ? anno.label : value)
			}
		}
	}

	{
		const d = row1.append('div').style('display', 'inline-block').style('margin-right', '10px')
		if (!j.sv || j.chr == j.sv.mate.chr) {
			// same chr
			d.html(
				common.bplen(Math.abs(j.start - (j.sv ? j.sv.mate.start : j.stop))) +
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
			d.html(
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
	}

	// samples
	const row2 = holder.append('div').style('white-space', 'nowrap')
	if (j.sampleCount == 1) {
		row2
			.append('div')
			.html(j.medianReadCount + ' <span style="font-size:.8em;color:#858585">read count, single sample</span>')
	} else {
		row2
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '10px')
			.html(j.medianReadCount + ' <span style="font-size:.8em;color:#858585">median read count</span>')
		row2
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '10px')
			.html(j.sampleCount + ' <span style="font-size:.8em;color:#858585">samples</span>')
	}

	const events_exonskipalt = []
	const events_a53ss = []

	if (j.info && j.info[hardcode_infoKey_type]) {
		// from values of info.type.lst, tell if the junction is canonical, or has any splice events
		for (const e of j.info[hardcode_infoKey_type].lst) {
			if (e.isskipexon || e.isaltexon) {
				events_exonskipalt.push(e)
			} else if (e.a5ss || e.a3ss) {
				events_a53ss.push(e)
			}
		}
	}

	const div = holder.append('div')

	if (events_exonskipalt.length + events_a53ss.length > 0) {
		// has splice events, show event diagram

		if (ifeventdetails) {
			/*
			true when clicking on a junction
			false when mouse-over a junction
			*/
			if (events_exonskipalt.length) {
				listAllEvents(events_exonskipalt, div, j, tk, block)
			}
			if (events_a53ss.length) {
				listAllEvents(events_a53ss, div, j, tk, block)
			}
			return
		}

		if (events_exonskipalt.length) {
			// skip/alt events, show one
			const showidx = exonskipalt_getdefault(events_exonskipalt)
			const e = events_exonskipalt[showidx]
			showEventdiagram_skipalt_fetchreadcount(j, e, tk, div, block)
		}

		if (events_a53ss.length) {
			// a5ss a3ss show one
			const e = events_a53ss[0]
			showEventdiagram_a53ss(j, e, tk, div, block)
		}
	} else {
		// no annotated events, no matter canonical or not, show free diagram
		showJunctionDiagram(j, tk, div)
	}
}

function showJunctionDiagram(j, tk, holder) {
	/* a junction with no known event, show diagram with respect to either end mapping to gene
	here just use first isoform
	TODO allow choosing an isoform/event
	if start/stop are on same gene, render using one function
	if no different genes, show with another  function
	*/
	if (!j.ongene) {
		return
	}

	const leftgenes = new Map()
	if (j.ongene.exonleft) j.ongene.exonleft.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.ongene.exonleftin)
		j.ongene.exonleftin.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.ongene.intronleft)
		j.ongene.intronleft.forEach(i => leftgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))

	const rightgenes = new Map()
	if (j.ongene.exonright) j.ongene.exonright.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.ongene.exonrightin)
		j.ongene.exonrightin.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))
	if (j.ongene.intronright)
		j.ongene.intronright.forEach(i => rightgenes.set(i.isoform, { gene: i.gene, strand: i.strand }))

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
		import('./spliceevent.noeventdiagram').then(p => {
			p.samegene({
				isoform: isoform,
				reverse: strand == '-',
				ongene: j.ongene,
				holder: holder
			})
		})
		return
	}

	// here start/stop are on different genes
	import('./spliceevent.noeventdiagram').then(p => {
		p.differentgenes({
			ongene: j.ongene,
			holder: holder
		})
	})
}

function showEventdiagram_a53ss(j, e, tk, holder, block) {
	// a5ss, a3ss
	const e2 = {
		junctionB: {
			start: j.start,
			stop: j.stop,
			v: j.medianReadCount
		},
		a5ss: e.a5ss,
		a3ss: e.a3ss,
		altinintron: e.altinintron,
		altinexon: e.altinexon,
		frame: e.frame,
		exon5idx: e.exon5idx,
		strand: e.strand,
		sitedist: e.sitedist
	}
	if (e.junctionA) {
		e2.junctionA = { start: e.junctionA.start, stop: e.junctionA.stop, v: '...' }
	}
	import('./spliceevent.a53ss.diagram').then(p => {
		const text = p.default({
			event: e2,
			holder: holder
		})
		if (!text) return
		setTimeout(() => {
			if (text.node().getBoundingClientRect().top == 0) return
			fetchReadcount4junctionAbyjunctionBsamples(
				tk,
				block,
				j,
				new Map([[e.junctionA.start + '.' + e.junctionA.stop, text]]),
				[[e.junctionA.start, e.junctionA.stop]]
			)
		}, 1000)
	})
}

function showEventdiagram_skipalt_fetchreadcount(j, e, tk, holder, block) {
	/*
	j is the junctionB of this event
	event is as from j.info.spliceEvent, either skip or alt

	*/
	const e2 = {
		gm: {
			name: e.gene,
			isoform: e.isoform
		},
		junctionB: {
			data: [{ v: j.medianReadCount }]
		},
		skippedexon: e.skippedexon,
		isskipexon: e.isskipexon,
		isaltexon: e.isaltexon,
		frame: e.frame,
		junctionAlst: [],
		color: '#99004d'
	}
	if (e.junctionAlst) {
		for (const jA of e.junctionAlst) {
			if (jA) {
				jA.data = [{ v: '...' }]
				e2.junctionAlst.push(jA)
				continue
				/*
				// find if jA exists in view range
				const inviewrange = tk.data.filter(j=> j.start==jA.start && j.stop==jA.stop)[0]
				if(inviewrange) {
					e2.junctionAlst.push({
						data:[ { v:inviewrange.sampleCount, tkid:1 } ]
						})
					continue
				}
				*/
			}
			e2.junctionAlst.push(null)
		}
	}
	if (e.up1junction) {
		e.up1junction.data = [{ v: '...' }]
		e2.up1junction = e.up1junction
		/*
		const inviewrange = tk.data.filter(j=> j.start==e.up1junction.start && j.stop==e.up1junction.stop)[0]
		if(inviewrange) {
			e2.up1junction={
				data:[ { v:inviewrange.sampleCount, tkid:1 } ]
				}
		}
		*/
	}
	if (e.down1junction) {
		e.down1junction.data = [{ v: '...' }]
		e2.down1junction = e.down1junction
		/*
		const inviewrange = tk.data.filter(j=> j.start==e.down1junction.start && j.stop==e.down1junction.stop)[0]
		if(inviewrange) {
			e2.down1junction={
				data:[ { v:inviewrange.sampleCount, tkid:1 } ]
				}
		}
		*/
	}

	import('./spliceevent.exonskip.diagram').then(p => {
		const [junction2readcounttext, junctionlst] = p.default({
			event: e2,
			holder: holder,
			nophrase: true
		})
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

async function fetchReadcount4junctionAbyjunctionBsamples(tk, block, jB, junction2readcounttext, jAlst) {
	/*
	query server to get median read count for display for these junctions
	over the same group of sample

	jB: junction B
	jAlst: [ [start,stop] ]
	junction2readcounttext: svg text for printing median read count for each A junction
	*/
	const par = {
		genome: block.genome.name,
		dslabel: tk.mds.label,
		querykey: tk.querykey,
		readcountByjBsamples: true,
		junctionB: { chr: jB.chr, start: jB.start, stop: jB.stop },
		junctionAposlst: jAlst
	}
	addLoadParameter(par, tk)
	try {
		const data = await client.dofetch2('mdsjunction', {
			method: 'POST',
			body: JSON.stringify(par)
		})
		if (data.error) throw data.error
		if (!data.lst) throw '.lst[] missing'
		for (const j of data.lst) {
			/*
			.start
			.stop
			.v
			*/
			const key = j.start + '.' + j.stop
			if (junction2readcounttext.has(key)) {
				junction2readcounttext.get(key).text(j.v)
			}
		}
	} catch (e) {
		console.error(e.message || e)
	}
}

function listAllEvents(lst, holder, j, tk, block) {
	if (lst.length == 1) {
		showEventdetail(lst[0], holder, j, tk, block)
		return
	}
	// one button for a evt
	const div = holder.append('div').style('display', 'inline-block').style('font-size', '.8em')
	for (const e of lst) {
		div
			.append('div')
			.html(eventlabel(e))
			.attr('class', 'sja_menuoption')
			.on('click', event => {
				tk.tktip.clear().show(event.clientX + 20, event.clientY - 40)
				showEventdetail(e, tk.tktip.d, j, tk, block)
			})
	}
}

function showEventdetail(e, holder, j, tk, block) {
	const tr = holder.append('table').append('tr')
	const td1 = tr.append('td')
	const p = td1.append('p')
	if (e.isskipexon || e.isaltexon) {
		p.html(eventlabel(e))
		showEventdiagram_skipalt_fetchreadcount(j, e, tk, td1, block)
	} else {
		p.html(eventlabel(e))
		showEventdiagram_a53ss(j, e, tk, td1, block)
	}
	const td2 = tr.append('td')
}

function eventlabel(e) {
	if (e.isskipexon || e.isaltexon) {
		return (
			(e.isskipexon ? 'Exon skip' : 'Exon alt') +
			' ' +
			e.gene +
			' ' +
			e.isoform +
			' ' +
			(e.frame == undefined ? '' : e.frame == common.IN_frame ? 'IN frame' : 'OUT of frame')
		)
	}
	return (
		(e.a5ss ? 'A5SS' : 'A3SS') +
		' ' +
		e.gene +
		' ' +
		e.isoform +
		' ' +
		(e.frame == undefined ? '' : e.frame == common.IN_frame ? 'IN frame' : 'OUT of frame')
	)
}

/////////////// __eventdiagram ENDS

async function queryOneJunction(j, tk, block, holder) {
	/*
	query server about details of one junction
	depending on permission from ds config, may expose samples (e.g. for clicking)
	*/
	const par = {
		genome: block.genome.name,
		dslabel: tk.mds.label,
		querykey: tk.querykey,
		junction: {
			chr: j.chr,
			start: j.start,
			stop: j.stop
		}
	}
	addLoadParameter(par, tk)

	const wait = holder.append('div').text('Loading ...')

	try {
		const data = await client.dofetch2('mdsjunction', {
			method: 'POST',
			body: JSON.stringify(par)
		})
		if (data.error) throw data.error
		wait.remove()

		if (data.readcountboxplotpercohort) {
			/* each cohort has a group of boxplots
			[{group}]
				.label
				.boxplots[]
					.label
					.samplecount
					.percentile
			*/
			const row = holder.append('div')
			for (const group of data.readcountboxplotpercohort) {
				const div = row
					.append('div')
					.style('margin', '10px')
					.style('display', 'inline-block')
					.style('vertical-align', 'top')
				div.append('h3').text(group.label).style('text-align', 'center')
				const p = await import('./old/plot.boxplot')
				const err = p.default({
					holder: div,
					list: group.boxplots,
					axislabel: 'Read count'
				})
				if (err) {
					client.sayerror(div, 'Boxplot error: ' + err)
				}
			}
		} else if (data.samples) {
			// print list of samples
			if (data.sampletotalnumber) {
				holder
					.append('p')
					.text('Displaying top ' + data.samples.length + ' samples')
					.style('opacity', 0.5)
			}
			const div = holder
				.append('div')
				.style('margin-top', '20px')
				.style('display', 'grid')
				.style('grid-template-columns', 'auto auto')
				.style('gap-row-gap', '1px')
				.style('align-items', 'center')
				.style('justify-items', 'left')
			const [c1, c2] = get_list_cells(div)
			c1.text('Sample').style('opacity', 0.5).style('font-size', '.7em')
			c2.text('Read count').style('opacity', 0.5).style('font-size', '.7em')
			for (const s of data.samples) {
				const [c1, c2] = get_list_cells(div)
				c1.text(s.sample_name ? s.sample_name : tk.samples[s.i])
				c2.text(s.readcount)
			}
		}
	} catch (e) {
		if (e.stack) console.log(e.stack)
		wait.text('Error: ' + (e.message || e))
	}
}

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
