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

const L1words=new Set(),
	L2words=new Set(),
	L3words=new Set(),
	L4words=new Set()

const lines = fs.readFileSync(phenotreefile,{encoding:'utf8'}).trim().split('\n')
for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')

	const w1 = l[1]=='-' ? null : l[1].trim()
	const w2 = l[2]=='-' ? null : l[2].trim()
	const w3 = l[3]=='-' ? null : l[3].trim()
	const w4 = l[4]=='-' ? null : l[4].trim()

	if(w1) L1words.add(w1)
	if(w2) L2words.add(w2)
	if(w3) L3words.add(w3)
	if(w4) L4words.add(w4)
}

/*
console.log('L1',L1words.size)
console.log('L2',L2words.size)
console.log('L3',L3words.size)
console.log('L4',L4words.size)
*/





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

const grade2count = new Map()

rl.on('line',line=>{
	if(first) {
		first=false
		return
	}
	const l = line.split('\t')
	const w1 = l[5-1].replace(/"/g,'')
	const w2 = l[6-1].replace(/"/g,'')
	const w3 = l[7-1].replace(/"/g,'')
	const w4 = l[8-1].replace(/"/g,'')
	if(w1 && !L1words.has(w1)) L1err.add(w1)
	if(w2 && !L2words.has(w2)) L2err.add(w2)
	if(w3 && !L3words.has(w3)) L3err.add(w3)
	if(w4 && !L4words.has(w4)) L4err.add(w4)

	const patient = l[0]
	const condition = w4 ? w4 : (w3 ? w3 : w2)
	if(!condition) console.error('unknown condition')
	const age = Number(l[ 9-1 ])
	if(Number.isNaN(age)) console.error('invalid age',l[9-1])
	const grade = Number(l[ 10-1 ])
	if(Number.isNaN(grade)) console.error('invalid grade',l[10-1])
	if(!grade2count.has(grade)) grade2count.set(grade,0)
	grade2count.set( grade, 1+grade2count.get(grade) )

	if(!patient2condition.has(patient)) {
		patient2condition.set( patient, {})
	}
	if(!patient2condition.get(patient)[condition]) {
		patient2condition.get(patient)[condition] = []
	}
	patient2condition.get(patient)[condition].push( { grade, age } )
})

rl.on('close',()=>{
	if(L1err.size) for(const w of L1err) console.error('First branch:', w)
	if(L2err.size) for(const w of L2err) console.error('Second branch:', w)
	if(L3err.size) for(const w of L3err) console.error('Third branch:', w)
	if(L4err.size) for(const w of L4err) console.error('Forth branch:', w)

	let numberofevents=0
	const conditions=new Set()

	for(const [patient,o] of patient2condition) {

		const o2 = {}
		for(const k in o) {
			conditions.add(k)
			numberofevents+=o[k].length
			o2[k] = { conditionevents: o[k] }
		}

		console.log(patient+'\t'+JSON.stringify(o2))
	}
	console.error(patient2condition.size+' patients, '+conditions.size+' conditions, '+numberofevents+' events')

	for(const [g,c] of grade2count) {
		console.error('Grade '+g+': '+c)
	}
})
