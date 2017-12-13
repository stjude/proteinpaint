if(process.argv.length!=4) {
	console.log('<gene bedj text file> <fpkm file> output bedj text data to stdout')
	process.exit()
}


const fs=require('fs')


const genefile=process.argv[2]
const fpkmfile=process.argv[3]


const geneup2coord={}
/*
k: gene upper case name
v: {}
   name: - actual name
   chrs: { chr: [   [start1,stop1],   [start2,stop2]  ] }

*/


for(const line of fs.readFileSync(genefile,{encoding:'utf8'}).trim().split('\n')) {
	const l=line.split('\t')
	const chr=l[0]
	const start=Number.parseInt(l[1])
	const stop=Number.parseInt(l[2])
	
	const j=JSON.parse(l[3])
	if(!j.name) continue

	const upname=j.name.toUpperCase()

	if(!geneup2coord[upname]) {

		// may add gene strand

		geneup2coord[upname]={
			name:j.name,
			chr:{}
		}
	}

	if(!geneup2coord[upname].chr[chr]) {
		geneup2coord[upname].chr[chr]=[]
	}

	let nomet=true
	for(const r of geneup2coord[upname].chr[chr]) {
		if(Math.max(r[0],start) <= Math.min(r[1],stop)) {
			r[0]=Math.min(r[0],start)
			r[1]=Math.max(r[1],stop)
			nomet=false
			break
		}
	}
	if(nomet) {
		geneup2coord[upname].chr[chr].push([ start, stop ])
	}
}


const readline=require('readline')

const r=readline.createInterface({input:fs.createReadStream(fpkmfile, {encoding:'utf8'})})

r.on('line',line=>{
	const [lowgene, value, sample] = line.split('\t')

	const upgene=lowgene.toUpperCase()

	if(geneup2coord[upgene]) {
		for(const chr in geneup2coord[upgene].chr) {
			for(const r of geneup2coord[upgene].chr[chr]) {
				const j={sample:sample, value:value, gene:geneup2coord[upgene].name}
				console.log(chr+'\t'+r[0]+'\t'+r[1]+'\t'+JSON.stringify(j))
			}
		}
	}
	// may report missing
})
