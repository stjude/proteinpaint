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
* error rendering, N junction overlaps with another read in stacking
* toggle between single read and paired read mode, if paired, join by dashed lines
* no region size restriction
  render no more than 5k reads; while collecting, if exceeds 5k, terminate spawn;
  then show an alert row on top

************* data structure
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
  .qual[]


*********** function cascade
get_q
	get_refseq
do_query
	query_region
	parse_all_reads
		parse_one_segment
			check_mismatch
			segmentstop
			segmentstart
	do_stack
	plot_template
		plot_segment
*/
const fcolor = 'rgb(120,120,120)'
const fcolor_lowq = 'rgb(230,230,230)'
const qual2fcolor = interpolateRgb(fcolor_lowq, fcolor)
// mismatch: soft red for background only without printed nt, strong red for printing nt on gray background
const mismatchbg = 'rgb(223,92,97)'
const mismatchbg_lowq = 'rgb(255,184,187)'
const qual2mismatchbg = interpolateRgb(mismatchbg_lowq, mismatchbg)
// softclip: soft blue for background only, strong blue for printing nt
const softclipbg = 'rgb(72,136,191)'
const softclipbg_lowq = 'rgb(173,217,255)'
const qual2softclipbg = interpolateRgb(softclipbg_lowq, softclipbg)

const maxqual = 40

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
	if (!req.query.ntspace) throw '.ntspace missing'
	q.ntspace = Number.parseInt(req.query.ntspace)
	if (Number.isNaN(q.ntspace)) throw '.ntspace not integer'

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
		plot_template(ctx, template, q)
	}

	const result = {
		src: canvas.toDataURL(),
		width: canvaswidth,
		height: canvasheight,
		nochr: q.nochr
	}
	return result
}

function do_stack(q, templates) {
	templates.sort((i, j) => i.start - j.start)
	const stacks = [] // each value is stop coord of each stack
	for (const template of templates) {
		// {start, stop, segments}
		let stackidx = null
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] + q.ntspace < template.start) {
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
			const segment = parse_one_segment(line, r, i)
			if (!segment || !segment.qname) continue
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.stop = Math.max(temp.stop, segmentstop(segment.boxes))
			} else {
				qname2template.set(segment.qname, {
					start: segment.boxes[0].start,
					stop: segmentstop(segment.boxes),
					segments: [segment]
				})
			}
		}
	}
	return [...qname2template.values()]
}

function parse_one_segment(line, r, ridx) {
	// line
	// r, a region
	// ridx: region array index
	const l = line.split('\t')
	const qname = l[0],
		flag = l[2 - 1],
		segstart = Number.parseInt(l[4 - 1]) - 1, // change to 0-based
		cigarstr = l[6 - 1],
		rnext = l[7 - 1],
		pnext = l[8 - 1],
		seq = l[10 - 1],
		qual = l[11 - 1]

	if (cigarstr == '*') {
		console.log('cigar is *')
		return
	}

	const boxes = [] // collect plottable segments
	let quallst = []
	if (r.to_qual) {
		// convert bp quality
		for (let i = 0; i < qual.length; i++) {
			const v = qual[i].charCodeAt(0) - 33
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
		} else {
			// will consume read seq
			s = seq.substr(cum, len)
			cum += len
		}
		prev = i + 1
		if (cigar == '=' || cigar == 'M') {
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
					check_mismatch(boxes, r, pos, s, b.qual)
				}
			}
			pos += len
			continue
		}
		if (cigar == 'I') {
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
			continue
		}
		if (cigar == 'D') {
			if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
				boxes.push({
					opr: 'D',
					start: pos,
					len
				})
				console.log('d', len)
			}
			pos += len
			continue
		}
		if (cigar == 'N') {
			// for skipped region, must have at least one end within region;
			// if both ends are outside of region e.g. intron-spanning rna read, will not include
			if ((pos >= r.start && pos <= r.stop) || (pos + len - 1 >= r.start && pos + len - 1 <= r.stop)) {
				boxes.push({
					opr: 'N',
					start: pos,
					len
				})
			}
			pos += len
			continue
		}
		if (cigar == 'X') {
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
			continue
		}
		if (cigar == 'S') {
			const b = {
				opr: cigar,
				start: pos,
				len,
				s
			}
			if (r.to_qual) b.qual = quallst.slice(cum - len, cum)
			if (boxes.length == 0) {
				// this is the first box, will not consume ref
				// shift softclip start to left, so its end will be pos, will not increment pos
				b.start -= len
				if (Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
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
		x2: r.x + r.scale(segmentstop(boxes)), // x stop position, for drawing connect line
		cigarstr, // temp
		segstart, // temp
		segstop: segmentstop(boxes)
	}
	if (boxes.find(i => i.opr == 'S') && boxes[0].opr != 'S' && boxes[boxes.length - 1].opr != 'S') console.log(cigarstr)
	//if(boxes[0].opr=='S') console.log(cigarstr)
	return segment
}

function segmentstop(boxes) {
	return Math.max(...boxes.map(i => i.start + i.len))
}

function check_mismatch(boxes, r, pos, readseq, quallst) {
	// pos: absolute start position of this read chunck
	// readseq: sequence of this read chunck
	// quallst: for getting quality of mismatching base
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
			if (r.to_qual && quallst) b.qual = [quallst[i]]
			boxes.push(b)
		}
	}
}

