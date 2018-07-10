const spawn = require('child_process').spawn
const readline = require('readline')

const abort=m=>{
	console.error('Error: '+m)
	process.exit()
}

if(process.argv.length!=5) abort('<BAM file> <intra-chr min bp> <y/n to add "chr">')

const bamfile=process.argv[2]
if(!bamfile) abort('no BAM file')

let intradist_min = process.argv[3]
if(!intradist_min) intradist_min = 500
intradist_min = Number.parseInt(intradist_min)
if(Number.isNaN(intradist_min)) abort('invalid min distance')

const addchr = process.argv[4]





const ps = spawn('samtools',['view', bamfile])

const rl = readline.createInterface({
	input: ps.stdout
})



rl.on('line',line=>{

	if(line[0]=='#') return

	const l = line.split('\t')

	const qname = l[0]
	const flag = Number.parseInt(l[1])
	const rname = l[2]
	const pos = Number.parseInt(l[3]) -1
	const mapq = Number.parseInt(l[4])
	const ciga = l[5]
	const rnext = l[6]
	const pnext = Number.parseInt(l[7]) -1
	const tlen = Number.parseInt(l[8])

	if(mapq < 10 || mapq==255) {
		return
	}

	if(!(flag & 0x2)) {
		return
	}
	if(flag & 0x4) {
		return
	}
	if(flag & 0x8) {
		return
	}
	if(flag & 0x80) {
		// second in pair
		return
	}

	if(rnext=='=') {
		if( Math.abs(tlen) > intradist_min ) {
			const chr = (addchr ? 'chr':'')+rname
			const i = {
				dt:5,
				chrB: chr,
				posB: pnext,
				qname:qname,
				sample:'1'
			}
			console.log(chr+'\t'+pos+'\t'+pos+'\t'+JSON.stringify(i))
			const j = {
				dt:5,
				chrA: chr,
				posA: pos,
				qname:qname,
				sample:'1'
			}
			console.log(chr+'\t'+pnext+'\t'+pnext+'\t'+JSON.stringify(j))
		}
		return
	}

	const chr1 = (addchr ? 'chr' : '')+rname
	const chr2 = (addchr ? 'chr' : '')+rnext

	const i = {
		dt: 5,
		chrB: chr2,
		posB: pnext,
		sample:'1'
	}
	console.log(chr1+'\t'+pos+'\t'+pos+'\t'+JSON.stringify(i))
	const j = {
		dt: 5,
		chrA: chr1,
		posA: pos,
		sample:'1'
	}
	console.log(chr2+'\t'+pnext+'\t'+pnext+'\t'+JSON.stringify(j))
})
