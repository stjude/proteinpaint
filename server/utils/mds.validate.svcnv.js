/*
.mattr{} is required for all items
*/




function abort(m) {
	console.log(m)
	process.exit()
}



const infile = process.argv[2]
if(!infile) abort('<input .gz file for CNV/LOH/SV/fusion/ITD> output stats to stdout')



const fs=require('fs')
const readline=require('readline')
const zlib=require('zlib')


const chr2dt = new Map()
// k: chromosome
// v: map
//    k: dt, v: # of variants

const pmid2dt = new Map()
// k: pmid
// v: map
//    k: dt, v: #variants

const dt2name = new Map([[4,'CNV'],[10,'LOH'],[5,'SV'],[2,'fusion'],[6,'ITD']])

const dt2totalcount = new Map()
// k: dt
// v: count



/*
arbitrary things may be configurable in future
*/
const mattr_dnaassay = 'dna_assay'
const dt2dnaassay = new Map()


const rl = readline.createInterface({input: fs.createReadStream( infile ).pipe(zlib.createGunzip()) })
rl.on('line',line=>{

	if(line[0]=='#') return
	const l = line.split('\t')

	if(l.length!=4) abort('not 4 columns: '+line)

	const start=Number.parseInt(l[1])
	const stop =Number.parseInt(l[2])
	if(stop < start) abort('stop < start: '+line)

	const j = JSON.parse(l[3])
	if(!Number.isInteger(j.dt)) abort('dt missing: '+line)

	j.start = start
	j.stop = stop


	if(j.dt==2 || j.dt==5) {
		// fusion 2, or sv 5
		if(j.chrA) {
			if(typeof j.chrA != 'string') abort('chrA value not string: '+line)
			if(!j.posA) abort('posA missing: '+line)
			if(!Number.isInteger(j.posA)) abort('posA value not integer: '+line)
		} else {
			if(!j.chrB) abort('chrA and chrB missing: '+line)
			if(typeof j.chrB != 'string') abort('chrB value not string: '+line)
			if(!j.posB) abort('posB missing: '+line)
			if(!Number.isInteger(j.posB)) abort('posB value not integer: '+line)
		}

	} else if(j.dt==4) {
		// cnv
	} else if(j.dt==6) {
		// itd
	} else if(j.dt==10) {
		// loh
	} else {
		abort('invalid dt: '+line)
	}



	if(!dt2totalcount.has(j.dt)) dt2totalcount.set( j.dt, 0 )
	dt2totalcount.set( j.dt, dt2totalcount.get(j.dt)+1 )



	{
		const chr = l[0]
		if(!chr2dt.has(chr)) chr2dt.set(chr, new Map())
		if(!chr2dt.get(chr).has(j.dt)) chr2dt.get(chr).set( j.dt, 0 )
		chr2dt.get(chr).set( j.dt, chr2dt.get(chr).get(j.dt)+1 )
	}

	// all the rest requires mattr
	if(!j.mattr) abort('mattr missing: '+line)

	apply_pmid(j)
		

	apply_dnaassay(j)
})

rl.on('close',()=>{

	console.log('TOTAL per dt')
	for(const [dt,c] of dt2totalcount) {
		console.log(dt2name.get(dt)+': '+c)
	}

	console.log('\nDNA assay per dt')
	for(const [dt,c] of dt2dnaassay) {
		console.log(dt2name.get(dt)+':')
		for(const [v,c2] of c.assayname2count) {
			console.log('\t'+v+': '+c2)
		}
		if(c.missingnumber) {
			console.log('\tNo DNA assay: '+c.missingnumber)
		}
	}


	console.log('\nPer chromosome')
	const lst = []
	for(const name of dt2name.values()) lst.push(name)
	console.log('chr\t'+ lst.join('\t') )

	for(const [chr, o] of chr2dt) {
		const lst = [chr]
		for(const dt of dt2name.keys()) {
			lst.push( o.get(dt) || 0 )
		}
		console.log(lst.join('\t'))
	}

	console.log('\nPer PMID')
	console.log('pmid\t'+lst.join('\t'))
	for(const [pmid, o] of pmid2dt) {
		if(pmid === 'pmidMissed') continue
		const pst = [pmid]
		for(const dt of dt2name.keys()){
			pst.push(o.get(dt)||0)
		}	
		console.log(pst.join('\t'))
	}
	console.log('\nSamples missing pmid:')
	console.log(pmid2dt.pmidMissed.join('\t'))
})


function apply_pmid(j) {
	const PMID = j.mattr.pmid
	if (PMID){
		for(const pid of PMID.split(',')) {
			if(!pmid2dt.has(pid)) pmid2dt.set(pid, new Map())
			if(!pmid2dt.get(pid).has(j.dt)) pmid2dt.get(pid).set(j.dt, 0)
			pmid2dt.get(pid).set(j.dt, pmid2dt.get(pid).get(j.dt)+1)
		}
		return
	}
	if(!pmid2dt.has('pmidMissed')) pmid2dt.pmidMissed = []
	pmid2dt.pmidMissed.push(j.sample)
}

function apply_dnaassay(j) {
	if(!dt2dnaassay.has(j.dt)) {
		dt2dnaassay.set(j.dt, {
			missingnumber:0,
			assayname2count: new Map()
		})
	}

	// temp filter for arm-level loh
	if(j.dt==10) {
		if(j.stop-j.start < 2000000 ) return
	}
	const a = dt2dnaassay.get(j.dt)
	const v = j.mattr[ mattr_dnaassay ]
	if(v) {
		a.assayname2count.set(v, (a.assayname2count.get(v) || 0)+1)
	} else {
		// missing dna assay
		a.missingnumber++
	}
}
