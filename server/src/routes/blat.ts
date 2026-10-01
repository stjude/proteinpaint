import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { BlatRequest, BlatResponse, RouteApi, RoutePayload } from '#types'
import { read_file, write_tmpfile } from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { genomes } from '#src/initGenomesDs.js'

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one genome has a blat server
	get init() {
		return hasBlat(genomes) ? init : null
	},
	request: { typeId: 'BlatRequest' },
	response: { typeId: 'BlatResponse' }
}

export const api: RouteApi = {
	// aligns a sequence against a genome on its blat server, or reports the status of the blat servers
	endpoint: 'blat',
	methods: {
		get: payload,
		// the client converts a GET request with a long sequence to POST, see client/common/dofetch.js
		post: payload
	}
}

export function hasBlat(genomes) {
	return Object.values(genomes).some((g: any) => g.blat)
}

function init({ genomes }) {
	return async (req, res) => {
		try {
			const q = req.query as BlatRequest
			if (q.serverstat) {
				const lst: string[] = []
				for (const n in genomes) {
					const g = genomes[n]
					if (!g.blat) continue
					lst.push(await server_stat(g))
				}
				if (lst.length == 0) throw 'found no genome with blat'
				res.send({ lst })
				return
			}
			if (!q.genome) throw '.genome missing'
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			if (!genome.blat) throw 'blat not enabled'
			if (!q.seq) throw '.seq missing'
			res.send(await do_blat(genome, q.seq))
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

// a server that is down is reported as OFF, so that the status of the other servers is still reported
async function server_stat(g): Promise<string> {
	try {
		// query a random sequence to see if the server is up
		await run_blat(g, 'ATCG')
		return `ON for ${g.blat.host} ${g.blat.port}`
	} catch (_) {
		return `OFF for ${g.blat.host} ${g.blat.port}`
	}
}

async function do_blat(genome, seq): Promise<BlatResponse> {
	const outputstr = (await run_blat(genome, seq)).trim()
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits: any[] = []
	for (const line of lines) {
		const l = line.split(' ').filter(function (el) {
			return el != ''
		})
		const h: any = {}
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
		h.ref_alignlen = Math.abs(parseInt(line2[16]) - parseInt(line2[15])).toString()
		h.ref_totallen = line2[14] // This is actually the chromosome length
		hits.push(h)
	}
	// Sorting alignments in descending order of score
	hits.sort((a, b) => {
		return b.query_match - a.query_match
	})
	return { hits }
}

// returns the gfClient psl output of aligning seq against the genome; the temporary files are always deleted
async function run_blat(genome, seq): Promise<string> {
	const infile = path.join(serverconfig.cachedir, await write_tmpfile('>query\n' + seq + '\n'))
	const outfile = path.join(serverconfig.cachedir, Math.random().toString())
	try {
		await run_gfClient(genome, infile, outfile)
		return await read_file(outfile)
	} finally {
		fs.unlink(outfile, () => {})
		fs.unlink(infile, () => {})
	}
}

function run_gfClient(genome, infile, outfile): Promise<void> {
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
		const out2: string[] = []
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', () => {
			const e = out2.join('')
			if (e) {
				console.log('BLAT error', e)
				return reject('blat server problem')
			}
			resolve()
		})

		ps.on('error', err => {
			reject('Error spawning gfClient: ' + err.message)
		})
	})
}
