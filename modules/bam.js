const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const spawn = require('child_process').spawn
const readline = require('readline')
const interpolateRgb = require('d3-interpolate').interpolateRgb

/*
TODO
- print ctx chr name next to read when to_qual
- selecting a vertical range from densely packed reads to show alignment in full letters
  via text file cache?
- count number of reads/templates skipped for only having N in view range and show as message row
- error rendering, N junction overlaps with another read in stacking

*********************** data structure
q {}
.regions[]
	.to_checkmismatch bool
	.referenceseq     str
	.to_printnt  bool
	.to_qual     bool
.asPaired
.stackheight
.stackspace
.stacksegspacing
.stacks[]
.templates[]
.overlapRP_multirows -- if to show overlap read pairs at separate rows, otherwise in one row one on top of the other
.overlapRP_hlline  -- at overlap read pairs on separate rows, if to highlight with horizontal line
.messagerows[ {} ]
	.h int
	.t str
.returntemplatebox[]

template {}
.y // initially stack idx, then replaced to be actual screen y
.x1, x2  // screen px, only for stacking not rendering
.ridx2 // not-in-use region idx of the stop position
.segments[]
.height // screen px, only set when to check overlap read pair, will double row height

segment {}
.qname
.boxes[]
.forward
.ridx
.x1, x2  // screen px, used for rendering
.shiftdownrow // idx of mini stack
.isfirst
.islast

box {}
.opr
.start // absolute bp
.len   // #bp
.cidx  // start position in sequence/qual string
.s (read sequence)
.qual[]


*********************** function cascade
get_q
do_query
	query_region
	get_templates
		parse_one_segment
	stack_templates
		may_trimstacks
	poststack_adjustq
		getstacksizebystacks
		get_refseq
	finalize_templates
		get_stacky
			overlapRP_setflag
			getrowheight_template_overlapread
		check_mismatch
	plot_messagerows
	plot_template
		plot_segment
	plot_insertions
*/

// match box color, for single read and normal read pairs
const match_hq = 'rgb(120,120,120)'
const match_lq = 'rgb(230,230,230)'
const qual2match = interpolateRgb(match_lq, match_hq)
// match box color, for ctx read pairs
const ctxpair_hq = '#d48b37'
const ctxpair_lq = '#dbc6ad'
const qual2ctxpair = interpolateRgb(ctxpair_lq, ctxpair_hq)
// mismatch: soft red for background only without printed nt, strong red for printing nt on gray background
const mismatchbg_hq = '#d13232'
const mismatchbg_lq = '#ffdbdd'
const qual2mismatchbg = interpolateRgb(mismatchbg_lq, mismatchbg_hq)
// softclip: soft blue for background only, strong blue for printing nt
const softclipbg_hq = '#4888bf'
const softclipbg_lq = '#c9e6ff'
const qual2softclipbg = interpolateRgb(softclipbg_lq, softclipbg_hq)
// insertion, text color gradient to correlate with the quality
const insertion_hq = '#47FFFC' //'#00FFFB'
const insertion_lq = '#B2D7D7' //'#009290'
const qual2insertion = interpolateRgb(insertion_lq, insertion_hq)
const insertion_maxfontsize = 12
const insertion_minfontsize = 7

const deletion_linecolor = 'red'
const split_linecolorfaint = '#ededed' // if thin stack (hardcoded cutoff 2), otherwise use match_hq
const overlapreadhlcolor = 'blue'

const insertion_minpx = 1 // minimum px width to display an insertion
const minntwidth_toqual = 1 // minimum nt px width to show base quality
const minntwidth_overlapRPmultirows = 0.4 // minimum nt px width to show

const maxqual = 40

// tricky: on retina screen the individual nt boxes appear to have slight gaps in between
// adding this increment to the rendering of each nt box appear to fix the issue
// yet to be tested on a low-res screen
const ntboxwidthincrement = 0.5

// space between reads in the same stack, either 5 bp or 5 px, which ever greater
const readspace_px = 2
const readspace_bp = 5

const maxreadcount = 10000 // maximum number of reads to load
const maxcanvasheight = 1500 // ideal max canvas height in pixels

const serverconfig = __non_webpack_require__('./serverconfig.json')
const samtools = serverconfig.samtools || 'samtools'

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (req.query.getread) {
				res.send(await route_getread(genome, req))
				return
			}
			const q = await get_q(genome, req)
			res.send(await do_query(q))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function get_q(genome, req) {
	const [e, _file, isurl] = app.fileurl(req)
	if (e) throw e
	// a query object to collect all the bits
	const q = {
		genome,
		file: _file, // may change if is url
		//collapse_density: false,
		asPaired: req.query.asPaired,
		getcolorscale: req.query.getcolorscale,
		numofreads: 0,
		messagerows: []
	}
	if (isurl) {
		q.dir = await app.cache_index_promise(req.query.indexURL || _file + '.bai')
	}

	if (req.query.stackstart) {
		q.partstack = {
			start: Number(req.query.stackstart),
			stop: Number(req.query.stackstop)
		}
	}

	if (req.query.nochr) {
		q.nochr = JSON.parse(req.query.nochr) // parse "true" into json true
	} else {
		// info not provided
		q.nochr = await app.bam_ifnochr(q.file, genome, q.dir)
	}
	if (!req.query.regions) throw '.regions[] missing'
	q.regions = JSON.parse(req.query.regions)

	let maxntwidth = 0
	for (const r of q.regions) {
		r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
		r.ntwidth = r.width / (r.stop - r.start)
		maxntwidth = Math.max(maxntwidth, r.ntwidth)
	}

	// max ntwidth determines segment spacing in a stack, across all regions
	q.stacksegspacing = Math.max(readspace_px, readspace_bp * maxntwidth)

	return q
}

