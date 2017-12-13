const fs=require('fs')
const exec=require('child_process').execSync

if(process.argv.length!=3) {
	console.log('<fragment file> output to stdout')
	process.exit()
}


const infile = process.argv[2]

const lines=fs.readFileSync(infile,'utf8').trim().split('\n')
for(const line of lines) {
	const l=line.split(' ')
	const chr = l[0]
	for(let i=1; i<l.length; i++) {
		const start = i==1 ? 0 : l[i-1]
		const stop = l[i]
		console.log(chr+'\t'+start+'\t'+stop+'\t'+(i-1))
	}
}
