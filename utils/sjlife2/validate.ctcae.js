if(process.argv.length!=4) {
	console.log('<phenotree file> <outcomes file>')
	process.exit()
}

/*
load outcome terms from phenotree:
level 2: organ system
level 3: grouped condition
level 4: individual condition

use that to validate terms in "outcomes" file and find any mismatch

output minimied outcome data with following fields:
1. patient
2. graded condition
3. grade
4. age graded

*/

const phenotreefile = process.argv[2]
const outcomefile = process.argv[3]


const fs=require('fs')
const readline=require('readline')

// condition terms from phenotree, to sum up number of each grade, and find inconsistency with outcome file
const L1words=new Map(),
	L2words=new Map(),
	L3words=new Map(),
	L4words=new Map()
// k: word, v: { grade:count }


const lines = fs.readFileSync(phenotreefile,{encoding:'utf8'}).trim().split('\n')
for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')

	const w1 = l[1]=='-' ? null : l[1].trim()
	if(w1!='CTCAE Graded Events') continue
	const w2 = l[2]=='-' ? null : l[2].trim()
	const w3 = l[3]=='-' ? null : l[3].trim()
	const w4 = l[4]=='-' ? null : l[4].trim()

	if(w1) L1words.set(w1, new Map())
	if(w2) L2words.set(w2, new Map())
	if(w3) L3words.set(w3, new Map())
	if(w4) L4words.set(w4, new Map())
}





const rl = readline.createInterface({input:fs.createReadStream(outcomefile)})

let first=true
const L1err = new Set(),
	L2err = new Set(),
	L3err = new Set(),
	L4err = new Set()

const patient2condition = new Map()
/*
k: patient
v: {}
   k: condition
   v: [ {grade,age}, {} ]
*/


rl.on('line',line=>{
	if(first) {
		first=false
		return
	}
	/*
	1	sjlid	SJL1758307
	2	wgs_sequenced	1
	3	ctcae_graded	1
	4	root	Outcomes
	5	first	CTCAE Graded Events
	6	second	Cardiovascular System
	7	third	Arrhythmias
	8	fourth	Cardiac dysrhythmia
	9	agegraded	49.783561644
	10	yearstoevent	34.78630137
	11	grade	0
	*/

	const l = line.split('\t')
	const w1 = l[5-1].replace(/"/g,'')
	const w2 = l[6-1].replace(/"/g,'')
	const w3 = l[7-1].replace(/"/g,'')
	const w4 = l[8-1].replace(/"/g,'')

	const patient = l[0]
	const condition = w4 ? w4 : (w3 ? w3 : w2)
	if(!condition) console.error('unknown condition')
	const age = Number(l[ 9-1 ])
	if(Number.isNaN(age)) console.error('invalid age',l[9-1])
	const yearstoevent = Number( l[ 10-1 ] )
	if(Number.isNaN(yearstoevent)) console.error('invalid yearstoevent')
	const grade = Number( l[ 11-1 ] )
	if(!Number.isInteger(grade)) console.error('grade is not integer',l[11-1])

	// count grade for each condition
	if( w1 ) {
		if( L1words.has(w1) ) {
			L1words.get(w1).set( grade, 1+(L1words.get(w1).get(grade)||0) )
		} else {
			L1err.add(w1)
		}
	}
	if( w2 ) {
		if( L2words.has(w2) ) {
			L2words.get(w2).set( grade, 1+(L2words.get(w2).get(grade)||0) )
		} else {
			L2err.add(w2)
		}
	}
	if( w3 ) {
		if( L3words.has(w3) ) {
			L3words.get(w3).set( grade, 1+(L3words.get(w3).get(grade)||0) )
		} else {
			L3err.add(w3)
		}
	}
	if( w4 ) {
		if( L4words.has(w4) ) {
			L4words.get(w4).set( grade, 1+(L4words.get(w4).get(grade)||0) )
		} else {
			L4err.add(w4)
		}
	}

	// output row for this event
	console.log(patient+'\t'+condition+'\t'+grade+'\t'+age+'\t'+yearstoevent)

	// record event for this patient
	if(!patient2condition.has(patient)) {
		patient2condition.set( patient, {})
	}
	if(!patient2condition.get(patient)[condition]) {
		patient2condition.get(patient)[condition] = []
	}
	patient2condition.get(patient)[condition].push( { grade, age, yearstoevent } )
})

rl.on('close',()=>{
	if(L1err.size) for(const w of L1err) console.error('First branch mismatch:', w)
	if(L2err.size) for(const w of L2err) console.error('Second branch mismatch:', w)
	if(L3err.size) for(const w of L3err) console.error('Third branch mismatch:', w)
	if(L4err.size) for(const w of L4err) console.error('Forth branch mismatch:', w)

	let numberofevents=0
	const conditions=new Set()

	for(const [patient,o] of patient2condition) {

		const o2 = {}
		for(const k in o) {
			conditions.add(k)
			numberofevents+=o[k].length
			o2[k] = { conditionevents: o[k] }
		}

		// do not log this
		//console.log(patient+'\t'+JSON.stringify(o2))
	}
	console.error(patient2condition.size+' patients, '+conditions.size+' conditions, '+numberofevents+' events')

	for(const [w,o] of L1words) {
		console.error('L1',w)
		for(const [g,c] of o) {
			console.error('\tgrade '+g+': '+c)
		}
	}
	for(const [w,o] of L2words) {
		console.error('L2',w)
		for(const [g,c] of o) {
			console.error('\tgrade '+g+': '+c)
		}
	}
	for(const [w,o] of L3words) {
		console.error('L3',w)
		for(const [g,c] of o) {
			console.error('\tgrade '+g+': '+c)
		}
	}
	for(const [w,o] of L4words) {
		console.error('L4',w)
		for(const [g,c] of o) {
			console.error('\tgrade '+g+': '+c)
		}
	}
})
