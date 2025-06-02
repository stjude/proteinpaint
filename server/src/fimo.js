import fs from 'fs'
import path from 'path'
import * as utils from './utils'
import serverconfig from './serverconfig'
import { spawn } from 'child_process'

const fimo = serverconfig.fimo || 'fimo'

export function handle_closure(genomes) {
	return async (req, res) => {
		try {
			const q = req.query
			if (!q.m) throw 'no mutation'
			if (!q.m.chr) throw 'mutation chr missing'
			if (!Number.isInteger(q.m.pos)) throw 'mutation position is not integer'
			if (!q.m.ref) throw 'mutation ref allele missing'
			if (!q.m.alt) throw 'mutation alt allele missing'
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			if (!gn.fimo_motif) throw 'motif finding not supported on this genome'
			const result = await handle_fimo_do(q, gn)
			res.send(result)
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

function fimo_may_updateallele(q, start, ref_fasta) {
	// retrieved seq flanking the q.m from forward strand
	// tell if the q.m alleles are from reverse strand, and if so change to forward

	// do not deal with these
	if (!q.m.ref) return
	if (q.m.ref == '-') return

	// remove fasta header
	const seq = ref_fasta.split('\n').slice(1).join('').toUpperCase()

	// nt string at m.pos matching length of m.ref
	const forward = seq.substring(q.m.pos - start, q.m.pos - start + q.m.ref.length)

	if (forward == q.m.ref.toUpperCase()) {
		// ref is from forward strand
		//console.log('forward')
		return
	}

	// make reverse compliment using forward
	const reverse = common.reversecompliment(forward)
	if (reverse == q.m.ref.toUpperCase()) {
		//console.log('is reverse')
		q.m.ref = forward
		if (q.m.alt != '-') {
			q.m.alt = common.reversecompliment(q.m.alt)
		}
		return
	}
	//console.log('dont know')
}

async function handle_fimo_do(q, gn) {
	/*
do motif finding on ref sequence
mutate ref seq
do motif finding on mutant seq
then find motif change
*/
	///////// scan reference sequence

	const refstart = q.m.pos - q.flankspan
	const refstop = q.m.pos + q.flankspan

	const ref_fasta = await utils.get_fasta(gn, q.m.chr + ':' + refstart + '-' + refstop)
	fimo_may_updateallele(q, refstart, ref_fasta)

	const ref_motifs = await run_fimo(q, gn, ref_fasta)

	// index ref motifs by tf name
	const allmotifs = new Map()
	/* k: tf name
	   v: [ {} ]
		 .pvalue_ref
		 .pvalue_alt
	     .logpvaluediff
	*/

	for (const i of ref_motifs) {
		i.pvalue_ref = i.pvalue
		delete i.pvalue
		i.logpvalue_ref = i.logpvalue
		delete i.logpvalue

		if (!allmotifs.has(i.name)) allmotifs.set(i.name, [])
		allmotifs.get(i.name).push(i)
	}

	const alt_fasta = fimo_mutate_seq(q.m, refstart, refstop, ref_fasta)
	const alt_motifs = await run_fimo(q, gn, alt_fasta)

	// index alt motifs and compare
	// for each alt, find matching ref motifs
	for (const i of alt_motifs) {
		i.pvalue_alt = i.pvalue
		delete i.pvalue
		i.logpvalue_alt = i.logpvalue
		delete i.logpvalue

		if (!allmotifs.has(i.name)) allmotifs.set(i.name, [])

		// see if any ref match
		let nomatch = true
		for (const j of allmotifs.get(i.name)) {
			if (
				j.logpvalue_ref != undefined &&
				j.strand == i.strand &&
				Math.abs(i.start - j.start) <= 2 &&
				Math.abs(i.stop - j.stop) <= 2
			) {
				/* alt (i) match to ref (j)
				   keep j and modify
				*/
				j.pvalue_alt = i.pvalue_alt
				j.logpvalue_alt = i.logpvalue_alt

				j.logpvaluediff = i.logpvalue_alt - j.logpvalue_ref
				if (j.logpvaluediff > 0) {
					j.gain = true
				} else {
					j.loss = true
				}
				nomatch = false

				break
			}
		}
		if (nomatch) {
			allmotifs.get(i.name).push(i)
		}
	}

	let valuemax = 0,
		valuemin = 0
	const tflst = []
	for (const items of allmotifs.values()) {
		for (const i of items) {
			if (i.logpvaluediff == undefined) {
				if (i.pvalue_ref == undefined) {
					// only alt
					i.gain = true
					i.logpvaluediff = i.logpvalue_alt
				} else if (i.pvalue_alt == undefined) {
					// only ref
					i.loss = true
					i.logpvaluediff = -i.logpvalue_ref
				}
			}
			// now each tf hit gets logpvaluediff

			if (q.minabslogp != undefined) {
				if (Math.abs(i.logpvaluediff) < q.minabslogp) {
					continue
				}
			}

			if (i.logpvaluediff > 0) {
				valuemax = Math.max(valuemax, i.logpvaluediff)
			} else {
				valuemin = Math.min(valuemin, i.logpvaluediff)
			}

			tflst.push(i)
		}
	}

	return {
		items: tflst,
		valuemin,
		valuemax,
		refstart,
		refstop,
		refseq: ref_fasta.split('\n').slice(1).join('')
	}
}

function fimo_mutate_seq(m, start, stop, fasta) {
	const lines = fasta.split('\n')
	const ref = lines.slice(1).join('')
	return (
		lines[0] +
		'\n' +
		ref.substr(0, m.pos - start) +
		(m.alt == '-' ? '' : m.alt) +
		ref.substr(m.pos - start + (m.ref == '-' ? 0 : m.ref.length))
	)
}

async function run_fimo(q, gn, fasta) {
	/*
	 * return {}
	 * k: motif name
	 * v: []
	 */

	const fastafile = path.join(serverconfig.cachedir, Math.random().toString())
	await utils.write_file(fastafile, fasta)

	return new Promise((resolve, reject) => {
		const lst = ['--parse-genomic-coord', '--verbosity', 1, '--text']

		if (q.fimo_thresh) {
			lst.push('--thresh')
			lst.push(q.fimo_thresh)
		}

		lst.push(gn.fimo_motif.db)
		lst.push(fastafile)

		const ps = spawn(fimo, lst)
		const out = []
		ps.stdout.on('data', i => out.push(i))
		ps.on('error', e => reject('cannot run fimo'))
		ps.on('close', code => {
			fs.unlink(fastafile, () => {})

			const tmp = out.join('').trim()

			if (!tmp) {
				// no hits
				resolve([])
			}

			/*
			1	motif_id	AP2B_HUMAN.H11MO.0.B
			2	motif_alt_id	
			3	sequence_name	chr5
			4	start	1295121
			5	stop	1295130
			6	strand	+
			7	score	12.5056
			8	p-value	2.6e-05
			9	q-value	
			10	matched_sequence	GGCCGGGGAC
			*/

			const items = []

			const lines = tmp.split('\n')
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i]
				const l = line.split('\t')
				const tfname = l[0].split('_')[0]

				const start = Number.parseInt(l[4 - 1])
				const stop = Number.parseInt(l[5 - 1])

				if (start > q.m.pos || stop < q.m.pos + 1) continue

				const pvalue = Number.parseFloat(l[8 - 1])

				const j = {
					start: start,
					stop: stop,
					strand: l[6 - 1],
					name: tfname,
					pvalue: pvalue,
					score: Number.parseFloat(l[7 - 1]),
					logpvalue: -Math.log10(pvalue)
				}

				if (gn.fimo_motif.tf2attr) {
					j.attr = gn.fimo_motif.tf2attr[j.name]
				}

				items.push(j)
			}
			resolve(items)
		})
	})
}
