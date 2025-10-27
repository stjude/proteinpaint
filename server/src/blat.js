import fs from 'fs'
import path from 'path'
import { get_lines_bigfile, read_file, write_tmpfile } from './utils.js'
import serverconfig from './serverconfig.js'
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

// not in use! for parsing maf format
async function do_blat2(genome, seq, soft_starts, soft_stops) {
	const infile = path.join(serverconfig.cachedir, await write_tmpfile('>query\n' + seq + '\n'))
	//console.log('soft_starts:', soft_starts, 'soft_stops:', soft_stops)
	const outfile = await run_blat2(genome, infile)
	const outputstr = (await read_file(outfile)).trim()
	fs.unlink(outfile, () => {})
	fs.unlink(infile, () => {})
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits = []
	let h = {}
	for (const line of lines) {
		const l = line.split(' ').filter(function (el) {
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
				h.query_stoppos = parseInt(l[2]) + parseInt(l[3] - 1)
				if (soft_starts) {
					//console.log("h.query_stoppos:",h.query_stoppos)
					// Checking to see if the alignment coordinates lie within soft clip
					const soft_starts_array = soft_starts.split(',')
					const soft_stops_array = soft_stops.split(',')
					//console.log("soft_starts_array:",soft_starts_array)
					//console.log("soft_stops_array:",soft_stops_array)
					h.query_insoftclip = false
					for (let m = 0; m < soft_starts_array.length; m++) {
						const soft_start = soft_starts_array[m]
						const soft_stop = soft_stops_array[m]
						if (
							parseInt(soft_start) <= parseInt(h.query_startpos) &&
							parseInt(h.query_stoppos) <= parseInt(soft_stop)
						) {
							h.query_insoftclip = true
							h.query_soft_boundaries = '-1' // Indicating the whole of the alignment is inside the softclip
							break
						} else if (
							parseInt(soft_start) > parseInt(h.query_startpos) &&
							parseInt(h.query_stoppos) > parseInt(soft_start)
						) {
							//console.log('Alignment extends onto the left side of the soft-clip')
							//console.log('h.query_alignment:', h.query_alignment)
							//console.log('soft_start:', soft_start)
							//console.log('soft_stop:', soft_stop)
							//console.log('h.query_startpos:', h.query_startpos)
							//console.log('h.query_stoppos:', h.query_stoppos)
							h.query_insoftclip = true
							//console.log('h.query_insoftclip:', h.query_insoftclip)
							h.query_soft_boundaries = 'right:' + soft_start // Alignment extends onto the left side of the soft-clip
						} else if (
							parseInt(soft_stop) > parseInt(h.query_startpos) &&
							parseInt(h.query_stoppos) > parseInt(soft_stop)
						) {
							//console.log('Alignment extends onto the right side of the soft-clip')
							//console.log('h.query_alignment:', h.query_alignment)
							//console.log('soft_start:', soft_start)
							//console.log('soft_stop:', soft_stop)
							//console.log('h.query_startpos:', h.query_startpos)
							//console.log('h.query_stoppos:', h.query_stoppos)
							h.query_insoftclip = true
							//console.log('h.query_insoftclip:', h.query_insoftclip)
							h.query_soft_boundaries = 'left:' + soft_stop //Alignment extends onto the right side of the soft clip
						} else {
							//h.query_soft_boundaries="-1"
							continue
						}
					}
				}
				hits.push(h)
			} else {
				h.ref_chr = l[1]
				h.ref_startpos = l[2]
				h.ref_alignlen = l[3]
				h.ref_strand = l[4]
				h.ref_totallen = l[5] // This is actually the chromosome length
				h.ref_alignment = l[6]
				h.ref_stoppos = (parseInt(l[2]) + parseInt(l[3] - 1)).toString()
				if (genome.repeatmasker) {
					await get_lines_bigfile({
						args: [
							path.join(serverconfig.tpmasterdir, genome.repeatmasker.dbfile),
							h.ref_chr + ':' + h.ref_startpos + '-' + h.ref_stoppos
						],
						callback: line => {
							const columns = line.split('\t')
							const json_object = JSON.parse(columns[3])
							h.ref_in_repeat = json_object.category
						}
					})
					if (h.ref_in_repeat == undefined) {
						h.ref_in_repeat = '-'
					}
				}
			}
		}
	}
	// Sorting alignments in descending order of score
	hits.sort((a, b) => {
		return b.score - a.score
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
