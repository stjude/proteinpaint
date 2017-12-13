/*
from bedj-format text file of a gene track, convert to new text file for loading to a gene table in db

bedj format:

1. chr
2. start
3. stop
4. JSON
   .name
   .isoform


all gene tracks loads to the same table, for querying by gene name and isoform
another optional table for gene alias

table format:

1. name
2. isoform
3. is default?
4. JSON



*/




if(process.argv.length!=5) {
	console.log('<bedj text file> <default isoform file> <trackname (RefGene/GENCODE)> output to stdout')
	process.exit()
}


const bedjfile = process.argv[2]
const defaultisoformfile = process.argv[3]
const trackname=process.argv[4]


const defaultisoform=new Set()

const fs=require('fs')

for(const line of fs.readFileSync(defaultisoformfile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	defaultisoform.add(l[1])
}


for(const line of fs.readFileSync(bedjfile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	const g=JSON.parse(l[3])
	g.chr=l[0]
	g.start=Number.parseInt(l[1])
	g.stop=Number.parseInt(l[2])
	g.trackname=trackname

	console.log(g.name+'\t'+g.isoform+'\t'+(defaultisoform.has(g.isoform) ? 1 : 0)+'\t'+JSON.stringify(g))
}
