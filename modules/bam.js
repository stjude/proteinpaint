const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const spawn = require('child_process').spawn
const readline = require('readline')
//const basecolor = require('../src/common.js').basecolor

/*
TODO
draw line between segments
if ntwidth>4:
	print mismatching nt
	show base quality

no region size restriction
render no more than 5k reads; while collecting, if exceeds 5k, terminate spawn;
then show an alert row on top

template {}
  .start
  .stop
  .segments[]

segment {}
  .qname
  .boxes[]
  .forward
  .ridx
  .x2  // screen px

box {}
  .opr
  .start // absolute bp
  .len   // #bp
  .s (read sequence)
*/
const fcolor = 'rgb(88,88,88)'
const color_i = 88
const mismatchbg = 'rgb(223,92,97)' // for only filling mismatch box without quality and nt
const softclipbg = 'rgb(198,153,114)' // for only filling softclip box without quality and nt
const mismatchtextcolor = 'rgb(255,29,17)' // for text color of mismatching nt but with graying background

const serverconfig = __non_webpack_require__('./serverconfig.json')
const samtools = serverconfig.samtools || 'samtools'

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			const q = await get_q(genome, req)
			const result = await do_query(q)
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(q) {
	for (const r of q.regions) {
		await query_region(r, q)
	}

	const templates = parse_all_reads(q.regions)
	console.log(q.regions.reduce((i, j) => i + j.lines.length, 0), 'reads', templates.length, 'templates')

	const stacks = do_stack(q, templates)

	const canvaswidth = q.regions[q.regions.length - 1].x + q.regions[q.regions.length - 1].width
	const canvasheight = stacks.length * (q.stackheight + q.stackspace)
	const canvas = createCanvas(canvaswidth, canvasheight)
	const ctx = canvas.getContext('2d')
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (const template of templates) {
		render_template(ctx, template, q)
	}

	const result = {
		src: canvas.toDataURL(),
		width: canvaswidth,
		height: canvasheight,
		nochr: q.nochr
	}
	return result
}

async function get_q(genome, req) {
	const [e, _file, isurl] = app.fileurl(req)
	if (e) throw e
	// a query object to collect all the bits
	const q = {
		file: _file, // may change if is url
		collapse_density: false,
		query: req.query
	}
	if (isurl) {
		q.dir = await cache_index_promise(req.query.indexURL || _file + '.bai')
	}

	if (!req.query.stackheight) throw '.stackheight missing'
	q.stackheight = Number.parseInt(req.query.stackheight)
	if (Number.isNaN(q.stackheight)) throw '.stackheight not integer'
	if (!req.query.stackspace) throw '.stackspace missing'
	q.stackspace = Number.parseInt(req.query.stackspace)
	if (Number.isNaN(q.stackspace)) throw '.stackspace not integer'

	if (req.query.nochr) {
		q.nochr = JSON.parse(req.query.nochr) // parse "true" into json true
	} else {
		// info not provided, first time loading
		q.nochr = await app.bam_ifnochr(q.file, genome, q.dir)
	}
	if (!req.query.regions) throw '.regions[] missing'
	q.regions = JSON.parse(req.query.regions)
	for (const r of q.regions) {
		r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
		r.ntwidth = r.width / (r.stop - r.start)
		// based on resolution, decide if to do following
		if (r.ntwidth >= 0.5) {
			r.to_checkmismatch = true
			r.referenceseq = await get_refseq(genome, r.chr + ':' + (r.start + 1) + '-' + r.stop)
		}
		r.to_printnt = q.stackheight > 7 && r.ntwidth >= 7
		r.to_qual = r.ntwidth >= 2
	}
	return q
}

function do_stack(q, templates) {
	templates.sort((i, j) => i.start - j.start)
	const stacks = [] // each value is stop coord of each stack
	for (const template of templates) {
		// {start, stop, segments}
		let stackidx = null
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] < template.start) {
				stackidx = i
				stacks[i] = template.stop
				break
			}
		}
		if (stackidx == null) {
			stackidx = stacks.length
			stacks[stackidx] = template.stop
		}
		template.y = stackidx * (q.stackheight + q.stackspace)
	}
	return stacks
}

