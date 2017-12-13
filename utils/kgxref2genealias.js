const fs=require('fs')

if(process.argv.length!=3) {
	console.log('<kgxref.txt> output to stdout')
	process.exit()
}


const data={}
for(const line of fs.readFileSync(process.argv[2],'utf8').trim().split('\n')) {
	const l=line.trim().split('\t')
	const symbol=l[5-1]
	if(symbol) {
		const s2=symbol.toUpperCase()
		if(!data[s2]) {
			data[s2]=[]
		}
		if(l[0]) data[s2].push(l[0].toUpperCase())
		if(l[1]) data[s2].push(l[1].toUpperCase())
		if(l[2]) data[s2].push(l[2].toUpperCase())
		if(l[3]) data[s2].push(l[3].replace('_HUMAN','').toUpperCase())
	}
}

for(const n in data) {
	console.log(n+'\t'+data[n].join('\t'))
}
