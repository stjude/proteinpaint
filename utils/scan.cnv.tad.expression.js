if(process.argv.length!=3) {
	console.log('<config.js file> output to stdout')
	process.exit()
}




const fs=require('fs')
const path=require('path')
const readline=require('readline')
const d3dsv = require('d3-dsv')


const configfile = process.argv[2]

const ds = require(configfile)

function abort(m) {
	console.error('Error: '+m)
	process.exit()
}



///////////////////// validate ds
if(!ds.cohort) abort('cohort missing from ds')
if(!ds.hicTADfiles) abort('hicTADfiles missing from ds')
if(!ds.queries) abort('queries missing from ds')
if(!ds.queries.svcnv) abort('svcnv missing from ds.queries')
if(!ds.queries.svcnv.textfile) abort('textfile missing from ds.queries.svcnv') // this is a text file
if(!ds.queries.genefpkm) abort('genefpkm missing from ds.queries')
if(!ds.queries.genefpkm.file) abort('file missing from ds.queries.genefpkm')




// sample annotation load to here
ds.cohort.annotation = {}


// parse sample annotation to ds.cohort.annotation
for(const file of ds.cohort.files) {
	for(const item of d3dsv.tsvParse( fs.readFileSync(file.file, {encoding:'utf8'}).trim())) {
		ds.cohort.tohash( item, ds )
	}
}




// parse hic TAD, figure out domain boundaries, each separating a pair of neighbouring TAD
// max bp length of domain boundary, above which won't consider
const maxlen_domainboundary = 20000
// max overlap length, above which do not consider as neighboring domains
const maxlen_domainoverlap = 500 

for(const file of ds.hicTADfiles) {

	console.error('parsing TAD: '+file.file)

	file.chr2boundaries = {}

	const chr2domains = new Map()

	for(const line of fs.readFileSync(file.file, {encoding:'utf8'}).trim().split('\n')) {
		const l = line.split('\t')
		const chr=l[0]
		if(!chr2domains.has(chr)) {
			chr2domains.set(chr, [])
		}
		const start=Number.parseInt(l[1])
		const stop=Number.parseInt(l[2])

		chr2domains.get(chr).push( [start, stop] )
	}

	for(const [chr, domains] of chr2domains) {
		file.chr2boundaries[chr]=[]
		for(let i=0; i<domains.length-1; i++) {

			const start1 = domains[i][0]
			const stop1  = domains[i][1]

			for(let j=i+1; j<domains.length; j++) {

				const start2 = domains[j][0]
				const stop2  = domains[j][1]

				if( start2 - stop1 >= maxlen_domainboundary) {
					// too far off
					break
				}

				if(stop1 - start2 <= maxlen_domainoverlap) {
					// within limit of overlap, consider neighbouring
					file.chr2boundaries[chr].push({
						start: Math.min(stop1, start2),
						stop:  Math.max(stop1, start2),
						leftdomain: { start:start1, stop:stop1 },
						rightdomain: {start:start2, stop:stop2 }
					})
				}
			}
		}
	}

	if(0) {
		for(const chr in file.chr2boundaries) {
			for(const b of file.chr2boundaries[chr]) {
				console.log(path.basename(file.file), chr, JSON.stringify(b) )
			}
		}
	}
}




// parse cnv
for(const line of fs.readFileSync(ds.queries.svcnv.textfile,{encoding:'utf8'}).trim().split('\n')) {

	if(line[0]=='#') continue

	const l = line.split('\t')
	const chr = l[0]
	const start = Number.parseInt(l[1])
	const stop  = Number.parseInt(l[2])
	const cnv = JSON.parse(l[3])

	if(!cnv.value) {
		// not a cnv
		continue
	}

	// boundaries fully contained in it
	const boundaries = []
	for(const hic of ds.hicTADfiles) {

		if(!hic.chr2boundaries[ chr ]) continue

		for(const boundary of hic.chr2boundaries[chr]) {
			if(start < boundary.start && stop > boundary.stop) {
				const save = {
					hicfile: hic.file
				}
				for(const k in boundary) save[k] = boundary[k]

				boundaries.push(boundary)
			}
		}
	}

	if(boundaries.length==0) continue


	console.log(chr,start,stop,boundaries.length)
}
