if(process.argv.length!=3) {
	console.log('<input gene-by-sample FPKM matrix> output to stdout')
	process.exit()
}


const exec=require('child_process').execSync
const fs=require('fs')


const infile=process.argv[2]

const lines=fs.readFileSync(infile,{encoding:'utf8'}).trim().split('\n')

const samples = lines[0].split('\t').slice(3)

for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')
	const gene = l[1]
	const coord = l[2].split(/[:-]/)
	for(const [j, sample] of samples.entries()) {
		const v = Number.parseFloat(l[j+3])
		if(v==0) continue
		const k={sample:sample, value:v, gene:gene}
		console.log('chr'+coord[0]+'\t'+coord[1]+'\t'+coord[2]+'\t'+JSON.stringify(k))
	}
}
