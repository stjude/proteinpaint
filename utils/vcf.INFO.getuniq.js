if(process.argv.length!=4) {
	console.log('<vcf file> <INFO field name> output uniq values to stdout')
	process.exit()
}


const infile = process.argv[2]
const fieldname = process.argv[3]+'='


const fs=require('fs')
const readline = require('readline')


const rl = readline.createInterface({input:fs.createReadStream( infile, {encoding:'utf8'} ) })


const set = new Set()

rl.on('line',line=>{
	if(line[0]=='#') return

	const a = line.split('\t')[7].split(';').find( i=> i.startsWith( fieldname ) )
	if(!a) return
	
	for(const s of a.split('=')[1].split(',')) {
		set.add(s)
	}
})

rl.on('close',()=>{
	console.log([...set])
})
