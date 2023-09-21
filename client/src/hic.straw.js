import { axisRight, axisBottom } from 'd3-axis'
import { select as d3select, selectAll as d3selectAll, pointer } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { format as d3format } from 'd3-format'
import * as common from '#shared/common'
import blocklazyload from './block.lazyload'

/*

********************** EXPORTED

hicparsefile()
hicparsestat()
hicparsefragdata()

********************** INTERNAL

initialize views

	init_wholegenome()
		.wholegenome

	init_chrpair()
		.chrpairview

	init_detail()
		.detailview


hic data getter and canvas painter

	getdata_leadfollow()
	getdata_chrpair()
	getdata_detail()



JumpTo:  __detail  __whole


hic.atdev controls dev-shortings

*/

const atdev_chrnum = 8

const hardcode_wholegenomechrlabwidth = 100

const defaultnmeth = 'NONE' // default normalization method

const initialbinnum_detail = 20 // when clicking on chrpairview, to set a initial view range for detail view, the number of bins to cover at the clicked point

const minimumbinnum_bp = 200 // at bp resolution, minimum bin number

const mincanvassize_detail = 500 // mininum canvas w/h, detail view

const minimumbinnum_frag = 100 // minimum bin num for fragment

const default_svpointspan = 500000 // span at breakpoint when clicking an sv from x/y view to show horizontal view

const default_hicstrawmaxvperc = 5 // default max value percentage for hicstraw track

const default_subpanelpxwidth = 600 // default px width of subpanels

const subpanel_bordercolor = 'rgba(200,0,0,.1)'

export function hicparsefile(hic, debugmode) {
	/*
	parse input file, initiate view
	hic{}
	.file
	.url
	.genome
	.hostURL
	.holder

	debugmode passed from app, server state, if true, attach to window.hic
	*/

	if (debugmode) {
		window.hic = hic
	}

	{
		const div = hic.holder.append('div')
		hic.error = msg => client.sayerror(div, msg)
	}

	if (!hic.name) {
		hic.name = 'Hi-C'
	}

	if (hic.tklst) {
		const lst = []
		for (const t of hic.tklst) {
			if (!t.type) {
				hic.error('type missing from one of the tracks accompanying HiC')
			} else {
				t.iscustom = true
				lst.push(t)
			}
		}
		if (lst.length) {
			hic.tklst = lst
		} else {
			delete hic.tklst
		}
	}

	hic.tip = new client.Menu()

	if (hic.enzyme) {
		if (hic.genome.hicenzymefragment) {
			let frag = null
			for (const f of hic.genome.hicenzymefragment) {
				if (f.enzyme == hic.enzyme) {
					frag = f
					break
				}
			}
			if (frag) {
				hic.enzymefile = frag.file
			} else {
				hic.error('unknown enzyme: ' + hic.enzyme)
				delete hic.enzyme
			}
		} else {
			hic.error('no enzyme fragment information available for this genome')
			delete hic.enzyme
		}
	}

	// wholegenome is fixed to use lowest bp resolution, and fixed cutoff value for coloring
	hic.wholegenome = {
		bpmaxv: 5000,
		lead2follow: new Map(),
		nmeth: defaultnmeth,
		pica_x: new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 }),
		pica_y: new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
	}

	hic.chrpairview = {
		data: [],
		nmeth: defaultnmeth
	}

	hic.detailview = {
		bbmargin: 1,
		nmeth: defaultnmeth,
		xb: {
			leftheadw: 20,
			rightheadw: 40,
			lpad: 1,
			rpad: 1
		},
		yb: {
			leftheadw: 20,
			rightheadw: 40,
			lpad: 1,
			rpad: 1
		}
	}

	hic.inwholegenome = true
	hic.inchrpair = false
	hic.indetail = false
	hic.inlineview = false

	// controls

	const table = hic.holder.append('table').style('border-spacing', '3px')
	const tr1 = table.append('tr')
	const tr2 = table.append('tr')

	if (hic.enzyme) {
		tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('ENZYME')
		tr2.append('td').text(hic.enzyme)
	}

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('NORMALIZATION')
	hic.nmethselect = tr2
		.append('td')
		.style('margin-right', '10px')
		.append('select')
		.on('change', event => {
			const v = event.target.options[event.target.selectedIndex].innerHTML
			setnmeth(hic, v)
		})
	hic.nmethselect.append('option').text('NONE')
	hic.nmethselect.append('option').text('VC')
	hic.nmethselect.append('option').text('VC_SQRT')
	hic.nmethselect.append('option').text('KR')

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('CUTOFF')
	hic.inputbpmaxv = tr2
		.append('td')
		.append('input')
		.style('width', '70px')
		.attr('type', 'number')
		.property('value', hic.wholegenome.bpmaxv)
		.on('keyup', event => {
			if (event.code != 'Enter') return
			const v = event.target.value
			if (v <= 0) return hic.error('invalid cutoff value')
			setmaxv(hic, v)
		})

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('RESOLUTION')
	hic.ressays = tr2.append('td').append('span')

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('VIEW')
	const td = tr2.append('td')
	hic.wholegenomebutton = td
		.append('button')
		.style('display', 'none')
		.text('Genome')
		.on('click', () => {
			hic.inwholegenome = true
			hic.inchrpair = false
			hic.indetail = false
			switchview(hic)
		})

	hic.chrpairviewbutton = td
		.append('button')
		.style('display', 'none')
		.on('click', () => {
			hic.inwholegenome = false
			hic.inchrpair = true
			hic.indetail = false
			switchview(hic)
		})

	// data tasks:
	// 1. load sv
	// 2. stat the hic file

	Promise.resolve()

		.then(() => {
			if (!hic.sv) return
			if (!hic.sv.file) return
			return fetch(
				new Request(hic.hostURL + '/textfile', {
					method: 'POST',
					body: JSON.stringify({ file: hic.sv.file, jwt: hic.jwt })
				})
			)
				.then(data => {
					return data.json()
				})
				.then(data => {
					const [err, header, items] = parseSV(data.text)
					if (err) throw { message: 'Error parsing SV: ' + err }
					hic.sv.header = header
					hic.sv.items = items
					return
				})
		})

		.then(() => {
			return client.dofetch2('hicstat?' + (hic.file ? 'file=' + hic.file : 'url=' + hic.url))
		})

		.then(data => {
			if (data.error) throw { message: data.error }
			const err = hicparsestat(hic, data.out)
			if (err) throw { message: err }

			// optionally, may init detail view by default

			init_wholegenome(hic)
		})
		.catch(err => {
			hic.error(err.message)
			if (err.stack) {
				console.log(err.stack)
			}
		})
}

