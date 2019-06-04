if(process.argv.length!=4) {
	console.log('<phenotree file> <outcomes file>')
	process.exit()
}

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

console.log('L1',L1words.size)
console.log('L2',L2words.size)
console.log('L3',L3words.size)
console.log('L4',L4words.size)


const rl = readline.createInterface({input:fs.createReadStream(outcomefile)})
let first=true
const L1err = new Set(),
	L2err = new Set(),
	L3err = new Set(),
	L4err = new Set()

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
})
rl.on('close',()=>{
	if(L1err.size) for(const w of L1err) console.log('First branch:', w)
	if(L2err.size) for(const w of L2err) console.log('Second branch:', w)
	if(L3err.size) for(const w of L3err) console.log('Third branch:', w)
	if(L4err.size) for(const w of L4err) console.log('Forth branch:', w)
})
