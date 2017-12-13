if(process.argv.length!=4) {
	console.log('<input bed file> <output bedj file basename>')
	process.exit()
}

const bedfile = process.argv[2]
const outfile = process.argv[3]
const tmpfile = Math.random().toString()


const fs = require('fs')
const exec = require('child_process').execSync


//const fout = fs.createWriteStream( outfile )

let scoreinvalid = 0

const out = []

const maxscore = 100

for(const line of fs.readFileSync(bedfile,{encoding:'utf8'}).trim().split('\n')) {
	const l = line.split('\t')

	const j = {}

	if(l[4]) {
		// has score field
		const score = Number.parseInt(l[4])
		if(Number.isNaN(score)) {
			scoreinvalid++
			continue
		}

		j.color = 'rgba(4,110,145,'+( score > maxscore ? 1 : (score/maxscore).toFixed(2) )+')'
	} else {
		// no score field
	}

	//fs.writeSync( fout, l[0]+'\t'+l[1]+'\t'+l[2]+'\t'+JSON.stringify( j ) )
	//out.push( l[0]+'\t'+l[1]+'\t'+l[2]+'\t'+JSON.stringify( j ) )
	out.push( l[0]+'\t'+l[1]+'\t'+l[2]+'\t{}' )
}

//fs.closeSync( fout )

if(scoreinvalid) {
	console.error(scoreinvalid+' lines with invalid score')
}


fs.writeFileSync( outfile, out.join('\n') )

exec('sort -k1,1 -k2,2n '+outfile+' > '+tmpfile)
exec('mv '+tmpfile+' '+outfile)
exec('bgzip -f '+outfile)
exec('tabix -p bed -f '+outfile+'.gz')