async function get_refseq(g, coord) {
	const tmp = await utils.get_fasta(g, coord)
	const l = tmp.split('\n')
	l.shift()
	return l.join('').toUpperCase()
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
		})
		rl.on('close', () => {
			resolve()
		})
	})
}

function parse_all_reads(regions) {
	// parse reads from all regions
	// a template with segments possibly from multiple regions
	const qname2template = new Map()
	// key: qname
	// value: template, a list of segments
	for (let i = 0; i < regions.length; i++) {
		const r = regions[i]
		for (const line of r.lines) {
			const segment = parse_one_segment(line, r, [i])
			if (!segment || !segment.qname) continue
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.stop = segmentstop(segment.boxes)
			} else {
				qname2template.set(segment.qname, {
					start: segment.boxes[0].start,
					stop: segmentstop(segment.boxes),
					segments: [segment]
				})
			}
		}
	}
	console.log(qmin, qmax)
	return [...qname2template.values()]
}

let qmin = 0,
	qmax = 0

function parse_one_segment(line, r, ridx) {
	// line
	// r, a region
	// ridx: region array index
	const l = line.split('\t')
	const boxes = []
	const qname = l[0],
		flag = l[2 - 1],
		segstart = Number.parseInt(l[4 - 1]) - 1, // change to 0-based
		cigarstr = l[6 - 1],
		rnext = l[7 - 1],
		pnext = l[8 - 1],
		seq = l[10 - 1],
		qual = l[11 - 1]

	let quallst = []
	if (r.to_qual) {
		// convert bp quality
		for (let i = 0; i < qual.length; i++) {
			const v = qual[i].charCodeAt(0) - 33
			qmin = Math.min(qmin, v)
			qmax = Math.max(qmax, v)
			quallst.push(v)
		}
	}
	let pos = segstart,
		prev = 0, // cigar char offset
		cum = 0 // read seq offset

	for (let i = 0; i < cigarstr.length; i++) {
		const cigar = cigarstr[i]
		if (cigar.match(/[0-9]/)) continue
		if (cigar == 'H') {
			// ignore
			continue
		}
		// read bp length of this part
		const len = Number.parseInt(cigarstr.substring(prev, i))
		// read seq of this part
		let s = ''
		if (cigar == 'N') {
			// no seq
		} else if (cigar == 'P' || cigar == 'D') {
			// padding or del, no sequence in read
			/*
			for (let j = 0; j < len; j++) {
				s += '*'
			}
			*/
		} else {
			s = seq.substr(cum, len)
			cum += len
		}
		prev = i + 1
		switch (cigar) {
			case '=':
			case 'M':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					// visible
					const b = {
						opr: 'M',
						start: pos,
						len
					}
					if (r.to_printnt) b.s = s
					if (r.to_qual) b.qual = quallst.slice(cum - len, cum)
					boxes.push(b)
					if (r.to_checkmismatch) {
						check_mismatch(boxes, r, pos, s, quallst, cum)
					}
				}
				pos += len
				break
			case 'I':
				if (pos > r.start && pos < r.stop) {
					const b = {
						opr: 'I',
						start: pos,
						len,
						s
					}
					if (r.to_qual) b.qual = quallst.slice(cum - len, cum)
					boxes.push(b)
				}
				break
			case 'D':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push({
						opr: 'D',
						start: pos,
						len
					})
				}
				pos += len
				break
			case 'N':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push({
						opr: 'N',
						start: pos,
						len
					})
				}
				pos += len
				break
			case 'X':
			case 'S':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					const b = {
						opr: cigar,
						start: pos,
						len,
						s
					}
					if (r.to_qual) b.qual = quallst.slice(cum - len, cum)
					boxes.push(b)
				}
				pos += len
				break
			case 'P':
				if (pos > r.start && pos < r.stop) {
					const b = {
						opr: 'P',
						start: pos,
						len,
						s
					}
					if (r.to_qual) b.qual = quallst.slice(cum - len, cum)
					boxes.push(b)
				}
				break
			default:
				console.log('unknown cigar: ' + cigar)
		}
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
		x2: r.x + r.scale(segmentstop(boxes)) // x stop position, for drawing connect line
	}
	return segment
}

function segmentstop(boxes) {
	return Math.max(...boxes.map(i => i.start + i.len))
}