async function do_query(q) {
	for (const r of q.regions) {
		await query_region(r, q)
	}

	q.totalnumreads = q.regions.reduce((i, j) => i + j.lines.length, 0)

	const result = {
		nochr: q.nochr,
		count: {
			r: q.totalnumreads
		}
	}
	if (result.count.r == 0) {
		q.messagerows.push({
			h: 30,
			t: 'No reads in view range.'
		})
	}

	get_templates(q) // q.templates

	stack_templates(q)
	await poststack_adjustq(q)

	finalize_templates(q) // set q.canvasheight

	const canvaswidth = q.regions[q.regions.length - 1].x + q.regions[q.regions.length - 1].width
	const canvas = createCanvas(canvaswidth, q.canvasheight)
	const ctx = canvas.getContext('2d')
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'

	result.messagerowheights = plot_messagerows(ctx, q, canvaswidth)

	for (const template of q.templates) {
		plot_template(ctx, template, q)
	}
	plot_insertions(ctx, q)

	if (q.asPaired) result.count.t = q.templates.length
	result.src = canvas.toDataURL()
	result.width = canvaswidth
	result.height = q.canvasheight
	result.stackheight = q.stackheight
	result.stackcount = q.stacks.length
	if (q.returntemplatebox) result.templatebox = q.returntemplatebox
	if (q.allowpartstack) result.allowpartstack = q.allowpartstack
	if (q.getcolorscale) result.colorscale = getcolorscale()
	return result
}

function query_region(r, q) {
	// for each region, query its data
	// if too many reads, collapse to coverage
	if (!r.chr) throw '.chr missing'
	if (!Number.isInteger(r.start)) throw '.start not integer'
	if (!Number.isInteger(r.stop)) throw '.stop not integer'
	r.lines = []
	return new Promise((resolve, reject) => {
		const ps = spawn(
			samtools,
			['view', q.file, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
			{ cwd: q.dir }
		)
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			r.lines.push(line)
			q.numofreads++
			if (q.numofreads == maxreadcount) {
				ps.kill()
				q.messagerows.push({
					h: 13,
					t: 'Too many reads in view range. Try zooming into a smaller region.'
				})
			}
		})
		rl.on('close', () => {
			resolve()
		})
	})
}

function get_templates(q) {
	// parse reads from all regions
	// returns an array of templates, no matter if paired or not
	if (!q.asPaired) {
		// pretends single reads as templates
		const lst = []
		// to account for reads spanning between multiple regions, may use qname2read = new Map()
		for (let i = 0; i < q.regions.length; i++) {
			const r = q.regions[i]
			for (const line of r.lines) {
				const segment = parse_one_segment(line, r, i)
				if (!segment) continue
				lst.push({
					x1: segment.x1,
					x2: segment.x2,
					segments: [segment]
					//ridx2: i, // r idx of stop
				})
			}
		}
		q.templates = lst
		return
	}
	// paired segments are joined together; a template with segments possibly from multiple regions
	const qname2template = new Map()
	// key: qname
	// value: template, a list of segments
	for (let i = 0; i < q.regions.length; i++) {
		const r = q.regions[i]
		for (const line of r.lines) {
			const segment = parse_one_segment(line, r, i)
			if (!segment || !segment.qname) continue
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.x2 = Math.max(temp.x2, segment.x2)
				//temp.ridx2 = i
			} else {
				qname2template.set(segment.qname, {
					x1: segment.x1,
					x2: segment.x2,
					segments: [segment]
					//ridx2: i,
				})
			}
		}
	}
	q.templates = [...qname2template.values()]
	return
}

