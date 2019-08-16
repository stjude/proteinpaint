if(process.argv.length!=3) {
	console.log('<r2 file> output to stdout')
	process.exit()
}


/*
1	L1	chr10.61901276.C.G
2	L2	chr10.61901581.T.C
3	D'	1.0
4	LOD	190.82
5	r^2	1.0
6	CIlow	0.99
7	CIhi	1.0
8	Dist	305
9	T-int	446.61

*/


const infile = process.argv[2]
const fs = require('fs')
const readline = require('readline')

const rl = readline.createInterface({input:fs.createReadStream( infile )})
let isfirst = true
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
	if(start >= stop) throw 'start>stop: '+start+' '+stop
	console.log(chr+'\t'+start+'\t'+stop+'\t'+l[4])
})
