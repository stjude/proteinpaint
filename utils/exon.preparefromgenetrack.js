if(process.argv.length!=3) {
	console.log('<gene bedj text file as input> output exon bed file to stdout')
	process.exit()
}


const infile=process.argv[2]

const fs=require('fs')


for(const line of fs.readFileSync(infile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	const chr=l[0]
	const j = JSON.parse(l[3])
	if(j.coding) {
		for(const e of j.exon) {
			console.log(chr+'\t'+e[0]+'\t'+e[1])
		}
	}
}