function parse_one_segment(line, r, ridx, keepallboxes) {
	/*
do not do:
  parse seq
  parse qual
  assign seq & qual to each box
  checking mismatch

only gather boxes in view range, with sequence start (cidx) for finalizing later

may skip insertion if on screen width shorter than minimum width
*/
	const l = line.trim().split('\t')
	if (l.length < 11) {
		// truncated line possible if the reading process is killed
		return
	}
	const qname = l[0],
		flag = l[2 - 1],
		segstart_1based = Number.parseInt(l[4 - 1]),
		cigarstr = l[6 - 1],
		// use rnext to tell if mate is on a different chr
		rnext = l[7 - 1],
		pnext = l[8 - 1],
		tlen = Number.parseInt(l[9 - 1]),
		seq = l[10 - 1],
		qual = l[11 - 1]

	if (flag & 0x4) {
		//console.log('unmapped')
		return
	}
	if (Number.isNaN(segstart_1based) || segstart_1based <= 0) {
		// invalid
		return
	}
	const segstart = segstart_1based - 1

	if (cigarstr == '*') {
		return
	}

	const boxes = [] // collect plottable segments
	// as the absolute coord start of each box, will be incremented after parsing a box
	let pos = segstart
	// prev/cum are sequence/qual character offset
	let prev = 0,
		cum = 0

	for (let i = 0; i < cigarstr.length; i++) {
		const cigar = cigarstr[i]
		if (cigar.match(/[0-9]/)) continue
		if (cigar == 'H') {
			// ignore
			continue
		}
		// read bp length of this part
		const len = Number.parseInt(cigarstr.substring(prev, i))
		if (cigar == 'N') {
			// no seq
		} else if (cigar == 'P' || cigar == 'D') {
			// padding or del, no sequence in read
		} else {
			// will consume read seq
			cum += len
		}
		prev = i + 1
		if (cigar == '=' || cigar == 'M') {
			if (keepallboxes || Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
				// visible
				boxes.push({
					opr: cigar,
					start: pos,
					len,
					cidx: cum - len
				})
				// need cidx for = / M, for quality and sequence mismatch
			}
			pos += len
			continue
		}
		if (cigar == 'I') {
			if (keepallboxes || (pos > r.start && pos < r.stop)) {
				if (len * r.ntwidth >= insertion_minpx) {
					boxes.push({
						opr: 'I',
						start: pos,
						len,
						cidx: cum - len
					})
				}
			}
			continue
		}
		if (cigar == 'N' || cigar == 'D') {
			// deletion or skipped region, must have at least one end within region
			// cannot use max(starts)<min(stops)
			// if both ends are outside of region e.g. intron-spanning rna read, will not include
			if ((pos >= r.start && pos <= r.stop) || (pos + len - 1 >= r.start && pos + len - 1 <= r.stop)) {
				boxes.push({
					opr: cigar,
					start: pos,
					len
				})
				// no box seq, don't add cidx
			}
			pos += len
			continue
		}
		if (cigar == 'X') {
			if (keepallboxes || Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
				const b = {
					opr: cigar,
					start: pos,
					len,
					cidx: cum - len
				}
				boxes.push(b)
			}
			pos += len
			continue
		}
		if (cigar == 'S') {
			const b = {
				opr: cigar,
				start: pos,
				len,
				cidx: cum - len
			}
			if (boxes.length == 0) {
				// this is the first box, will not consume ref
				// shift softclip start to left, so its end will be pos, will not increment pos
				b.start -= len
				if (keepallboxes || Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push(b)
				}
			} else {
				// not the first box, so should be the last box
				// do not shift start
				boxes.push(b)
			}
			continue
		}
		if (cigar == 'P') {
			if (keepallboxes || (pos > r.start && pos < r.stop)) {
				const b = {
					opr: 'P',
					start: pos,
					len,
					cidx: cum - len
				}
				boxes.push(b)
			}
			continue
		}
		console.log('unknown cigar: ' + cigar)
	}
	if (boxes.length == 0) {
		// no visible boxes, do not show this segment
		return
	}
	const segment = {
		qname,
		boxes,
		forward: !(flag & 0x10),
		ridx,
		x1: r.x + r.scale(boxes[0].start),
		x2: r.x + r.scale(segmentstop(boxes)), // x stop position, for drawing connect line
		seq,
		qual,
		cigarstr,
		tlen,
		flag
	}
	if (flag & 0x40) {
		segment.isfirst = true
	} else if (flag & 0x80) {
		segment.islast = true
	}
	if (rnext != '=' && rnext != '*' && rnext != r.chr) {
		segment.rnext = rnext
		segment.pnext = pnext
	}
	return segment
}

async function poststack_adjustq(q) {
	/*
call after stacking
control canvas height based on number of reads and stacks
set rendering parameters in q{}
based on stack height, to know if to render base quality and print letters
return number of stacks for setting canvas height

super high number of stacks will result in fractional row height and blurry rendering, no way to fix it now
*/
	const [a, b] = getstacksizebystacks(q.stacks.length)
	q.stackheight = a
	q.stackspace = b
	for (const r of q.regions) {
		// based on resolution, decide if to do following
		if (r.ntwidth >= 0.9) {
			r.to_checkmismatch = true
			r.referenceseq = await get_refseq(q.genome, r.chr + ':' + (r.start + 1) + '-' + r.stop)
		}
		r.to_printnt = q.stackheight > 7 && r.ntwidth >= 7
		r.to_qual = r.ntwidth >= minntwidth_toqual
	}
	if (q.stacks.length) {
		// has reads/templates for rendering, support below
		if (q.stackheight >= 7 && q.totalnumreads < 3000) {
			q.returntemplatebox = []
		} else {
			if (!q.partstack) {
				q.allowpartstack = true // to inform client
			}
		}
	}
}

