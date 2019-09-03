if(process.argv.length!=3) {
	console.log('<r2 file> output to stdout')
	process.exit()
}


/*
1	L1	chr10.61901276.C.G
2	L2	chr10.61901581.T.C
3	r2

*/


const infile = process.argv[2]
const fs = require('fs')
const readline = require('readline')

const rl = readline.createInterface({input:fs.createReadStream( infile )})
let isfirst = true

let wrong=0
let skipr2=0

rl.on('line',line=>{
	if(isfirst) {
		isfirst=false
		return
	}
	const l = line.split('\t')
	const tmp = l[0].split('.')
	const chr = tmp[0]
	const start = Number(tmp[1])-1
	const stop = Number(l[1].split('.')[1])-1
	if(start >= stop) {
		wrong++
		return
	}

	const r2 = Number(l[2])
	if(r2<=0.1) {
		skipr2++
		return
	}

	console.log(chr+'\t'+start+'\t'+stop+'\t'+r2)
})
rl.on('close',()=>{
	console.error(infile+': '+skipr2+' lines skipped with r2<=.1; '+wrong+' lines with wrong start/stop')
})
