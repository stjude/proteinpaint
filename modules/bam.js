const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const spawn = require('child_process').spawn
const readline = require('readline')

/*
 */

const serverconfig = __non_webpack_require__('./serverconfig.json')
const samtools = serverconfig.samtools || 'samtools'

module.exports = genomes => {
	return async (req, res) => {
		//if(app.reqbodyisinvalidjson(req,res)) return
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			await do_query(genome, req, res)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(genome, req, res) {
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
	if (!req.query.regions) throw '.regions[] missing'
	const regions = JSON.parse(req.query.regions)
	for (const r of regions) {
		await query_region(r, q)
	}
	const canvaswidth = regions[regions.length - 1].xoff + regions[regions.length - 1].width
	const canvasheight = 100
	const canvas = createCanvas(canvaswidth, canvasheight)
	const ctx = canvas.getContext('2d')

	for (const r of regions) {
		render_region(ctx, r, q)
	}

	const result = {
		src: canvas.toDataURL(),
		width: canvaswidth,
		height: canvasheight,
		nochr: q.nochr
	}
	res.send(result)
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
		ps.on('close', () => {
			rl.close()
			resolve()
		})
	})
}

function render_region(ctx, r, q) {
	const ntwidth = this.width / (this.stop - this.start)

	const readsf = [],
		readsr = []
	for (const line of r.lines) {
		var l = line.split('\t')
		var pos = parseInt(l[3]) - 1
		var stop = start
		var boxes = []
		var flag = l[1],
			seq = l[9],
			cigarstr = l[5]
		var prev = 0
		var cum = 0
		for (var i = 0; i < cigarstr.length; i++) {
			if (cigarstr[i].match(/[0-9]/)) continue
			var cigar = cigarstr[i]
			if (cigar == 'H') {
				// ignore
				continue
			}
			var len = parseInt(cigarstr.substring(prev, i))
			var s = ''
			if (cigar == 'N') {
				// no seq
			} else if (cigar == 'P' || cigar == 'D') {
				// padding or del, no sequence in read
				for (var j = 0; j < len; j++) {
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
					if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
						// visible
						boxes.push({
							opr: 'M',
							start: pos,
							len: len,
							s: s
						})
					}
					pos += len
					break
				case 'I':
					if (pos > this.start && pos < this.stop) {
						boxes.push({
							opr: 'I',
							start: pos,
							len: len,
							s: s
						})
					}
					break
				case 'D':
					if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
						boxes.push({
							opr: 'D',
							start: pos,
							len: len,
							s: s
						})
					}
					pos += len
					break
				case 'N':
					if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
						boxes.push({
							opr: 'N',
							start: pos,
							len: len,
							s: s
						})
					}
					pos += len
					break
				case 'X':
				case 'S':
					if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
						boxes.push({
							opr: cigar,
							start: pos,
							len: len,
							s: s
						})
					}
					pos += len
					break
				case 'P':
					if (pos > this.start && pos < this.stop) {
						boxes.push({
							opr: 'P',
							start: pos,
							len: len,
							s: s
						})
					}
					break
				default:
					console.log('unknown cigar: ' + cigar)
			}
		}
		if (boxes.length == 0) return
		var read = {
			name: l[0],
			forward: !(flag & 0x10),
			boxes: boxes
		}
		if (read.forward) {
			readsf.push(read)
		} else {
			readsr.push(read)
		}
	}
	var reads = readsf.concat(readsr)
	//reads.sort((i,j)=>{ return i.boxes[0].start-j.boxes[0].start})
	var canvas = createCanvas(this.width, reads.length * this.stackheight)
	var ctx = canvas.getContext('2d')
	var fontsize = this.stackheight
	ctx.font = fontsize + 'px arial'
	ctx.textBaseline = 'middle'
	var scale = p => Math.ceil((this.width * (p - 0.5 - this.start)) / (this.stop - this.start))
	reads.forEach((read, i) => {
		var y = i * this.stackheight
		var xstop = 0
		read.boxes.forEach(b => {
			var x = scale(b.start)
			switch (b.opr) {
				case 'P':
				case 'I':
					// ignore
					return
				case 'N':
					ctx.strokeStyle = read.forward ? this.fcolor : this.rcolor
					var y2 = Math.floor(y + this.stackheight / 2) + 0.5
					ctx.beginPath()
					ctx.moveTo(x, y2)
					ctx.lineTo(x + b.len * ntwidth, y2)
					ctx.stroke()
					xstop = x + b.len * ntwidth
					return
				case 'X':
					ctx.fillStyle = 'white'
					ctx.fillText(b.s, x, y + fontsize / 2)
					return
				default:
					ctx.fillStyle = read.forward ? this.fcolor : this.rcolor
					ctx.fillRect(x, y, b.len * ntwidth, this.stackheight)
					xstop = x + b.len * ntwidth
			}
		})
		ctx.fillStyle = read.forward ? this.fcolor : this.rcolor
		ctx.fillText(read.name, xstop, y + fontsize / 2)
	})
}