function getstacksizebystacks(numofstacks) {
	/* with hardcoded cutoffs
	 */
	let a = maxcanvasheight / numofstacks
	if (a > 10) return [Math.min(15, Math.floor(a)), 1]
	if (a > 7) return [Math.floor(a), 1]
	if (a > 3) return [Math.ceil(a), 0]
	if (a > 1) return [Math.floor(a), 0]
	console.log('small stack', a)
	return [a, 0]
}

function stack_templates(q) {
	// stack by on screen x1 x2 position of each template, only set stack idx to each template
	// actual y position will be set later after stackheight is determined
	// adds q.stacks[]
	// stacking code not reusable for the special spacing calculation
	q.templates.sort((i, j) => i.x1 - j.x1)
	q.stacks = [] // each value is screen pixel pos of each stack
	for (const template of q.templates) {
		let stackidx = null
		for (let i = 0; i < q.stacks.length; i++) {
			if (q.stacks[i] + q.stacksegspacing < template.x1) {
				stackidx = i
				q.stacks[i] = template.x2
				break
			}
		}
		if (stackidx == null) {
			stackidx = q.stacks.length
			q.stacks[stackidx] = template.x2
		}
		template.y = stackidx
	}
	may_trimstacks(q)
}

function may_trimstacks(q) {
	if (!q.partstack) return
	// should be a positive integer
	const lst = q.templates.filter(i => i.y >= q.partstack.start && i.y <= q.partstack.stop)
	lst.forEach(i => (i.y -= q.partstack.start))
	q.templates = lst
	q.stacks = []
	for (let i = q.partstack.start; i <= q.partstack.stop; i++) {
		q.stacks.push(0)
	}
	q.returntemplatebox = [] // always set this
}

async function get_refseq(g, coord) {
	const tmp = await utils.get_fasta(g, coord)
	const l = tmp.split('\n')
	l.shift()
	return l.join('').toUpperCase()
}

function finalize_templates(q) {
	/*
for each template:

for each box:
  the box alreay has raw strings for .seq and .qual
  may do below:
	add sequence
	add quality
	check mismatch

at the end, set q.canvasheight
*/

	const stacky = get_stacky(q)

	for (const template of q.templates) {
		template.y = stacky[template.y]

		for (const segment of template.segments) {
			const r = q.regions[segment.ridx]
			const quallst = r.to_qual ? qual2int(segment.qual) : null
			const mismatches = []
			for (const b of segment.boxes) {
				if (b.cidx == undefined) {
					continue
				}
				if (quallst) {
					b.qual = quallst.slice(b.cidx, b.cidx + b.len)
				}
				if (b.opr == 'M') {
					if (r.to_checkmismatch) {
						b.s = segment.seq.substr(b.cidx, b.len)
						check_mismatch(mismatches, r, b)
					}
				} else if (b.opr == 'I') {
					// insertion has been decided to be visible so always get seq
					b.s = segment.seq.substr(b.cidx, b.len)
				} else if (b.opr == 'X' || b.opr == 'S') {
					if (r.to_printnt) {
						b.s = segment.seq.substr(b.cidx, b.len)
					}
				}
				delete b.cidx
			}
			if (mismatches.length) segment.boxes.push(...mismatches)
			delete segment.seq
			delete segment.qual
		}
	}

	if (stacky.length == 0) {
		// no reads, must use sum of message row height as canvas height
		q.canvasheight = q.messagerows.reduce((i, j) => i + j.h, 0)
	} else {
		// has reads, and nessage row heights are already counted in y position of each stack
		q.canvasheight = stacky[stacky.length - 1]
	}
}

function qual2int(s) {
	if (s == '*') return null
	const lst = []
	for (let i = 0; i < s.length; i++) {
		const v = s[i].charCodeAt(0) - 33
		lst.push(v)
	}
	return lst
}

function plot_messagerows(ctx, q, canvaswidth) {
	let y = 0
	for (const row of q.messagerows) {
		ctx.font = Math.min(12, row.h - 2) + 'pt Arial'
		//ctx.fillStyle = '#f1f1f1'
		//ctx.fillRect(0,y,canvaswidth,row.h)
		ctx.fillStyle = 'black'
		ctx.fillText(row.t, canvaswidth / 2, y + row.h / 2)
		y += row.h
	}
	return y
}

function get_stacky(q) {
	// get y off for each stack, may account for fat rows created by overlapping read pairs
	const stackrowheight = []
	for (let i = 0; i < q.stacks.length; i++) stackrowheight.push(q.stackheight)
	overlapRP_setflag(q)
	if (q.overlapRP_multirows) {
		// expand row height for stacks with overlapping read pairs
		for (const template of q.templates) {
			if (template.segments.length <= 1) continue
			template.height = getrowheight_template_overlapread(template, q.stackheight)
			stackrowheight[template.y] = Math.max(stackrowheight[template.y], template.height)
		}
	}
	const stacky = []
	let y = q.messagerows.reduce((i, j) => i + j.h, 0) + q.stackspace
	stackrowheight.forEach(h => {
		stacky.push(y)
		y += h + q.stackspace
	})
	return stacky
}

