
const infile = process.argv[2]

if(!infile) {
	console.log('<input bedgraph file> output cleaned lines to stdout, error lines to stderr')
	process.exit()
}


const fs=require('fs')
const readline=require('readline')

const rl = readline.createInterface({input: fs.createReadStream(infile,{encoding:'utf8'})})
rl.on('line',line=>{
	if(line.startsWith('track')) return
	const l = line.split('\t')
	const start = Number.parseInt(l[1])
	const stop = Number.parseInt(l[2])
	if(Number.isNaN(start) || Number.isNaN(stop) || start<0 || stop<0 || start>stop) {
		console.error(line)
		return
	}
	console.log(l[0]+'\t'+start+'\t'+stop+'\t'+l[3])
})