export function hicparsestat(hic, txt) {
	/*
	output by read_hic_header.py
	*/
	if (!txt) return 'cannot stat hic file'
	let j
	try {
		j = JSON.parse(txt)
	} catch (e) {
		return 'Invalid JSON from hic file stat'
	}

	hic.version = j['Hic Version']

	if (!j.Chromosomes) return 'Chromosomes not found in file stat'
	if (!Array.isArray(j.chrorder)) return '.chrorder[] missing'
	if (j.chrorder.length == 0) return '.chrorder[] empty array'
	hic.chrorder = j.chrorder
	if (!j['Base pair-delimited resolutions']) return 'Base pair-delimited resolutions not found in file stat'
	if (!Array.isArray(j['Base pair-delimited resolutions'])) return 'Base pair-delimited resolutions should be array'
	hic.bpresolution = j['Base pair-delimited resolutions']
	if (!j['Fragment-delimited resolutions']) return 'Fragment-delimited resolutions is not array'
	if (!Array.isArray(j['Fragment-delimited resolutions'])) return 'Fragment-delimited resolutions is not array'
	hic.fragresolution = j['Fragment-delimited resolutions']

	const chrlst = []
	for (const chr in j.Chromosomes) {
		chrlst.push(chr)
	}
	const [nochrcount, haschrcount] = common.contigNameNoChr2(hic.genome, chrlst)
	if (nochrcount + haschrcount == 0) return 'chromosome names do not match with genome build'
	if (nochrcount > 0) {
		hic.nochr = true
		// prepend 'chr' to names in chrorder array
		for (let i = 0; i < hic.chrorder.length; i++) hic.chrorder[i] = 'chr' + hic.chrorder[i]
	}
	// as a way of skipping chrM
	hic.chrlst = []
	for (const chr of hic.genome.majorchrorder) {
		const c2 = hic.nochr ? chr.replace('chr', '') : chr
		if (chrlst.indexOf(c2) != -1) {
			hic.chrlst.push(chr)
		}
	}
}

/////////// __whole genome

async function init_wholegenome(hic) {
	/*
	launch wholegenome
	*/

	const checker_fill = '#DEF3FA'

	if (!hic.y) {
		hic.y = {}
	}
	if (!hic.x) {
		hic.x = {}
	}
	hic.c = {}
	const table = hic.holder.append('table')
	const tr1 = table.append('tr')
	hic.c.td = tr1.append('td').style('vertical-align', 'top')
	hic.y.td = tr1.append('td').style('vertical-align', 'top')
	const tr2 = table.append('tr')
	hic.x.td = tr2.append('td')
	tr2.append('td')

	/*
	launch wholegenome
	at lowest resolution
	*/
	const resolution = hic.bpresolution[0]

	hic.ressays.text(common.bplen(resolution) + ' bp')

	// # pixel per bin, may set according to resolution
	let binpx = 1

	// for each chr, a row as canvas container
	hic.wholegenome.svg = hic.c.td.append('svg')
	hic.wholegenome.binpx = binpx
	hic.wholegenome.resolution = resolution

	const fontsize = 15 // chr labels
	const borderwidth = 1
	const spacecolor = '#ccc'

	// heatmap layer underneath sv
	const layer_map = hic.wholegenome.svg
		.append('g')
		.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
	hic.wholegenome.layer_map = layer_map
	const layer_sv = hic.wholegenome.svg
		.append('g')
		.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
	hic.wholegenome.layer_sv = layer_sv

	let checker_row = true

	const chr2px = {} // px width for each chr
	let totalpx = hic.chrlst.length
	for (const chr of hic.chrlst) {
		const w = Math.ceil(hic.genome.chrlookup[chr.toUpperCase()].len / resolution) * binpx
		chr2px[chr] = w
		totalpx += w
	}

	let xoff = 0
	// column labels
	for (const chr of hic.chrlst) {
		const chrw = chr2px[chr]
		if (checker_row) {
			layer_map
				.append('rect')
				.attr('x', xoff)
				.attr('width', chrw)
				.attr('height', fontsize)
				.attr('y', -fontsize)
				.attr('fill', checker_fill)
		}
		checker_row = !checker_row
		layer_map
			.append('text')
			.attr('font-family', client.font)
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.attr('x', xoff + chrw / 2)
			.text(chr)

		xoff += chrw
		layer_sv
			.append('line')
			.attr('x1', xoff)
			.attr('x2', xoff)
			.attr('y2', totalpx)
			.attr('stroke', spacecolor)
			.attr('shape-rendering', 'crispEdges')

		xoff += borderwidth
	}

	let yoff = 0
	checker_row = true

	// row labels
	for (const chr of hic.chrlst) {
		const chrh = chr2px[chr]
		if (checker_row) {
			layer_map
				.append('rect')
				.attr('x', -hardcode_wholegenomechrlabwidth)
				.attr('width', hardcode_wholegenomechrlabwidth)
				.attr('height', chrh)
				.attr('y', yoff)
				.attr('fill', checker_fill)
		}
		checker_row = !checker_row
		layer_map
			.append('text')
			.attr('font-family', client.font)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('font-size', 12)
			.attr('y', yoff + chrh / 2)
			.text(chr)

		yoff += chrh
		layer_sv
			.append('line')
			.attr('x2', totalpx)
			.attr('y1', yoff)
			.attr('y2', yoff)
			.attr('stroke', spacecolor)
			.attr('shape-rendering', 'crispEdges')

		yoff += borderwidth
	}

	const manychr = hic.atdev ? atdev_chrnum : hic.chrlst.length

	xoff = 0

	for (let i = 0; i < manychr; i++) {
		const lead = hic.chrlst[i]
		hic.wholegenome.lead2follow.set(lead, new Map())

		yoff = 0

		for (let j = 0; j <= i; j++) {
			const follow = hic.chrlst[j]
			hic.wholegenome.lead2follow.get(lead).set(follow, {
				x: xoff,
				y: yoff
			})
			makewholegenome_chrleadfollow(hic, lead, follow)
			yoff += chr2px[follow] + borderwidth
		}
		xoff += chr2px[lead] + borderwidth
	}

	if (hic.sv && hic.sv.items) {
		makewholegenome_sv(hic)
	}

	hic.wholegenome.svg.attr('width', hardcode_wholegenomechrlabwidth + xoff).attr('height', fontsize + yoff)

	// after the ui is created, load data for each chr pair,
	// await on each request to finish to avoid server lockup
	for (let i = 0; i < manychr; i++) {
		const lead = hic.chrlst[i]
		for (let j = 0; j <= i; j++) {
			const follow = hic.chrlst[j]
			await getdata_leadfollow(hic, lead, follow)
		}
	}

	return
}

