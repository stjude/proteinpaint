const fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	utils = require('./utils'),
	app = require('../app')

const serverconfig = utils.serverconfig
const gfClient = serverconfig.gfClient || 'gfClient'

exports.request_closure = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (!genome.blat) throw 'blat not enabled'
			if (!req.query.seq) throw '.seq missing'
			res.send(await do_blat(genome, req.query.seq))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
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
	return { hits }
}

function run_blat(genome, infile) {
	const outfile = path.join(serverconfig.cachedir, Math.random().toString())
	return new Promise((resolve, reject) => {
		const ps = spawn(gfClient, [
			genome.blat.host,
			genome.blat.port,
			genome.blat.seqDir,
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
