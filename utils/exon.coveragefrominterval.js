if(process.argv.length!=6) {
	console.error('<exon.gz tabix file> <chr> <start> <stop> output exonic bp length to stdout')
	process.exit()
}


const exonfile=process.argv[2]
const chr=process.argv[3]
const start=Number.parseInt(process.argv[4])
const stop=Number.parseInt(process.argv[5])

if(Number.isNaN(start) || Number.isNaN(stop)) {
	console.error('invalid start or stop position')
	process.exit()
}


const exec = require('child_process').execSync


const str = exec('tabix '+exonfile+' '+chr+':'+start+'-'+stop,{encoding:'utf8'}).trim()

if(!str) {
	console.log(0)
	process.exit()
}


const regions=[]

for(const line of str.split('\n')) {
	const l=line.split('\t')
	const exonstart= Math.max(start, Number.parseInt(l[1]))
	const exonstop= Math.min(stop, Number.parseInt(l[2]))

	let overlap=false
	for(const region of regions) {
		if(Math.max(region[0], exonstart) < Math.min(region[1], exonstop)) {
			overlap=true
			region[0] = Math.min(region[0], exonstart)
			region[1] = Math.max(region[1], exonstop)
			break
		}
	}

	if(overlap) {
		continue
	}

	regions.push([ exonstart, exonstop ])
}


const exoncoverage = regions.reduce( (i,j)=> i+j[1]-j[0], 0 )


console.log(exoncoverage)
