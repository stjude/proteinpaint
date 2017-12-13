if(process.argv.length!=4) {
	console.log('<dataset.js file> <TP directory> output to stdout')
	process.exit()
}

const fs=require('fs')
const path=require('path')
const d3dsv=require('d3-dsv')
const exec=require('child_process').execSync


// hardcoded but configurable
const key_svcnv = 'svcnv'
const key_genefpkm = 'genefpkm'
const levelkey = 'diagnosis_short'


const datasetfile = process.argv[2]
const tpmasterdir = process.argv[3]


const ds = require(datasetfile)



if(!ds.cohort) abort('cohort missing')
if(!ds.cohort.files) abort('cohort.files missing')
if(!ds.queries) abort('queries missing')
const svcnv = ds.queries[key_svcnv]
if(!svcnv) abort('queries.'+key_svcnv+' missing')
if(!svcnv.file) abort('queries.'+key_svcnv+'.file missing')
const genefpkm = ds.queries[key_genefpkm]
if(!genefpkm) abort('queries.'+key_genefpkm+' missing')
if(!genefpkm.file) abort('queries.'+key_genefpkm+'.file missing')
svcnv.file = path.join( tpmasterdir, svcnv.file )
genefpkm.file = path.join( tpmasterdir, genefpkm.file )



// cohort
ds.cohort.annotation = {}
for(const f of ds.cohort.files) {
	const text = fs.readFileSync( path.join(tpmasterdir, f.file), {encoding:'utf8'} ).trim()
	const items=d3dsv.tsvParse(text)
	items.forEach( i=> ds.cohort.tohash(i, ds))
}


{
	const tmp = exec( 'tabix -H '+genefpkm.file, {encoding:'utf8'} ).trim()
	genefpkm.samples = tmp.split(' ').slice(1)
	if(genefpkm.samples.length==0) abort('no samples from '+key_genefpkm)
}



const tmpcnvfile = Math.random().toString()
exec('bgzip -d -c '+svcnv.file+' > '+tmpcnvfile)

const lines = fs.readFileSync(tmpcnvfile,{encoding:'utf8'}).trim().split('\n')
for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')
	const chr=l[0]
	const start=Number.parseInt(l[1])
	const stop=Number.parseInt(l[2])
	const j = JSON.parse(l[3])

	if(!j.start_sv && !j.stop_sv && !j.match_sv) continue

	if(Math.abs(j.value)<0.2) continue

	if(!j.sample) continue
	if(!ds.cohort.annotation[j.sample]) continue

	const levelvalue = ds.cohort.annotation[j.sample][levelkey]
	if(!levelvalue) continue

	if(genefpkm.samples.indexOf(j.sample)==-1) {
		// sample not in genefpkm
		continue
	}

	const lst = checkrank(chr, start, stop, j.sample, levelvalue)

	const high = lst.filter( i=> i.value>10 && i.rank>=95 )

	if(high.length) {
		console.log( j.sample+'\t'+chr+'\t'+start+'\t'+stop+'\t'+j.value+'\t'+JSON.stringify(high) )
	}
}




function checkrank(chr, start, stop, sample, levelvalue) {
	const gene2value = new Map()
	// v: {all, this}

	const str=exec( 'tabix '+genefpkm.file+' '+chr+':'+start+'-'+stop, {encoding:'utf8'} ).trim()
	if(!str) return []

	for(const line of str.split('\n') ) {
		const l = line.split('\t')
		const j = JSON.parse(l[3])
		if(!j.sample) continue

		if(j.sample==sample) {
			if(!gene2value.has(j.gene)) {
				gene2value.set(j.gene, {allvalue:[]})
			}
			gene2value.get(j.gene).thisvalue = j.value
			continue
		}

		if(!ds.cohort.annotation[j.sample]) continue
		if(ds.cohort.annotation[j.sample][levelkey] != levelvalue) continue
		if(!gene2value.has(j.gene)) {
			gene2value.set(j.gene, {allvalue:[]} )
		}
		gene2value.get(j.gene).allvalue.push( j.value )
	}

	const lst=[]
	for(const [gene, o] of gene2value) {
		o.allvalue.sort((i,j)=>i-j)
		const idx = o.allvalue.findIndex(i=>i>o.thisvalue)
		let rank
		if(idx==-1) rank=100
		else {
			rank = Math.ceil(100*idx/o.allvalue.length)
		}
		lst.push({gene:gene,rank:rank,value:o.thisvalue})
	}
	return lst
}




function abort(msg) {
	console.log(msg)
	process.exit()
}