function plot_template(ctx, template, q) {
	// segments: a list of segments consisting this template, maybe at different regions
	const fontsize = q.stackheight
	//ctx.font = fontsize + 'px arial'
	//ctx.textBaseline = 'middle'
	if (template.y == 28) console.log(template)
	for (let i = 0; i < template.segments.length; i++) {
		const seg = template.segments[i]
		plot_segment(ctx, seg, template.y, q)
		if (i > 0) {
			// make it optional
			// this segment is not the first of the list
			const currentr = q.regions[seg.ridx]
			const currentx = currentr.x + currentr.scale(seg.boxes[0].start)
			const prevseg = template.segments[i - 1]
			if (prevseg.x2 < currentx) {
				const y = Math.floor(template.y + q.stackheight / 2) + 0.5
				ctx.strokeStyle = fcolor
				ctx.setLineDash([5, 3]) // dash for read pairs
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
		if (b.opr == 'D' || b.opr == 'N') {
			ctx.strokeStyle = fcolor // may use blue line
			ctx.setLineDash([]) // use solid lines
			const y2 = Math.floor(y + q.stackheight / 2) + 0.5
			ctx.beginPath()
			ctx.moveTo(x, y2)
			ctx.lineTo(x + b.len * r.ntwidth, y2)
			ctx.stroke()
			return
		}
		if (b.opr == 'X' || b.opr == 'S') {
			if (r.to_qual) {
				for (let i = 0; i < b.s.length; i++) {
					const v = b.qual[i] / maxqual
					ctx.fillStyle = b.opr == 'S' ? qual2softclipbg(v) : qual2mismatchbg(v)
					ctx.fillRect(x + r.ntwidth * i, y, r.ntwidth, q.stackheight)
					if (r.to_printnt) {
						ctx.fillStyle = 'white'
						ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + q.stackheight / 2)
					}
				}
			} else {
				// not printing text or rendering qual
				ctx.fillStyle = b.opr == 'S' ? softclipbg : mismatchbg
				ctx.fillRect(x, y, b.len * r.ntwidth, q.stackheight)
			}
			return
		}
		if (b.opr == 'M') {
			if (r.to_qual) {
				for (let i = 0; i < b.qual.length; i++) {
					ctx.fillStyle = qual2fcolor(b.qual[i] / maxqual)
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
			return
		}
		throw 'unknown opr at rendering: ' + b.opr
	})
}

/*
puzzling case of HWI-ST988:130:D1TFEACXX:4:1201:10672:53382 from SJBALL021856_D1
{
  start: 5072626,
  stop: 5078394,
  segments: [
    {
      qname: 'HWI-ST988:130:D1TFEACXX:4:2306:16068:71448',
      boxes: [Array],
      forward: false,
      ridx: 0,
      x2: 850,
      cigarstr: '9M1I2M5679N89M',
      segstart: 5072615,
      segstop: 5078394
    },
    {
      qname: 'HWI-ST988:130:D1TFEACXX:4:2306:16068:71448',
      boxes: [Array],
      forward: true,
      ridx: 0,
      x2: 723,
      cigarstr: '53S48M',
      segstart: 5078303,
      segstop: 5078351
    }
  ],
  y: 28
}
*/
