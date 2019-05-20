const app = require('../app')
const fs = require('fs')
const utils = require('./utils')
const spawn = require('child_process').spawn
const path = require('path')



const serverconfig = __non_webpack_require__('./serverconfig.json')
const fimo = serverconfig.fimo || 'fimo'



exports.handle_closure = (genomes) =>{
	return async (req, res) => {
		if(app.reqbodyisinvalidjson(req,res)) return
		try {
			const q = req.query
			if(!q.m) throw 'no mutation'
			if(!q.m.chr) throw 'mutation chr missing'
			if(!Number.isInteger(q.m.pos)) throw 'mutation position is not integer'
			if(!q.m.ref) throw 'mutation ref allele missing'
			if(!q.m.alt) throw 'mutation alt allele missing'
			const gn = genomes[q.genome]
			if(!gn) throw 'invalid genome'
			if(!gn.fimo_motif) throw 'motif finding not supported on this genome'
			const result = await handle_fimo_do( q, gn )
			res.send( result )
		} catch(e) {
			if(e.stack) console.log(e.stack)
			res.send({error: (e.message || e)})
		}
	}
}




function fimo_may_updateallele ( q, start, ref_fasta ) {
// retrieved seq flanking the q.m from forward strand
// tell if the q.m alleles are from reverse strand, and if so change to forward

	// do not deal with these
	if(!q.m.ref) return
	if(q.m.ref=='-') return

	// remove fasta header
	const seq = ref_fasta.split('\n').slice(1).join('').toUpperCase()

	// nt string at m.pos matching length of m.ref
	const forward = seq.substring( q.m.pos - start, q.m.pos-start+q.m.ref.length )

	if(forward == q.m.ref.toUpperCase()) {
		// ref is from forward strand
		//console.log('forward')
		return
	}

	// make reverse compliment using forward
	const reverse = common.reversecompliment( forward )
	if(reverse == q.m.ref.toUpperCase()) {
		//console.log('is reverse')
		q.m.ref = forward
		if(q.m.alt!='-') {
			q.m.alt = common.reversecompliment( q.m.alt )
		}
		return
	}
	//console.log('dont know')
}



async function handle_fimo_do ( q, gn ) {
/*
do motif finding on ref sequence
mutate ref seq
do motif finding on mutant seq
then find motif change
*/
	///////// scan reference sequence

	const refstart = q.m.pos-q.flankspan
	const refstop = q.m.pos+q.flankspan

	const ref_fasta = await utils.get_fasta( gn, q.m.chr+':'+refstart+'-'+refstop )
	console.log(ref_fasta)
	fimo_may_updateallele( q, refstart, ref_fasta )

	const ref_motifs = await run_fimo( q, gn, ref_fasta )

	// index ref motifs by tf name
	const allmotifs = {}
	// k: tf name
	// v: [ {} ]
	//   .isref
	//   .isalt
	//   .logpvaluediff
	for(const i of ref_motifs) {
		i.isref = 1
		if(!allmotifs[ i.name ]) {
			allmotifs[ i.name ] = []
		}
		allmotifs[ i.name ].push( i )
	}


	const alt_fasta = fimo_mutate_seq( q.m, refstart, refstop, ref_fasta )
	const alt_motifs = await run_fimo( q, gn, alt_fasta )

	// index alt motifs and compare
	// for each alt, find matching ref motifs
	for(const i of alt_motifs) {
		i.isalt = 1
		if(!allmotifs[ i.name ]) {
			allmotifs[ i.name ] = []
		}

		// see if any ref match
		let nomatch=true
		for(const j of allmotifs[ i.name ]) {
			if(j.isref
				&& j.strand == i.strand
				&& Math.abs(i.start-j.start)<=2
				&& Math.abs(i.stop-j.stop)<=2
				) {
				// alt (i) match to ref (j)
				// keep j and modify
				delete j.isref
				j.logpvaluediff = i.logpvalue - j.logpvalue
				if(j.logpvaluediff > 0) {
					j.gain = 1
				} else {
					j.loss = 1
				}
				nomatch=false
				break
			}
		}
		if(nomatch) {
			allmotifs[ i.name ].push( i )
		}
	}


	let valuemax=0,
		valuemin=0
	const items = [] // items to go to bed track, with gain/loss indicated (color)
	for(const tf in allmotifs) {

		for(const i of allmotifs[ tf ]) {

			if(i.isref) {
				i.loss=1
				i.logpvaluediff = -i.logpvalue
			} else if(i.isalt) {
				i.gain = 1
				i.logpvaluediff = i.logpvalue
			}

			if(q.minabslogp) {
				if(Math.abs(i.logpvaluediff) < q.minabslogp) {
					continue
				}
			}

			if(i.logpvaluediff > 0) {
				valuemax = Math.max( valuemax, i.logpvaluediff)
			} else {
				valuemin = Math.min( valuemin, i.logpvaluediff)
			}
			
			items.push(i)
		}
	}

	return {
		items, 
		valuemin,
		valuemax,
		refstart,
		refstop,
		refseq: ref_fasta.split('\n').slice(1).join('')
	}
}







function fimo_mutate_seq ( m, start, stop, fasta ) {
	const lines = fasta.split('\n')
	const ref = lines.slice(1).join('')
	return lines[0]
		+'\n'
		+ref.substr( 0, m.pos - start )
		+ (m.alt=='-' ? '' : m.alt)
		+ ref.substr( m.pos - start + (m.ref=='-' ? 0 : m.ref.length) )
}




async function run_fimo ( q, gn, fasta ) {
/*
 * return {}
 * k: motif name
 * v: []
 */

	const fastafile = path.join(serverconfig.cachedir, Math.random().toString() )
	await utils.write_file( fastafile, fasta )

	return new Promise(( resolve, reject ) => {

		const lst = ['--parse-genomic-coord', '--verbosity', 1, '--text']

		if(q.fimo_thresh) {
			lst.push('--thresh')
			lst.push(q.fimo_thresh)
		}

		lst.push( gn.fimo_motif.db )
		lst.push( fastafile )


		const ps = spawn( fimo, lst )
		const out = []
		ps.stdout.on('data',i=> out.push(i))
		ps.on('close',code=>{

			fs.unlink( fastafile, ()=>{} )

			const tmp = out.join('').trim()

			if(!tmp) {
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
			for(let i=1; i<lines.length; i++) {
				const line = lines[i]
				const l = line.split('\t')
				const tfname = l[0].split('_')[0]

				const start = Number.parseInt(l[4-1])
				const stop =  Number.parseInt(l[5-1])

				if( start> q.m.pos || stop< q.m.pos+1 ) continue

				const pvalue = Number.parseFloat( l[8-1] )

				const j = {
					start: start,
					stop: stop,
					strand: l[6-1],
					name: tfname,
					pvalue: pvalue,
					score: Number.parseFloat( l[7-1]),
					logpvalue: -Math.log10( pvalue ),
				}

				if(gn.fimo_motif.tf2attr) {
					j.attr = gn.fimo_motif.tf2attr[ j.name ]
				}

				items.push(j)
			}
			resolve( items )
		})
	})
}

