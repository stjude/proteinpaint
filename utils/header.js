if(process.argv.length<=2) {
	console.log('<in file> <line # from 1>')
	process.exit()
}


const fs=require('fs'),
	readline = require('readline')


const infile=process.argv[2]
let linenum=process.argv[3]

if(linenum) {
	linenum=Number.parseInt(linenum)
	if(Number.isNaN(linenum)) linenum=2
} else {
	linenum=2
}


let i=1
let hlst=[]

const fin = fs.createReadStream(infile, {encoding:'utf8'})
const rl = readline.createInterface({input: fin})

rl.on('line',line=>{

	if(line[0]=='#') return
	if(i==1) {
		hlst=line.split('\t')
		i++
		return
	}
	if(i==linenum) {
		const look=line.split('\t')
		for(let j=0; j<hlst.length; j++) {
			console.log('%d\t%s\t%s', j+1, hlst[j], look[j])
		}
		fin.close()
	}
	i++
})
