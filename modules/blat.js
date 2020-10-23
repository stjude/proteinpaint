const fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	utils = require('./utils'),
	app = require('../app')

const serverconfig = utils.serverconfig
const gfClient = serverconfig.gfClient || 'gfClient'
const gfServer = serverconfig.gfServer || 'gfServer'

exports.request_closure = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (req.query.serverstat) {
				const lst = []
				for (const n in genomes) {
					const g = genomes[n]
					if (!g.blat) continue
					lst.push(await server_stat(n, g))
				}
				if (lst.length == 0) throw 'found no genome with blat'
				res.send({ lst })
				return
			}
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (!genome.blat) throw 'blat not enabled'
			if (!req.query.seq) throw '.seq missing'
			console.log('req.query:', req.query)
			res.send(await do_blat2(genome, req.query.seq, req.query.soft_start, req.query.soft_stop))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function server_stat(name, g) {
	return new Promise((resolve, reject) => {
		const ps = spawn(gfServer, ['status', g.blat.host, g.blat.port])
		const out = [],
			out2 = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
			const e = out2.join('').trim()
			if (e) {
				resolve(name + ' OFF')
			}
			const lines = out
				.join('')
				.trim()
				.split('\n')
			let c = 0
			for (line of lines) {
				if (line.startsWith('blat requests')) c = line.split(' ')[2]
			}
			resolve(name + ' ON, ' + c + ' requests')
		})
	})
}

async function do_blat(genome, seq) {
	const infile = path.join(serverconfig.cachedir, await utils.write_tmpfile('>query\n' + seq + '\n'))
	const outfile = await run_blat(genome, infile)
	const outputstr = (await utils.read_file(outfile)).trim()
	fs.unlink(outfile, () => {})
	fs.unlink(infile, () => {})
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits = []
	for (const line of lines) {
		const l = line.split('\t')
		const h = {
			match: Number(l[0]),
			mismatch: Number(l[1]),
			repmatch: Number(l[2]),
			ncount: Number(l[3]),
			qnuminsert: Number(l[4]),
			qbaseinsert: Number(l[5]),
			tnuminsert: Number(l[6]),
			tbaseinsert: Number(l[7]),
			strand: l[8],
			qstart: Number(l[11]),
			qstop: Number(l[12]),
			chr: l[13],
			start: Number(l[15]),
			stop: Number(l[16])
		}
		const blockcount = Number(l[17])
		if (blockcount > 1) {
			// more than 1 block
			h.lst = []
			const blocksizes = l[18].split(',').map(Number)
			const qstarts = l[19].split(',').map(Number)
			const tstarts = l[20].split(',').map(Number)
			for (let i = 0; i < blockcount; i++) {
				h.lst.push({
					qstart: qstarts[i],
					qstop: qstarts[i] + blocksizes[i],
					start: tstarts[i],
					stop: tstarts[i] + blocksizes[i]
				})
			}
		}
		hits.push(h)
	}
	console.log(hits)
	return { hits }
}

async function do_blat2(genome, seq, soft_start, soft_stop) {
	const infile = path.join(serverconfig.cachedir, await utils.write_tmpfile('>query\n' + seq + '\n'))
	console.log('soft_start:', soft_start, 'soft_stop:', soft_stop)
	const outfile = await run_blat2(genome, infile)
	const outputstr = (await utils.read_file(outfile)).trim()
	fs.unlink(outfile, () => {})
	fs.unlink(infile, () => {})
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits = []
	let h = {}
	let temp_seq = ''
	for (const line of lines) {
		const l = line.split(' ').filter(function(el) {
			return el != ''
		})
		//console.log(l)
		if (l[0] == 'a') {
			h = {}
			h.score = parseFloat(l[1].substr(6, l[1].length)).toFixed(2)
		} else if (l[0] == 's') {
			if (l[1] == 'query') {
				h.query_startpos = l[2]
				h.query_alignlen = l[3]
				h.query_strand = l[4]
				h.query_totallen = l[5]
				h.query_alignment = l[6]
				if (soft_start) {
					h.query_stoppos = parseInt(l[2]) + parseInt(l[3] - 1)
					//console.log("h.query_stoppos:",h.query_stoppos)
					// Checking to see if the alignment coordinates lie within soft clip
					if (parseInt(soft_start) <= parseInt(h.query_startpos) && parseInt(h.query_stoppos) <= parseInt(soft_stop)) {
						h.query_insoftclip = true
					} else if (
						parseInt(soft_start) >= parseInt(h.query_startpos) &&
						parseInt(h.query_stoppos) >= parseInt(soft_stop)
					) {
						h.query_insoftclip = true
					}
					//				    else if ((parseInt(soft_start) >= parseInt(h.query_startpos)) && (parseInt(h.query_stoppos) >= parseInt(soft_stop))) {
					//                                       h.query_insoftclip=true
					//				    }
					//				    else if ((parseInt(soft_start) <= parseInt(h.query_startpos)) && (parseInt(h.query_stoppos) <= parseInt(soft_stop))) {
					//                                       h.query_insoftclip=true
					//				    }
					else {
						h.query_insoftclip = false
					}
				}
				//console.log("h:",h)
				hits.push(h)
			} else {
				h.ref_chr = l[1]
				h.ref_startpos = l[2]
				h.ref_alignlen = l[3]
				h.ref_strand = l[4]
				h.ref_totallen = l[5] // This is actually the chromosome length
				h.ref_alignment = l[6]
			}
		}
	}
	//console.log(hits)
	return { hits }
}

function run_blat(genome, infile) {
	const outfile = path.join(serverconfig.cachedir, Math.random().toString())
	return new Promise((resolve, reject) => {
		const ps = spawn(gfClient, [
			genome.blat.host,
			genome.blat.port,
			'', // works with /full/path/to/2bit in blat server
			infile,
			outfile,
			'-q=dna',
			'-nohead',
			'-minScore=20',
			'-minIdentity=0'
		])
		const out2 = []
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
			const e = out2.join('')
			if (e) {
				console.log('BLAT error', e)
				reject('blat server problem')
			}
			resolve(outfile)
		})
	})
}

function run_blat2(genome, infile) {
	const outfile = path.join(serverconfig.cachedir, Math.random().toString())
	return new Promise((resolve, reject) => {
		const ps = spawn(gfClient, [
			genome.blat.host,
			genome.blat.port,
			'', // works with /full/path/to/2bit in blat server
			infile,
			outfile,
			'-q=dna',
			'-nohead',
			'-minScore=20',
			'-minIdentity=0',
			'-out=maf'
		])
		const out2 = []
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
			const e = out2.join('')
			if (e) {
				console.log('BLAT error', e)
				reject('blat server problem')
			}
			resolve(outfile)
		})
	})
}