function makewholegenome_chrleadfollow(hic, lead, follow) {
	/*
	wholegenome for a pair of chr (lead - follow)
	lead is on x
	follow is on y, lead & follow could be same
	*/
	const binpx = hic.wholegenome.binpx
	const obj = hic.wholegenome.lead2follow.get(lead).get(follow)

	const leadchrlen = hic.genome.chrlookup[lead.toUpperCase()].len
	const followchrlen = hic.genome.chrlookup[follow.toUpperCase()].len

	const xbins = Math.ceil(leadchrlen / hic.wholegenome.resolution)
	const ybins = Math.ceil(followchrlen / hic.wholegenome.resolution)

	obj.canvas = hic.holder.append('canvas').style('display', 'none').node()

	obj.ctx = obj.canvas.getContext('2d')

	obj.canvas.width = xbins * binpx
	obj.canvas.height = ybins * binpx

	obj.img = hic.wholegenome.layer_map
		.append('image')
		.attr('width', obj.canvas.width)
		.attr('height', obj.canvas.height)
		.attr('x', obj.x)
		.attr('y', obj.y)
		.on('click', () => {
			init_chrpair(hic, lead, follow)
		})
		.on('mouseover', () => {
			chrpair_mouseover(hic, obj.img, lead, follow)
		})

	if (lead != follow) {
		obj.canvas2 = hic.holder.append('canvas').style('display', 'none').node()

		obj.ctx2 = obj.canvas2.getContext('2d')

		obj.canvas2.width = ybins * binpx
		obj.canvas2.height = xbins * binpx

		obj.img2 = hic.wholegenome.layer_map
			.append('image')
			.attr('width', obj.canvas2.width)
			.attr('height', obj.canvas2.height)
			.attr('x', obj.y)
			.attr('y', obj.x)
			.on('click', () => {
				init_chrpair(hic, follow, lead)
			})
			.on('mouseover', () => {
				chrpair_mouseover(hic, obj.img2, follow, lead)
			})
	} else {
		obj.ctx2 = obj.ctx
	}
}

function chrpair_mouseover(hic, img, x_chr, y_chr) {
	const p = img.node().getBoundingClientRect()
	hic.wholegenome.pica_x
		.clear()
		.show(p.left, p.top)
		.d.style('top', null)
		.style('bottom', window.innerHeight - p.top - window.pageYOffset + 'px')
		.text(x_chr)
	hic.wholegenome.pica_y
		.clear()
		.show(p.left, p.top)
		.d.style('left', null)
		.style('right', document.body.clientWidth - p.left - window.pageXOffset + 'px') // no scrollbar width
		.text(y_chr)
}