function overlapRP_setflag(q) {
	if (!q.asPaired) return
	for (const r of q.regions) {
		if (r.ntwidth <= minntwidth_overlapRPmultirows) return
	}
	q.overlapRP_multirows = true
	q.overlapRP_hlline = q.stackspace > 0
}

function getrowheight_template_overlapread(template, stackheight) {
	// if to show overlapped read pairs, detect if this template has overlap, if so, double the row height
	if (template.segments.length == 2) {
		const [a, b] = template.segments
		if (a.x2 > b.x1) {
			b.shiftdownrow = 1 // shift down by 1 row
			return stackheight * 2
		}
		return stackheight
	}
	// more than 2 segments, do a mini stack to, may not happen??
	console.log('more than 2 segments', template.segments.length)
	const stacks = []
	for (const b of template.segments) {
		let stackidx = null
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] < b.x1) {
				stackidx = i
				stacks[i] = b.x2
				break
			}
		}
		if (stackidx == null) {
			stackidx = stacks.length
			stacks[stackidx] = b.x2
		}
		b.shiftdownrow = stackidx
	}
	return stackheight * stacks.length
}

function segmentstop(boxes) {
	return Math.max(...boxes.map(i => i.start + i.len))
}

function check_mismatch(lst, r, box) {
	for (let i = 0; i < box.s.length; i++) {
		if (box.start + i < r.start || box.start + i > r.stop) {
			// to skip bases beyond view range
			continue
		}
		const readnt = box.s[i]
		const refnt = r.referenceseq[box.start + i - r.start]
		if (refnt != readnt.toUpperCase()) {
			const b = {
				opr: 'X', // mismatch
				start: box.start + i,
				len: 1,
				s: readnt
			}
			if (box.qual) b.qual = [box.qual[i]]
			lst.push(b)
		}
	}
}

function plot_template(ctx, template, q) {
	if (q.returntemplatebox) {
		// one box per template
		const box = {
			qname: template.segments[0].qname,
			x1: template.x1,
			x2: template.x2,
			y1: template.y,
			y2: template.y + (template.height || q.stackheight)
		}
		if (!q.asPaired) {
			// single reads are in multiple "templates", tell if its first/last to identify
			if (template.segments[0].isfirst) box.isfirst = true
			if (template.segments[0].islast) box.islast = true
		}
		q.returntemplatebox.push(box)
	}
	for (let i = 0; i < template.segments.length; i++) {
		const seg = template.segments[i]
		if (i == 0) {
			// is the first segment, same rendering method no matter in single or paired mode
			plot_segment(ctx, seg, template.y, q)
			continue
		}
		// after the first segment, this only occurs in paired mode
		const prevseg = template.segments[i - 1]
		if (prevseg.x2 <= seg.x1) {
			// two segments are apart; render this segment the same way, draw dashed line connecting with last
			plot_segment(ctx, seg, template.y, q)
			const y = Math.floor(template.y + q.stackheight / 2) + 0.5
			ctx.strokeStyle = q.stackheight <= 2 ? split_linecolorfaint : match_hq
			ctx.setLineDash([5, 3]) // dash for read pairs
			ctx.beginPath()
			ctx.moveTo(prevseg.x2, y)
			ctx.lineTo(seg.x1, y)
			ctx.stroke()

			if (q.overlapRP_hlline) {
				// highlight line is showing, this is at zoom in level
				// detect if two segments are next to each other, by coord but not x1/2
				// as at zoom out level, pixel position is imprecise
				const prevlastbox = prevseg.boxes.reduce((i, j) => {
					if (i.start + i.len > j.start + j.len) return i
					return j
				})
				if (prevlastbox.start + prevlastbox.len == seg.boxes[0].start) {
					ctx.strokeStyle = overlapreadhlcolor
					ctx.setLineDash([])
					ctx.beginPath()
					const x = Math.floor(seg.x1) + 0.5
					ctx.moveTo(x, template.y)
					ctx.lineTo(x, template.y + q.stackheight)
					ctx.stroke()
				}
			}
		} else {
			// overlaps with the previous segment
			if (q.overlapRP_multirows) {
				plot_segment(ctx, seg, template.y + q.stackheight, q)
				if (q.overlapRP_hlline) {
					const y = Math.floor(template.y + q.stackheight) + 0.5
					ctx.strokeStyle = overlapreadhlcolor
					ctx.setLineDash([])
					ctx.beginPath()
					ctx.moveTo(seg.x1, y)
					ctx.lineTo(prevseg.x2, y)
					ctx.stroke()
				}
			} else {
				plot_segment(ctx, seg, template.y, q)
			}
		}
	}
}

