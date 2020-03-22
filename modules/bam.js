const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const spawn = require('child_process').spawn
const readline = require('readline')
const basecolor = require('../src/common.js').basecolor

/*
TODO
draw line between segments
if ntwidth>4:
	print mismatching nt
	show base quality
*/
const fcolor = '#d3d3d3'
const rcolor = '#D7F1D5'

const serverconfig = __non_webpack_require__('./serverconfig.json')
const samtools = serverconfig.samtools || 'samtools'

module.exports = genomes => {
	return async (req, res) => {
		//if(app.reqbodyisinvalidjson(req,res)) return
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (!req.query.regions) throw '.regions[] missing'
			if (!req.query.stackheight) throw '.stackheight missing'
			req.query.stackheight = Number.parseInt(req.query.stackheight)
			if (Number.isNaN(req.query.stackheight)) throw '.stackheight not integer'
			if (req.query.nochr) req.query.nochr = JSON.parse(req.query.nochr)
			const result = await do_query(genome, req)
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(genome, req) {
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

	q.nochr = req.query.nochr
	if (q.nochr == undefined) {
		q.nochr = await app.bam_ifnochr(q.file, genome, q.dir)
	}

	const regions = JSON.parse(req.query.regions)
	for (const r of regions) {
		await query_region(r, q)
		r.referenceseq = await get_refseq(genome, r.chr + ':' + (r.start + 1) + '-' + r.stop)
		r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
		r.ntwidth = r.width / (r.stop - r.start)
	}

	const qname2template = parse_all_reads(regions)
	console.log(regions.reduce((i, j) => i + j.lines.length, 0), 'reads', qname2template.size, 'templates')

	// do stacking
	const templates = [...qname2template.values()].sort((i, j) => i.start - j.start)
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
		template.y = stackidx * q.query.stackheight
	}

	const canvaswidth = regions[regions.length - 1].x + regions[regions.length - 1].width
	const canvasheight = stacks.length * q.query.stackheight
	const canvas = createCanvas(canvaswidth, canvasheight)
	const ctx = canvas.getContext('2d')
	for (const template of qname2template.values()) {
		render_template(ctx, template, q, regions)
	}

	const result = {
		src: canvas.toDataURL(),
		width: canvaswidth,
		height: canvasheight,
		nochr: q.nochr
	}
	return result
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
	// one item for each template (read pair)
	// key: qname
	// value: template, a list of segments
	for (let i = 0; i < regions.length; i++) {
		const r = regions[i]
		for (const line of r.lines) {
			const segment = parse_one_segment(line, r, [i])
			if (!segment || !segment.qname) continue
			const lastbox = segment.boxes[segment.boxes.length - 1]
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.stop = lastbox.start + lastbox.len
			} else {
				qname2template.set(segment.qname, {
					start: segment.boxes[0].start,
					stop: lastbox.start + lastbox.len,
					segments: [segment]
				})
			}
		}
	}
	return qname2template
}

function parse_one_segment(line, r, ridx) {
	// line
	// r, a region
	// ridx: region array index
	const l = line.split('\t')
	const boxes = []
	const qname = l[0],
		flag = l[2 - 1],
		cigarstr = l[6 - 1],
		rnext = l[7 - 1],
		pnext = l[8 - 1],
		seq = l[10 - 1]
	let pos = Number.parseInt(l[4 - 1]) - 1, // change to 0-based
		stop = r.start,
		prev = 0,
		cum = 0
	for (let i = 0; i < cigarstr.length; i++) {
		const cigar = cigarstr[i]
		if (cigar.match(/[0-9]/)) continue
		if (cigar == 'H') {
			// ignore
			continue
		}
		const len = Number.parseInt(cigarstr.substring(prev, i))
		let s = ''
		if (cigar == 'N') {
			// no seq
		} else if (cigar == 'P' || cigar == 'D') {
			// padding or del, no sequence in read
			for (let j = 0; j < len; j++) {
				s += '*'
			}
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
					boxes.push({
						opr: 'M',
						start: pos,
						len
					})
					get_mismatch(boxes, r, pos, s)
				}
				pos += len
				break
			case 'I':
				if (pos > r.start && pos < r.stop) {
					boxes.push({
						opr: 'I',
						start: pos,
						len,
						s
					})
				}
				break
			case 'D':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push({
						opr: 'D',
						start: pos,
						len,
						s
					})
				}
				pos += len
				break
			case 'N':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push({
						opr: 'N',
						start: pos,
						len,
						s
					})
				}
				pos += len
				break
			case 'X':
			case 'S':
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push({
						opr: cigar,
						start: pos,
						len,
						s
					})
				}
				pos += len
				break
			case 'P':
				if (pos > r.start && pos < r.stop) {
					boxes.push({
						opr: 'P',
						start: pos,
						len,
						s
					})
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
		ridx
	}
	return segment
}

function get_mismatch(boxes, r, pos, readseq) {
	// pos: absolute start position of this read chunck
	// readseq: sequence of this read chunck
	for (let i = 0; i < readseq.length; i++) {
		if (pos + i < r.start || pos + i > r.stop) {
			// to skip bases beyond view range
			continue
		}
		const readnt = readseq[i]
		const refnt = r.referenceseq[pos + i - r.start]
		if (refnt != readnt.toUpperCase()) {
			boxes.push({
				opr: 'X', // mismatch
				start: pos + i,
				len: 1,
				s: readnt
			})
		}
	}
}

function render_template(ctx, template, q, regions) {
	// segments: a list of segments consisting this template, maybe at different regions
	const fontsize = q.query.stackheight
	//ctx.font = fontsize + 'px arial'
	//ctx.textBaseline = 'middle'
	for (let i = 0; i < template.segments.length; i++) {
		const seg = template.segments[i]
		plot_segment(ctx, seg, template.y, q, regions)
		if (i > 0) {
			const prevseg = template.segments[i - 1]
			//const prevlastbox =
		}
	}
}

function plot_segment(ctx, segment, y, q, regions) {
	const r = regions[segment.ridx] // this region where the segment falls into
	// what if segment spans multiple regions

	let xstop = 0
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
			ctx.strokeStyle = fcolor //segment.forward ? fcolor : rcolor
			const y2 = Math.floor(y + q.query.stackheight / 2) + 0.5
			ctx.beginPath()
			ctx.moveTo(x, y2)
			ctx.lineTo(x + b.len * r.ntwidth, y2)
			ctx.stroke()
			xstop = x + b.len * r.ntwidth
			return
		}
		if (b.opr == 'X' || b.opr == 'S') {
			//ctx.fillStyle = 'white'
			//ctx.fillText(b.s, x, y + fontsize / 2)
			for (let j = 0; j < b.s.length; j++) {
				ctx.fillStyle = basecolor[b.s[j]] || 'black'
				ctx.fillRect(x + r.ntwidth * j, y, r.ntwidth, q.query.stackheight)
			}
			return
		}
		// match
		ctx.fillStyle = fcolor // segment.forward ? fcolor : rcolor
		ctx.fillRect(x, y, b.len * r.ntwidth, q.query.stackheight)
		xstop = x + b.len * r.ntwidth
	})
}
