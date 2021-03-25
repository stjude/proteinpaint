if(process.argv.length!=4) {
	console.log('<original mdsjunction text file> <findspliceevent output.gz> output updated mdsjunction data to STDOUT')
	process.exit()
}

const oldfile=process.argv[2]
const tabixfile=process.argv[3]



const fs=require('fs')
const readline=require('readline')
const exec=require('child_process').execSync

const rl=readline.createInterface({
	input:fs.createReadStream(oldfile)
})


rl.on('line',line=>{

	if(line[0]=='#') {
		console.log(line)
		return
	}

	const l=line.split('\t')
	const chr=l[0]
	const start=l[1]
	const stop=l[2]
	
	const tmp=exec('tabix '+tabixfile+' '+chr+':'+start+'-'+stop,{encoding:'ascii',maxBuffer:1024000000}).trim().split('\n')

	/*
	for the case of FAM133B and FAM133DP
	junctions at this position can appear twice in spliceevent output, one for each gene name
	they should be merged
	*/

	const matchlines = []
	for(const line2 of tmp) {
		const l2=line2.split('\t')
		if(l2[1]==start && l2[2]==stop) {
			matchlines.push( line2 )
		}
	}

	if(matchlines.length==0) {
		// no match, output original line
		console.log(line)
		return
	}

	if(matchlines.length==1) {
		console.log(matchlines[0])
		return
	}

	/*
	multiple event annotations for this junction

	{
		events:{
		},
		samples:[
		]
	}

	each annotation should have the same number of samples
	*/

	const lst = matchlines[0].split('\t')
	const j = JSON.parse( lst[5] )

	for(let i=1; i<matchlines.length; i++) {

		const k = JSON.parse(matchlines[i].split('\t')[5])

		// max event id that's already in j.events
		let eventid = 0
		for(const idstr in j.events) eventid = Math.max( eventid, Number.parseInt(idstr) )

		// add k events to j, in the meantime change event id; record old/new id name mapping
		const oldid2new = new Map()

		for(const oldid in k.events) {

			const newid = (++eventid).toString()

			oldid2new.set( oldid, newid )

			j.events[ newid ] = k.events[ oldid ]
		}

		// copy sample info from k to j
		for(const sj of j.samples) {

			const sk = k.samples.find( x=> x.id==sj.id )
			if(sk && sk.events) {

				for(const oldid in sk.events) {

					const newid = oldid2new.get(oldid)
					if(newid) {
						sj.events[ newid ] = sk.events[oldid]
					}
				}
			}
		}
	}

	lst[5] = JSON.stringify( j )
	console.log(lst.join('\t'))
})
