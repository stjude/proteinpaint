import fs from 'fs'
import path from 'path'
import { get_lines_bigfile, read_file, write_tmpfile } from './utils'
import serverconfig from './serverconfig'
import { spawn } from 'child_process'

export function request_closure(genomes) {
	return async (req, res) => {
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
			res.send(await do_blat(genome, req.query.seq, req.query.soft_starts, req.query.soft_stops))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

// TODO add this to /healthcheck and delete it from app header
function server_stat(name, g) {
	return new Promise(async (resolve, reject) => {
		// query a random sequence to see if the server is up
		const infile = path.join(serverconfig.cachedir, await write_tmpfile('>query\n' + 'ATCG' + '\n'))
		try {
			await run_blat2(g, infile)
			resolve(`ON for ${g.blat.host} ${g.blat.port}`)
		} catch (e) {
			reject(`OFF for ${g.blat.host} ${g.blat.port}`)
		}
	})
}

async function do_blat(genome, seq, soft_starts, soft_stops) {
	const infile = path.join(serverconfig.cachedir, await write_tmpfile('>query\n' + seq + '\n'))
	const outfile = await run_blat2(genome, infile)
	const outputstr = (await read_file(outfile)).trim()
	fs.unlink(outfile, () => {})
	fs.unlink(infile, () => {})
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits = []
	for (const line of lines) {
		const l = line.split(' ').filter(function (el) {
			return el != ''
		})
		const h = {}
		const line2 = l[0].split('\t')
		h.query_match = line2[0]
		h.query_startpos = (parseInt(line2[11]) + 1).toString()
		h.query_stoppos = line2[12]
		h.query_strand = line2[8]
		h.query_totallen = line2[10]
		h.query_alignlen = Math.abs(parseInt(line2[11]) - parseInt(line2[12])).toString()
		h.ref_chr = line2[13]
		h.ref_startpos = (parseInt(line2[15]) + 1).toString()
		h.ref_stoppos = line2[16]
		h.ref_alignlen = Math.abs(line2[16] - line2[15]).toString()
		h.ref_totallen = line2[14] // This is actually the chromosome length
		hits.push(h)
	}
	// Sorting alignments in descending order of score
	hits.sort((a, b) => {
		return b.query_match - a.query_match
	})
	return { hits }
}

function run_blat2(genome, infile) {
	const outfile = path.join(serverconfig.cachedir, Math.random().toString())
	return new Promise((resolve, reject) => {
		const ps = spawn(serverconfig.gfClient, [
			genome.blat.host,
			genome.blat.port,
			genome.blat.seqDir,
			infile,
			outfile,
			'-q=dna',
			'-nohead',
			'-minScore=20',
			'-minIdentity=0',
			'-out=psl'
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

		ps.on('error', err => {
			resolve('Error spawning gfClient: ' + err.message)
		})
	})
}
