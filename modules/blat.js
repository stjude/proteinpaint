const fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	utils = require('./utils'),
	app = require('../app')

const serverconfig = utils.serverconfig
const tabix = serverconfig.tabix || 'tabix'
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
			//console.log('req.query:', req.query)
			res.send(await do_blat2(genome, req.query.seq, req.query.soft_starts, req.query.soft_stops))
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
			for (const line of lines) {
				if (line.startsWith('blat requests')) c = line.split(' ')[2]
			}
			resolve(name + ' ON, ' + c + ' requests')
		})
	})
}

async function do_blat2(genome, seq, soft_starts, soft_stops) {
	const infile = path.join(serverconfig.cachedir, await utils.write_tmpfile('>query\n' + seq + '\n'))
	console.log('soft_starts:', soft_starts, 'soft_stops:', soft_stops)
	const outfile = await run_blat2(genome, infile)
	const outputstr = (await utils.read_file(outfile)).trim()
	fs.unlink(outfile, () => {})
	fs.unlink(infile, () => {})
	if (outputstr == '') return { nohit: 1 }
	const lines = outputstr.split('\n')
	const hits = []
	let h = {}
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
						soft_start = soft_starts_array[m]
						soft_stop = soft_stops_array[m]
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
					const outputstr = await determine_repeat_in_ref(genome, h.ref_chr, h.ref_startpos, h.ref_stoppos) // Checking to see if the alignment lies within a repeat region
					//console.log("outfile:",outfile)
					//const outputstr = (await utils.read_file(outfile)).trim()
					//console.log("outputstr:",outputstr)
					//fs.unlink(outfile, () => {})
					if (outputstr.length == 0) {
						h.ref_in_repeat = '-'
					} else {
						const tabix_lines = outputstr.split('\n')
						const columns = tabix_lines[0].split('\t') // Only selecting the first line for annotation when query spans two or more different repeats
						const json_object = JSON.parse(columns[3])
						h.ref_in_repeat = json_object.category
					}
				}
			}
		}
	}
	//console.log(hits)
	// Sorting alignments in descending order of score
	hits.sort((a, b) => {
		return b.score - a.score
	})
	return { hits }
}

function determine_repeat_in_ref(genome, ref_chr, ref_startpos, ref_stoppos) {
	return new Promise((resolve, reject) => {
		console.log(
			tabix +
				' -p bed ' +
				serverconfig.tpmasterdir +
				'/' +
				genome.repeatmasker.dbfile +
				' ' +
				ref_chr +
				':' +
				ref_startpos +
				'-' +
				ref_stoppos
		)
		//console.log(ref_chr+":"+ref_startpos+"-"+ref_stoppos)

		const ls = spawn(tabix, [
			'-p',
			'bed',
			serverconfig.tpmasterdir + '/' + genome.repeatmasker.dbfile,
			ref_chr + ':' + ref_startpos + '-' + ref_stoppos
		])

		//    ls.stdout.setEncoding('utf8')
		ls.stdout.on('data', function(data) {
			//Here is where the output goes
			data = data.toString()
			console.log('stdout: ' + data)
			resolve(data)
		})

		ls.stderr.on('data', data => {
			console.log(`stderr: ${data}`)
		})

		//    ls.on('error', (error) => {
		//	    console.log(`error: ${error.message}`)
		//	})

		ls.on('close', code => {
			console.log(`child process exited with code ${code}`)
			resolve('')
		})
	})
	//console.log("data:",data)
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
		//console.log("ps:",ps)
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