async function getdata_leadfollow(hic, lead, follow) {
	const binpx = hic.wholegenome.binpx
	const resolution = hic.wholegenome.resolution
	const obj = hic.wholegenome.lead2follow.get(lead).get(follow)
	obj.data = []
	obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
	if (obj.canvas2) {
		obj.ctx2.clearRect(0, 0, obj.canvas2.width, obj.canvas.height)
	}

	const arg = {
		file: hic.file,
		url: hic.url,
		pos1: hic.nochr ? lead.replace('chr', '') : lead,
		pos2: hic.nochr ? follow.replace('chr', '') : follow,
		nmeth: hic.wholegenome.nmeth,
		resolution: resolution
	}

	try {
		const data = await client.dofetch2('/hicdata', {
			method: 'POST',
			body: JSON.stringify(arg)
		})
		if (data.error) throw lead + ' - ' + follow + ': ' + data.error
		if (!data.items || data.items.length == 0) {
			return
		}
		for (const [plead, pfollow, v] of data.items) {
			const leadpx = Math.floor(plead / resolution) * binpx
			const followpx = Math.floor(pfollow / resolution) * binpx

			obj.data.push([leadpx, followpx, v])

			const p =
				v >= hic.wholegenome.bpmaxv ? 0 : Math.floor((255 * (hic.wholegenome.bpmaxv - v)) / hic.wholegenome.bpmaxv)
			obj.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			obj.ctx.fillRect(followpx, leadpx, binpx, binpx)
			obj.ctx2.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			obj.ctx2.fillRect(leadpx, followpx, binpx, binpx)
		}
		obj.img.attr('xlink:href', obj.canvas.toDataURL())
		if (obj.canvas2) {
			obj.img2.attr('xlink:href', obj.canvas2.toDataURL())
		}
	} catch (e) {
		hic.error(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

function makewholegenome_sv(hic) {
	const unknownchr = new Set()

	const radius = 8

	for (const item of hic.sv.items) {
		const _o = hic.wholegenome.lead2follow.get(item.chr1)
		if (!_o) {
			unknownchr.add(item.chr1)
			continue
		}
		const obj = _o.get(item.chr2)
		if (!obj) {
			unknownchr.add(item.chr2)
			continue
		}

		const p1 = item.position1 / hic.wholegenome.resolution
		const p2 = item.position2 / hic.wholegenome.resolution
		hic.wholegenome.layer_sv
			.append('circle')
			.attr('stroke', 'black')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('cx', obj.x + p1)
			.attr('cy', obj.y + p2)
			.attr('r', radius)
			.on('mouseover', () => {
				tooltip_sv(hic, item)
			})
			.on('mouseout', () => {
				hic.tip.hide()
			})
			.on('click', () => {
				click_sv(hic, item)
			})

		if (obj.img2) {
			hic.wholegenome.layer_sv
				.append('circle')
				.attr('stroke', 'black')
				.attr('fill', 'whilte')
				.attr('fill-opacity', 0)
				.attr('cy', obj.x + p1)
				.attr('cx', obj.y + p2)
				.attr('r', radius)
				.on('mouseover', event => {
					tooltip_sv(event, hic, item)
				})
				.on('mouseout', () => {
					hic.tip.hide()
				})
				.on('click', () => {
					click_sv(hic, item)
				})
		}
	}
}

function tooltip_sv(event, hic, item) {
	hic.tip
		.clear()
		.show(event.clientX, event.clientY)
		.d.append('div')
		.text(
			item.chr1 == item.chr2
				? item.chr1 + ' : ' + item.position1 + ' - ' + item.position2
				: item.chr1 + ':' + item.position1 + ' > ' + item.chr2 + ':' + item.position2
		)
}

function click_sv(hic, item) {
	const pane = client.newpane({ x: 100, y: 100 })
	pane.header.text(
		hic.name +
			' ' +
			(item.chr1 == item.chr2
				? item.chr1 + ':' + item.position1 + '-' + item.position2
				: item.chr1 + ':' + item.position1 + ' > ' + item.chr2 + ':' + item.position2)
	)
	const tracks = [
		{
			type: client.tkt.hicstraw,
			file: hic.file,
			enzyme: hic.enzyme,
			maxpercentage: default_hicstrawmaxvperc,
			pyramidup: 1,
			name: hic.name
		}
	]
	if (hic.tklst) {
		for (const t of hic.tklst) {
			tracks.push(t)
		}
	}
	client.first_genetrack_tolist(hic.genome, tracks)
	const arg = {
		holder: pane.body,
		hostURL: hic.hostURL,
		jwt: hic.jwt,
		genome: hic.genome,
		nobox: 1,
		tklst: tracks
	}

	if (item.chr1 == item.chr2 && Math.abs(item.position2 - item.position1) < default_svpointspan * 2) {
		// two breakends overlap
		arg.chr = item.chr1
		const w = Math.abs(item.position2 - item.position1)
		arg.start = Math.max(1, Math.min(item.position1, item.position2) - w)
		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, Math.max(item.position1, item.position2) + w)
	} else {
		arg.chr = item.chr1
		arg.start = Math.max(1, item.position1 - default_svpointspan / 2)
		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, item.position1 + default_svpointspan / 2)
		arg.width = default_subpanelpxwidth
		arg.subpanels = [
			{
				chr: item.chr2,
				start: Math.max(1, item.position2 - default_svpointspan / 2),
				stop: Math.min(hic.genome.chrlookup[item.chr2.toUpperCase()].len, item.position2 + default_svpointspan / 2),
				width: default_subpanelpxwidth,
				leftpad: 10,
				leftborder: subpanel_bordercolor
			}
		]
	}
	blocklazyload(arg)
}

/////////// __whole genome ends

function init_chrpair(hic, chrx, chry) {
	/*
	by clicking a pair of chr on whole genome view
	hide the whole genome view
	show view of entire chromosome pair
	*/

	nmeth2select(hic, hic.chrpairview.nmeth)

	hic.inwholegenome = false
	hic.inchrpair = true
	hic.indetail = false
	hic.wholegenomebutton.style('display', 'inline-block')
	hic.chrpairviewbutton.style('display', 'none')
	hic.wholegenome.svg.remove()

	hic.chrpairview.chrx = chrx
	hic.chrpairview.chry = chry

	const chrxlen = hic.genome.chrlookup[chrx.toUpperCase()].len
	const chrylen = hic.genome.chrlookup[chry.toUpperCase()].len
	const maxchrlen = Math.max(chrxlen, chrylen)

	/*
	for resolution bin from great to tiny
	find one that just shows >200 # bins over biggest chr
	*/
	let resolution = null
	for (let i = 0; i < hic.bpresolution.length; i++) {
		const res = hic.bpresolution[i]
		if (maxchrlen / res > 200) {
			resolution = res
			break
		}
	}
	if (resolution == null) {
		hic.error('no suitable resolution')
		return
	}
	hic.ressays.text(common.bplen(resolution) + ' bp')

	let binpx = 1
	while ((binpx * maxchrlen) / resolution < 600) {
		binpx++
	}

	const axispad = 10 // padding on the ends of x/y chr coordinate axes

	{
		// y axis
		hic.y.td.selectAll('*').remove()
		const svg = hic.y.td.append('svg')
		const h = Math.ceil(chrylen / resolution) * binpx
		svg.attr('width', 100).attr('height', axispad * 2 + h)
		svg
			.append('g')
			.attr('transform', 'translate(80,' + (axispad + h / 2) + ')')
			.append('text')
			.text(chry)
			.attr('text-anchor', 'middle')
			.attr('font-size', 15)
			.attr('font-family', client.font)
			.attr('dominant-baseline', 'central')
			.attr('transform', 'rotate(90)')
		client.axisstyle({
			axis: svg
				.append('g')
				.attr('transform', 'translate(1,' + axispad + ')')
				.call(
					axisRight()
						.scale(scaleLinear().domain([0, chrylen]).range([0, h]))
						.tickFormat(d3format('.2s'))
				),
			showline: true
		})
		hic.chrpairview.axisy = svg
	}

	{
		// x axis
		hic.x.td.selectAll('*').remove()
		const svg = hic.x.td.append('svg')
		const w = Math.ceil(chrxlen / resolution) * binpx
		svg.attr('height', 100).attr('width', axispad * 2 + w)
		svg
			.append('text')
			.text(chrx)
			.attr('font-size', 15)
			.attr('font-family', client.font)
			.attr('x', axispad + w / 2)
			.attr('text-anchor', 'middle')
			.attr('y', 60)
		client.axisstyle({
			axis: svg
				.append('g')
				.attr('transform', 'translate(' + axispad + ',1)')
				.call(
					axisBottom()
						.scale(scaleLinear().domain([0, chrxlen]).range([0, w]))
						.tickFormat(d3format('.2s'))
				),
			showline: true
		})
		hic.chrpairview.axisx = svg
	}

	hic.chrpairview.resolution = resolution
	hic.chrpairview.binpx = binpx

	const canvas = hic.c.td
		.append('canvas')
		.style('margin', axispad + 'px')
		.on('click', event => {
			const [x, y] = pointer(event, this)
			init_detail(hic, chrx, chry, x, y)
		})
		.node()
	canvas.width = Math.ceil(chrxlen / resolution) * binpx
	canvas.height = Math.ceil(chrylen / resolution) * binpx
	const ctx = canvas.getContext('2d')
	hic.chrpairview.ctx = ctx
	hic.chrpairview.canvas = canvas

	getdata_chrpair(hic)
}

function tell_firstisx(hic, chrx, chry) {
	if (chrx == chry) return true
	return hic.chrorder.indexOf(chrx) < hic.chrorder.indexOf(chry)
}

function getdata_chrpair(hic) {
	const chrx = hic.chrpairview.chrx
	const chry = hic.chrpairview.chry
	const isintrachr = chrx == chry
	const chrxlen = hic.genome.chrlookup[chrx.toUpperCase()].len
	const chrylen = hic.genome.chrlookup[chry.toUpperCase()].len
	const firstisx = tell_firstisx(hic, chrx, chry)

	const resolution = hic.chrpairview.resolution
	const binpx = hic.chrpairview.binpx
	const ctx = hic.chrpairview.ctx

	const arg = {
		jwt: hic.jwt,
		file: hic.file,
		url: hic.url,
		pos1: hic.nochr ? chrx.replace('chr', '') : chrx,
		pos2: hic.nochr ? chry.replace('chr', '') : chry,
		nmeth: hic.chrpairview.nmeth,
		resolution: resolution
	}
	fetch(
		new Request(hic.hostURL + '/hicdata', {
			method: 'POST',
			body: JSON.stringify(arg)
		})
	)
		.then(data => {
			return data.json()
		})
		.then(data => {
			if (data.error) throw { message: chrx + ' - ' + chry + ': ' + data.error }

			ctx.clearRect(0, 0, hic.chrpairview.canvas.width, hic.chrpairview.canvas.height)

			if (!data.items || data.items.length == 0) {
				// no data
				return
			}

			let err = 0

			hic.chrpairview.isintrachr = isintrachr
			hic.chrpairview.data = []

			/*
		a percentile as cutoff for chrpairview
		*/
			const vlst = []

			for (const [coord1, coord2, v] of data.items) {
				vlst.push(v)

				const px1 = Math.floor(coord1 / resolution) * binpx
				const px2 = Math.floor(coord2 / resolution) * binpx
				const x = firstisx ? px1 : px2
				const y = firstisx ? px2 : px1

				hic.chrpairview.data.push([x, y, v])
				if (isintrachr) {
					hic.chrpairview.data.push([y, x, v])
				}
			}

			const maxv = vlst.sort((a, b) => a - b)[Math.floor(vlst.length * 0.99)]
			hic.chrpairview.bpmaxv = maxv
			hic.inputbpmaxv.property('value', maxv)

			for (const [x, y, v] of hic.chrpairview.data) {
				const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
				ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
				ctx.fillRect(x, y, binpx, binpx)
			}
		})
		.catch(err => {
			hic.error(err.message)
			if (err.stack) console.log(err.stack)
		})
}

async function setnmeth(hic, nmeth) {
	/*
	set normalization method from <select>
	*/
	if (hic.inwholegenome) {
		hic.wholegenome.nmeth = nmeth
		const manychr = hic.atdev ? 3 : hic.chrlst.length
		for (let i = 0; i < manychr; i++) {
			const lead = hic.chrlst[i]
			for (let j = 0; j <= i; j++) {
				const follow = hic.chrlst[j]
				await getdata_leadfollow(hic, lead, follow)
			}
		}
		return
	}
	if (hic.inchrpair) {
		hic.chrpairview.nmeth = nmeth
		getdata_chrpair(hic)
		return
	}
	if (hic.indetail) {
		hic.detailview.nmeth = nmeth
		getdata_detail(hic)
	}
}

function setmaxv(hic, maxv) {
	/*
	setting max value from user input
	*/
	if (hic.inwholegenome) {
		// viewing whole genome
		hic.wholegenome.bpmaxv = maxv
		if (!hic.wholegenome.lead2follow) return
		const binpx = hic.wholegenome.binpx
		for (const [lead, a] of hic.wholegenome.lead2follow) {
			for (const [follow, b] of a) {
				for (const [leadpx, followpx, v] of b.data) {
					const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
					b.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx.fillRect(followpx, leadpx, binpx, binpx)
					b.ctx2.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx2.fillRect(leadpx, followpx, binpx, binpx)
				}
				b.img.attr('xlink:href', b.canvas.toDataURL())
				if (b.canvas2) {
					b.img2.attr('xlink:href', b.canvas2.toDataURL())
				}
			}
		}
		return
	}
	if (hic.inchrpair) {
		// viewing chr pair
		hic.chrpairview.bpmaxv = maxv
		const binpx = hic.chrpairview.binpx
		for (const [x, y, v] of hic.chrpairview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.chrpairview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.chrpairview.ctx.fillRect(x, y, binpx, binpx)
			if (hic.chrpairview.isintrachr) {
				hic.chrpairview.ctx.fillRect(y, x, binpx, binpx)
			}
		}
		return
	}
	if (hic.indetail) {
		hic.detailview.bpmaxv = maxv
		for (const [x, y, w, h, v] of hic.detailview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.detailview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.detailview.ctx.fillRect(x, y, w, h)
		}
	}
}

function switchview(hic) {
	/*
	by clicking buttons
	only for switching to
	*/
	if (hic.inwholegenome) {
		hic.x.td.selectAll('*').remove()
		hic.y.td.selectAll('*').remove()
		hic.c.td.selectAll('*').remove()
		hic.c.td.node().appendChild(hic.wholegenome.svg.node())
		hic.wholegenomebutton.style('display', 'none')
		hic.chrpairviewbutton.style('display', 'none')
		hic.inputbpmaxv.property('value', hic.wholegenome.bpmaxv)
		hic.ressays.text(common.bplen(hic.wholegenome.resolution) + ' bp')
		nmeth2select(hic, hic.wholegenome.nmeth)
	} else if (hic.inchrpair) {
		hic.y.td.selectAll('*').remove()
		hic.y.td.node().appendChild(hic.chrpairview.axisy.node())
		hic.x.td.selectAll('*').remove()
		hic.x.td.node().appendChild(hic.chrpairview.axisx.node())
		hic.c.td.selectAll('*').remove()
		hic.c.td.node().appendChild(hic.chrpairview.canvas)
		hic.wholegenomebutton.style('display', 'inline-block')
		hic.chrpairviewbutton.style('display', 'none')
		hic.inputbpmaxv.property('value', hic.chrpairview.bpmaxv)
		hic.ressays.text(common.bplen(hic.chrpairview.resolution) + ' bp')
		nmeth2select(hic, hic.chrpairview.nmeth)
	}
}

function nmeth2select(hic, v) {
	const options = hic.nmethselect.node().options
	for (const o of options) o.selected = false
	switch (v) {
		case 'NONE':
			options[0].selected = true
			break
		case 'VC':
			options[1].selected = true
			break
		case 'VC_SQRT':
			options[2].selected = true
			break
		case 'KR':
			options[3].selected = true
			break
	}
}

//////////////////// __detail

function init_detail(hic, chrx, chry, x, y) {
	/*
	chrpairview is static
	clicking on it to launch detail view
	
	initially, zoom into a pretty large region
	so only use bp resolution but not fragment
	*/

	nmeth2select(hic, hic.detailview.nmeth)

	hic.indetail = true
	hic.inwholegenome = false
	hic.inchrpair = false
	hic.wholegenomebutton.style('display', 'inline-block')

	const isintrachr = chrx == chry

	hic.chrpairviewbutton.text('Entire ' + chrx + '-' + chry).style('display', 'inline-block')

	// default view span
	const viewrangebpw = hic.chrpairview.resolution * initialbinnum_detail

	let coordx = Math.max(1, Math.floor((x * hic.chrpairview.resolution) / hic.chrpairview.binpx) - viewrangebpw / 2)
	let coordy = Math.max(1, Math.floor((y * hic.chrpairview.resolution) / hic.chrpairview.binpx) - viewrangebpw / 2)

	// make sure positions are not out of bounds
	{
		const lenx = hic.genome.chrlookup[chrx.toUpperCase()].len
		if (coordx + viewrangebpw >= lenx) {
			coordx = lenx - viewrangebpw
		}
		const leny = hic.genome.chrlookup[chry.toUpperCase()].len
		if (coordy + viewrangebpw > leny) {
			coordy = leny - viewrangebpw
		}
	}

	let resolution = null
	for (const res of hic.bpresolution) {
		if (viewrangebpw / res > minimumbinnum_bp) {
			resolution = res
			break
		}
	}
	if (resolution == null) {
		// use finest
		resolution = hic.bpresolution[hic.bpresolution.length - 1]
	}
	let binpx = 2
	while ((binpx * viewrangebpw) / resolution < mincanvassize_detail) {
		binpx += 2
	}

	// px width of x and y blocks
	const blockwidth = Math.ceil((binpx * viewrangebpw) / resolution)
	hic.detailview.xb.width = blockwidth
	hic.detailview.yb.width = blockwidth

	hic.chrpairview.axisy.remove()
	hic.chrpairview.axisx.remove()
	hic.c.td.selectAll('*').remove()

	/************** middle canvas *****************/

	const canvasholder = hic.c.td
		.append('div')
		.style('position', 'relative')
		.style('width', blockwidth + 'px')
		.style('height', blockwidth + 'px')
		.style('overflow', 'hidden')

	const canvas = canvasholder
		.append('canvas')
		.style('display', 'block')
		.style('position', 'absolute')
		.attr('width', blockwidth)
		.attr('height', blockwidth)
		.attr('left', '10px')
		.attr('top', '10px')
		.on('mousedown', event => {
			const body = d3select(document.body)
			const x = event.clientX
			const y = event.clientY
			const oldx = Number.parseInt(canvas.style('left'))
			const oldy = Number.parseInt(canvas.style('top'))
			body.on('mousemove', event => {
				const xoff = event.clientX - x
				const yoff = event.clientY - y
				hic.detailview.xb.panning(xoff)
				hic.detailview.yb.panning(yoff)
				canvas.style('left', oldx + xoff + 'px').style('top', oldy + yoff + 'px')
			})
			body.on('mouseup', event => {
				body.on('mousemove', null).on('mouseup', null)
				const xoff = event.clientX - x
				const yoff = event.clientY - y
				hic.detailview.xb.pannedby(xoff)
				hic.detailview.yb.pannedby(yoff)
			})
		})
	const ctx = canvas.node().getContext('2d')

	hic.detailview.canvas = canvas
	hic.detailview.ctx = ctx

	detailviewupdatehic(hic, chrx, coordx, coordx + viewrangebpw, chry, coordy, coordy + viewrangebpw)

	/*
	global zoom buttons
	*/
	{
		const row = canvasholder.append('div').style('position', 'absolute').style('right', '100px').style('top', '20px')
		row
			.append('button')
			.text('Zoom in')
			.style('margin-right', '10px')
			.on('click', () => {
				hic.detailview.xb.zoomblock(2, false)
				hic.detailview.yb.zoomblock(2, false)
			})
		row
			.append('button')
			.text('Zoom out')
			.style('margin-right', '10px')
			.on('click', () => {
				hic.detailview.xb.zoomblock(2, true)
				hic.detailview.yb.zoomblock(2, true)
			})

		row
			.append('button')
			.text('Horizontal View')
			.on('click', () => {
				const regionx = hic.detailview.xb.rglst[0]
				const regiony = hic.detailview.yb.rglst[0]

				const pane = client.newpane({ x: 100, y: 100 })
				pane.header.text(hic.name + ' ' + regionx.chr + ' : ' + regiony.chr)

				const tracks = [
					{
						type: client.tkt.hicstraw,
						file: hic.file,
						enzyme: hic.enzyme,
						maxpercentage: default_hicstrawmaxvperc,
						pyramidup: 1,
						name: hic.name
					}
				]
				if (hic.tklst) {
					for (const t of hic.tklst) {
						tracks.push(t)
					}
				}
				client.first_genetrack_tolist(hic.genome, tracks)
				const arg = {
					holder: pane.body,
					hostURL: hic.hostURL,
					jwt: hic.jwt,
					genome: hic.genome,
					nobox: 1,
					tklst: tracks
				}
				if (
					regionx.chr == regiony.chr &&
					Math.max(regionx.start, regiony.start) < Math.min(regionx.stop, regiony.stop)
				) {
					// x/y overlap
					arg.chr = regionx.chr
					arg.start = Math.min(regionx.start, regiony.start)
					arg.stop = Math.max(regionx.stop, regiony.stop)
				} else {
					arg.chr = regionx.chr
					arg.start = regionx.start
					arg.stop = regionx.stop
					arg.width = default_subpanelpxwidth
					arg.subpanels = [
						{
							chr: regiony.chr,
							start: regiony.start,
							stop: regiony.stop,
							width: default_subpanelpxwidth,
							leftpad: 10,
							leftborder: subpanel_bordercolor
						}
					]
				}
				blocklazyload(arg)
			})
	}

	/******** common parameter for x/y block ********/

	const arg = {
		noresize: true,
		nobox: true,
		butrowbottom: true,
		style: {
			margin: hic.detailview.bbmargin + 'px'
		},
		genome: hic.genome,
		hostURL: hic.hostURL,
		width: blockwidth,
		leftheadw: 20,
		rightheadw: 40,
		tklst: []
	}
	client.first_genetrack_tolist(hic.genome, arg.tklst)

	// duplicate arg for y
	const arg2 = {}
	for (const k in arg) arg2[k] = arg[k]

	/******************* x block ******************/

	let xfirsttime = true
	arg.chr = chrx
	arg.start = coordx
	arg.stop = coordx + viewrangebpw
	arg.holder = hic.x.td
	arg.onloadalltk_always = bb => {
		/*
		cannot apply transition to canvasholder
		it may prevent resetting width when both x and y are changing
		*/
		canvasholder.style(
			'width',
			2 * hic.detailview.bbmargin + bb.leftheadw + bb.lpad + bb.width + bb.rpad + bb.rightheadw + 'px'
		)

		if (xfirsttime) {
			xfirsttime = false
			// must do this:
			canvas.transition().style('left', hic.detailview.bbmargin + bb.leftheadw + bb.lpad + 'px')
			return
		}
		detailviewupdateregionfromblock(hic)
	}
	arg.onpanning = xoff => {
		canvas.style('left', xoff + hic.detailview.bbmargin + hic.detailview.xb.leftheadw + hic.detailview.xb.lpad + 'px')
	}
	blocklazyload(arg).then(block => {
		hic.detailview.xb = block
	})

	/******************* y block ******************/

	const sheath = hic.y.td
		.append('div')
		.style('position', 'relative')
		.style('width', '200px') // dummy size
		.style('height', '800px')

	const rotor = sheath
		.append('div')
		.style('position', 'absolute')
		.style('bottom', '0px')
		.style('transform', 'rotate(-90deg)')
		.style('transform-origin', 'left bottom')

	let yfirsttime = true

	arg2.rotated = true
	arg2.showreverse = true

	arg2.chr = chry
	arg2.start = coordy
	arg2.stop = coordy + viewrangebpw
	arg2.holder = rotor
	arg2.onloadalltk_always = bb => {
		const bbw = bb.leftheadw + bb.lpad + bb.width + bb.rpad + bb.rightheadw + 2 * hic.detailview.bbmargin
		sheath.transition().style('height', bbw + 'px')
		canvasholder.style('height', bbw + 'px')
		if (yfirsttime) {
			yfirsttime = false
			// must do this:
			canvas.transition().style('top', hic.detailview.bbmargin + bb.rpad + bb.rightheadw + 'px')
			return
		}
		detailviewupdateregionfromblock(hic)
	}
	arg2.onpanning = xoff => {
		canvas.style('top', -xoff + hic.detailview.bbmargin + hic.detailview.yb.rightheadw + hic.detailview.yb.rpad + 'px')
	}

	const buttonrowh = 30
	arg2.onsetheight = bbh => {
		rotor.transition().style('left', hic.detailview.bbmargin + bbh + buttonrowh + 'px')
	}

	blocklazyload(arg2).then(block => {
		hic.detailview.yb = block
	})
	/*
	//XXX this won't work, will duplicate the chunk for block, try named chunk
	import('./block').then(p=>{
		hic.detailview.yb = new p.Block(arg2)
	})
	*/
}

function detailviewupdateregionfromblock(hic) {
	const rx = hic.detailview.xb.rglst[0]
	const ry = hic.detailview.yb.rglst[0]
	detailviewupdatehic(hic, rx.chr, rx.start, rx.stop, ry.chr, ry.start, ry.stop)
}

function detailviewupdatehic(hic, chrx, xstart, xstop, chry, ystart, ystop) {
	/*
	call when coordinate changes

	x/y can span different bp width, in different px width

	calculate resolution, apply the same to both x/y

	detect if to use bp or fragment resolution
	*/

	hic.detailview.chrx = chrx
	hic.detailview.chry = chry
	hic.detailview.xstart = xstart
	hic.detailview.xstop = xstop
	hic.detailview.ystart = ystart
	hic.detailview.ystop = ystop

	const maxbpwidth = Math.max(xstop - xstart, ystop - ystart)
	let resolution = null
	for (const res of hic.bpresolution) {
		if (maxbpwidth / res > minimumbinnum_bp) {
			resolution = res
			break
		}
	}

	Promise.resolve()
		.then(() => {
			if (resolution != null) {
				// using bp resolution
				delete hic.detailview.frag
				return
			}

			if (!hic.enzyme) {
				// no enzyme available
				resolution = hic.bpresolution[hic.bpresolution.length - 1]
				delete hic.detailview.frag
				return
			}

			/*
		convert x/y view range coordinate to enzyme fragment index
		using the span of frag index to figure out resolution (# of fragments)
		*/
			hic.detailview.frag = {}

			// query fragment index for x
			const arg = {
				getdata: 1,
				getBED: 1,
				file: hic.enzymefile,
				rglst: [{ chr: chrx, start: xstart, stop: xstop }]
			}
			return client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
		})

		.then(xfragment => {
			if (!xfragment) {
				// use bpresolution, not fragment
				hic.detailview.resolution = resolution
				hic.ressays.text(common.bplen(resolution) + ' bp')
				// fixed bin size only for bp bins
				hic.detailview.xbinpx = hic.detailview.canvas.attr('width') / ((xstop - xstart) / resolution)
				hic.detailview.ybinpx = hic.detailview.canvas.attr('height') / ((ystop - ystart) / resolution)
				return
			}

			// got fragment index for x
			if (xfragment.error) throw { message: xfragment.error }
			if (!xfragment.items) throw { message: '.items[] missing for x view range enzyme fragment' }
			const [err, map, start, stop] = hicparsefragdata(xfragment.items)
			if (err) throw { message: err }
			hic.detailview.frag.xid2coord = map
			hic.detailview.frag.xstartfrag = start
			hic.detailview.frag.xstopfrag = stop

			// query fragment index for y
			const arg = {
				getdata: 1,
				getBED: 1,
				file: hic.enzymefile,
				rglst: [{ chr: chry, start: ystart, stop: ystop }]
			}
			return client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
		})

		.then(yfragment => {
			if (!yfragment) return

			// got fragment index for y
			if (yfragment.error) throw { message: yfragment.error }
			if (!yfragment.items) throw { message: '.items[] missing' }
			const [err, map, start, stop] = hicparsefragdata(yfragment.items)
			if (err) throw { message: err }

			if (chrx == chry) {
				/*
			intra chr
			frag id to coord mapping goes to same bin for great merit
			*/
				for (const [id, pos] of map) {
					hic.detailview.frag.xid2coord.set(id, pos)
				}
				hic.detailview.frag.yid2coord = hic.detailview.frag.xid2coord
			} else {
				hic.detailview.frag.yid2coord = map
			}
			hic.detailview.frag.ystartfrag = start
			hic.detailview.frag.ystopfrag = stop

			/*
		x/y fragment range defined
		find out resolution
		*/
			const maxfragspan = Math.max(
				hic.detailview.frag.xstopfrag - hic.detailview.frag.xstartfrag,
				hic.detailview.frag.ystopfrag - hic.detailview.frag.ystartfrag
			)
			let resolution = null
			for (const r of hic.fragresolution) {
				if (maxfragspan / r > minimumbinnum_frag) {
					resolution = r
					break
				}
			}
			if (resolution == null) {
				resolution = hic.fragresolution[hic.fragresolution.length - 1]
			}
			hic.ressays.text(resolution > 1 ? resolution + ' fragments' : 'single fragment')
			hic.detailview.resolution = resolution
			return
		})

		.then(() => {
			getdata_detail(hic)
		})

		.catch(err => {
			hic.error(err.message)
			if (err.stack) console.log(err.stack)
		})
}

function getdata_detail(hic) {
	/*
	x/y view range and resolution have all been set
	request hic data and paint canvas
	*/

	const resolution = hic.detailview.resolution
	const ctx = hic.detailview.ctx
	const chrx = hic.detailview.chrx
	const chry = hic.detailview.chry

	const fg = hic.detailview.frag

	// genomic coordinates
	const xstart = hic.detailview.xstart
	const xstop = hic.detailview.xstop
	const ystart = hic.detailview.ystart
	const ystop = hic.detailview.ystop

	const par = {
		jwt: hic.jwt,
		file: hic.file,
		url: hic.url,
		pos1:
			(hic.nochr ? chrx.replace('chr', '') : chrx) +
			':' +
			(fg ? fg.xstartfrag + ':' + fg.xstopfrag : xstart + ':' + xstop),
		pos2:
			(hic.nochr ? chry.replace('chr', '') : chry) +
			':' +
			(fg ? fg.ystartfrag + ':' + fg.ystopfrag : ystart + ':' + ystop),
		nmeth: hic.detailview.nmeth,
		resolution: resolution
	}

	if (fg) {
		par.isfrag = true
	}

	fetch(
		new Request(hic.hostURL + '/hicdata', {
			method: 'POST',
			body: JSON.stringify(par)
		})
	)
		.then(data => {
			return data.json()
		})
		.then(data => {
			hic.detailview.canvas.attr('width', hic.detailview.xb.width).attr('height', hic.detailview.yb.width)

			const canvaswidth = Number.parseInt(hic.detailview.canvas.attr('width'))
			const canvasheight = Number.parseInt(hic.detailview.canvas.attr('height'))
			ctx.clearRect(0, 0, canvaswidth, canvasheight)

			// pixel per bp
			const xpxbp = canvaswidth / (xstop - xstart)
			const ypxbp = canvasheight / (ystop - ystart)

			if (data.error) throw { message: data.error }
			if (!data.items || data.items.length == 0) {
				return
			}

			let firstisx = false
			const isintrachr = chrx == chry
			if (isintrachr) {
				firstisx = xstart < ystart
			} else {
				firstisx = tell_firstisx(hic, chrx, chry)
				//firstisx = hic.genome.chrlookup[chrx.toUpperCase()].len > hic.genome.chrlookup[chry.toUpperCase()].len
			}

			const lst = []
			let err = 0
			let maxv = 0

			for (const [n1, n2, v] of data.items) {
				/*
			genomic position and length of either the bin, or the fragment
			*/
				let coord1, coord2, span1, span2

				if (fg) {
					// the beginning fragment index
					const idx_start = firstisx ? n1 : n2
					const idy_start = firstisx ? n2 : n1

					/*
				convert fragment id to coordinate

				start: start of idx_start
				stop: stop of idx_start + resolution
				*/

					// convert x
					if (fg.xid2coord.has(idx_start)) {
						const [a, b] = fg.xid2coord.get(idx_start)
						coord1 = a
						span1 = b - a // note this likely to be replaced by [idx_start+resolution]
					} else {
						console.log('[x id error] x: ' + idx_start + ' y: ' + idy_start)
						err++
						continue
					}
					{
						// the end of fragment id of x, it may be out of range!
						const id_stop = idx_start + resolution

						if (fg.xid2coord.has(id_stop)) {
							const [a, b] = fg.xid2coord.get(id_stop)
							span1 = b - coord1
						}
					}

					// convert y
					if (fg.yid2coord.has(idy_start)) {
						const [a, b] = fg.yid2coord.get(idy_start)
						coord2 = a
						span2 = b - a
					} else {
						console.log('[y id error] x: ' + idx_start + ' y: ' + idy_start)
						err++
						continue
					}
					{
						// the end of fragment id of x, it may be out of range!
						const id_stop = idy_start + resolution

						if (fg.yid2coord.has(id_stop)) {
							const [a, b] = fg.yid2coord.get(id_stop)
							span2 = b - coord2
						}
					}
				} else {
					/*
				bp bin resolution
				*/

					coord1 = firstisx ? n1 : n2
					coord2 = firstisx ? n2 : n1
					span1 = resolution
					span2 = resolution
				}

				maxv = Math.max(v, maxv)

				if (isintrachr) {
					if (coord1 > xstart - span1 && coord1 < xstop && coord2 > ystart - span2 && coord2 < ystop) {
						lst.push([
							Math.floor((coord1 - xstart) * xpxbp),
							Math.floor((coord2 - ystart) * ypxbp),
							Math.ceil(span1 * xpxbp),
							Math.ceil(span2 * ypxbp),
							v
						])
					}
					if (coord2 > xstart - span2 && coord2 < xstop && coord1 > ystart && coord1 < ystop) {
						lst.push([
							Math.floor((coord2 - xstart) * xpxbp),
							Math.floor((coord1 - ystart) * ypxbp),
							Math.ceil(span2 * xpxbp),
							Math.ceil(span1 * ypxbp),
							v
						])
					}
					continue
				}

				// inter chr
				lst.push([
					Math.floor((coord1 - xstart) * xpxbp),
					Math.floor((coord2 - ystart) * ypxbp),
					Math.ceil(span1 * xpxbp),
					Math.ceil(span2 * ypxbp),
					v
				])

				// done this line
			}
			// done all lines

			maxv *= 0.8

			hic.detailview.bpmaxv = maxv
			hic.inputbpmaxv.property('value', maxv)

			for (const [x, y, w, h, v] of lst) {
				const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
				ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'

				ctx.fillRect(x, y, w, h)
			}

			hic.detailview.data = lst
		})

		.catch(err => {
			hic.error(err.message)
			if (err.stack) console.log(err.stack)
		})

		.then(() => {
			hic.detailview.canvas
				.style('left', hic.detailview.bbmargin + hic.detailview.xb.leftheadw + hic.detailview.xb.lpad + 'px')
				.style('top', hic.detailview.bbmargin + hic.detailview.yb.rightheadw + hic.detailview.yb.rpad + 'px')
		})
}

export function hicparsefragdata(items) {
	const id2coord = new Map()
	let min = null,
		max
	for (const i of items) {
		// id of first fragment
		if (!i.rest || !i.rest[0]) {
			return ['items[].rest data problem']
		}
		const id = Number.parseInt(i.rest[0])
		if (Number.isNaN(id)) {
			return [i.start + '.' + i.stop + ' invalid fragment id: ' + i.rest[0]]
		}
		id2coord.set(id, [i.start, i.stop])
		if (min == null) {
			min = id
			max = id
		} else {
			min = Math.min(min, id)
			max = Math.max(max, id)
		}
	}
	return [null, id2coord, min, max]
}

//////////////////// __detail ends

function parseSV(txt) {
	const lines = txt.trim().split(/\r?\n/)
	const [err, header] = parseSVheader(lines[0])
	if (err) return ['header error: ' + err]

	const items = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (line[0] == '#') continue
		const [e, m] = parseSVline(line, header)
		if (e) return ['line ' + (i + 1) + ' error: ' + e]
		items.push(m)
	}
	return [null, header, items]
}