function load(dir) {
	this.name = req.query.name
	this.start = start
	this.stop = stop
	this.chr = req.query.chr
	this.nochr = nochr
	this.width = width
	this.barheight = barheight
	this.stackheight = stackheight
	this.fcolor = req.query.fcolor
	this.rcolor = req.query.rcolor
	this.mmcolor = req.query.mmcolor
	this.load = () => {
		var ps = spawn(
			samtools,
			['view', file, (this.nochr ? this.chr.replace('chr', '') : this.chr) + ':' + this.start + '-' + this.stop],
			{ cwd: dir }
		)
		var out = [],
			out2 = []
		ps.stdout.on('data', data => {
			// TODO detect amount of data, terminate if too big
			out.push(data)
		})
		ps.stderr.on('data', data => {
			out2.push(data)
		})
		ps.on('close', code => {
			if (out2.length > 0) {
				//res.send({error:out2.join('')})
				//return
			}
			var lines = out
				.join('')
				.trim()
				.split('\n')
			var ntwidth = this.width / (this.stop - this.start)
			var readsf = [],
				readsr = []
			lines.forEach(line => {
				var l = line.split('\t')
				var pos = parseInt(l[3]) - 1
				var stop = start
				var boxes = []
				var flag = l[1],
					seq = l[9],
					cigarstr = l[5]
				var prev = 0
				var cum = 0
				for (var i = 0; i < cigarstr.length; i++) {
					if (cigarstr[i].match(/[0-9]/)) continue
					var cigar = cigarstr[i]
					if (cigar == 'H') {
						// ignore
						continue
					}
					var len = parseInt(cigarstr.substring(prev, i))
					var s = ''
					if (cigar == 'N') {
						// no seq
					} else if (cigar == 'P' || cigar == 'D') {
						// padding or del, no sequence in read
						for (var j = 0; j < len; j++) {
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
							if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
								// visible
								boxes.push({
									opr: 'M',
									start: pos,
									len: len,
									s: s
								})
							}
							pos += len
							break
						case 'I':
							if (pos > this.start && pos < this.stop) {
								boxes.push({
									opr: 'I',
									start: pos,
									len: len,
									s: s
								})
							}
							break
						case 'D':
							if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
								boxes.push({
									opr: 'D',
									start: pos,
									len: len,
									s: s
								})
							}
							pos += len
							break
						case 'N':
							if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
								boxes.push({
									opr: 'N',
									start: pos,
									len: len,
									s: s
								})
							}
							pos += len
							break
						case 'X':
						case 'S':
							if (Math.max(pos, this.start) < Math.min(pos + len - 1, this.stop)) {
								boxes.push({
									opr: cigar,
									start: pos,
									len: len,
									s: s
								})
							}
							pos += len
							break
						case 'P':
							if (pos > this.start && pos < this.stop) {
								boxes.push({
									opr: 'P',
									start: pos,
									len: len,
									s: s
								})
							}
							break
						default:
							console.log('unknown cigar: ' + cigar)
					}
				}
				if (boxes.length == 0) return
				var read = {
					name: l[0],
					forward: !(flag & 0x10),
					boxes: boxes
				}
				if (read.forward) readsf.push(read)
				else readsr.push(read)
			})
			var reads = readsf.concat(readsr)
			//reads.sort((i,j)=>{ return i.boxes[0].start-j.boxes[0].start})
			var canvas = createCanvas(this.width, reads.length * this.stackheight)
			var ctx = canvas.getContext('2d')
			var fontsize = this.stackheight
			ctx.font = fontsize + 'px arial'
			ctx.textBaseline = 'middle'
			var scale = p => Math.ceil((this.width * (p - 0.5 - this.start)) / (this.stop - this.start))
			reads.forEach((read, i) => {
				var y = i * this.stackheight
				var xstop = 0
				read.boxes.forEach(b => {
					var x = scale(b.start)
					switch (b.opr) {
						case 'P':
						case 'I':
							// ignore
							return
						case 'N':
							ctx.strokeStyle = read.forward ? this.fcolor : this.rcolor
							var y2 = Math.floor(y + this.stackheight / 2) + 0.5
							ctx.beginPath()
							ctx.moveTo(x, y2)
							ctx.lineTo(x + b.len * ntwidth, y2)
							ctx.stroke()
							xstop = x + b.len * ntwidth
							return
						case 'X':
							ctx.fillStyle = 'white'
							ctx.fillText(b.s, x, y + fontsize / 2)
							return
						default:
							ctx.fillStyle = read.forward ? this.fcolor : this.rcolor
							ctx.fillRect(x, y, b.len * ntwidth, this.stackheight)
							xstop = x + b.len * ntwidth
					}
				})
				ctx.fillStyle = read.forward ? this.fcolor : this.rcolor
				ctx.fillText(read.name, xstop, y + fontsize / 2)
			})
			res.send({
				src: canvas.toDataURL(),
				height: reads.length * this.stackheight
			})
		})
	}
}
