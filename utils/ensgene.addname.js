if(process.argv.length!=4) {
	console.log('<bedj output for ensGene track> <transcript id 2 gene symbol> output to stdout')
	process.exit()
}


const fs=require('fs')

const bedjfile = process.argv[2]
const namefile = process.argv[3]


const id2name = new Map()
for(const line of fs.readFileSync(namefile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	id2name.set(l[0],l[1])
}


for(const line of fs.readFileSync(bedjfile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	const j=JSON.parse(l[3])
	if(id2name.has(j.isoform)) {
		j.name=id2name.get(j.isoform)
	}
	console.log(l[0]+'\t'+l[1]+'\t'+l[2]+'\t'+JSON.stringify(j))
}