function parseSVheader(line) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for fusions'
	const htry = (...lst) => {
		for (const a of lst) {
			const j = header.indexOf(a)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('chr_a', 'chr1', 'chra')
	if (i == -1) return 'chr_A missing from header'
	header[i] = 'chr1'
	i = htry('chr_b', 'chr2', 'chrb')
	if (i == -1) return 'chr_B missing from header'
	header[i] = 'chr2'
	i = htry('pos_a', 'position_a', 'position1', 'posa')
	if (i == -1) return 'pos_a missing from header'
	header[i] = 'position1'
	i = htry('pos_b', 'position_b', 'position2', 'posb')
	if (i == -1) return 'pos_b missing from header'
	header[i] = 'position2'
	i = htry('strand_a', 'orta', 'orienta')
	if (i == -1) return 'strand_a missing from header'
	header[i] = 'strand1'
	i = htry('strand_b', 'ortb', 'orientb')
	if (i == -1) return 'strand_b missing from header'
	header[i] = 'strand2'
	// optional
	i = htry('numreadsa')
	if (i != -1) header[i] = 'reads1'
	i = htry('numreadsb')
	if (i != -1) header[i] = 'reads2'

	return [null, header]
}

function parseSVline(line, header) {
	const lst = line.split('\t')
	const m = {}

	for (let j = 0; j < header.length; j++) {
		m[header[j]] = lst[j]
	}
	if (!m.chr1) return ['missing chr1']
	if (m.chr1.toLowerCase().indexOf('chr') != 0) {
		m.chr1 = 'chr' + m.chr1
	}
	if (!m.chr2) return ['missing chr2']
	if (m.chr2.toLowerCase().indexOf('chr') != 0) {
		m.chr2 = 'chr' + m.chr2
	}
	if (!m.position1) return ['missing position1']
	let v = Number.parseInt(m.position1)
	if (Number.isNaN(v) || v <= 0) return ['position1 invalid value']
	m.position1 = v
	if (!m.position2) return ['missing position2']
	v = Number.parseInt(m.position2)
	if (Number.isNaN(v) || v <= 0) return ['position2 invalid value']
	m.position2 = v
	if (m.reads1) {
		v = Number.parseInt(m.reads1)
		if (Number.isNaN(v)) return ['reads1 invalid value']
		m.reads1 = v
	}
	if (m.reads2) {
		v = Number.parseInt(m.reads2)
		if (Number.isNaN(v)) return ['reads2 invalid value']
		m.reads2 = v
	}
	return [null, m]
}
