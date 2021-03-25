function argerror(m) {
	console.log('ERROR: '+m+`
  --genome=         path to the .gz samtools fasta db
  --mutation=       chr1:123:REF:ALT
                    limit to snv for now!!
  --fimo_thresh=    1e-4 (default)
  --outfile=        output file basename, to tp/xzhou/meme/[file].gz
`)
	process.exit()
}

function abort(m) {
	console.log('ERROR: '+m)
	process.exit()
}

const arg = {}
for(let i=2; i<process.argv.length; i++) {
	const [a,b] = process.argv[i].split('=')
	arg[a.substr(2)] = b
}

if(!arg.genome) argerror('genome missing')
if(!arg.mutation) argerror('mutation missing')
{
	const t = arg.mutation.split(':')
	if(t.length!=4) argerror('cannot parse mutation')
	arg.chr = t[0]
	arg.mutationpos = Number.parseInt( t[1])
	if(!Number.isInteger(arg.mutationpos)) argerror('mutation position is not integer')
	arg.refallele = t[2]
	arg.altallele = t[3]
}
if(!arg.outfile) argerror('output file name missing')




const flankspan = 15 // bp length flanking the mutation






const fs=require('fs')
const exec=require('child_process').execSync
const readline=require('readline')


///////// scan reference sequence

const refstart = arg.mutationpos-flankspan
const refstop = arg.mutationpos+flankspan


const ref_fasta = exec('samtools faidx '+arg.genome+' '+arg.chr+':'+refstart+'-'+refstop,{encoding:'utf8'}).trim()
const ref_motifs = run_fimo( ref_fasta )
console.log('ref motifs: '+ref_motifs.length)

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



const alt_fasta = mutate_seq( refstart, refstop, ref_fasta )
const alt_motifs = run_fimo( alt_fasta )
console.log('alt motifs: '+alt_motifs.length)

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
			continue
		}
	}
	if(nomatch) {
		allmotifs[ i.name ].push( i )
	}
}




let valuemax=0,
	valuemin=0
for(const tf in allmotifs) {

	for(const i of allmotifs[ tf ]) {

		if(i.isref) {
			i.loss=1
			i.logpvaluediff = -i.logpvalue
		} else if(i.isalt) {
			i.gain = 1
			i.logpvaluediff = i.logpvalue
		}

		if(i.logpvaluediff > 0) {
			valuemax = Math.max( valuemax, i.logpvaluediff)
		} else {
			valuemin = Math.min( valuemin, i.logpvaluediff)
		}
	}
}
console.log('log-p min: '+valuemin)
console.log('log-p max: '+valuemax)


const items = [] // items to go to bed track, with gain/loss indicated (color)
for(const tf in allmotifs) {
	for(const i of allmotifs[ tf ]) {
		if(i.gain) {
			const v = Math.floor( 255 * (1 - i.logpvaluediff/valuemax) )
			i.color = 'rgb(255,'+v+','+v+')'
		} else {
			const v = Math.floor( 255 * (1 - i.logpvaluediff/valuemin) )
			i.color = 'rgb('+v+','+v+',255)'
		}
		items.push(i)
	}
}



items.sort((i,j)=> i.start-j.start)
const lines = items.map(i => arg.chr+'\t'+(i.start-1)+'\t'+(i.stop-1)+'\t'+JSON.stringify(i) )

const file = '/home/xzhou1/tp/xzhou/meme/'+arg.outfile

fs.writeFileSync( file, lines.join('\n') )

exec( 'bgzip -f '+file)
exec( 'tabix -f -p bed '+file+'.gz')








function mutate_seq ( start, stop, fasta ) {
	const lines = fasta.split('\n')
	const ref = lines.slice(1).join('')

	// SNV
	return lines[0]
		+'\n'
		+ref.substr( 0, arg.mutationpos-start)
		+ arg.altallele
		+ ref.substr( arg.mutationpos-start+1 )
}


function run_fimo ( fasta ) {
/*
 * return {}
 * k: motif name
 * v: []
 */

	const tmpfile = Math.random().toString()
	fs.writeFileSync( tmpfile, fasta )

	const cmd = '/research/rgs01/resgen/legacy/gb_customTracks/tp/utils/meme/meme-5.0.4/src/fimo'
		+' --parse-genomic-coord'
		+' --thresh '+(arg.fimo_thresh || 1e-4)
		+' --verbosity 1'
		+' --text'
		+' /research/rgs01/resgen/legacy/gb_customTracks/tp/utils/meme/motif_databases/HUMAN/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme'
		+' '+tmpfile
	const tmp = exec( cmd, {encoding:'utf8'}).trim()

	fs.unlinkSync( tmpfile )

	if(!tmp) {
		// no hits
		return []
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

		if( start> arg.mutationpos || stop< arg.mutationpos ) continue

		const logp = -Math.log10( l[8-1] )

		const j = {
			start: start,
			stop: stop,
			strand: l[6-1],
			name: tfname,
			logpvalue: logp
		}
		items.push(j)
	}
	return items
}

