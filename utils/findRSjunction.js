if(process.argv.length!=5) {
	console.log('<RS site file> <junction.gz> <maf.gz>')
	process.exit()
}


const fs=require('fs')
const exec=require('child_process').execSync
const lazy=require('lazy')

const sitefile=process.argv[2]
const junctionfile=process.argv[3]
const maffile=process.argv[4]


const stalledjunctions=[]


new lazy(fs.createReadStream(sitefile))

.on('end',()=>{
	stalledjunctions.sort((a,b)=>{
		return b.v-a.v
	})

	for(const j of stalledjunctions) {
		console.log(j.chr+':'+j.start+'-'+j.stop+'\t'+j.v+'\t'+j.snv.join(','))
	}
})

.lines
.map(String)
.forEach(line=>{
	const l=line.split('\t')

	const chr=l[0]
	const pos=Number.parseInt(l[1])
	const forward=l[2]=='+'

	const str=exec('tabix '+junctionfile+' '+chr+':'+pos+'-'+pos,{encoding:'utf8'}).trim()
	if(str=='') {
		return
	}

	for(const ln2 of str.split('\n')) {
		const l=ln2.split('\t')
		const start=Number.parseInt(l[1])
		const stop=Number.parseInt(l[2])
		const v=Number.parseInt(l[3])

		if(forward && stop==pos) {
			const snv=hasvariant(chr, stop, stop+5)
			if(snv) {
				//console.log(chr+':'+start+'-'+stop+'\t'+v)
				stalledjunctions.push({
					chr:chr,
					start:start,
					stop:stop,
					v:v,
					snv:snv
				})
			}
			continue
		}
		if(!forward && start==pos) {
			const snv=hasvariant(chr,start-5,start)
			if(snv) {
				//console.log(chr+':'+start+'-'+stop+'\t'+v)
				stalledjunctions.push({
					chr:chr,
					start:start,
					stop:stop,
					v:v,
					snv:snv
				})
			}
		}
	}
})



const ntset=new Set(['A','T','C','G'])


function hasvariant(chr, start, stop) {
	const cmd='tabix '+maffile+' '+chr.replace('chr','')+':'+start+'-'+stop
	const str=exec(cmd,{encoding:'utf8'}).trim()
	if(str=='') return false
	// find snv
	const snv=[]
	for(const line of str.split('\n')) {
		const l=line.split('\t')
		const ref=l[19]
		const alt1=l[20]
		const alt2=l[21]
		const alt= alt1==ref ? alt2 : alt1
		if(ntset.has(ref) && ntset.has(alt)) {
			snv.push(l[28]+' '+ref+'>'+alt)
		}
	}
	if(snv.length) {
		return snv
	}
	return false
}
