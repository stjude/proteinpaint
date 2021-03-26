if(process.argv.length!=3) {
	console.log('<input bed file>')
	process.exit()
}


/*
1	591	591
2	chr1	chr1
3	894640	894641
4	894654	894657
5	V$P300_01	V$ELK1_01
6	842	898
7	-	-
8	1.68	2.7
*/


const bedfile = process.argv[2]


const fs = require('fs')
const exec = require('child_process').execSync
const readline = require('readline')

//const fout = fs.createWriteStream( outfile )

let scoreinvalid = 0

const out = []

const maxscore = 1000


const rl = readline.createInterface({input:fs.createReadStream(bedfile)})

rl.on('line',line=>{

	const l = line.split('\t')

	const j = {name:l[4]}

	if(l[5]) {
		// has score field
		const score = Number.parseInt(l[5])
		if(Number.isNaN(score)) {
			scoreinvalid++
			return
		}

		j.color = 'rgba(4,110,145,'+( score > maxscore ? 1 : (score/maxscore).toFixed(2) )+')'
	} else {
		// no score field
	}

	console.log( l[1]+'\t'+l[2]+'\t'+l[3]+'\t'+JSON.stringify(j) )
})