function check_mismatch(boxes, r, pos, readseq, quallst, cum) {
	// pos: absolute start position of this read chunck
	// readseq: sequence of this read chunck
	// quallst, cum: for getting quality of mismatching base
	for (let i = 0; i < readseq.length; i++) {
		if (pos + i < r.start || pos + i > r.stop) {
			// to skip bases beyond view range
			continue
		}
		const readnt = readseq[i]
		const refnt = r.referenceseq[pos + i - r.start]
		if (refnt != readnt.toUpperCase()) {
			const b = {
				opr: 'X', // mismatch
				start: pos + i,
				len: 1,
				s: readnt
			}
			if (r.to_qual) b.qual = [quallst[cum]]
			boxes.push(b)
		}
	}
}

function render_template(ctx, template, q) {
	// segments: a list of segments consisting this template, maybe at different regions
	const fontsize = q.stackheight
	//ctx.font = fontsize + 'px arial'
	//ctx.textBaseline = 'middle'
	for (let i = 0; i < template.segments.length; i++) {
		const seg = template.segments[i]
		plot_segment(ctx, seg, template.y, q)
		if (i > 0) {
			// this segment is not the first of the list
			const currentr = q.regions[seg.ridx]
			const currentx = currentr.x + currentr.scale(seg.boxes[0].start)
			const prevseg = template.segments[i - 1]
			if (prevseg.x2 < currentx) {
				const y = Math.floor(template.y + q.stackheight / 2) + 0.5
				ctx.strokeStyle = fcolor
				ctx.beginPath()
				ctx.moveTo(prevseg.x2, y)
				ctx.lineTo(currentx, y)
				ctx.stroke()
			}
		}
	}
}

function plot_segment(ctx, segment, y, q) {
	const r = q.regions[segment.ridx] // this region where the segment falls into
	// what if segment spans multiple regions

	if (r.to_printnt) {
		ctx.font = Math.min(r.ntwidth, q.stackheight - 2) + 'pt Arial'
	}

	segment.boxes.forEach(b => {
		const x = r.x + r.scale(b.start)
		if (b.opr == 'P') {
			return
		}
		if (b.opr == 'I') {
			// insertion, show a round dot
			console.log('insertion')
			return
		}
		if (b.opr == 'N') {
			ctx.strokeStyle = fcolor // may use blue line
			const y2 = Math.floor(y + q.stackheight / 2) + 0.5
			ctx.beginPath()
			ctx.moveTo(x, y2)
			ctx.lineTo(x + b.len * r.ntwidth, y2)
			ctx.stroke()
			return
		}
		if (b.opr == 'X' || b.opr == 'S') {
			if (r.to_printnt) {
				// draw background with basepair quality, print letter on top
				for (let i = 0; i < b.s.length; i++) {
					ctx.fillStyle = qual2bgcolor(b.qual[i])
					ctx.fillRect(x + r.ntwidth * i, y, r.ntwidth, q.stackheight)
					ctx.fillStyle = mismatchtextcolor
					ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + q.stackheight / 2)
				}
			} else {
				ctx.fillStyle = b.opr == 'X' ? mismatchbg : softclipbg
				ctx.fillRect(x, y, b.len * r.ntwidth, q.stackheight)
			}
			return
		}
		// match
		if (r.to_qual) {
			for (let i = 0; i < b.qual.length; i++) {
				ctx.fillStyle = qual2bgcolor(b.qual[i])
				ctx.fillRect(x + i * r.ntwidth, y, r.ntwidth, q.stackheight)
			}
		} else {
			// not showing qual, one box
			ctx.fillStyle = fcolor
			ctx.fillRect(x, y, b.len * r.ntwidth, q.stackheight)
		}
		/*
		if(r.to_printnt) {
			ctx.fillStyle = 'white'
			for(let i=0; i<b.s.length; i++) {
				ctx.fillText(b.s[i], x+r.ntwidth*(i+.5), y+q.stackheight/2)
			}
		}
		*/
	})
}

function qual2bgcolor(v) {
	if (v > 40) console.log('big', v)
	const c = Math.ceil(255 - (255 - color_i) * (v / 40))
	return 'rgb(' + c + ',' + c + ',' + c + ')'
}