function plot_segment(ctx, segment, y, q) {
	const r = q.regions[segment.ridx] // this region where the segment falls into
	// what if segment spans multiple regions
	// a box is always within a region, so get r at box level

	if (r.to_printnt) {
		ctx.font = Math.min(r.ntwidth, q.stackheight - 2) + 'pt Arial'
	}

	segment.boxes.forEach(b => {
		const x = r.x + r.scale(b.start)
		if (b.opr == 'P') return // do not handle
		if (b.opr == 'I') return // do it next round
		if (b.opr == 'D' || b.opr == 'N') {
			// a line
			if (b.opr == 'D') {
				ctx.strokeStyle = deletion_linecolor
			} else {
				ctx.strokeStyle = q.stackheight <= 2 ? split_linecolorfaint : match_hq
			}
			ctx.setLineDash([]) // use solid lines
			const y2 = Math.floor(y + q.stackheight / 2) + 0.5
			ctx.beginPath()
			ctx.moveTo(x, y2)
			ctx.lineTo(x + b.len * r.ntwidth, y2)
			ctx.stroke()
			return
		}

		if (b.opr == 'X' || b.opr == 'S') {
			// box with maybe letters
			if (r.to_qual && b.qual) {
				// to show quality and indeed there is quality
				let xoff = x
				for (let i = 0; i < b.qual.length; i++) {
					const v = b.qual[i] / maxqual
					ctx.fillStyle = b.opr == 'S' ? qual2softclipbg(v) : qual2mismatchbg(v)
					ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, q.stackheight)
					if (r.to_printnt) {
						ctx.fillStyle = 'white'
						ctx.fillText(b.s[i], xoff + r.ntwidth / 2, y + q.stackheight / 2)
					}
					xoff += r.ntwidth
				}
			} else {
				// not using quality or there ain't such data
				ctx.fillStyle = b.opr == 'S' ? softclipbg_hq : mismatchbg_hq
				ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, q.stackheight)
			}
			return
		}
		if (b.opr == 'M' || b.opr == '=') {
			// box
			if (r.to_qual) {
				let xoff = x
				b.qual.forEach(v => {
					ctx.fillStyle = (segment.rnext ? qual2ctxpair : qual2match)(v / maxqual)
					ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, q.stackheight)
					xoff += r.ntwidth
				})
			} else {
				// not showing qual, one box
				ctx.fillStyle = segment.rnext ? ctxpair_hq : match_hq
				ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, q.stackheight)
			}
			if (r.to_printnt) {
				ctx.fillStyle = 'white'
				for (let i = 0; i < b.s.length; i++) {
					ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + q.stackheight / 2)
				}
			}
			return
		}
		throw 'unknown opr at rendering: ' + b.opr
	})

	if (segment.rnext) {
		if (!r.to_qual) {
			// no quality and just a solid box, may print name
			if (segment.x2 - segment.x1 >= 20 && q.stackheight >= 7) {
				ctx.font = Math.min(insertion_maxfontsize, Math.max(insertion_minfontsize, q.stackheight - 4)) + 'pt Arial'
				ctx.fillStyle = 'white'
				ctx.fillText(
					(q.nochr ? 'chr' : '') + segment.rnext,
					(segment.x1 + segment.x2) / 2,
					y + q.stackheight / 2,
					segment.x2 - segment.x1
				)
			}
		}
	}
}

function plot_insertions(ctx, q) {
	/*
after all template boxes are drawn, mark out insertions on top of that by cyan text labels
if single basepair, use the nt; else, use # of nt
if b.qual is available, set text color based on it
*/
	for (const template of q.templates) {
		for (const segment of template.segments) {
			const r = q.regions[segment.ridx]
			const insertions = segment.boxes.filter(i => i.opr == 'I')
			if (!insertions.length) continue
			ctx.font = Math.max(insertion_maxfontsize, q.stackheight - 2) + 'pt Arial'
			insertions.forEach(b => {
				const x = r.x + r.scale(b.start)
				if (b.qual) {
					ctx.fillStyle = qual2insertion(b.qual.reduce((i, j) => i + j, 0) / b.qual.length / maxqual)
				} else {
					ctx.fillStyle = insertion_hq
				}
				const text = b.s.length == 1 ? b.s : b.s.length
				// text y position to observe if the read is in an overlapping pair and shifted down
				ctx.fillText(text, x, template.y + q.stackheight * (segment.on2ndrow || 0) + q.stackheight / 2)
			})
		}
	}
}

