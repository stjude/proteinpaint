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
const pmid2dt = new Map()

const dt2name = new Map([[4,'CNV'],[10,'LOH'],[5,'SV'],[2,'fusion'],[6,'ITD']])


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


	if(j.dt==2) {
		// fusion
	} else if(j.dt==5) {
		// sv
	} else if(j.dt==4) {
		// cnv
	} else if(j.dt==6) {
		// itd
	} else if(j.dt==10) {
		// loh
	} else {
		abort('invalid dt: '+line)
	}


	{
		const chr = l[0]
		if(!chr2dt.has(chr)) chr2dt.set(chr, new Map())
		if(!chr2dt.get(chr).has(j.dt)) chr2dt.get(chr).set( j.dt, 0 )
		chr2dt.get(chr).set( j.dt, chr2dt.get(chr).get(j.dt)+1 )
	}

	//pmid
	{
		if(!j.mattr) abort('mattr missing: '+line)
		const PMID = j.mattr.pmid
		if (PMID){
			for(const pid of PMID.split(',')) {
				if(!pmid2dt.has(pid)) pmid2dt.set(pid, new Map())
				if(!pmid2dt.get(pid).has(j.dt)) pmid2dt.get(pid).set(j.dt, 0)
				pmid2dt.get(pid).set(j.dt, pmid2dt.get(pid).get(j.dt)+1)
			}
		}
		else{
			if(!pmid2dt.has('pmidMissed')) pmid2dt.pmidMissed = []
			pmid2dt.pmidMissed.push(j.sample)
		}
		
	}
})

rl.on('close',()=>{

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
	//pmid
	console.log('pmid\t'+lst.join('\t'))
	for(const [pmid, o] of pmid2dt) {
		if(pmid === 'pmidMissed') continue
		const pst = [pmid]
		for(const dt of dt2name.keys()){
			pst.push(o.get(dt)||0)
		}	
		console.log(pst.join('\t'))
	}
	console.log('\nSmples missing pmid:')
	console.log(pmid2dt.pmidMissed.join('\t'))
})