function getcolorscale() {
	/*
           base quality
           40  30  20  10  0
           |   |   |   |   |
Match      BBBBBBBBBBBBBBBBB
Mismatch   BBBBBBBBBBBBBBBBB
Softclip   BBBBBBBBBBBBBBBBB
Insertion  BBBBBBBBBBBBBBBBB
*/
	const barwidth = 160,
		barheight = 20,
		barspace = 1,
		fontsize = 12,
		labyspace = 5,
		leftpad = 100,
		rightpad = 10,
		ticksize = 4

	const canvas = createCanvas(
		leftpad + barwidth + rightpad,
		fontsize * 2 + labyspace + ticksize + (barheight + barspace) * 4
	)
	const ctx = canvas.getContext('2d')

	ctx.fillStyle = 'black'
	ctx.font = fontsize + 'pt Arial'
	ctx.textAlign = 'center'
	ctx.fillText('Base quality', leftpad + barwidth / 2, fontsize)

	let y = fontsize * 2 + labyspace

	ctx.strokeStyle = 'black'
	ctx.beginPath()
	ctx.moveTo(leftpad, y)
	ctx.lineTo(leftpad, y + ticksize)
	ctx.moveTo(leftpad + barwidth / 4, y)
	ctx.lineTo(leftpad + barwidth / 4, y + ticksize)
	ctx.moveTo(leftpad + barwidth / 2, y)
	ctx.lineTo(leftpad + barwidth / 2, y + ticksize)
	ctx.moveTo(leftpad + (barwidth * 3) / 4, y)
	ctx.lineTo(leftpad + (barwidth * 3) / 4, y + ticksize)
	ctx.moveTo(leftpad + barwidth, y)
	ctx.lineTo(leftpad + barwidth, y + ticksize)
	ctx.closePath()
	ctx.stroke()

	ctx.fillText(40, leftpad, y)
	ctx.fillText(30, leftpad + barwidth / 4, y)
	ctx.fillText(20, leftpad + barwidth / 2, y)
	ctx.fillText(10, leftpad + (barwidth * 3) / 4, y)
	ctx.fillText(0, leftpad + barwidth, y)

	ctx.textAlign = 'left'
	ctx.textBaseline = 'middle'

	y += ticksize

	ctx.fillText('Match', 0, y + barheight / 2)
	fillgradient(match_lq, match_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Mismatch', 0, y + barheight / 2)
	fillgradient(mismatchbg_lq, mismatchbg_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Softclip', 0, y + barheight / 2)
	fillgradient(softclipbg_lq, softclipbg_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Insertion', 0, y + barheight / 2)
	fillgradient(insertion_lq, insertion_hq, y)

	function fillgradient(lowq, highq, y) {
		const x = leftpad
		const gradient = ctx.createLinearGradient(x, y, x + barwidth, y)
		gradient.addColorStop(0, highq)
		gradient.addColorStop(1, lowq)
		ctx.fillStyle = gradient
		ctx.fillRect(x, y, barwidth, barheight)
	}

	return canvas.toDataURL()
}

////////////////////// get one read/template

async function route_getread(genome, req) {
	// cannot use the point position under cursor to query, as if clicking on softclip
	if (!req.query.chr) throw '.chr missing'
	if (!req.query.qname) throw '.qname missing'
	req.query.qname = decodeURIComponent(req.query.qname) // convert %2B to +
	//if(!req.query.pos) throw '.pos missing'
	if (!req.query.viewstart) throw '.viewstart missing'
	if (!req.query.viewstop) throw '.viewstart missing'
	const r = {
		chr: req.query.chr,
		start: Number(req.query.viewstart),
		stop: Number(req.query.viewstop),
		scale: () => {}, // dummy
		ntwidth: 10 // good to show all insertions
	}
	if (!Number.isInteger(r.start)) throw '.viewstart not integer'
	if (!Number.isInteger(r.stop)) throw '.viewstop not integer'
	//r.referenceseq = await get_refseq(genome, req.query.chr + ':' + (r.start + 1) + '-' + r.stop)
	const seglst = await query_oneread(req, r)
	if (!seglst) throw 'read not found'
	const lst = []
	for (const s of seglst) {
		lst.push(await convertread(s, genome, req.query))
	}
	return { html: lst.join('') }
}

async function query_oneread(req, r) {
	const [e, _file, isurl] = app.fileurl(req)
	if (e) throw e
	let dir
	if (isurl) {
		dir = await app.cache_index_promise(req.query.indexURL || _file + '.bai')
	}
	//const pos = Number(req.query.pos)
	//if (!Number.isInteger(pos)) throw '.pos not integer'
	let firstseg, lastseg
	return new Promise((resolve, reject) => {
		const ps = spawn(
			samtools,
			[
				'view',
				_file,
				(req.query.nochr ? req.query.chr.replace('chr', '') : req.query.chr) + ':' + r.start + '-' + r.stop
			],
			{ cwd: dir }
		)
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			const s = parse_one_segment(line, r, null, true)
			if (!s) return
			if (s.qname != req.query.qname) return
			if (req.query.getfirst) {
				if (s.isfirst) {
					ps.kill()
					resolve([s])
					return
				}
			} else if (req.query.getlast) {
				if (s.islast) {
					ps.kill()
					resolve([s])
					return
				}
			} else {
				// get both
				if (s.isfirst) firstseg = s
				else if (s.islast) lastseg = s
				if (firstseg && lastseg) {
					ps.kill()
					resolve([firstseg, lastseg])
					return
				}
			}
		})
		rl.on('close', () => {
			// finished reading and still not resolved
			// means it is in paired mode but read is single
			const lst = []
			if (firstseg) lst.push(firstseg)
			if (lastseg) lst.push(lastseg)
			resolve(lst.length ? lst : null)
		})
	})
}
async function convertread(seg, genome, query) {
	// convert a read to html
	const refstart = seg.boxes[0].start // 0 based
	const b = seg.boxes[seg.boxes.length - 1]
	const refstop = b.start + b.len
	const refseq = await get_refseq(genome, query.chr + ':' + (refstart + 1) + '-' + refstop)
	const quallst = qual2int(seg.qual)
	const reflst = ['<td>Reference</td>']
	const querylst = ['<td style="color:black;text-align:left">Read</td>']
	for (const b of seg.boxes) {
		if (b.opr == 'I') {
			for (let i = b.cidx; i < b.cidx + b.len; i++) {
				reflst.push('<td>-</td>')
				querylst.push(
					'<td style="color:' +
						insertion_hq +
						';background:' +
						qual2match(quallst[i] / maxqual) +
						'">' +
						seg.seq[i] +
						'</td>'
				)
			}
			continue
		}
		if (b.opr == 'D' || b.opr == 'N') {
			if (b.len >= 20) {
				reflst.push('<td style="font-size:.8em;opacity:.5;white-space:nowrap">' + b.len + ' bp</td>')
				querylst.push('<td style="color:black;white-space:nowrap">-----------</td>')
			} else {
				for (let i = 0; i < b.len; i++) {
					reflst.push('<td>' + refseq[b.start - refstart + i] + '</td>')
					querylst.push('<td style="color:black">-</td>')
				}
			}
			continue
		}
		if (b.opr == 'S') {
			for (let i = 0; i < b.len; i++) {
				reflst.push('<td>' + refseq[b.start - refstart + i] + '</td>')
				querylst.push(
					'<td style="background:' +
						qual2softclipbg(quallst[b.cidx + i] / maxqual) +
						'">' +
						seg.seq[b.cidx + i] +
						'</td>'
				)
			}
			continue
		}
		if (b.opr == 'M' || b.opr == '=' || b.opr == 'X') {
			for (let i = 0; i < b.len; i++) {
				const nt0 = refseq[b.start - refstart + i]
				const nt1 = seg.seq[b.cidx + i]
				reflst.push('<td>' + nt0 + '</td>')
				querylst.push(
					'<td style="background:' +
						(nt0.toUpperCase() == nt1.toUpperCase() ? qual2match : qual2mismatchbg)(quallst[b.cidx + i] / maxqual) +
						'">' +
						seg.seq[b.cidx + i] +
						'</td>'
				)
			}
			continue
		}
	}
	const lst = []
	if (seg.rnext)
		lst.push(
			'<li>Next segment on <span style="background:' +
				ctxpair_hq +
				'">' +
				(query.nochr ? 'chr' : '') +
				seg.rnext +
				', ' +
				seg.pnext +
				'</span></li>'
		)
	if (seg.flag & 0x1) lst.push('<li>Template has multiple segments</li>')
	if (seg.flag & 0x2) lst.push('<li>Each segment properly aligned</li>')
	if (seg.flag & 0x4) lst.push('<li>Segment unmapped</li>')
	if (seg.flag & 0x8) lst.push('<li>Next segment in the template unmapped</li>')
	if (seg.flag & 0x10) lst.push('<li>Reverse complemented</li>')
	if (seg.flag & 0x20) lst.push('<li>Next segment in the template is reverse complemented</li>')
	if (seg.flag & 0x40) lst.push('<li>This is the first segment in the template</li>')
	if (seg.flag & 0x80) lst.push('<li>This is the last segment in the template</li>')
	if (seg.flag & 0x100) lst.push('<li>Secondary alignment</li>')
	if (seg.flag & 0x200) lst.push('<li>Not passing filters</li>')
	if (seg.flag & 0x400) lst.push('<li>PCR or optical duplicate</li>')
	if (seg.flag & 0x800) lst.push('<li>Supplementary alignment</li>')
	return `
<div style='margin:20px'>
	<table style="border-spacing:0px;border-collapse:separate;text-align:center">
	  <tr style="opacity:.6">${reflst.join('')}</tr>
	  <tr style="color:white">${querylst.join('')}</tr>
	</table>
  <div style='margin-top:10px'>
    <span style="opacity:.5;font-size:.7em">START</span>: ${refstart + 1},
    <span style="opacity:.5;font-size:.7em">STOP</span>: ${refstop},
    <span style="opacity:.5;font-size:.7em">THIS READ</span>: ${refstop - refstart} bp,
    <span style="opacity:.5;font-size:.7em">TEMPLATE</span>: ${seg.tlen} bp,
    <span style="opacity:.5;font-size:.7em">CIGAR</span>: ${seg.cigarstr}
    <span style="opacity:.5;font-size:.7em">NAME: ${seg.qname}</span>
  </div>
  <ul style='padding-left:15px'>${lst.join('')}</ul>
</div>`
}
